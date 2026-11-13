import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import MapCanvas, { type MapPoint } from './MapCanvas'
import './MapPage.css'

interface MapVehicle {
  immatriculation: string
  nom?: string | null
  type?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  adresse?: string | null
  nomProprietaire?: string | null
  prenomProprietaire?: string | null
}

interface MapScan {
  id: string | number
  immatriculation?: string | null
  date?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  precisionMeters?: number | string | null
}

interface MapPayload {
  vehicles?: MapVehicle[]
  scans?: MapScan[]
}

interface Coordinates {
  latitude: number
  longitude: number
}

interface MapItem {
  key: string
  kind: 'vehicle' | 'scan'
  label: string
  subtitle: string
  coordinates: Coordinates | null
  vehicle?: MapVehicle
  scan?: MapScan
}

type Basemap = 'plan' | 'satellite'
type ViewMode = '2d' | '3d'

const LIST_PAGE_SIZE = 8
const DEFAULT_CENTER: Coordinates = { latitude: -19.87, longitude: 47.03 }

function isNightAt(date: Date): boolean {
  const hour = date.getHours()
  return hour < 6 || hour >= 18
}

function coordinatesOf(value: { latitude?: number | string | null; longitude?: number | string | null }): Coordinates | null {
  if (value.latitude == null || value.longitude == null || (typeof value.latitude === 'string' && !value.latitude.trim()) || (typeof value.longitude === 'string' && !value.longitude.trim())) {
    return null
  }
  const latitude = Number(value.latitude)
  const longitude = Number(value.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null
  }
  return { latitude, longitude }
}

function vehicleColor(type?: string | null): string {
  const normalized = (type ?? '').toLocaleLowerCase()
  if (normalized.includes('bus')) return '#e8a33d'
  if (normalized.includes('bajaj')) return '#1f2b25'
  if (normalized.includes('cyclo')) return '#3f7d5f'
  return '#2b3a32'
}

function formatCoordinates(value: Coordinates | null): string {
  return value ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}` : 'Coordonnées non renseignées'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.'
}

async function readError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null)
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message
    if (typeof message === 'string') return message
    if (Array.isArray(message)) return message.join(', ')
  }
  return `La requête a échoué (HTTP ${response.status}).`
}

export default function MapPage() {
  const [vehicles, setVehicles] = useState<MapVehicle[]>([])
  const [scans, setScans] = useState<MapScan[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [showVehicles, setShowVehicles] = useState(true)
  const [showScans, setShowScans] = useState(true)
  const [basemap, setBasemap] = useState<Basemap>('plan')
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [night, setNight] = useState(() => isNightAt(new Date()))
  const [autoNight, setAutoNight] = useState(true)
  const [listPage, setListPage] = useState(1)
  const [selectedKey, setSelectedKey] = useState('')
  const [center, setCenter] = useState<Coordinates>(DEFAULT_CENTER)
  const [zoom, setZoom] = useState(13)
  const [updatingRegistration, setUpdatingRegistration] = useState('')
  const [updateMessage, setUpdateMessage] = useState<{ registration: string; text: string; error: boolean } | null>(null)
  const initialCameraSet = useMemo(() => ({ current: false }), [])

  const loadMap = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch('/api/map', { credentials: 'same-origin' })
      if (!response.ok) throw new Error(await readError(response))
      const payload: unknown = await response.json()
      if (!payload || typeof payload !== 'object') throw new Error('La réponse de la carte est invalide.')
      const mapPayload = payload as MapPayload
      const nextVehicles = Array.isArray(mapPayload.vehicles) ? mapPayload.vehicles : []
      const nextScans = Array.isArray(mapPayload.scans) ? mapPayload.scans : []
      setVehicles(nextVehicles)
      setScans(nextScans)
      if (!initialCameraSet.current) {
        const firstPoint = nextVehicles.map(coordinatesOf).find((point) => point !== null)
          ?? nextScans.map(coordinatesOf).find((point) => point !== null)
        if (firstPoint) setCenter(firstPoint)
        initialCameraSet.current = true
      }
    } catch (error) {
      setLoadError(errorMessage(error) || 'Impossible de charger les données de la carte.')
    } finally {
      setLoading(false)
    }
  }, [initialCameraSet])

  useEffect(() => { void loadMap() }, [loadMap])

  // Bascule automatique jour/nuit selon l'heure locale, tant que l'utilisateur
  // n'a pas choisi lui-même le mode (son choix reste sinon ecrase).
  useEffect(() => {
    if (!autoNight) return
    const timer = window.setInterval(() => setNight(isNightAt(new Date())), 60_000)
    return () => window.clearInterval(timer)
  }, [autoNight])

  const items = useMemo<MapItem[]>(() => {
    const term = query.trim().toLocaleLowerCase()
    const vehicleItems: MapItem[] = vehicles.map((vehicle) => ({
      key: `vehicle:${vehicle.immatriculation}`,
      kind: 'vehicle',
      label: vehicle.immatriculation || 'Véhicule sans immatriculation',
      subtitle: [vehicle.nom, vehicle.type].filter(Boolean).join(' · ') || 'Véhicule',
      coordinates: coordinatesOf(vehicle),
      vehicle,
    }))
    const scanItems: MapItem[] = scans.map((scan) => ({
      key: `scan:${scan.id}`,
      kind: 'scan',
      label: scan.immatriculation || 'Scan',
      subtitle: scan.date ? `Scan · ${scan.date}` : 'Scan récent',
      coordinates: coordinatesOf(scan),
      scan,
    }))
    return [...(showVehicles ? vehicleItems : []), ...(showScans ? scanItems : [])].filter((item) => {
      if (!term) return true
      const text = item.kind === 'vehicle'
        ? [item.label, item.subtitle, item.vehicle?.adresse, item.vehicle?.nomProprietaire, item.vehicle?.prenomProprietaire]
        : [item.label, item.subtitle]
      return text.some((part) => part?.toLocaleLowerCase().includes(term))
    })
  }, [query, scans, showScans, showVehicles, vehicles])

  const points = useMemo<MapPoint[]>(() => items.flatMap((item) => {
    if (!item.coordinates) return []
    return [{
      key: item.key,
      label: item.label,
      kind: item.kind,
      color: item.kind === 'vehicle' ? vehicleColor(item.vehicle?.type) : '#e8a33d',
      latitude: item.coordinates.latitude,
      longitude: item.coordinates.longitude,
    }]
  }), [items])

  const selectedItem = items.find((item) => item.key === selectedKey) ?? null
  const pageCount = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE))
  const currentPage = Math.min(listPage, pageCount)
  const pagedItems = items.slice((currentPage - 1) * LIST_PAGE_SIZE, currentPage * LIST_PAGE_SIZE)

  function selectItem(item: MapItem) {
    setSelectedKey(item.key)
    setUpdateMessage(null)
    if (item.coordinates) setCenter(item.coordinates)
  }

  function selectByKey(key: string) {
    const item = items.find((entry) => entry.key === key)
    if (item) selectItem(item)
  }

  async function updateVehicleLocation(vehicle: MapVehicle) {
    const registration = vehicle.immatriculation
    setUpdateMessage(null)
    if (!navigator.geolocation) {
      setUpdateMessage({ registration, text: 'La géolocalisation n’est pas disponible dans ce navigateur.', error: true })
      return
    }

    setUpdatingRegistration(registration)
    navigator.geolocation.getCurrentPosition(async (position) => {
      const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude }
      try {
        const response = await fetch(`/api/map/${encodeURIComponent(registration)}/coordinates`, {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(coordinates),
        })
        if (!response.ok) throw new Error(await readError(response))
        setVehicles((current) => current.map((item) => item.immatriculation === registration ? { ...item, ...coordinates } : item))
        setCenter(coordinates)
        setSelectedKey(`vehicle:${registration}`)
        setUpdateMessage({ registration, text: 'La position du véhicule a été mise à jour.', error: false })
      } catch (error) {
        setUpdateMessage({ registration, text: `Mise à jour impossible : ${errorMessage(error)}`, error: true })
      } finally {
        setUpdatingRegistration('')
      }
    }, (error) => {
      const message = error.code === error.PERMISSION_DENIED
        ? 'Autorisez l’accès à votre position dans le navigateur, puis réessayez.'
        : error.code === error.POSITION_UNAVAILABLE
          ? 'Votre position est momentanément indisponible. Réessayez plus tard.'
          : 'La recherche de votre position a expiré. Réessayez.'
      setUpdateMessage({ registration, text: message, error: true })
      setUpdatingRegistration('')
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }

  return (
    <div className="map-page">
      <header className="map-page__header">
        <div>
          <span className="map-page__eyebrow">SUIVI DU RÉSEAU</span>
          <h1>Carte des véhicules</h1>
          <p>Visualisez les positions des véhicules et les derniers scans enregistrés.</p>
        </div>
        <button className="map-page__refresh" type="button" onClick={() => void loadMap()} disabled={loading}>
          <span aria-hidden="true">↻</span> {loading ? 'Actualisation…' : 'Actualiser'}
        </button>
      </header>

      <section className="map-page__toolbar" aria-label="Filtres de carte">
        <label className="map-page__search">
          <span className="map-page__search-icon" aria-hidden="true">⌕</span>
          <span className="visually-hidden">Rechercher un véhicule ou un scan</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setListPage(1) }} placeholder="Rechercher une immatriculation, un nom…" />
          {query && <button type="button" aria-label="Effacer la recherche" onClick={() => { setQuery(''); setListPage(1) }}>×</button>}
        </label>
        <div className="map-page__basemap" role="group" aria-label="Fond de carte">
          <button type="button" className={basemap === 'plan' ? 'is-active' : ''} aria-pressed={basemap === 'plan'} onClick={() => setBasemap('plan')}>
            <span className="map-page__basemap-icon" aria-hidden="true">▦</span> Plan
          </button>
          <button type="button" className={basemap === 'satellite' ? 'is-active' : ''} aria-pressed={basemap === 'satellite'} onClick={() => setBasemap('satellite')}>
            <span className="map-page__basemap-icon" aria-hidden="true">◍</span> Satellite
          </button>
        </div>
        <div className="map-page__viewmode" role="group" aria-label="Mode d’affichage">
          <button type="button" className={viewMode === '2d' ? 'is-active' : ''} aria-pressed={viewMode === '2d'} onClick={() => setViewMode('2d')}>
            <span className="map-page__basemap-icon" aria-hidden="true">▱</span> 2D
          </button>
          <button type="button" className={viewMode === '3d' ? 'is-active' : ''} aria-pressed={viewMode === '3d'} onClick={() => setViewMode('3d')}>
            <span className="map-page__basemap-icon" aria-hidden="true">◈</span> 3D
          </button>
        </div>
        <div className="map-page__viewmode" role="group" aria-label="Moment de la journée">
          <button type="button" className={!night ? 'is-active' : ''} aria-pressed={!night} onClick={() => { setAutoNight(false); setNight(false) }}>
            <span className="map-page__basemap-icon" aria-hidden="true">☀</span> Jour
          </button>
          <button type="button" className={night ? 'is-active' : ''} aria-pressed={night} onClick={() => { setAutoNight(false); setNight(true) }}>
            <span className="map-page__basemap-icon" aria-hidden="true">☾</span> Nuit
          </button>
        </div>
        <div className="map-page__layers" role="group" aria-label="Couches de la carte">
          <button type="button" className={showVehicles ? 'is-active' : ''} aria-pressed={showVehicles} onClick={() => { setShowVehicles((value) => !value); setListPage(1) }}>
            <span className="map-page__layer-dot map-page__layer-dot--vehicle" aria-hidden="true" /> Véhicules
          </button>
          <button type="button" className={showScans ? 'is-active' : ''} aria-pressed={showScans} onClick={() => { setShowScans((value) => !value); setListPage(1) }}>
            <span className="map-page__layer-dot map-page__layer-dot--scan" aria-hidden="true" /> Scans
          </button>
        </div>
      </section>

      {loadError && (
        <div className="map-page__alert" role="alert">
          <div><strong>Impossible de charger la carte.</strong><span>{loadError}</span></div>
          <button type="button" onClick={() => void loadMap()}>Réessayer</button>
        </div>
      )}

      <section className="map-page__workspace" aria-label="Carte et détails">
        <div className="map-page__map-column">
          <div
            className={`map-page__map${viewMode === '3d' ? ' is-3d' : ''}${night ? ' is-night' : ''}`}
            aria-label="Carte interactive. Faites glisser pour déplacer la carte."
          >
            <MapCanvas
              points={points}
              selectedKey={selectedKey}
              center={center}
              zoom={zoom}
              basemap={basemap}
              viewMode={viewMode}
              night={night}
              onSelect={selectByKey}
              onMove={(nextCenter, nextZoom) => { setCenter(nextCenter); setZoom(nextZoom) }}
            />
            <div className="map-page__attribution">
              {basemap === 'satellite'
                ? <a href="https://www.esri.com/" target="_blank" rel="noreferrer">© Esri, Maxar, Earthstar Geographics</a>
                : <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">© OpenFreeMap · © OpenMapTiles · © OpenStreetMap</a>}
            </div>
            {loading && <div className="map-page__loading" role="status">Chargement des positions…</div>}
          </div>
          <div className="map-page__map-caption">
            <span>{points.length} position{points.length === 1 ? '' : 's'} affichée{points.length === 1 ? '' : 's'}</span>
            <span>Déplacez la carte par glisser-déposer · Fond {basemap === 'satellite' ? 'satellite' : 'plan'} · Vue {viewMode.toUpperCase()} · {night ? 'Nuit' : 'Jour'}</span>
          </div>
        </div>

        <aside className="map-page__sidebar" aria-label="Liste des positions et détails">
          <div className="map-page__sidebar-heading">
            <div><span className="map-page__eyebrow">RÉSULTATS</span><h2>{selectedItem ? 'Détails' : 'Positions'}</h2></div>
            <span className="map-page__count">{items.length}</span>
          </div>
          {selectedItem ? (
            <div className="map-page__details">
              <button type="button" className="map-page__back" onClick={() => { setSelectedKey(''); setUpdateMessage(null) }}>← Tous les résultats</button>
              <span className={`map-page__kind map-page__kind--${selectedItem.kind}`}>
                {selectedItem.kind === 'vehicle' ? 'VÉHICULE' : 'SCAN'}
              </span>
              <h3>{selectedItem.label}</h3>
              <p className="map-page__details-subtitle">{selectedItem.subtitle}</p>
              {selectedItem.kind === 'vehicle' && selectedItem.vehicle ? (
                <>
                  <dl className="map-page__facts">
                    <div><dt>Propriétaire</dt><dd>{[selectedItem.vehicle.prenomProprietaire, selectedItem.vehicle.nomProprietaire].filter(Boolean).join(' ') || 'Non renseigné'}</dd></div>
                    <div><dt>Adresse</dt><dd>{selectedItem.vehicle.adresse || 'Non renseignée'}</dd></div>
                    <div><dt>Coordonnées</dt><dd>{formatCoordinates(selectedItem.coordinates)}</dd></div>
                  </dl>
                  <button
                    className="map-page__locate"
                    type="button"
                    disabled={updatingRegistration === selectedItem.vehicle.immatriculation}
                    onClick={() => void updateVehicleLocation(selectedItem.vehicle!)}
                  >
                    {updatingRegistration === selectedItem.vehicle.immatriculation ? 'Localisation en cours…' : 'Mettre à jour avec ma position'}
                  </button>
                  {!navigator.geolocation && <p className="map-page__help">La géolocalisation n’est pas disponible dans ce navigateur.</p>}
                  {updateMessage?.registration === selectedItem.vehicle.immatriculation && (
                    <p className={`map-page__notice${updateMessage.error ? ' is-error' : ''}`} role={updateMessage.error ? 'alert' : 'status'}>{updateMessage.text}</p>
                  )}
                  {!selectedItem.coordinates && <p className="map-page__help">Ce véhicule n’a pas encore de coordonnées. Utilisez le bouton ci-dessus pour enregistrer sa position actuelle.</p>}
                </>
              ) : selectedItem.scan ? (
                <dl className="map-page__facts">
                  <div><dt>Immatriculation</dt><dd>{selectedItem.scan.immatriculation || 'Non renseignée'}</dd></div>
                  <div><dt>Date du scan</dt><dd>{selectedItem.scan.date || 'Non renseignée'}</dd></div>
                  <div><dt>Précision</dt><dd>{selectedItem.scan.precisionMeters != null ? `${selectedItem.scan.precisionMeters} m` : 'Non renseignée'}</dd></div>
                  <div><dt>Coordonnées</dt><dd>{formatCoordinates(selectedItem.coordinates)}</dd></div>
                </dl>
              ) : null}
            </div>
          ) : loading && items.length === 0 ? (
            <p className="map-page__empty">Chargement des véhicules et des scans…</p>
          ) : items.length === 0 ? (
            <p className="map-page__empty">{query ? 'Aucun résultat pour cette recherche.' : 'Aucune position disponible.'}</p>
          ) : (
            <>
            <ul className="map-page__results">
              {pagedItems.map((item) => (
                <li key={item.key}>
                  <button type="button" className="map-page__result" onClick={() => selectItem(item)}>
                    <span className={`map-page__result-icon map-page__result-icon--${item.kind}`} style={item.kind === 'vehicle' ? { '--marker-color': vehicleColor(item.vehicle?.type) } as CSSProperties : undefined} aria-hidden="true">
                      {item.kind === 'vehicle' ? '●' : '•'}
                    </span>
                    <span className="map-page__result-text"><strong>{item.label}</strong><span>{item.subtitle}</span></span>
                    <span className={`map-page__coordinate-state${item.coordinates ? '' : ' is-missing'}`} title={item.coordinates ? 'Coordonnées disponibles' : 'Coordonnées manquantes'} aria-label={item.coordinates ? 'Coordonnées disponibles' : 'Coordonnées manquantes'} />
                  </button>
                </li>
              ))}
            </ul>
            {items.length > LIST_PAGE_SIZE && (
              <div className="map-page__pagination" role="navigation" aria-label="Pagination des résultats">
                <button type="button" onClick={() => setListPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} aria-label="Page précédente">‹</button>
                <span>Page <b>{currentPage}</b> sur {pageCount}</span>
                <button type="button" onClick={() => setListPage(Math.min(pageCount, currentPage + 1))} disabled={currentPage >= pageCount} aria-label="Page suivante">›</button>
              </div>
            )}
            </>
          )}
        </aside>
      </section>

      <footer className="map-page__legend" aria-label="Légende des marqueurs">
        <span><i className="map-page__legend-dot" style={{ backgroundColor: '#3f7d5f' }} /> Cyclo-pousse</span>
        <span><i className="map-page__legend-dot" style={{ backgroundColor: '#e8a33d' }} /> Bus</span>
        <span><i className="map-page__legend-dot" style={{ backgroundColor: '#1f2b25' }} /> Bajaj</span>
        <span><i className="map-page__legend-dot" style={{ backgroundColor: '#2b3a32' }} /> Autre véhicule</span>
        <span><i className="map-page__legend-dot map-page__legend-dot--scan" /> Scan</span>
      </footer>
    </div>
  )
}
