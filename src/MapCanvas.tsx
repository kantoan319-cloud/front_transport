import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl'
import type {
  FilterSpecification,
  GeoJSONSource,
  MapLayerMouseEvent,
  StyleSpecification,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
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
const STYLE_NIGHT = 'https://tiles.openfreemap.org/styles/dark'

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

function styleFor(basemap: MapCanvasProps['basemap'], night: boolean): string | StyleSpecification {
  if (basemap === 'satellite') return satelliteStyle()
  return night ? STYLE_NIGHT : STYLE_DAY
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
    const map = new MapLibreMap({
      container,
      style: styleFor(props.basemap, props.night),
      center: [props.center.longitude, props.center.latitude],
      zoom: props.zoom,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    })
    mapRef.current = map

    map.on('load', () => {
      installPointLayers(map)
      applyDecorations(map, propsRef.current)
    })
    map.on('click', 'points', (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0]
      if (feature && typeof feature.properties?.key === 'string') {
        propsRef.current.onSelect(feature.properties.key)
      }
    })
    map.on('mouseenter', 'points', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'points', () => { map.getCanvas().style.cursor = '' })
    map.on('moveend', () => {
      const center = map.getCenter()
      propsRef.current.onMove({ latitude: center.lat, longitude: center.lng }, map.getZoom())
    })
    return () => {
      map.remove()
      mapRef.current = null
    }
    // La carte est creee une seule fois ; les changements passent par les effets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fond de carte / jour-nuit : nouveau style, puis redecorations.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(styleFor(props.basemap, props.night), { diff: false })
    map.once('styledata', () => {
      installPointLayers(map)
      applyDecorations(map, propsRef.current)
      updatePoints(map, propsRef.current)
      updateSelected(map, propsRef.current.selectedKey)
      map.easeTo({ pitch: propsRef.current.viewMode === '3d' ? 55 : 0, duration: 600 })
    })
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
