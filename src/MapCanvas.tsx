import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl'
import type {
  FilterSpecification,
  GeoJSONSource,
  MapLayerMouseEvent,
  StyleSpecification,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url'
import 'maplibre-gl/dist/maplibre-gl.css'

// MapLibre analyse les tuiles vectorielles dans un Web Worker : l'URL doit etre
// fournie explicitement pour que Vite (dev et build) serve le bon fichier.
setWorkerUrl(workerUrl)

export interface MapPoint {
  key: string
  label: string
  kind: 'vehicle' | 'scan'
  color: string
  latitude: number
  longitude: number
}

interface Coordinates {
  latitude: number
  longitude: number
}

interface MapCanvasProps {
  points: MapPoint[]
  selectedKey: string
  center: Coordinates
  zoom: number
  basemap: 'plan' | 'satellite'
  viewMode: '2d' | '3d'
  night: boolean
  onSelect: (key: string) => void
  onMove: (center: Coordinates, zoom: number) => void
}

// Styles vectoriels libres (aucune cle d'API), avec batiments et routes.
const STYLE_DAY = 'https://tiles.openfreemap.org/styles/positron'

interface LooseLayer {
  id: string
  type: string
  'source-layer'?: string
  paint?: Record<string, unknown>
}

/**
 * Le style "dark" d'OpenFreeMap ne termine pas son chargement (aucun cache de
 * tuiles cree, carte vide) : on deroule donc le style clair et on le recolorie.
 */
function toNightStyle(style: StyleSpecification): StyleSpecification {
  const clone = JSON.parse(JSON.stringify(style)) as StyleSpecification
  const layers = clone.layers as unknown as LooseLayer[]
  for (const layer of layers) {
    const sourceLayer = layer['source-layer']
    const paint = (layer.paint ??= {})
    if (layer.type === 'background') {
      paint['background-color'] = '#070c14'
    } else if (layer.type === 'fill') {
      if (sourceLayer === 'water') paint['fill-color'] = '#0b1624'
      else if (sourceLayer === 'building') paint['fill-color'] = '#141d29'
      else if (sourceLayer) paint['fill-color'] = '#0a121b'
    } else if (layer.type === 'line') {
      if (sourceLayer === 'transportation') paint['line-color'] = '#242e3b'
      else if (sourceLayer === 'waterway') paint['line-color'] = '#0b1624'
      else paint['line-color'] = '#1c2634'
    } else if (layer.type === 'symbol') {
      paint['text-color'] = '#cdd7e3'
      paint['text-halo-color'] = 'rgba(5, 10, 18, 0.92)'
      if (paint['icon-color']) paint['icon-color'] = '#9fb0c4'
    } else if (layer.type === 'fill-extrusion') {
      paint['fill-extrusion-color'] = '#1a2532'
    }
  }
  clone.name = 'carte-nuit'
  return clone
}

let nightStylePromise: Promise<StyleSpecification> | null = null

function nightStyle(): Promise<StyleSpecification> {
  nightStylePromise ??= fetch(STYLE_DAY)
    .then((response) => response.json() as Promise<StyleSpecification>)
    .then(toNightStyle)
    .catch((error: unknown) => {
      nightStylePromise = null
      throw error
    })
  return nightStylePromise
}

const ROADS_FILTER: FilterSpecification = [
  'match',
  ['get', 'class'],
  ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'street'],
  true,
  false,
]

function satelliteStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      esri: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '© Esri, Maxar, Earthstar Geographics',
      },
    },
    layers: [{ id: 'satellite', type: 'raster', source: 'esri' }],
  }
}

function styleFor(
  basemap: MapCanvasProps['basemap'],
  night: boolean,
): string | StyleSpecification | Promise<StyleSpecification> {
  if (basemap === 'satellite') return satelliteStyle()
  return night ? nightStyle() : STYLE_DAY
}

/** Retire une couche et sa source si elles existent. */
function removeLayer(map: MapLibreMap, id: string) {
  if (map.getLayer(id)) map.removeLayer(id)
}

function applyDecorations(map: MapLibreMap, props: MapCanvasProps) {
  const { basemap, night, viewMode } = props
  const layers = map.getStyle()?.layers ?? []
  const hasRoads = layers.some((layer) => 'source-layer' in layer && layer['source-layer'] === 'transportation')
  const hasBuildings = layers.some((layer) => 'source-layer' in layer && layer['source-layer'] === 'building')

  // Batiments en relief (mode 3D sur le fond vectoriel).
  if (basemap === 'plan' && viewMode === '3d' && hasBuildings) {
    if (!map.getLayer('bati-3d')) {
      map.addLayer({
        id: 'bati-3d',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 13,
        paint: {
          'fill-extrusion-color': night ? '#22303f' : '#dfe6ef',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': night ? 0.85 : 0.7,
        },
      })
    }
  } else {
    removeLayer(map, 'bati-3d')
  }

  // La nuit : routes qui s'illuminent + lampadaires le long des voies.
  if (basemap === 'plan' && night && hasRoads) {
    if (!map.getLayer('routes-eclairees')) {
      map.addLayer({
        id: 'routes-eclairees',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ROADS_FILTER,
        paint: {
          'line-color': '#f5b25a',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 3.5, 18, 8],
          'line-blur': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 8, 18, 14],
          'line-opacity': 0.55,
        },
      })
    }
    if (!map.getLayer('lampadaires')) {
      map.addLayer({
        id: 'lampadaires',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ROADS_FILTER,
        minzoom: 13,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 13, 90, 17, 45],
          'text-field': '•',
          // Police presente dans les styles OpenFreeMap (sinon les glyphes manquent).
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 8, 18, 16],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-rotation-alignment': 'viewport',
        },
        paint: {
          'text-color': '#ffe6b8',
          'text-halo-color': '#ffb454',
          'text-halo-width': 2.4,
          'text-halo-blur': 1.2,
        },
      })
    }
  } else {
    removeLayer(map, 'lampadaires')
    removeLayer(map, 'routes-eclairees')
  }

  // Points (vehicules et scans) au-dessus du fond.
  const beforeId = ['lampadaires', 'bati-3d', 'routes-eclairees'].find((id) => map.getLayer(id))
  const layerIds = ['points-halo', 'points', 'points-selected', 'points-labels']
  for (const id of layerIds) {
    if (map.getLayer(id)) map.moveLayer(id, beforeId)
    else if (!map.getLayer(id)) break
  }
}

function installPointLayers(map: MapLibreMap) {
  if (!map.getSource('points')) {
    map.addSource('points', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }
  if (!map.getLayer('points-halo')) {
    map.addLayer({
      id: 'points-halo',
      type: 'circle',
      source: 'points',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 16, 22],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.25,
        'circle-blur': 1,
      },
    })
  }
  if (!map.getLayer('points')) {
    map.addLayer({
      id: 'points',
      type: 'circle',
      source: 'points',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 8],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
    })
  }
  if (!map.getLayer('points-selected')) {
    map.addLayer({
      id: 'points-selected',
      type: 'circle',
      source: 'points',
      filter: ['==', ['get', 'key'], ''],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 16, 14],
        'circle-color': 'transparent',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
      },
    })
  }
  if (!map.getLayer('points-labels')) {
    map.addLayer({
      id: 'points-labels',
      type: 'symbol',
      source: 'points',
      minzoom: 14,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(12,20,28,0.85)',
        'text-halo-width': 1.4,
      },
    })
  }
}

export default function MapCanvas(props: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return
    let disposed = false
    let map: MapLibreMap | null = null

    const start = async () => {
      // Le style de nuit est construit a partir du style clair : il faut
      // attendre sa resolution avant de creer la carte.
      const style = await styleFor(props.basemap, props.night)
      if (disposed) return
      const instance = new MapLibreMap({
        container,
        style,
        center: [props.center.longitude, props.center.latitude],
        zoom: props.zoom,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
      })
      map = instance
      mapRef.current = instance
      if (propsRef.current.viewMode === '3d') instance.jumpTo({ pitch: 55 })

      instance.on('load', () => {
        installPointLayers(instance)
        applyDecorations(instance, propsRef.current)
        updatePoints(instance, propsRef.current)
        updateSelected(instance, propsRef.current.selectedKey)
      })
      instance.on('click', 'points', (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0]
        if (feature && typeof feature.properties?.key === 'string') {
          propsRef.current.onSelect(feature.properties.key)
        }
      })
      instance.on('error', (event) => {
        console.error('[carte] erreur MapLibre', event.error)
      })
      instance.on('mouseenter', 'points', () => { instance.getCanvas().style.cursor = 'pointer' })
      instance.on('mouseleave', 'points', () => { instance.getCanvas().style.cursor = '' })
      instance.on('moveend', () => {
        const center = instance.getCenter()
        propsRef.current.onMove({ latitude: center.lat, longitude: center.lng }, instance.getZoom())
      })
    }

    void start()

    return () => {
      disposed = true
      map?.remove()
      mapRef.current = null
    }
    // La carte est creee une seule fois ; les changements passent par les effets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fond de carte et heure : nouveau style, puis remise en place des couches
  // une fois le style completement charge (style.load, pas styledata).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false
    const apply = async () => {
      const style = await styleFor(props.basemap, props.night)
      if (cancelled) return
      let reinstalled = false
      const reinstall = () => {
        if (reinstalled) return
        reinstalled = true
        installPointLayers(map)
        applyDecorations(map, propsRef.current)
        updatePoints(map, propsRef.current)
        updateSelected(map, propsRef.current.selectedKey)
      }
      // L'ecouteur doit exister avant setStyle : un style objet peut se charger
      // de facon synchrone et emettre style.load immediatement.
      map.once('style.load', reinstall)
      map.setStyle(style)
      map.once('idle', reinstall)
    }
    void apply()
    return () => { cancelled = true }
  }, [props.basemap, props.night])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    applyDecorations(map, props)
    map.easeTo({ pitch: props.viewMode === '3d' ? 55 : 0, duration: 600 })
  }, [props.viewMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    updatePoints(map, props)
  }, [props.points])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    updateSelected(map, props.selectedKey)
  }, [props.selectedKey])

  // Recentrage demande par la page (selection dans la liste, actualisation).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const current = map.getCenter()
    const moved = Math.abs(current.lat - props.center.latitude) > 1e-6
      || Math.abs(current.lng - props.center.longitude) > 1e-6
    if (moved) {
      map.easeTo({ center: [props.center.longitude, props.center.latitude], duration: 500 })
    }
  }, [props.center])

  return (
    <>
      <div ref={containerRef} className="map-page__canvas" />
      <div className="map-page__zoom" role="group" aria-label="Zoom de la carte">
        <button type="button" aria-label="Zoom avant" onClick={() => mapRef.current?.zoomIn()}>+</button>
        <button type="button" aria-label="Zoom arrière" onClick={() => mapRef.current?.zoomOut()}>−</button>
      </div>
    </>
  )
}

function updatePoints(map: MapLibreMap, props: MapCanvasProps) {
  const source = map.getSource('points') as GeoJSONSource | undefined
  if (!source) return
  source.setData({
    type: 'FeatureCollection',
    features: props.points.map((point) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point.longitude, point.latitude] },
      properties: {
        key: point.key,
        label: point.label,
        kind: point.kind,
        color: point.color,
      },
    })),
  })
}

function updateSelected(map: MapLibreMap, selectedKey: string) {
  if (!map.getLayer('points-selected')) return
  map.setFilter('points-selected', ['==', ['get', 'key'], selectedKey])
}
