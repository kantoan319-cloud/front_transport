import { useMemo, useState } from 'react'
import MapCanvas, { type MapLine, type MapPoint } from '../MapCanvas'
import { useApp, useAsync } from './components'
import { izApi, type IZRecord } from './api'

export type TracePoint = { latitude: number; longitude: number }
export type TraceData = { aller: TracePoint[]; retour: TracePoint[] }

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function readPoints(value: unknown): TracePoint[] {
  if (!Array.isArray(value)) return []
  const points: TracePoint[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const latitude = toNumber(row.latitude)
    const longitude = toNumber(row.longitude)
    if (latitude !== null && longitude !== null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      points.push({ latitude, longitude })
    }
  }
  return points
}

export function readTrace(value: unknown): TraceData {
  let source = value
  if (typeof source === 'string') {
    try { source = JSON.parse(source) } catch { source = {} }
  }
  const record = source && typeof source === 'object' ? source as Record<string, unknown> : {}
  return { aller: readPoints(record.aller), retour: readPoints(record.retour) }
}

function findStop(stops: IZRecord[], query: string): IZRecord | null {
  const value = query.trim().toLocaleLowerCase()
  if (!value) return null
  return stops.find((stop) => String(stop.nom ?? '').toLocaleLowerCase() === value)
    ?? stops.find((stop) => String(stop.nom ?? '').toLocaleLowerCase().includes(value))
    ?? null
}

function nearestIndex(points: TracePoint[], target: TracePoint): number {
  let best = 0
  let distance = Number.POSITIVE_INFINITY
  points.forEach((point, index) => {
    const current = (point.latitude - target.latitude) ** 2 + (point.longitude - target.longitude) ** 2
    if (current < distance) { distance = current; best = index }
  })
  return best
}

type Layer = 'lignes' | 'arrets' | 'vehicules' | 'incidents'

export function NetworkMap() {
  const { theme, notify } = useApp()
  const [center, setCenter] = useState({ latitude: -19.865, longitude: 47.033 })
  const [zoom, setZoom] = useState(13)
  const [basemap, setBasemap] = useState<'plan' | 'satellite'>('plan')
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')
  const [query, setQuery] = useState('')
  const [departure, setDeparture] = useState('')
  const [arrival, setArrival] = useState('')
  const [route, setRoute] = useState<TracePoint[]>([])
  const [avoidTraffic, setAvoidTraffic] = useState(true)
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    lignes: true, arrets: true, vehicules: false, incidents: false,
  })
  const [geoStatus, setGeoStatus] = useState('')

  const { data: lines } = useAsync(() => izApi.lines(), [])
  const { data: vehicles } = useAsync(() => izApi.map(), [])
  const { data: incidents } = useAsync(() => izApi.incidents(), [])
  const { data: rawStops } = useAsync(async () => {
    const list = await Promise.all((lines ?? []).map(async (line) => {
      const stops = await izApi.stops(line.id)
      return stops.map((stop) => ({ ...stop, lineId: line.id, cooperativeCode: line.cooperativeCode }))
    }))
    return list.flat()
  }, [lines])

  const stops = useMemo<IZRecord[]>(() => rawStops ?? [], [rawStops])
  const stopOptions = useMemo(
    () => stops.map((stop) => String(stop.nom ?? '')).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [stops],
  )

  const mapLines = useMemo<MapLine[]>(() => {
    const result: MapLine[] = []
    if (layers.lignes) {
      for (const line of lines ?? []) {
        const trace = readTrace(line.trace)
        const color = String(line.couleur ?? '#2563eb')
        for (const [sens, points] of [['aller', trace.aller], ['retour', trace.retour]] as const) {
          if (points.length > 1) {
            result.push({ key: `ligne-${line.id}-${sens}`, color, points })
          }
        }
      }
    }
    if (route.length > 1) {
      result.push({ key: 'itineraire', color: '#dc2626', points: route })
    }
    return result
  }, [layers.lignes, lines, route])

  const points = useMemo<MapPoint[]>(() => {
    const result: MapPoint[] = []
    if (layers.arrets) {
      for (const stop of stops) {
        const latitude = toNumber(stop.latitude)
        const longitude = toNumber(stop.longitude)
        if (latitude === null || longitude === null) continue
        result.push({
          key: `arret-${stop.id}`, label: String(stop.nom ?? 'Arrêt'), kind: 'arret',
          color: '#2563eb', latitude, longitude,
        })
      }
    }
    if (layers.vehicules) {
      for (const vehicle of vehicles ?? []) {
        const latitude = toNumber(vehicle.latitude)
        const longitude = toNumber(vehicle.longitude)
        if (latitude === null || longitude === null) continue
        result.push({
          key: `vehicle-${vehicle.id}`, label: String(vehicle.immatriculation ?? 'Véhicule'), kind: 'vehicle',
          color: vehicle.statutLicence === 'Valide' ? '#16a34a' : '#dc2626', latitude, longitude,
        })
      }
    }
    if (layers.incidents) {
      for (const incident of incidents ?? []) {
        const latitude = toNumber(incident.latitude)
        const longitude = toNumber(incident.longitude)
        if (latitude === null || longitude === null) continue
        result.push({
          key: `incident-${incident.id}`, label: String(incident.type ?? 'Incident'), kind: 'signal',
          color: '#f59e0b', latitude, longitude,
        })
      }
    }
    if (query.trim()) {
      const match = findStop(stops, query)
      if (match) {
        const latitude = toNumber(match.latitude)
        const longitude = toNumber(match.longitude)
        if (latitude !== null && longitude !== null) {
          result.push({ key: 'recherche', label: String(match.nom), kind: 'arret', color: '#dc2626', latitude, longitude })
        }
      }
    }
    return result
  }, [layers.arrets, layers.vehicules, layers.incidents, stops, vehicles, incidents, query])

  const filteredStops = useMemo(() => {
    const value = query.trim().toLocaleLowerCase()
    if (!value) return stops.slice(0, 30)
    return stops.filter((stop) => String(stop.nom ?? '').toLocaleLowerCase().includes(value)).slice(0, 30)
  }, [stops, query])

  function calculerItineraire() {
    const depart = findStop(stops, departure)
    const arrivee = findStop(stops, arrival)
    if (!depart || !arrivee) {
      notify('Choisissez un départ et une arrivée dans la liste.', 'error')
      return
    }
    const a: TracePoint = { latitude: Number(depart.latitude), longitude: Number(depart.longitude) }
    const b: TracePoint = { latitude: Number(arrivee.latitude), longitude: Number(arrivee.longitude) }
    let chemin: TracePoint[] = [a, b]
    if (avoidTraffic) {
      for (const line of lines ?? []) {
        const lineStops = stops.filter((stop) => String(stop.lineId ?? stop.line_id) === String(line.id))
        const contient = (point: TracePoint) => lineStops.some((stop) =>
          Math.abs(Number(stop.latitude) - point.latitude) < 0.0001 &&
          Math.abs(Number(stop.longitude) - point.longitude) < 0.0001)
        if (!contient(a) || !contient(b)) continue
        const trace = readTrace(line.trace)
        const sens = nearestIndex(trace.aller, a) <= nearestIndex(trace.aller, b) ? trace.aller : trace.retour
        if (sens.length > 1) {
          const debut = nearestIndex(sens, a)
          const fin = nearestIndex(sens, b)
          chemin = sens.slice(Math.min(debut, fin), Math.max(debut, fin) + 1)
        }
        break
      }
    }
    setRoute(chemin)
    setCenter(a)
    setZoom(15)
    notify(`Itinéraire calculé : ${depart.nom} → ${arrivee.nom}`, 'success')
  }

  function geolocaliser() {
    if (!navigator.geolocation) {
      setGeoStatus('Géolocalisation indisponible sur ce navigateur.')
      return
    }
    setGeoStatus('Recherche de votre position…')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        setZoom(16)
        setGeoStatus('Position trouvée : carte recentrée sur vous.')
      },
      () => setGeoStatus('Géolocalisation refusée – aucune position.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <>
      <div className="iz-page-head">
        <div>
          <h1>Trajets de bus — Commune Urbaine</h1>
          <p>Recherchez un arrêt, tracez un itinéraire et consultez l’état du réseau.</p>
        </div>
        <div className="iz-flex iz-wrap">
          <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setBasemap(basemap === 'plan' ? 'satellite' : 'plan')}>
            {basemap === 'plan' ? '🛰 Satellite' : '🗺 Plan'}
          </button>
          <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')}>
            {viewMode.toUpperCase()}
          </button>
        </div>
      </div>

      <div className="iz-map-layout">
        <div className="iz-map-box">
          <MapCanvas
            points={points}
            lines={mapLines}
            vehicle={null}
            follow={false}
            terrain={viewMode === '3d'}
            focus={null}
            selectedKey=""
            center={center}
            zoom={zoom}
            basemap={basemap}
            viewMode={viewMode}
            night={theme === 'dark'}
            onSelect={() => undefined}
            onMove={(nextCenter, nextZoom) => { setCenter(nextCenter); setZoom(nextZoom) }}
          />
        </div>

        <aside className="iz-card iz-citizen-map-panel">
          <datalist id="iz-arrets">
            {stopOptions.map((name) => <option key={name} value={name} />)}
          </datalist>

          <div className="iz-map-search">
            <input
              className="iz-input"
              list="iz-arrets"
              placeholder="Rechercher un arrêt (nom, ligne…)"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {query.trim() && (
            <div className="iz-map-list iz-map-search-list">
              {filteredStops.length ? filteredStops.map((stop) => (
                <button key={stop.id} onClick={() => {
                  setQuery(String(stop.nom ?? ''))
                  const latitude = toNumber(stop.latitude)
                  const longitude = toNumber(stop.longitude)
                  if (latitude !== null && longitude !== null) { setCenter({ latitude, longitude }); setZoom(16) }
                }}>
                  <strong>{String(stop.nom ?? '')}</strong>
                  <span className="iz-small iz-muted" style={{ display: 'block' }}>{String(stop.cooperativeCode ?? '')}</span>
                </button>
              )) : <p className="iz-muted iz-small">Aucun arrêt trouvé.</p>}
            </div>
          )}

          <h3 className="iz-map-section-title">🧭 Itinéraire</h3>
          <div className="iz-form-grid">
            <label className="iz-field">
              <span className="iz-label">Départ</span>
              <input className="iz-input" list="iz-arrets" value={departure} onChange={(event) => setDeparture(event.target.value)} placeholder="Ex : Gare routière" />
            </label>
            <label className="iz-field">
              <span className="iz-label">Arrivée</span>
              <input className="iz-input" list="iz-arrets" value={arrival} onChange={(event) => setArrival(event.target.value)} placeholder="Ex : Hôpital" />
            </label>
          </div>
          <label className="iz-check-row">
            <input type="checkbox" checked={avoidTraffic} onChange={(event) => setAvoidTraffic(event.target.checked)} />
            <span>Éviter les embouteillages</span>
          </label>
          <button className="iz-btn iz-btn-primary iz-btn-sm" style={{ width: '100%' }} onClick={calculerItineraire}>
            Calculer l’itinéraire
          </button>
          {route.length > 1 && (
            <p className="iz-small iz-muted" style={{ marginTop: 8 }}>
              {Math.max(0, route.length - 1)} segment{route.length > 2 ? 's' : ''} · {avoidTraffic ? 'tracé optimisé' : 'tracé direct'}
            </p>
          )}

          <h3 className="iz-map-section-title">🚦 État du trafic</h3>
          <div className="iz-traffic-status">
            <span className="iz-dot iz-badge-green" />
            <span>{incidents?.length ? `${incidents.length} incident${incidents.length > 1 ? 's' : ''} signalé${incidents.length > 1 ? 's' : ''}` : 'Aucun embouteillage détecté.'}</span>
          </div>

          <h3 className="iz-map-section-title">🗂 Couches</h3>
          <div className="iz-layer-grid">
            {([['lignes', 'Lignes'], ['arrets', 'Arrêts'], ['vehicules', 'Véhicules'], ['incidents', 'Incidents']] as const).map(([key, label]) => (
              <label className="iz-check-row" key={key}>
                <input
                  type="checkbox"
                  checked={layers[key]}
                  onChange={(event) => setLayers({ ...layers, [key]: event.target.checked })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <h3 className="iz-map-section-title">🕘 Historique incidents</h3>
          <div className="iz-map-list iz-map-incidents">
            {incidents?.length ? incidents.slice(0, 8).map((incident) => (
              <div key={incident.id} className="iz-incident-row">
                <strong>{String(incident.type ?? 'Incident')}</strong>
                <span className="iz-small iz-muted">{String(incident.adresse ?? incident.createdAt ?? '')}</span>
                <span className="iz-badge iz-badge-orange">{String(incident.statut ?? '')}</span>
              </div>
            )) : <p className="iz-muted iz-small">Aucun incident enregistré.</p>}
          </div>

          <h3 className="iz-map-section-title">🎯 Légende</h3>
          <div className="iz-legend">
            <span><i style={{ background: '#2563eb' }} /> Arrêt</span>
            <span><i style={{ background: '#dc2626' }} /> Itinéraire</span>
            <span><i style={{ background: '#16a34a' }} /> Véhicule conforme</span>
            <span><i style={{ background: '#f59e0b' }} /> Incident</span>
          </div>

          <button className="iz-btn iz-btn-outline iz-btn-sm" style={{ width: '100%', marginTop: 14 }} onClick={geolocaliser}>
            ⌖ Me géolocaliser
          </button>
          {geoStatus && <p className="iz-small iz-muted" style={{ marginTop: 6 }}>{geoStatus}</p>}
        </aside>
      </div>
    </>
  )
}
