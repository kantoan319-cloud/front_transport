import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError, type BusArret, type BusCarteDetail, type BusLigneCarte } from './api'
import MapCanvas, { type MapLine, type MapPoint, type MapVehiclePosition } from './MapCanvas'
import './BusMapPage.css'

type Mode = 'lecture' | 'arret' | 'trace'
type Basemap = 'plan' | 'satellite'

interface Coordonnee {
  latitude: number
  longitude: number
}

interface Props {
  canEdit: boolean
}

function messageErreur(cause: unknown, defaut: string): string {
  return cause instanceof ApiError ? cause.message : defaut
}

const VITESSE_BUS = 5.6 // metres par seconde, environ 20 km/h
const RAYON_TERRE = 6_371_000

function isNightAt(date: Date): boolean {
  const heure = date.getHours()
  return heure < 6 || heure >= 18
}

function distanceMetres(a: Coordonnee, b: Coordonnee): number {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180 * Math.cos(((a.latitude + b.latitude) / 2) * Math.PI / 180)
  return RAYON_TERRE * Math.hypot(dLat, dLng)
}

function longueurTrace(points: Coordonnee[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += distanceMetres(points[index - 1], points[index])
  }
  return total
}

function capDegres(a: Coordonnee, b: Coordonnee): number {
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180) / Math.PI
}

function positionSurTrace(points: Coordonnee[], distance: number): Coordonnee & { bearing: number } {
  let restant = Math.max(0, distance)
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]
    const b = points[index]
    const longueur = distanceMetres(a, b)
    if (restant <= longueur || index === points.length - 1) {
      const ratio = longueur > 0 ? Math.min(1, restant / longueur) : 0
      return {
        latitude: a.latitude + (b.latitude - a.latitude) * ratio,
        longitude: a.longitude + (b.longitude - a.longitude) * ratio,
        bearing: capDegres(a, b),
      }
    }
    restant -= longueur
  }
  const dernier = points[points.length - 1]
  return { latitude: dernier.latitude, longitude: dernier.longitude, bearing: 0 }
}

/** Coupe le trace a la distance parcourue : partie faite / partie restante. */
function decouperTrace(points: Coordonnee[], distance: number): { fait: Coordonnee[]; restant: Coordonnee[] } {
  const fait: Coordonnee[] = []
  const restant: Coordonnee[] = []
  let reste = Math.max(0, distance)
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]
    const b = points[index]
    const longueur = distanceMetres(a, b)
    if (reste >= longueur) {
      if (!fait.length) fait.push(a)
      fait.push(b)
      reste -= longueur
      continue
    }
    if (reste > 0) {
      const ratio = longueur > 0 ? reste / longueur : 0
      const point = {
        latitude: a.latitude + (b.latitude - a.latitude) * ratio,
        longitude: a.longitude + (b.longitude - a.longitude) * ratio,
      }
      fait.push(point)
      restant.push(point)
      reste = 0
    } else if (!restant.length) {
      restant.push(a)
    }
    restant.push(b)
  }
  return { fait, restant }
}

export default function BusMapPage({ canEdit }: Props) {
  const [lignes, setLignes] = useState<BusLigneCarte[]>([])
  const [ligne, setLigne] = useState('')
  const [detail, setDetail] = useState<BusCarteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<Mode>('lecture')
  const [draft, setDraft] = useState<Coordonnee[]>([])
  const [stopDraft, setStopDraft] = useState<(Coordonnee & { nom: string }) | null>(null)
  const [selected, setSelected] = useState('')
  const [center, setCenter] = useState<Coordonnee>({ latitude: -19.865, longitude: 47.033 })
  const [zoom, setZoom] = useState(13)
  const [basemap, setBasemap] = useState<Basemap>('plan')
  const [jours, setJours] = useState('30')
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')
  const [night, setNight] = useState(() => isNightAt(new Date()))
  const [autoNight, setAutoNight] = useState(true)
  const [relief, setRelief] = useState(true)
  const [simulation, setSimulation] = useState(false)
  const [vitesse, setVitesse] = useState('30')
  const [vehicule, setVehicule] = useState<MapVehiclePosition | null>(null)
  const [parcouru, setParcouru] = useState(0)
  const [suivi, setSuivi] = useState(true)
  const [pleinEcran, setPleinEcran] = useState(false)
  const [focus, setFocus] = useState<{ latitude: number; longitude: number; zoom: number; pitch: number; bearing: number; key: number } | null>(null)
  const nightRef = useRef(night)
  const capRef = useRef(0)

  const trace = useMemo<Coordonnee[]>(
    () => (detail?.trajet?.points ?? []).map((point) => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
    })),
    [detail],
  )
  const longueur = useMemo(() => longueurTrace(trace), [trace])

  const chargeLignes = useCallback(async () => {
    try {
      const response = await api.busMapLines()
      setLignes(response.lignes)
      setLigne((actuelle) => {
        if (actuelle) return actuelle
        const garnie = response.lignes.find((item) => item.arrets > 0 || item.points > 0)
        return garnie?.valeur ?? response.lignes[0]?.valeur ?? ''
      })
    } catch (cause) {
      setError(messageErreur(cause, 'Impossible de charger les lignes de bus.'))
    }
  }, [])

  const chargeDetail = useCallback(async (valeur: string) => {
    if (!valeur) return
    setLoading(true)
    setError('')
    try {
      const response = await api.busMapDetail(valeur)
      setDetail(response)
      const premier = response.arrets[0] ?? response.trajet?.points?.[0] ?? response.scans[0]
      if (premier) {
        setCenter({ latitude: Number(premier.latitude), longitude: Number(premier.longitude) })
      }
    } catch (cause) {
      setError(messageErreur(cause, 'Impossible de charger la ligne.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void chargeLignes() }, [chargeLignes])
  useEffect(() => {
    if (!ligne) return
    setDraft([])
    setStopDraft(null)
    setMode('lecture')
    setSelected('')
    setMessage('')
    setSimulation(false)
    setVehicule(null)
    setParcouru(0)
    void chargeDetail(ligne)
  }, [ligne, chargeDetail])

  // Nuit automatique selon l'heure locale, sauf choix manuel de l'utilisateur.
  useEffect(() => { nightRef.current = night }, [night])
  useEffect(() => {
    if (!autoNight) return
    const minuteur = window.setInterval(() => setNight(isNightAt(new Date())), 60_000)
    return () => window.clearInterval(minuteur)
  }, [autoNight])

  // Le bus simule avance le long du tracé (boucle au bout de la ligne).
  useEffect(() => {
    if (!simulation || trace.length < 2 || longueur <= 0) {
      setVehicule(null)
      setParcouru(0)
      return
    }
    let distance = 0
    let dernier = performance.now()
    capRef.current = positionSurTrace(trace, 0).bearing
    const minuteur = window.setInterval(() => {
      const maintenant = performance.now()
      const delta = Math.min(0.5, (maintenant - dernier) / 1000)
      dernier = maintenant
      distance += VITESSE_BUS * Number(vitesse) * delta
      if (distance >= longueur) distance = 0
      const position = positionSurTrace(trace, distance)
      // Cap lisse : la camera tourne progressivement dans les virages.
      const ecart = ((position.bearing - capRef.current + 540) % 360) - 180
      capRef.current = (capRef.current + ecart * 0.3 + 360) % 360
      setVehicule({
        latitude: position.latitude,
        longitude: position.longitude,
        bearing: capRef.current,
        headlights: nightRef.current,
      })
      setParcouru(distance)
    }, 80)
    return () => window.clearInterval(minuteur)
  }, [simulation, trace, longueur, vitesse])

  function demarrerSimulation() {
    if (trace.length < 2) {
      setError('Aucun tracé à simuler : dessinez-le ou générez-le depuis les scans.')
      return
    }
    setError('')
    setMode('lecture')
    setStopDraft(null)
    setViewMode('3d')
    setBasemap('plan')
    setRelief(true)
    setSimulation(true)
    setSuivi(true)
    const depart = positionSurTrace(trace, 0)
    capRef.current = depart.bearing
    setVehicule({ latitude: depart.latitude, longitude: depart.longitude, bearing: depart.bearing, headlights: nightRef.current })
    setFocus({ latitude: depart.latitude, longitude: depart.longitude, zoom: 18, pitch: 62, bearing: depart.bearing, key: Date.now() })
    basculerPleinEcran(true)
    setMessage('Vue navigation : la carte suit le bus, zoom maximal et bâtiments en 3D.')
  }

  function recentrer() {
    if (!vehicule) return
    setSuivi(true)
    setFocus({ latitude: vehicule.latitude, longitude: vehicule.longitude, zoom: 18, pitch: 62, bearing: vehicule.bearing, key: Date.now() })
  }

  async function routerTrace() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const resultat = await api.busRouterTrajet(ligne)
      setMessage(`Tracé recalé sur les routes réelles (${resultat.points} points).`)
      await recharger()
    } catch (cause) {
      setError(messageErreur(cause, 'Recalage sur les routes impossible.'))
    } finally {
      setBusy(false)
    }
  }

  function arreterSimulation() {
    setSimulation(false)
    setVehicule(null)
    setParcouru(0)
    if (pleinEcran) basculerPleinEcran(false)
  }

  /** Bascule le plein ecran et force MapLibre a recalculer sa taille. */
  function basculerPleinEcran(valeur: boolean) {
    setPleinEcran(valeur)
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120)
  }

  function handleMapClick(coordonnee: Coordonnee) {
    if (!canEdit) return
    if (mode === 'arret') {
      setStopDraft({ ...coordonnee, nom: '' })
      setMode('lecture')
      setMessage('')
    } else if (mode === 'trace') {
      setDraft((current) => [...current, coordonnee])
    }
  }

  async function recharger() {
    await Promise.all([chargeDetail(ligne), chargeLignes()])
  }

  async function enregistrerArret() {
    if (!stopDraft) return
    if (!stopDraft.nom.trim()) {
      setError('Donnez un nom à l’arrêt avant de l’enregistrer.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.busAddArret(ligne, {
        nom: stopDraft.nom.trim(),
        latitude: stopDraft.latitude,
        longitude: stopDraft.longitude,
      })
      setStopDraft(null)
      setMessage('Arrêt ajouté à la ligne.')
      await recharger()
    } catch (cause) {
      setError(messageErreur(cause, 'Enregistrement de l’arrêt impossible.'))
    } finally {
      setBusy(false)
    }
  }

  async function supprimerArret(arret: BusArret) {
    if (!window.confirm(`Supprimer l’arrêt « ${arret.nom} » ?`)) return
    setBusy(true)
    setError('')
    try {
      await api.busDeleteArret(arret.id)
      setMessage('Arrêt supprimé.')
      await recharger()
    } catch (cause) {
      setError(messageErreur(cause, 'Suppression impossible.'))
    } finally {
      setBusy(false)
    }
  }

  async function enregistrerTrace() {
    if (draft.length < 2) {
      setError('Placez au moins deux points sur la carte pour former un tracé.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const resultat = await api.busSaveTrajet(ligne, draft, 'manuel')
      setMessage(
        resultat.routed
          ? `Tracé enregistré et recalé sur les rues réelles (${resultat.points} points).`
          : `Tracé enregistré (${resultat.points} points).`,
      )
      setDraft([])
      setMode('lecture')
      await recharger()
    } catch (cause) {
      setError(messageErreur(cause, 'Enregistrement du tracé impossible.'))
    } finally {
      setBusy(false)
    }
  }

  async function tracerDepuisScans() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const resultat = await api.busTraceFromScans(ligne, {
        jours: Number(jours) || undefined,
      })
      setMessage(
        `Tracé construit depuis les scans : ${resultat.scans} scans, ${resultat.points} points conservés.`,
      )
      await recharger()
    } catch (cause) {
      setError(messageErreur(cause, 'Aucun tracé n’a pu être construit depuis les scans.'))
    } finally {
      setBusy(false)
    }
  }

  async function effacerTrace() {
    if (!window.confirm(`Effacer le tracé de la ligne ${ligne} ?`)) return
    setBusy(true)
    setError('')
    try {
      await api.busDeleteTrajet(ligne)
      setMessage('Tracé effacé.')
      await recharger()
    } catch (cause) {
      setError(messageErreur(cause, 'Suppression du tracé impossible.'))
    } finally {
      setBusy(false)
    }
  }

  const points = useMemo<MapPoint[]>(() => {
    if (!detail) return []
    const arrets: MapPoint[] = detail.arrets.map((arret) => ({
      key: `arret:${arret.id}`,
      label: arret.nom,
      kind: 'arret',
      color: '#1f6feb',
      latitude: Number(arret.latitude),
      longitude: Number(arret.longitude),
    }))
    const scans: MapPoint[] = detail.scans.map((scan) => ({
      key: `scan:${scan.id}`,
      label: scan.immatriculation || 'Scan',
      kind: 'scan',
      color: '#8a97a6',
      latitude: Number(scan.latitude),
      longitude: Number(scan.longitude),
    }))
    const brouillon: MapPoint[] = draft.map((point, index) => ({
      key: `draft:${index}`,
      label: `${index + 1}`,
      kind: 'trace',
      color: '#d94f4f',
      latitude: point.latitude,
      longitude: point.longitude,
    }))
    return [...arrets, ...scans, ...brouillon]
  }, [detail, draft])

  const lines = useMemo<MapLine[]>(() => {
    const liste: MapLine[] = []
    if (simulation && trace.length > 1) {
      const { fait, restant } = decouperTrace(trace, parcouru)
      if (fait.length > 1) liste.push({ key: 'parcours-fait', color: '#94a3b8', points: fait })
      if (restant.length > 1) liste.push({ key: 'parcours-restant', color: '#1a73e8', points: restant })
    } else if (trace.length > 1) {
      liste.push({ key: 'trajet', color: '#e8a33d', points: trace })
    }
    if (draft.length > 1) {
      liste.push({ key: 'brouillon', color: '#d94f4f', points: draft })
    }
    return liste
  }, [trace, draft, simulation, parcouru])

  const arretSelectionne = detail?.arrets.find((arret) => `arret:${arret.id}` === selected) ?? null
  const ligneCourante = lignes.find((item) => item.valeur === ligne) ?? null

  return (
    <div className={`busmap${pleinEcran ? ' is-fullscreen' : ''}`}>
      {pleinEcran && (
        <div className="busmap__hud" role="toolbar" aria-label="Contrôles plein écran">
          <span className="busmap__hud-title">Ligne {ligne || '—'}</span>
          <button type="button" className={simulation ? 'is-active' : ''} onClick={() => (simulation ? arreterSimulation() : demarrerSimulation())}>
            {simulation ? '■ Arrêter' : '▶ Simuler'}
          </button>
          <button type="button" className={suivi && simulation ? 'is-active' : ''} onClick={() => (suivi ? setSuivi(false) : recentrer())}>⌖ Suivre</button>
          <button type="button" className={viewMode === '3d' ? 'is-active' : ''} onClick={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}>3D</button>
          <button type="button" className={basemap === 'satellite' ? 'is-active' : ''} onClick={() => setBasemap(basemap === 'satellite' ? 'plan' : 'satellite')}>Satellite</button>
          <button type="button" className={relief ? 'is-active' : ''} onClick={() => setRelief((valeur) => !valeur)}>⛰ Relief</button>
          <button type="button" className={night ? 'is-active' : ''} onClick={() => { setAutoNight(false); setNight(!night) }}>{night ? '☾ Nuit' : '☀ Jour'}</button>
          <button type="button" onClick={() => basculerPleinEcran(false)}>✕ Quitter</button>
        </div>
      )}
      <header className="busmap__header">
        <div>
          <span className="busmap__eyebrow">RÉSEAU DE BUS · ANTSIRABE</span>
          <h1>Lignes &amp; arrêts</h1>
          <p>Arrêts, trajet et positions des scans pour chaque ligne de bus.</p>
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={() => void recharger()}
          disabled={loading || busy || !ligne}
        >
          ↻ Actualiser
        </button>
      </header>

      <section className="busmap__toolbar" aria-label="Choix de la ligne">
        <label className="busmap__field">
          <span>Ligne</span>
          <select value={ligne} onChange={(event) => setLigne(event.target.value)}>
            {lignes.length === 0 && <option value="">Aucune ligne</option>}
            {lignes.map((item) => (
              <option key={item.valeur} value={item.valeur}>
                Ligne {item.valeur} · {item.bus} bus · {item.arrets} arrêt{item.arrets === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>

        <div className="busmap__stats">
          <span><b>{detail?.arrets.length ?? 0}</b> arrêts</span>
          <span><b>{detail?.trajet?.points.length ?? 0}</b> points de tracé</span>
          <span><b>{detail?.scans.length ?? 0}</b> scans géolocalisés</span>
          {detail?.trajet && (
            <span className="busmap__source">
              Tracé {detail.trajet.source === 'scan' ? 'issu des scans' : 'manuel'}
            </span>
          )}
          {ligneCourante && <span className="busmap__source">{ligneCourante.bus} bus sur la ligne</span>}
        </div>

        <div className="busmap__basemap" role="group" aria-label="Affichage de la carte">
          <button type="button" className={basemap === 'plan' ? 'is-active' : ''} onClick={() => setBasemap('plan')}>Plan</button>
          <button type="button" className={basemap === 'satellite' ? 'is-active' : ''} onClick={() => setBasemap('satellite')}>Satellite</button>
        </div>

        <div className="busmap__basemap" role="group" aria-label="Vue 2D ou 3D">
          <button type="button" className={viewMode === '2d' ? 'is-active' : ''} onClick={() => setViewMode('2d')}>2D</button>
          <button type="button" className={viewMode === '3d' ? 'is-active' : ''} onClick={() => setViewMode('3d')}>3D</button>
        </div>

        <div className="busmap__basemap" role="group" aria-label="Moment de la journée">
          <button type="button" className={!night ? 'is-active' : ''} onClick={() => { setAutoNight(false); setNight(false) }}>☀ Jour</button>
          <button type="button" className={night ? 'is-active' : ''} onClick={() => { setAutoNight(false); setNight(true) }}>☾ Nuit</button>
        </div>

        <div className="busmap__basemap" role="group" aria-label="Relief du terrain">
          <button type="button" className={relief ? 'is-active' : ''} onClick={() => setRelief((valeur) => !valeur)}>⛰ Relief</button>
        </div>
      </section>

      {error && <div className="alert error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Fermer">×</button></div>}
      {message && <div className="busmap__message" role="status">{message}<button type="button" onClick={() => setMessage('')} aria-label="Fermer">×</button></div>}

      <section className="busmap__workspace">
        <div className={`busmap__map${mode !== 'lecture' ? ' is-editing' : ''}`}>
          <MapCanvas
            points={points}
            lines={lines}
            vehicle={vehicule}
            follow={suivi}
            terrain={relief}
            focus={focus}
            selectedKey={selected}
            center={center}
            zoom={zoom}
            basemap={basemap}
            viewMode={viewMode}
            night={night}
            onSelect={(key) => setSelected(key)}
            onMove={(nextCenter, nextZoom) => { setCenter(nextCenter); setZoom(nextZoom) }}
            onMapClick={canEdit ? handleMapClick : undefined}
          />
          {mode === 'arret' && <div className="busmap__hint">Cliquez sur la carte pour placer le nouvel arrêt.</div>}
          {mode === 'trace' && <div className="busmap__hint">Cliquez sur la carte pour ajouter des points au tracé ({draft.length} point{draft.length === 1 ? '' : 's'}).</div>}
          {!pleinEcran && (
            <button type="button" className="busmap__fullscreen" onClick={() => basculerPleinEcran(true)}>
              ⤢ Plein écran
            </button>
          )}
          {loading && <div className="busmap__loading">Chargement de la ligne…</div>}
        </div>

        <aside className="busmap__side" aria-label="Arrêts et outils">
          <div className="busmap__simulation">
            <div className="busmap__simulation-heading">
              <h2>Simulation du bus</h2>
              <span className={`busmap__night-badge${night ? ' is-night' : ''}`}>{night ? '☾ Nuit' : '☀ Jour'}</span>
            </div>
            <div className="busmap__buttons">
              <button
                type="button"
                className={`button ${simulation ? 'secondary danger' : 'primary'}`}
                onClick={() => (simulation ? arreterSimulation() : demarrerSimulation())}
                disabled={!simulation && (trace.length < 2 || loading)}
              >
                {simulation ? '■ Arrêter' : '▶ Simuler le bus'}
              </button>
              <label className="busmap__field small">
                <span>Vitesse</span>
                <select value={vitesse} onChange={(event) => setVitesse(event.target.value)}>
                  <option value="1">×1 (20 km/h)</option>
                  <option value="10">×10</option>
                  <option value="30">×30</option>
                  <option value="60">×60</option>
                </select>
              </label>
            </div>
            {simulation && (
              <div className="busmap__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((parcouru / (longueur || 1)) * 100)}>
                <div style={{ width: `${Math.min(100, (parcouru / (longueur || 1)) * 100)}%` }} />
              </div>
            )}
            {simulation && (
              <div className="busmap__buttons">
                <button type="button" className={`button ${suivi ? 'secondary' : 'primary'}`} onClick={() => (suivi ? setSuivi(false) : recentrer())}>
                  {suivi ? '⌖ Suivi actif' : '⌖ Recentrer sur le bus'}
                </button>
              </div>
            )}
            <p className="busmap__coords">
              {simulation
                ? `${(parcouru / 1000).toFixed(2)} km / ${(longueur / 1000).toFixed(2)} km`
                : trace.length < 2
                  ? 'Aucun tracé à simuler pour cette ligne.'
                  : `Tracé de ${(longueur / 1000).toFixed(2)} km`}
            </p>
            <p className="busmap__simulation-note">La nuit, les feux de route du bus s’allument. La simulation passe en 3D automatiquement.</p>
          </div>

          {canEdit && (
            <div className="busmap__tools">
              <h2>Outils</h2>
              <div className="busmap__buttons">
                <button type="button" className={`button ${mode === 'arret' ? 'primary' : 'secondary'}`} onClick={() => { setMode(mode === 'arret' ? 'lecture' : 'arret'); setStopDraft(null) }}>
                  + Arrêt
                </button>
                <button type="button" className={`button ${mode === 'trace' ? 'primary' : 'secondary'}`} onClick={() => { setMode(mode === 'trace' ? 'lecture' : 'trace'); setStopDraft(null) }}>
                  ✎ Tracer
                </button>
                <button type="button" className="button secondary" onClick={() => void tracerDepuisScans()} disabled={busy || !ligne}>
                  ⚡ Depuis les scans
                </button>
              </div>
              <label className="busmap__field small">
                <span>Scans des</span>
                <select value={jours} onChange={(event) => setJours(event.target.value)}>
                  <option value="7">7 derniers jours</option>
                  <option value="30">30 derniers jours</option>
                  <option value="90">90 derniers jours</option>
                  <option value="365">12 derniers mois</option>
                </select>
              </label>
              {detail?.trajet && (
                <button type="button" className="button secondary danger" onClick={() => void effacerTrace()} disabled={busy}>
                  Effacer le tracé
                </button>
              )}
              {detail?.trajet && detail.trajet.source !== 'route' && (
                <button type="button" className="button secondary" onClick={() => void routerTrace()} disabled={busy}>
                  ↻ Recaler sur les routes
                </button>
              )}
            </div>
          )}

          {stopDraft && (
            <div className="busmap__form">
              <h2>Nouvel arrêt</h2>
              <p className="busmap__coords">{stopDraft.latitude.toFixed(6)}, {stopDraft.longitude.toFixed(6)}</p>
              <label className="busmap__field">
                <span>Nom de l’arrêt</span>
                <input
                  value={stopDraft.nom}
                  autoFocus
                  onChange={(event) => setStopDraft((current) => current ? { ...current, nom: event.target.value } : current)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void enregistrerArret() }}
                  placeholder="Ex : Gare routière, Hôpital…"
                />
              </label>
              <div className="busmap__buttons">
                <button type="button" className="button secondary" onClick={() => setStopDraft(null)}>Annuler</button>
                <button type="button" className="button primary" onClick={() => void enregistrerArret()} disabled={busy || !stopDraft.nom.trim()}>
                  Enregistrer
                </button>
              </div>
            </div>
          )}

          {mode === 'trace' && (
            <div className="busmap__form">
              <h2>Tracé manuel</h2>
              <p className="busmap__coords">{draft.length} point{draft.length === 1 ? '' : 's'} placé{draft.length === 1 ? '' : 's'}</p>
              <div className="busmap__buttons">
                <button type="button" className="button secondary" onClick={() => setDraft((current) => current.slice(0, -1))} disabled={!draft.length}>Retirer le dernier</button>
                <button type="button" className="button secondary" onClick={() => { setDraft([]); setMode('lecture') }}>Annuler</button>
                <button type="button" className="button primary" onClick={() => void enregistrerTrace()} disabled={busy || draft.length < 2}>Enregistrer le tracé</button>
              </div>
            </div>
          )}

          <div className="busmap__stops">
            <div className="busmap__stops-heading">
              <h2>Arrêts de la ligne {ligne || '—'}</h2>
              <span>{detail?.arrets.length ?? 0}</span>
            </div>
            {detail?.arrets.length ? (
              <ol className="busmap__stop-list">
                {detail.arrets.map((arret, index) => (
                  <li key={arret.id} className={`busmap__stop${selected === `arret:${arret.id}` ? ' is-selected' : ''}`}>
                    <button type="button" className="busmap__stop-main" onClick={() => { setSelected(`arret:${arret.id}`); setCenter({ latitude: Number(arret.latitude), longitude: Number(arret.longitude) }) }}>
                      <span className="busmap__stop-index">{index + 1}</span>
                      <span className="busmap__stop-name">{arret.nom}</span>
                    </button>
                    {canEdit && (
                      <button type="button" className="busmap__stop-delete" onClick={() => void supprimerArret(arret)} disabled={busy} aria-label={`Supprimer ${arret.nom}`}>×</button>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="busmap__empty">Aucun arrêt enregistré pour cette ligne.</p>
            )}
          </div>

          {arretSelectionne && (
            <div className="busmap__detail">
              <h2>{arretSelectionne.nom}</h2>
              <dl>
                <div><dt>Position</dt><dd>{Number(arretSelectionne.latitude).toFixed(6)}, {Number(arretSelectionne.longitude).toFixed(6)}</dd></div>
                <div><dt>Ordre</dt><dd>{arretSelectionne.ordre}</dd></div>
              </dl>
            </div>
          )}
        </aside>
      </section>

      <footer className="busmap__legend">
        <span><i style={{ background: '#e8a33d' }} /> Tracé de la ligne</span>
        <span><i style={{ background: '#1f6feb' }} /> Arrêt</span>
        <span><i style={{ background: '#8a97a6' }} /> Scan géolocalisé</span>
        <span><i style={{ background: '#d94f4f' }} /> Tracé en cours</span>
        <span>Relief © Mapzen / AWS Terrain Tiles · © OpenStreetMap</span>
      </footer>
    </div>
  )
}
