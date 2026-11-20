import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, Marker } from 'maplibre-gl'
import type {
  FilterSpecification,
  GeoJSONSource,
  MapLayerMouseEvent,
  StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export interface MapPoint {
  key: string
  label: string
  kind: 'vehicle' | 'scan' | 'arret' | 'trace' | 'signal'
  color: string
  latitude: number
  longitude: number
}

export interface MapLine {
  key: string
  color: string
  points: { latitude: number; longitude: number }[]
}

/** Bus simule : position, cap et phares allumes la nuit. */
export interface MapVehiclePosition {
  latitude: number
  longitude: number
  bearing: number
  headlights: boolean
}

interface Coordinates {
  latitude: number
  longitude: number
}

interface MapCanvasProps {
  points: MapPoint[]
  lines?: MapLine[]
  vehicle?: MapVehiclePosition | null
  follow?: boolean
  terrain?: boolean
  focus?: { latitude: number; longitude: number; zoom: number; pitch: number; bearing: number; key: number } | null
  selectedKey: string
  center: Coordinates
  zoom: number
  basemap: 'plan' | 'satellite'
  viewMode: '2d' | '3d'
  night: boolean
  onSelect: (key: string) => void
  onMove: (center: Coordinates, zoom: number) => void
  onMapClick?: (coordinates: Coordinates) => void
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
    // Necessaire pour afficher les noms d'arrets sur le fond satellite.
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      esri: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '© Esri, Maxar, Earthstar Geographics',
      },
      // Memes donnees OpenStreetMap que le plan : quartiers, rues, commerces,
      // numeros de batiments, dessines en clair par-dessus l'imagerie.
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution: '© OpenStreetMap contributors / OpenFreeMap',
      },
    },
    layers: [
      { id: 'satellite', type: 'raster', source: 'esri' },
      {
        id: 'sat-place-labels',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['all', ['!=', ['get', 'name'], ''], ['in', ['get', 'class'], ['literal', [
          'city', 'town', 'village', 'hamlet', 'suburb', 'quarter', 'neighbourhood',
          'isolated_dwelling', 'province', 'state',
        ]]]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 12, 18, 14],
          'text-letter-spacing': 0.05,
          'text-max-width': 9,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(16, 24, 32, 0.85)',
          'text-halo-width': 1.6,
        },
      },
      {
        id: 'sat-road-labels',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 13,
        filter: ['!=', ['get', 'name'], ''],
        layout: {
          'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'symbol-placement': 'line',
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 17, 12],
          'text-max-width': 10,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(16, 24, 32, 0.85)',
          'text-halo-width': 1.3,
        },
      },
      {
        id: 'sat-poi-labels',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'poi',
        minzoom: 14.5,
        filter: ['all', ['!=', ['get', 'name'], ''], ['!=', ['get', 'class'], 'bus_stop']],
        layout: {
          'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 14.5, 10, 18, 12.5],
          'text-max-width': 8,
          'text-anchor': 'top',
          'text-offset': [0, 0.3],
          'text-padding': 2,
          'text-optional': true,
        },
        paint: {
          'text-color': '#ffe9a8',
          'text-halo-color': 'rgba(16, 24, 32, 0.9)',
          'text-halo-width': 1.4,
        },
      },
      {
        id: 'sat-house-numbers',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'housenumber',
        minzoom: 16,
        layout: {
          'text-field': ['get', 'housenumber'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 9,
          'text-padding': 2,
          'text-optional': true,
        },
        paint: {
          'text-color': '#f1f5f9',
          'text-halo-color': 'rgba(16, 24, 32, 0.85)',
          'text-halo-width': 1,
        },
      },
    ],
  }
}

function styleFor(
  basemap: MapCanvasProps['basemap'],
  night: boolean,
): string | StyleSpecification | Promise<StyleSpecification> {
  if (basemap === 'satellite') return satelliteStyle()
  return night ? nightStyle() : STYLE_DAY
}

/**
 * Relief reel : modele d'elevation (tuiles Terrarium Mapzen/AWS) + ombrage.
 * La carte se deforme alors en 3D et suit le relief du terrain.
 */
function installTerrain(map: MapLibreMap, actif: boolean) {
  if (!actif) {
    if (map.getTerrain()) map.setTerrain(null)
    removeLayer(map, 'relief')
    return
  }
  if (!map.getSource('terrain-dem')) {
    map.addSource('terrain-dem', {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15,
      attribution: 'Relief © Mapzen / AWS Terrain Tiles',
    })
  }
  // Le relief est deja ombre par le moteur de terrain : une couche hillshade
  // sur la meme source est inutile et declenche un avertissement MapLibre.
  removeLayer(map, 'relief')
  map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
}

/** Retire une couche et sa source si elles existent. */
function removeLayer(map: MapLibreMap, id: string) {
  if (map.getLayer(id)) map.removeLayer(id)
}

/**
 * N'execute une modification de style que lorsque celui-ci est pret.
 *
 * Sinon MapLibre leve "Style is not done loading" (par exemple quand on bascule
 * 2D/3D pendant le chargement) : l'exception remonte d'un effet React et demont
 * toute l'application, pas seulement la carte.
 */
function whenStyleReady(map: MapLibreMap, run: () => void) {
  const execute = () => {
    try {
      run()
    } catch (error) {
      // Carte demontee entre l'ecoute et l'execution : rien a faire.
      if (!map.getStyle()) return
      console.error('[carte] mise a jour du style impossible', error)
    }
  }
  if (map.isStyleLoaded()) {
    execute()
    return
  }
  map.once('style.load', execute)
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
          // Les tuiles OpenFreeMap exposent ces proprietes a null : sans la
          // conversion `number`, MapLibre signale "Expected value to be of type
          // number, but found null instead" pour chaque valeur nulle. La
          // conversion renvoie null et `coalesce` prend alors le repli, donc le
          // rendu est identique a avant.
          'fill-extrusion-height': [
            'coalesce',
            ['number', ['get', 'render_height']],
            ['number', ['get', 'height']],
            8,
          ],
          'fill-extrusion-base': [
            'coalesce',
            ['number', ['get', 'render_min_height']],
            0,
          ],
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

  // Traces et points au-dessus des batiments 3D (lisibilite en navigation).
  const layerIds = ['trajets-casing', 'trajets', 'points-halo', 'points', 'points-selected', 'points-labels', 'points-arrets']
  for (const id of layerIds) {
    if (map.getLayer(id)) map.moveLayer(id)
  }

  installTerrain(map, Boolean(props.terrain))
}

function installLineLayers(map: MapLibreMap) {
  if (!map.getSource('trajets')) {
    map.addSource('trajets', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }
  if (!map.getLayer('trajets-casing')) {
    map.addLayer({
      id: 'trajets-casing',
      type: 'line',
      source: 'trajets',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': 9,
        'line-opacity': 0.8,
      },
    })
  }
  if (!map.getLayer('trajets')) {
    map.addLayer({
      id: 'trajets',
      type: 'line',
      source: 'trajets',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 5,
        'line-opacity': 0.95,
      },
    })
  }
}

/** Pictogramme d'arret de bus, dessine une fois par carte (aucune image externe). */
function stopIconData(): { data: ImageData; pixelRatio: number } {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  // Pointe du panneau (ancre en bas, sur la position exacte de l'arret).
  ctx.fillStyle = '#173a2e'
  ctx.beginPath()
  ctx.moveTo(size / 2 - 6, size - 26)
  ctx.lineTo(size / 2 + 6, size - 26)
  ctx.lineTo(size / 2, size - 8)
  ctx.closePath()
  ctx.fill()
  // Disque du panneau.
  ctx.beginPath()
  ctx.arc(size / 2, size / 2 - 8, 20, 0, Math.PI * 2)
  ctx.fillStyle = '#173a2e'
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  // Silhouette de bus.
  const bodyX = size / 2 - 11
  const bodyY = size / 2 - 17
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(bodyX, bodyY, 22, 17, 3)
  ctx.fill()
  ctx.fillStyle = '#173a2e'
  ctx.fillRect(bodyX + 3, bodyY + 3, 7, 5)
  ctx.fillRect(bodyX + 12, bodyY + 3, 7, 5)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(bodyX + 6, bodyY + 19, 3, 0, Math.PI * 2)
  ctx.arc(bodyX + 16, bodyY + 19, 3, 0, Math.PI * 2)
  ctx.fill()
  return { data: ctx.getImageData(0, 0, size, size), pixelRatio: 2 }
}

function installPointLayers(map: MapLibreMap) {
  if (!map.getSource('points')) {
    map.addSource('points', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }
  if (!map.hasImage('arret-icon')) {
    const icon = stopIconData()
    map.addImage('arret-icon', icon.data, { pixelRatio: icon.pixelRatio })
  }
  if (!map.getLayer('points-halo')) {
    map.addLayer({
      id: 'points-halo',
      type: 'circle',
      source: 'points',
      filter: ['!=', ['get', 'kind'], 'arret'],
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
      filter: ['!=', ['get', 'kind'], 'arret'],
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
  // Arrets : pictogramme de panneau + nom toujours affiche.
  if (!map.getLayer('points-arrets')) {
    map.addLayer({
      id: 'points-arrets',
      type: 'symbol',
      source: 'points',
      filter: ['==', ['get', 'kind'], 'arret'],
      layout: {
        'icon-image': 'arret-icon',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.55, 16, 0.85],
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    })
  }
  if (!map.getLayer('points-labels-arrets')) {
    map.addLayer({
      id: 'points-labels-arrets',
      type: 'symbol',
      source: 'points',
      filter: ['==', ['get', 'kind'], 'arret'],
      minzoom: 10,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 16, 12.5],
        'text-offset': [0, 0.4],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-optional': true,
        'text-padding': 2,
      },
      paint: {
        'text-color': '#173a2e',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.8,
      },
    })
  }
  if (!map.getLayer('points-labels')) {
    map.addLayer({
      id: 'points-labels',
      type: 'symbol',
      source: 'points',
      filter: ['!=', ['get', 'kind'], 'arret'],
      minzoom: 14,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
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

/**
 * Libelles complementaires du fond vectoriel : commerces/services (station
 * service, banque, ecole...) et numeros de batiments, comme sur Google Maps.
 * Ignore le fond satellite (imagerie + libelles raster CARTO).
 */
function installMapLabels(map: MapLibreMap) {
  // Le fond satellite porte deja ses propres libelles clairs.
  if (!map.getSource('openmaptiles') || map.getLayer('satellite')) return
  if (!map.getLayer('poi-labels')) {
    map.addLayer({
      id: 'poi-labels',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'poi',
      minzoom: 14.5,
      filter: ['all', ['!=', ['get', 'name'], ''], ['!=', ['get', 'class'], 'bus_stop']],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14.5, 10, 18, 12],
        'text-max-width': 8,
        'text-anchor': 'top',
        'text-offset': [0, 0.2],
        'text-padding': 2,
        'text-optional': true,
      },
      paint: {
        'text-color': '#3f4a5a',
        'text-halo-color': 'rgba(255, 255, 255, 0.92)',
        'text-halo-width': 1.2,
      },
    })
  }
  if (!map.getLayer('house-numbers')) {
    map.addLayer({
      id: 'house-numbers',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'housenumber',
      minzoom: 16,
      layout: {
        'text-field': ['get', 'housenumber'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 9.5,
        'text-padding': 2,
        'text-optional': true,
      },
      paint: {
        'text-color': '#5b6572',
        'text-halo-color': 'rgba(255, 255, 255, 0.9)',
        'text-halo-width': 1,
      },
    })
  }
}

export default function MapCanvas(props: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const markerElementRef = useRef<HTMLDivElement | null>(null)
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

      let dernierClicPoint = 0
      instance.on('load', () => {
        installLineLayers(instance)
        installMapLabels(instance)
        installPointLayers(instance)
        applyDecorations(instance, propsRef.current)
        updateLines(instance, propsRef.current)
        updatePoints(instance, propsRef.current)
        updateSelected(instance, propsRef.current.selectedKey)
      })
      instance.on('click', 'points', (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0]
        if (feature && typeof feature.properties?.key === 'string') {
          dernierClicPoint = Date.now()
          propsRef.current.onSelect(feature.properties.key)
        }
      })
      instance.on('click', (event) => {
        if (!propsRef.current.onMapClick) return
        if (Date.now() - dernierClicPoint < 300) return
        propsRef.current.onMapClick({
          latitude: event.lngLat.lat,
          longitude: event.lngLat.lng,
        })
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
        installLineLayers(map)
        installMapLabels(map)
        installPointLayers(map)
        applyDecorations(map, propsRef.current)
        updateLines(map, propsRef.current)
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
    whenStyleReady(map, () => {
      applyDecorations(map, props)
      map.easeTo({ pitch: props.viewMode === '3d' ? 55 : 0, duration: 600 })
    })
  }, [props.viewMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    whenStyleReady(map, () => installTerrain(map, Boolean(props.terrain)))
  }, [props.terrain])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    updatePoints(map, props)
  }, [props.points])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    updateLines(map, props)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.lines])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    updateSelected(map, props.selectedKey)
  }, [props.selectedKey])

  // Camera de navigation : zoom maximal, vue inclinee, orientation du bus.
  useEffect(() => {
    const map = mapRef.current
    const focus = props.focus
    if (!map || !focus) return
    map.jumpTo({
      center: [focus.longitude, focus.latitude],
      zoom: focus.zoom,
      pitch: focus.pitch,
      bearing: focus.bearing,
    })
  }, [props.focus])

  // Bus simule : marqueur HTML (le faisceau des phares est dessine en CSS).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const vehicule = props.vehicle
    if (!vehicule) {
      markerRef.current?.remove()
      markerRef.current = null
      markerElementRef.current = null
      return
    }
    if (!markerRef.current) {
      const element = document.createElement('div')
      element.className = 'map-bus'
      element.innerHTML = '<div class="map-bus__beam"></div><div class="map-bus__body">🚌</div>'
      markerRef.current = new Marker({ element, anchor: 'center' })
        .setLngLat([vehicule.longitude, vehicule.latitude])
        .addTo(map)
      markerElementRef.current = element
    } else {
      markerRef.current.setLngLat([vehicule.longitude, vehicule.latitude])
    }
    if (props.follow) {
      map.jumpTo({
        center: [vehicule.longitude, vehicule.latitude],
        bearing: vehicule.bearing,
      })
    }
    const element = markerElementRef.current
    if (!element) return
    element.classList.toggle('is-night', vehicule.headlights)
    const beam = element.querySelector('.map-bus__beam') as HTMLElement | null
    if (beam) {
      beam.style.transform = `translate(-50%, -100%) rotate(${vehicule.bearing}deg)`
    }
  }, [props.vehicle, props.follow])

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

function updateLines(map: MapLibreMap, props: MapCanvasProps) {
  const source = map.getSource('trajets') as GeoJSONSource | undefined
  if (!source) return
  source.setData({
    type: 'FeatureCollection',
    features: (props.lines ?? [])
      .filter((line) => line.points.length > 1)
      .map((line) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: line.points.map((point) => [point.longitude, point.latitude]),
        },
        properties: { key: line.key, color: line.color },
      })),
  })
}

function updateSelected(map: MapLibreMap, selectedKey: string) {
  if (!map.getLayer('points-selected')) return
  map.setFilter('points-selected', ['==', ['get', 'key'], selectedKey])
}
