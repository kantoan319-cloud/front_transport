import { useEffect, useMemo, useRef, useState } from 'react'
import MapCanvas, { type MapLine, type MapPoint, type MapVehiclePosition } from '../MapCanvas'
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

// Repli honnete quand aucune trace GPS n'est enregistree : on suit l'ordre des
// arrets geolocalises de la ligne (les liaisons entre arrets sont estimees).
function stopTrace(list: IZRecord[], lineId: string, direction: keyof TraceData): TracePoint[] {
  const points = list
    .filter((stop) => String(stop.lineId) === lineId)
    .sort((a, b) => (Number(a.ordre) || 0) - (Number(b.ordre) || 0) || Number(a.id) - Number(b.id))
    .map((stop) => ({ latitude: toNumber(stop.latitude), longitude: toNumber(stop.longitude) }))
    .filter((point): point is TracePoint => point.latitude !== null && point.longitude !== null)
  return direction === 'retour' ? points.reverse() : points
}

function findStop(stops: IZRecord[], query: string): IZRecord | null {
  const value = query.trim().toLocaleLowerCase()
  if (!value) return null
  return stops.find((stop) => String(stop.nom ?? '').toLocaleLowerCase() === value)
    ?? stops.find((stop) => String(stop.nom ?? '').toLocaleLowerCase().includes(value))
    ?? null
}

function distanceMeters(a: TracePoint, b: TracePoint): number {
  const radians = Math.PI / 180
  const latitude = (b.latitude - a.latitude) * radians
  const longitude = (b.longitude - a.longitude) * radians
  const h = Math.sin(latitude / 2) ** 2
    + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(longitude / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}

function bearingBetween(a: TracePoint, b: TracePoint): number {
  const radians = Math.PI / 180
  const longitude = (b.longitude - a.longitude) * radians
  const y = Math.sin(longitude) * Math.cos(b.latitude * radians)
  const x = Math.cos(a.latitude * radians) * Math.sin(b.latitude * radians)
    - Math.sin(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.cos(longitude)
  return (Math.atan2(y, x) / radians + 360) % 360
}

function nearestIndex(points: TracePoint[], target: TracePoint): number {
  let best = 0
  let distance = Number.POSITIVE_INFINITY
  points.forEach((point, index) => {
    const current = distanceMeters(point, target)
    if (current < distance) { distance = current; best = index }
  })
  return best
}

const SIMULATION_SPEED_KMH = 30

type SimulationSegment = { from: TracePoint; to: TracePoint; start: number; end: number; bearing: number }

function simulationSegments(points: TracePoint[]): SimulationSegment[] {
  const segments: SimulationSegment[] = []
  let distance = 0
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]
    const to = points[index]
    const length = distanceMeters(from, to)
    if (length === 0) continue
    segments.push({ from, to, start: distance, end: distance + length, bearing: bearingBetween(from, to) })
    distance += length
  }
  return segments
}

function positionOnTrace(segments: SimulationSegment[], distance: number, headlights: boolean): MapVehiclePosition | null {
  const segment = segments.find((item) => item.end > distance) ?? segments[segments.length - 1]
  if (!segment) return null
  const progress = Math.max(0, Math.min(1, (distance - segment.start) / (segment.end - segment.start)))
  return {
    latitude: segment.from.latitude + (segment.to.latitude - segment.from.latitude) * progress,
    longitude: segment.from.longitude + (segment.to.longitude - segment.from.longitude) * progress,
    bearing: segment.bearing,
    headlights,
  }
}

type Layer = 'lignes' | 'arrets' | 'vehicules' | 'incidents'
type MapFocus = TracePoint & { zoom: number; pitch: number; bearing: number; key: number }

export function NetworkMap() {
  const { notify, navigate } = useApp()
  const [center, setCenter] = useState({ latitude: -19.865, longitude: 47.033 })
  const [zoom, setZoom] = useState(13)
  const [basemap, setBasemap] = useState<'plan' | 'satellite'>('plan')
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d')
  const [night, setNight] = useState(false)
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const [simulationLineId, setSimulationLineId] = useState('')
  const [direction, setDirection] = useState<keyof TraceData>('aller')
  const [playing, setPlaying] = useState(false)
  const [follow, setFollow] = useState(true)
  const [simulationDistance, setSimulationDistance] = useState(0)
  const distanceRef = useRef(0)
  const [query, setQuery] = useState('')
  const [departure, setDeparture] = useState('')
  const [arrival, setArrival] = useState('')
  const [route, setRoute] = useState<TracePoint[]>([])
  const [routeStatus, setRouteStatus] = useState('')
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    lignes: true, arrets: true, vehicules: false, incidents: false,
  })
  const [geoStatus, setGeoStatus] = useState('')

  const { data: lines, loading: linesLoading, error: linesError } = useAsync(() => izApi.lines(), [])
  const { data: vehicles } = useAsync(() => izApi.map(), [])
  const { data: incidents, loading: incidentsLoading, error: incidentsError } = useAsync(() => izApi.incidents(), [])
  const { data: rawStops } = useAsync(async () => {
    const list = await Promise.all((lines ?? []).map(async (line) => {
      const stops = await izApi.stops(line.id)
      return stops.map((stop) => ({ ...stop, lineId: line.id, cooperativeCode: line.cooperativeCode }))
    }))
    return list.flat()
  }, [lines])

  const stops = useMemo<IZRecord[]>(() => rawStops ?? [], [rawStops])
  const stopOptions = useMemo(
    () => [...new Set(stops.map((stop) => String(stop.nom ?? '')).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [stops],
  )
  const simulationLine = (lines ?? []).find((line) => String(line.id) === simulationLineId)
  const recordedTrace = useMemo(() => readTrace(simulationLine?.trace)[direction], [simulationLine, direction])
  const fallbackTrace = useMemo(
    () => (simulationLine ? stopTrace(stops, String(simulationLine.id), direction) : []),
    [stops, simulationLine, direction],
  )
  const estimatedTrace = recordedTrace.length < 2 && fallbackTrace.length > 1
  const simulationTrace = estimatedTrace ? fallbackTrace : recordedTrace
  const segments = useMemo(() => simulationSegments(simulationTrace), [simulationTrace])
  const totalDistance = segments[segments.length - 1]?.end ?? 0
  const simulatedVehicle = useMemo(
    () => positionOnTrace(segments, simulationDistance, night),
    [segments, simulationDistance, night],
  )
  const simulationStatus = !simulatedVehicle ? 'Indisponible'
    : playing ? 'En cours' : simulationDistance >= totalDistance ? 'Terminée' : simulationDistance > 0 ? 'En pause' : 'Prête'

  useEffect(() => {
    if (!playing || totalDistance === 0) return
    let frame = 0
    let previous = 0
    const advance = (time: number) => {
      // Pas de rattrapage du trajet lorsque l'onglet revient au premier plan.
      if (!previous || document.hidden) {
        previous = time
        frame = requestAnimationFrame(advance)
        return
      }
      const elapsed = time - previous
      if (elapsed >= 1000 / 30) {
        previous = time
        const distance = Math.min(totalDistance, distanceRef.current
          + Math.min(elapsed, 250) / 1000 * (SIMULATION_SPEED_KMH / 3.6))
        distanceRef.current = distance
        setSimulationDistance(distance)
        if (distance >= totalDistance) {
          setPlaying(false)
          return
        }
      }
      frame = requestAnimationFrame(advance)
    }
    frame = requestAnimationFrame(advance)
    return () => cancelAnimationFrame(frame)
  }, [playing, segments, totalDistance])

  function focusMap(point: TracePoint, nextZoom: number, bearing = 0) {
    setCenter({ latitude: point.latitude, longitude: point.longitude })
    setZoom(nextZoom)
    setFocus((current) => ({
      latitude: point.latitude, longitude: point.longitude, zoom: nextZoom,
      pitch: viewMode === '3d' ? 55 : 0, bearing, key: (current?.key ?? 0) + 1,
    }))
  }

  function toggleSimulation() {
    if (playing) { setPlaying(false); return }
    if (!simulatedVehicle) return
    const finished = distanceRef.current >= totalDistance
    if (finished) {
      distanceRef.current = 0
      setSimulationDistance(0)
    }
    const position = finished ? positionOnTrace(segments, 0, night)! : simulatedVehicle
    focusMap(position, 17.5, follow ? position.bearing : 0)
    setPlaying(true)
  }

  function clearSimulation() {
    setPlaying(false)
    distanceRef.current = 0
    setSimulationDistance(0)
  }

  function resetSimulation() {
    clearSimulation()
    const position = positionOnTrace(segments, 0, night)
    if (position) focusMap(position, 17.5, follow ? position.bearing : 0)
  }

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
    if (totalDistance > 0) {
      result.push({ key: 'simulation', color: '#7c3aed', points: simulationTrace })
    }
    return result
  }, [layers.lignes, lines, route, simulationTrace, totalDistance])

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
          key: `vehicle-${vehicle.id}`,
          label: `${String(vehicle.immatriculation ?? 'Véhicule')}${vehicle.statut ? ` · ${String(vehicle.statut)}` : ''}`,
          kind: 'vehicle', color: '#64748b', latitude, longitude,
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
    setRoute([])
    const unavailable = (message: string) => {
      setRouteStatus(message)
      notify(message, 'error')
    }
    const depart = findStop(stops, departure)
    const arrivee = findStop(stops, arrival)
    if (!depart || !arrivee) {
      unavailable('Choisissez un départ et une arrivée dans la liste.')
      return
    }
    const a = readPoints([depart])[0]
    const b = readPoints([arrivee])[0]
    if (!a || !b) {
      unavailable('Itinéraire indisponible : coordonnées des arrêts manquantes.')
      return
    }
    for (const line of lines ?? []) {
      const lineStops = stops.filter((stop) => String(stop.lineId ?? stop.line_id) === String(line.id))
      const contient = (point: TracePoint) => lineStops.some((stop) => {
        const latitude = toNumber(stop.latitude)
        const longitude = toNumber(stop.longitude)
        return latitude !== null && longitude !== null
          && Math.abs(latitude - point.latitude) < 0.0001 && Math.abs(longitude - point.longitude) < 0.0001
      })
      if (!contient(a) || !contient(b)) continue
      const trace = readTrace(line.trace)
      for (const [sens, path] of [['aller', trace.aller], ['retour', trace.retour]] as const) {
        if (path.length < 2) continue
        const debut = nearestIndex(path, a)
        const fin = nearestIndex(path, b)
        // Respecter le sens enregistre, sans inverser ni inventer de segments.
        if (debut >= fin) continue
        setRoute(path.slice(debut, fin + 1))
        setFollow(false)
        focusMap(path[debut], 15)
        setRouteStatus(`${String(line.nom ?? line.code ?? 'Ligne')} · ${sens} · tracé enregistré, sans données de trafic.`)
        notify(`Itinéraire sur la ligne : ${depart.nom} → ${arrivee.nom}`, 'success')
        return
      }
    }
    unavailable('Itinéraire indisponible : aucun tracé exploitable sur une ligne commune dans ce sens. Aucun trajet direct inventé.')
  }

  function geolocaliser() {
    if (!navigator.geolocation) {
      setGeoStatus('Géolocalisation indisponible sur ce navigateur.')
      return
    }
    setGeoStatus('Recherche de votre position…')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFollow(false)
        focusMap({ latitude: position.coords.latitude, longitude: position.coords.longitude }, 16)
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
          <button className="iz-btn iz-btn-outline iz-btn-sm" aria-label="Vue 3D" aria-pressed={viewMode === '3d'} onClick={() => {
            const nextMode = viewMode === '2d' ? '3d' : '2d'
            setViewMode(nextMode)
            setFocus((current) => ({ ...center, zoom, pitch: nextMode === '3d' ? 55 : 0,
              bearing: follow && simulatedVehicle ? simulatedVehicle.bearing : 0, key: (current?.key ?? 0) + 1 }))
          }}>
            {viewMode.toUpperCase()}
          </button>
          <button className="iz-btn iz-btn-outline iz-btn-sm" aria-label="Mode nuit de la carte" aria-pressed={night} onClick={() => setNight(!night)}>
            Carte : {night ? 'Nuit' : 'Jour'}
          </button>
        </div>
      </div>

      <div className="iz-map-layout">
        <div className="iz-map-box">
          <MapCanvas
            points={points}
            lines={mapLines}
            vehicle={simulatedVehicle}
            follow={follow && Boolean(simulatedVehicle)}
            terrain={viewMode === '3d'}
            focus={focus}
            selectedKey=""
            center={center}
            zoom={zoom}
            basemap={basemap}
            viewMode={viewMode}
            night={night}
            onSelect={(key) => {
              const vehicle = (vehicles ?? []).find((item) => `vehicle-${item.id}` === key)
              if (vehicle?.immatriculation) navigate(`/bus?plaque=${encodeURIComponent(String(vehicle.immatriculation))}`)
            }}
            onMove={(nextCenter, nextZoom) => { setCenter(nextCenter); setZoom(nextZoom) }}
          />
          {simulatedVehicle && (
            <div className="iz-card iz-small" style={{ position: 'absolute', top: 12, left: 12, zIndex: 2, padding: '8px 12px', maxWidth: 'calc(100% - 70px)', pointerEvents: 'none' }}>
              <strong>SIMULATION · {simulationStatus}</strong>
              <span style={{ display: 'block' }}>{String(simulationLine?.nom ?? simulationLine?.code ?? 'Ligne')} · {direction}</span>
              <span className="iz-muted">{estimatedTrace ? 'Bus simulé le long des arrêts — liaisons estimées, pas de GPS' : 'Bus simulé — pas de GPS en temps réel'}</span>
            </div>
          )}
        </div>

        <aside className="iz-card iz-citizen-map-panel">
          <h3 className="iz-map-section-title" style={{ marginTop: 0 }}>Simulation du trajet</h3>
          <p className="iz-small iz-muted">
            <strong>SIMULATION</strong> sur le tracé enregistré de la ligne ou, à défaut, le long de ses
            arrêts géolocalisés (liaisons estimées). Le bus animé ne représente pas une position GPS réelle.
          </p>
          <div className="iz-form-grid">
            <label className="iz-field full">
              <span className="iz-label">Ligne à simuler</span>
              <select className="iz-input" value={simulationLineId} disabled={linesLoading || !lines?.length} onChange={(event) => { clearSimulation(); setSimulationLineId(event.target.value) }}>
                <option value="">Choisir une ligne</option>
                {(lines ?? []).map((line) => (
                  <option key={line.id} value={String(line.id)}>{String(line.nom ?? line.code ?? `Ligne ${line.id}`)}</option>
                ))}
              </select>
            </label>
            <label className="iz-field full">
              <span className="iz-label">Sens du tracé</span>
              <select className="iz-input" value={direction} disabled={!simulationLine} onChange={(event) => { clearSimulation(); setDirection(event.target.value as keyof TraceData) }}>
                <option value="aller">Aller</option>
                <option value="retour">Retour</option>
              </select>
            </label>
          </div>
          {!simulatedVehicle && (
            <p className="iz-small iz-muted" role="status">
              {linesLoading ? 'Chargement des lignes…' : linesError ? `Lignes indisponibles : ${linesError}`
                : !lines?.length ? 'Aucune ligne disponible.' : !simulationLine ? 'Choisissez une ligne et un sens pour commencer.'
                  : `Tracé ${direction} absent et moins de deux arrêts géolocalisés : simulation indisponible.`}
            </p>
          )}
          <div className="iz-flex iz-wrap" style={{ marginTop: 12 }}>
            <button className="iz-btn iz-btn-primary iz-btn-sm" disabled={!simulatedVehicle} onClick={toggleSimulation}>
              {playing ? 'Pause' : simulationDistance >= totalDistance && totalDistance > 0 ? 'Rejouer' : simulationDistance > 0 ? 'Reprendre' : 'Démarrer'}
            </button>
            <button className="iz-btn iz-btn-outline iz-btn-sm" disabled={!simulatedVehicle} onClick={resetSimulation}>Réinitialiser</button>
          </div>
          {simulatedVehicle && (
            <div style={{ marginTop: 10 }}>
              <progress aria-label="Progression de la simulation" value={Math.min(simulationDistance, totalDistance)} max={totalDistance} style={{ width: '100%', accentColor: '#7c3aed' }} />
              <p className="iz-small iz-muted" style={{ margin: '4px 0' }}>
                {simulationStatus} · {Math.round(Math.min(1, simulationDistance / totalDistance) * 100)} % · {(totalDistance / 1000).toFixed(1)} km
                <br />Vitesse simulée : {SIMULATION_SPEED_KMH} km/h
              </p>
            </div>
          )}
          <label className="iz-check-row">
            <input type="checkbox" checked={follow} disabled={!simulatedVehicle} onChange={(event) => {
              setFollow(event.target.checked)
              if (event.target.checked && simulatedVehicle) focusMap(simulatedVehicle, 17.5, simulatedVehicle.bearing)
            }} />
            <span>Suivre le bus simulé</span>
          </label>
          {basemap === 'satellite' && <p className="iz-small iz-muted">Les bâtiments 3D et l’éclairage jour/nuit sont disponibles sur le fond Plan.</p>}

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
                  if (latitude !== null && longitude !== null) {
                    setFollow(false)
                    focusMap({ latitude, longitude }, 16)
                  }
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
              <input className="iz-input" list="iz-arrets" value={departure} onChange={(event) => { setDeparture(event.target.value); setRoute([]); setRouteStatus('') }} placeholder="Ex : Gare routière" />
            </label>
            <label className="iz-field">
              <span className="iz-label">Arrivée</span>
              <input className="iz-input" list="iz-arrets" value={arrival} onChange={(event) => { setArrival(event.target.value); setRoute([]); setRouteStatus('') }} placeholder="Ex : Hôpital" />
            </label>
          </div>
          <p className="iz-small iz-muted">Tracé sur une ligne commune uniquement, dans le sens enregistré. Pas de calcul ni d’optimisation selon le trafic.</p>
          <button className="iz-btn iz-btn-primary iz-btn-sm" style={{ width: '100%' }} onClick={calculerItineraire}>
            Calculer l’itinéraire
          </button>
          {routeStatus && <p className="iz-small iz-muted" role="status" style={{ marginTop: 8 }}>{routeStatus}</p>}

          <h3 className="iz-map-section-title">Incidents signalés</h3>
          <div className="iz-traffic-status">
            <span className="iz-dot" style={{ background: '#64748b' }} />
            <span>{incidentsLoading ? 'Chargement des signalements…' : incidentsError ? 'Signalements indisponibles.'
              : incidents?.length ? `${incidents.length} incident${incidents.length > 1 ? 's' : ''} signalé${incidents.length > 1 ? 's' : ''}` : 'Aucun incident signalé.'}</span>
          </div>
          <p className="iz-small iz-muted">Signalements uniquement, sans mesure du trafic en temps réel.</p>

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
            )) : <p className="iz-muted iz-small">{incidentsLoading ? 'Chargement…' : incidentsError ? 'Historique indisponible.' : 'Aucun incident enregistré.'}</p>}
          </div>

          <h3 className="iz-map-section-title">🎯 Légende</h3>
          <div className="iz-legend">
            <span><i style={{ background: '#2563eb' }} /> Arrêt</span>
            <span><i style={{ background: '#dc2626' }} /> Itinéraire</span>
            <span><i style={{ background: '#64748b' }} /> Véhicule enregistré</span>
            <span><i style={{ background: '#7c3aed' }} /> Tracé de simulation</span>
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
