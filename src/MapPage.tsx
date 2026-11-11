import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
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

interface Tile {
  key: string
  url: string
  left: number
  top: number
}

const TILE_SIZE = 256
const MIN_ZOOM = 2
const MAX_ZOOM = 19
const DEFAULT_CENTER: Coordinates = { latitude: -19.87, longitude: 47.03 }

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

function worldPoint({ latitude, longitude }: Coordinates, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom
  const boundedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude))
  const sin = Math.sin((boundedLatitude * Math.PI) / 180)
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  }
}

function coordinatesFromWorld(x: number, y: number, zoom: number): Coordinates {
  const scale = TILE_SIZE * 2 ** zoom
  const longitude = (x / scale) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / scale
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n))
  return { latitude, longitude }
}

function vehicleColor(type?: string | null): string {
  const normalized = (type ?? '').toLocaleLowerCase()
  if (normalized.includes('bus')) return '#df7946'
  if (normalized.includes('bajaj')) return '#8767c4'
  if (normalized.includes('cyclo')) return '#2b9c78'
  return '#3478b8'
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
  const [selectedKey, setSelectedKey] = useState('')
  const [center, setCenter] = useState<Coordinates>(DEFAULT_CENTER)
  const [zoom, setZoom] = useState(13)
  const [mapSize, setMapSize] = useState({ width: 900, height: 560 })
  const [tilesUnavailable, setTilesUnavailable] = useState(false)
  const [updatingRegistration, setUpdatingRegistration] = useState('')
  const [updateMessage, setUpdateMessage] = useState<{ registration: string; text: string; error: boolean } | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const initialCameraSet = useRef(false)
  const dragRef = useRef<{ pointerId: number; x: number; y: number; worldX: number; worldY: number } | null>(null)

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
  }, [])

  useEffect(() => { void loadMap() }, [loadMap])

  useEffect(() => {
    const element = mapRef.current
    if (!element) return
    const measure = () => setMapSize({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

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

  const selectedItem = items.find((item) => item.key === selectedKey) ?? null
  const centerWorld = worldPoint(center, zoom)
  const mapTiles = useMemo<Tile[]>(() => {
    const minX = Math.floor((centerWorld.x - mapSize.width / 2) / TILE_SIZE)
    const maxX = Math.floor((centerWorld.x + mapSize.width / 2) / TILE_SIZE)
    const minY = Math.floor((centerWorld.y - mapSize.height / 2) / TILE_SIZE)
    const maxY = Math.floor((centerWorld.y + mapSize.height / 2) / TILE_SIZE)
    const tileCount = 2 ** zoom
    const result: Tile[] = []
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        if (y < 0 || y >= tileCount) continue
        const wrappedX = ((x % tileCount) + tileCount) % tileCount
        result.push({
          key: `${zoom}:${x}:${y}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
          left: x * TILE_SIZE - centerWorld.x + mapSize.width / 2,
          top: y * TILE_SIZE - centerWorld.y + mapSize.height / 2,
        })
      }
    }
    return result
  }, [centerWorld.x, centerWorld.y, mapSize.height, mapSize.width, zoom])

  const visibleItems = items.filter((item) => {
    if (!item.coordinates) return false
    const point = worldPoint(item.coordinates, zoom)
    const dx = point.x - centerWorld.x
    const wrappedDx = dx - Math.round(dx / (TILE_SIZE * 2 ** zoom)) * (TILE_SIZE * 2 ** zoom)
    const x = mapSize.width / 2 + wrappedDx
    const y = mapSize.height / 2 + point.y - centerWorld.y
    return x >= -32 && x <= mapSize.width + 32 && y >= -32 && y <= mapSize.height + 32
  })

  function markerPosition(item: MapItem) {
    if (!item.coordinates) return { left: -100, top: -100 }
    const point = worldPoint(item.coordinates, zoom)
    const worldWidth = TILE_SIZE * 2 ** zoom
    const dx = point.x - centerWorld.x
    const wrappedDx = dx - Math.round(dx / worldWidth) * worldWidth
    return { left: mapSize.width / 2 + wrappedDx, top: mapSize.height / 2 + point.y - centerWorld.y }
  }

  function selectItem(item: MapItem) {
    setSelectedKey(item.key)
    setUpdateMessage(null)
    if (item.coordinates) setCenter(item.coordinates)
  }

  function zoomBy(amount: number) {
    setZoom((current) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + amount)))
  }

  function onMapPointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button, a')) return
    const point = worldPoint(center, zoom)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, worldX: point.x, worldY: point.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onMapPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setCenter(coordinatesFromWorld(drag.worldX - (event.clientX - drag.x), drag.worldY - (event.clientY - drag.y), zoom))
  }

  function endMapDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une immatriculation, un nom…" />
          {query && <button type="button" aria-label="Effacer la recherche" onClick={() => setQuery('')}>×</button>}
        </label>
        <div className="map-page__layers" role="group" aria-label="Couches de la carte">
          <button type="button" className={showVehicles ? 'is-active' : ''} aria-pressed={showVehicles} onClick={() => setShowVehicles((value) => !value)}>
            <span className="map-page__layer-dot map-page__layer-dot--vehicle" aria-hidden="true" /> Véhicules
          </button>
          <button type="button" className={showScans ? 'is-active' : ''} aria-pressed={showScans} onClick={() => setShowScans((value) => !value)}>
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
            ref={mapRef}
            className={`map-page__map${tilesUnavailable ? ' map-page__map--fallback' : ''}`}
            aria-label="Carte interactive. Faites glisser pour déplacer la carte."
            onPointerDown={onMapPointerDown}
            onPointerMove={onMapPointerMove}
            onPointerUp={endMapDrag}
            onPointerCancel={endMapDrag}
          >
            {!tilesUnavailable && mapTiles.map((tile) => (
              <img
                key={tile.key}
                className="map-page__tile"
                src={tile.url}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{ left: tile.left, top: tile.top }}
                onError={() => setTilesUnavailable(true)}
              />
            ))}
            <div className="map-page__fallback-grid" aria-hidden="true">
              <span>Carte géographique · {center.latitude.toFixed(3)}, {center.longitude.toFixed(3)}</span>
            </div>
            {visibleItems.map((item) => {
              const position = markerPosition(item)
              const color = item.kind === 'vehicle' ? vehicleColor(item.vehicle?.type) : '#c45d9c'
              const active = selectedKey === item.key
              return (
                <button
                  type="button"
                  key={item.key}
                  className={`map-page__marker map-page__marker--${item.kind}${active ? ' is-selected' : ''}`}
                  style={{ left: position.left, top: position.top, '--marker-color': color } as CSSProperties}
                  aria-label={`${item.kind === 'vehicle' ? 'Véhicule' : 'Scan'} ${item.label}${item.subtitle ? `, ${item.subtitle}` : ''}`}
                  aria-pressed={active}
                  onClick={() => selectItem(item)}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  {item.kind === 'vehicle' ? <span aria-hidden="true" /> : <span aria-hidden="true">•</span>}
                </button>
              )
            })}
            <div className="map-page__zoom" role="group" aria-label="Zoom de la carte">
              <button type="button" aria-label="Zoom avant" onClick={() => zoomBy(1)} disabled={zoom >= MAX_ZOOM}>+</button>
              <button type="button" aria-label="Zoom arrière" onClick={() => zoomBy(-1)} disabled={zoom <= MIN_ZOOM}>−</button>
            </div>
            <div className="map-page__attribution">
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
            </div>
            {tilesUnavailable && <div className="map-page__tile-note" role="status">Le fond de carte n’a pas pu être chargé. Les marqueurs restent disponibles.</div>}
            {loading && <div className="map-page__loading" role="status">Chargement des positions…</div>}
          </div>
          <div className="map-page__map-caption">
            <span>{visibleItems.length} position{visibleItems.length === 1 ? '' : 's'} affichée{visibleItems.length === 1 ? '' : 's'}</span>
            <span>Déplacez la carte par glisser-déposer · Zoom avec les boutons</span>
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
            <ul className="map-page__results">
              {items.map((item) => (
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
          )}
        </aside>
      </section>

      <footer className="map-page__legend" aria-label="Légende des marqueurs">
        <span><i className="map-page__legend-dot" style={{ backgroundColor: '#2b9c78' }} /> Cyclo-pousse</span>
        <span><i className="map-page__legend-dot" style={{ backgroundColor: '#df7946' }} /> Bus</span>
        <span><i className="map-page__legend-dot" style={{ backgroundColor: '#8767c4' }} /> Bajaj</span>
        <span><i className="map-page__legend-dot" style={{ backgroundColor: '#3478b8' }} /> Autre véhicule</span>
        <span><i className="map-page__legend-dot map-page__legend-dot--scan" /> Scan</span>
      </footer>
    </div>
  )
}
