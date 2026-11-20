import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import MapCanvas from '../MapCanvas'
import type { MapLine, MapPoint } from '../MapCanvas'
import { izApi } from './api'
import type { IZRecord } from './api'
import {
  Alert, Empty, Field, Loading, Modal, PageHead, PasswordInput, StatCard, StatusBadge, useApp, useAsync,
} from './components'

const dateText = (value?: string | null) => (value ? String(value).slice(0, 10) : '—')

/* ------------------------------------------------------------------ */
/* Accueil                                                             */
/* ------------------------------------------------------------------ */

export function HomePage() {
  const { t, navigate, user } = useApp()
  const { data } = useAsync(() => izApi.publicStats(), [])
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<void> } | null>(null)
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as unknown as { prompt: () => Promise<void> })
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  const installPwa = () => {
    if (installPrompt) {
      void installPrompt.prompt()
      setInstallPrompt(null)
    } else {
      alert(t('home.mobileHelp'))
    }
  }
  const features = [
    { icon: '🔎', title: t('home.f1Title'), text: t('home.f1Text') },
    { icon: '🛡️', title: t('home.f2Title'), text: t('home.f2Text') },
    { icon: '📣', title: t('home.f3Title'), text: t('home.f3Text') },
    { icon: '📊', title: t('home.f4Title'), text: t('home.f4Text') },
  ]
  return (
    <>
      <section className="iz-hero">
        <span className="iz-hero-badge"><span className="iz-dot" />{t('home.badge')}</span>
        <h1>{t('home.title')}</h1>
        <p>{t('home.subtitle')}</p>
        <div className="iz-hero-actions">
          <button className="iz-btn iz-btn-primary" onClick={() => navigate('/recherche')}>
            {t('home.ctaSearch')} →
          </button>
          <button className="iz-btn iz-btn-outline" onClick={() => navigate('/signaler')}>
            {t('home.ctaSignal')}
          </button>
        </div>
      </section>

      <section className="iz-section" style={{ marginTop: 28 }}>
        <div className="iz-grid iz-grid-4">
          <StatCard icon="🚐" value={data?.vehicules ?? '—'} label={t('home.statVehicles')} />
          <StatCard icon="🤝" value={data?.cooperatives ?? '—'} label={t('home.statCoops')} />
          <StatCard icon="👥" value={data?.proprietaires ?? '—'} label={t('home.statOwners')} />
          <StatCard icon="📣" value={data?.signalements ?? '—'} label={t('home.statSignals')} />
        </div>
      </section>

      <section className="iz-section">
        <div className="iz-section-head">
          <div>
            <div className="iz-eyebrow">Gestion de Bus CU/ABE</div>
            <h2>{t('home.featuresTitle')}</h2>
            <p className="iz-muted">{t('home.featuresSubtitle')}</p>
          </div>
        </div>
        <div className="iz-grid iz-grid-4">
          {features.map((feature) => (
            <div className="iz-card iz-card-hover" key={feature.title}>
              <div className="iz-feature-icon">{feature.icon}</div>
              <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>{feature.title}</h3>
              <p className="iz-muted iz-small">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="iz-section">
        <div className="iz-section-head">
          <div>
            <div className="iz-eyebrow">Gestion de Bus CU/ABE</div>
            <h2>{t('home.mobileTitle')}</h2>
            <p className="iz-muted">{t('home.mobileSubtitle')}</p>
          </div>
        </div>
        <div className="iz-grid">
          <div className="iz-card iz-card-hover">
            <div className="iz-feature-icon">📱</div>
            <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>Application Android — Bus CU/ABE</h3>
            <p className="iz-muted iz-small">
              Une seule application : accédez au scan et au signalement sans compte, ou
              connectez-vous avec votre compte contrôleur pour ajouter et gérer les comptes.
            </p>
            <div className="iz-flex iz-wrap" style={{ marginTop: 12 }}>
              <a className="iz-btn iz-btn-primary iz-btn-sm" href="/downloads/gestion-bus.apk" download>
                {t('home.mobileDownload')}
              </a>
              <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={installPwa}>{t('home.mobileInstall')}</button>
            </div>
          </div>
        </div>
        <p className="iz-small iz-muted" style={{ marginTop: 10 }}>{t('home.mobileHelp')}</p>
      </section>

      {user && (
        <section className="iz-section">
          <div className="iz-section-head">
            <div>
              <h2>{t('coops.title')}</h2>
              <p className="iz-muted">{t('coops.subtitle')}</p>
            </div>
          </div>
          <div className="iz-grid iz-grid-2">
            <button type="button" className="iz-card iz-card-hover iz-link-card" onClick={() => navigate('/cooperatives')}>
              <div className="iz-feature-icon">🤝</div>
              <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>{t('nav.coops')}</h3>
              <p className="iz-muted iz-small">{data?.cooperatives ?? '—'} coopérative(s) · {data?.vehicules ?? '—'} véhicule(s)</p>
              <span className="iz-btn iz-btn-outline iz-btn-sm" style={{ marginTop: 12 }}>{t('common.details')} →</span>
            </button>
          </div>
        </section>
      )}

      <section className="iz-iz-card iz-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
        <h2>{t('home.ctaFooter')}</h2>
        <div className="iz-hero-actions" style={{ justifyContent: 'center' }}>
          <button className="iz-btn iz-btn-primary" onClick={() => navigate('/recherche')}>
            {t('home.ctaSearch')}
          </button>
          <button className="iz-btn iz-btn-outline" onClick={() => navigate('/carte')}>
            {t('nav.map')}
          </button>
        </div>
      </section>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Recherche de licence                                                */
/* ------------------------------------------------------------------ */

export function SearchPage() {
  const { t } = useApp()
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState({ q: '', cooperative: '', ligne: '', statut: '' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<IZRecord | null>(null)

  const { data, loading, error } = useAsync(
    () => izApi.vehicles({ ...submitted, page, limit: 20 }),
    [submitted, page],
  )
  const coops = useAsync(() => izApi.cooperatives(), [])
  const lines = useAsync(() => izApi.lines(), [])

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    setPage(1)
    setSubmitted({ q: query, cooperative: '', ligne: '', statut: '' })
  }
  const updateFilter = (key: string, value: string) => {
    setPage(1)
    setSubmitted((current) => ({ ...current, [key]: value }))
  }

  return (
    <>
      <PageHead title={t('search.title')} subtitle={t('search.subtitle')} />
      <form className="iz-card" onSubmit={submit}>
        <div className="iz-search-row">
          <input
            className="iz-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search.placeholder')}
          />
          <button className="iz-btn iz-btn-primary" type="submit">{t('search.button')}</button>
        </div>
        <div className="iz-form-grid" style={{ marginTop: 14, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <Field label={t('search.allCoops')}>
            <select className="iz-select" value={submitted.cooperative} onChange={(e) => updateFilter('cooperative', e.target.value)}>
              <option value="">{t('search.allCoops')}</option>
              {(coops.data ?? []).map((coop) => (
                <option key={coop.id} value={coop.code}>{coop.nom}</option>
              ))}
            </select>
          </Field>
          <Field label={t('search.allLines')}>
            <select className="iz-select" value={submitted.ligne} onChange={(e) => updateFilter('ligne', e.target.value)}>
              <option value="">{t('search.allLines')}</option>
              {(lines.data ?? []).map((line) => (
                <option key={line.id} value={line.code}>{line.nom}</option>
              ))}
            </select>
          </Field>
          <Field label={t('search.allStatus')}>
            <select className="iz-select" value={submitted.statut} onChange={(e) => updateFilter('statut', e.target.value)}>
              <option value="">{t('search.allStatus')}</option>
              <option value="Valide">{t('search.valid')}</option>
              <option value="Expirée">{t('search.expired')}</option>
              <option value="Non renseignée">{t('search.unknown')}</option>
            </select>
          </Field>
        </div>
      </form>

      <div className="iz-section-head" style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: '1.1rem' }}>
          {data?.total ?? 0} {t('search.resultCount')}
        </h2>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {loading ? <Loading /> : !data?.data.length ? <Empty message={t('search.noResults')} /> : (
        <div className="iz-table-wrap">
          <table className="iz-table">
            <thead>
              <tr>
                <th>{t('search.plate')}</th>
                <th>{t('search.owner')}</th>
                <th>{t('search.cooperative')}</th>
                <th>{t('search.line')}</th>
                <th>{t('search.licence')}</th>
                <th>{t('search.validity')}</th>
                <th>{t('search.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.data.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td className="iz-mono iz-upper"><strong>{vehicle.immatriculation}</strong></td>
                  <td>{vehicle.proprietaireNom ?? '—'}</td>
                  <td>{vehicle.cooperativeCode ?? '—'}</td>
                  <td>{vehicle.ligne ?? '—'}</td>
                  <td className="iz-mono iz-small">{vehicle.licenceNumero ?? '—'}</td>
                  <td className="iz-small">{dateText(vehicle.licenceFin)}</td>
                  <td><StatusBadge status={vehicle.statutLicence} /></td>
                  <td>
                    <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setSelected(vehicle)}>
                      {t('search.view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > data.limit && (
        <div className="iz-flex" style={{ justifyContent: 'center', marginTop: 18 }}>
          <button className="iz-btn iz-btn-outline iz-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
          <span className="iz-small">{page} / {Math.ceil(data.total / data.limit)}</span>
          <button className="iz-btn iz-btn-outline iz-btn-sm" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>→</button>
        </div>
      )}
      {selected && <VehicleDetail vehicle={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

function VehicleDetail({ vehicle, onClose }: { vehicle: IZRecord; onClose: () => void }) {
  const { t } = useApp()
  const detail = useAsync(() => izApi.vehicle(vehicle.immatriculation), [vehicle.immatriculation])
  const record = detail.data ?? vehicle
  return (
    <Modal title={`${t('common.details')} — ${vehicle.immatriculation}`} onClose={onClose}>
      {detail.loading ? <Loading /> : (
        <>
          <div className="iz-detail-grid">
            <div className="iz-detail-item"><span>{t('search.owner')}</span><strong>{record.proprietaireNom ?? '—'}</strong></div>
            <div className="iz-detail-item"><span>{t('search.cooperative')}</span><strong>{record.cooperativeNom ?? '—'}</strong></div>
            <div className="iz-detail-item"><span>{t('search.line')}</span><strong>{record.ligne ?? '—'}</strong></div>
            <div className="iz-detail-item"><span>{t('search.licence')}</span><strong className="iz-mono">{record.licenceNumero ?? '—'}</strong></div>
            <div className="iz-detail-item"><span>{t('search.validity')}</span><strong>{record.licenceValidite ?? dateText(record.licenceFin)}</strong></div>
            <div className="iz-detail-item"><span>{t('search.status')}</span><StatusBadge status={record.statutLicence} /></div>
          </div>
          <h3 style={{ fontSize: '.95rem', margin: '20px 0 10px' }}>{t('control.scans')}</h3>
          {(record.scans ?? []).length ? (
            <div className="iz-table-wrap">
              <table className="iz-table">
                <thead><tr><th>{t('common.date')}</th><th>{t('common.status')}</th></tr></thead>
                <tbody>
                  {record.scans.map((scan: IZRecord) => (
                    <tr key={scan.id}>
                      <td className="iz-small">{String(scan.scanTime).slice(0, 16).replace('T', ' ')}</td>
                      <td><StatusBadge status={scan.resultat} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="iz-muted iz-small">{t('control.scans')} : 0</p>}
        </>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Signalement                                                         */
/* ------------------------------------------------------------------ */

export function SignalPage() {
  const { t, notify, navigate, route, user } = useApp()
  const initialPlate = new URLSearchParams(route.split('?')[1]).get('plaque') ?? ''
  const [form, setForm] = useState({ immatriculation: initialPlate, categorie: '', description: '', adresse: '', photo: '' })
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null)
  const [reference, setReference] = useState('')
  const [sending, setSending] = useState(false)
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!form.immatriculation || !form.categorie || form.description.length < 10) {
      notify(t('signal.required'), 'error')
      return
    }
    setSending(true)
    try {
      const result = await izApi.createSignal({ ...form, ...position })
      setReference(result.reference)
      notify(t('signal.success'), 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    } finally {
      setSending(false)
    }
  }

  // Une photo de telephone pese plusieurs Mo : on la redimensionne et on la
  // recompresse avant l'envoi, sans quoi l'API la refuserait (2 Mo maximum).
  const MAX_PHOTO_BYTES = 2 * 1024 * 1024
  const PHOTO_MAX_WIDTH = 1280

  const onPhoto = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify(t('signal.photoType'), 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const source = String(reader.result ?? '')
      const image = new Image()
      image.onload = () => {
        const ratio = Math.min(1, PHOTO_MAX_WIDTH / image.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * ratio))
        canvas.height = Math.max(1, Math.round(image.height * ratio))
        const context = canvas.getContext('2d')
        if (!context) {
          set('photo', source)
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        const base64 = dataUrl.split(',')[1] ?? ''
        if (Math.floor((base64.length * 3) / 4) > MAX_PHOTO_BYTES) {
          set('photo', '')
          notify(t('signal.photoTooLarge'), 'error')
          return
        }
        set('photo', dataUrl)
      }
      image.onerror = () => notify(t('signal.photoType'), 'error')
      image.src = source
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <PageHead title={t('signal.title')} subtitle={t('signal.subtitle')} />
      <div className="iz-card" style={{ maxWidth: 760 }}>
        {reference ? (
          <div>
            <Alert type="success">{t('signal.success')} <strong className="iz-mono">{reference}</strong></Alert>
            <div className="iz-hero-actions">
              {user ? (
                <button className="iz-btn iz-btn-primary" onClick={() => navigate(`/suivi?ref=${reference}`)}>
                  {t('signal.trackNow')}
                </button>
              ) : (
                <p className="iz-small iz-muted" style={{ margin: 0 }}>
                  Conservez cette référence. Le suivi est réservé aux agents habilités : connectez-vous pour consulter l’avancement.
                </p>
              )}
              <button className="iz-btn iz-btn-outline" onClick={() => { setReference(''); setPosition(null); setForm({ immatriculation: initialPlate, categorie: '', description: '', adresse: '', photo: '' }) }}>
                {t('common.add')}
              </button>
            </div>
          </div>
        ) : (
          <form className="iz-form-grid" onSubmit={submit}>
            <Field label={t('signal.plate')}>
              <input className="iz-input iz-upper" required value={form.immatriculation} onChange={(e) => set('immatriculation', e.target.value)} placeholder="0169 TBF" />
            </Field>
            <Field label={t('signal.category')}>
              <select className="iz-select" required value={form.categorie} onChange={(e) => set('categorie', e.target.value)}>
                <option value="">—</option>
                {[1, 2, 3, 4].map((index) => <option key={index} value={t(`signal.cat${index}`)}>{t(`signal.cat${index}`)}</option>)}
              </select>
            </Field>
            <Field label={t('signal.description')} full>
              <textarea className="iz-textarea" required minLength={10} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <Field label={t('signal.address')} full>
              <input className="iz-input" value={form.adresse} onChange={(e) => set('adresse', e.target.value)} />
            </Field>
            <div className="full">
              <button type="button" className="iz-btn iz-btn-outline" onClick={() => {
                if (!navigator.geolocation) { notify('Géolocalisation indisponible.', 'error'); return }
                navigator.geolocation.getCurrentPosition(
                  ({ coords }) => setPosition({ latitude: coords.latitude, longitude: coords.longitude }),
                  () => notify('Position indisponible. Vous pouvez saisir une adresse.', 'error'),
                  { timeout: 10000 },
                )
              }}>Joindre ma position (facultatif)</button>
              {position && <p className="iz-small">Position jointe <button type="button" className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => setPosition(null)}>Retirer</button></p>}
            </div>
            <Field label={t('signal.photo')} full>
              <input className="iz-input" type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} />
            </Field>
            <div className="full">
              <button className="iz-btn iz-btn-primary" disabled={sending} type="submit">
                {sending ? <span className="iz-spinner" /> : null}{t('signal.send')}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Suivi                                                               */
/* ------------------------------------------------------------------ */

export function TrackPage() {
  const { t } = useApp()
  const initialRef = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('ref') ?? ''
  const [reference, setReference] = useState(initialRef)
  const [searched, setSearched] = useState(initialRef)
  const { data, loading, error } = useAsync(
    () => (searched ? izApi.followSignal(searched) : Promise.resolve(null)),
    [searched],
  )

  useEffect(() => {
    if (initialRef) setReference(initialRef)
  }, [initialRef])

  return (
    <>
      <PageHead title={t('track.title')} subtitle={t('track.subtitle')} />
      <form className="iz-card iz-search-row" style={{ maxWidth: 760 }} onSubmit={(event) => { event.preventDefault(); setSearched(reference) }}>
        <input className="iz-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('track.reference')} />
        <button className="iz-btn iz-btn-primary" type="submit">{t('track.button')}</button>
      </form>
      <div style={{ maxWidth: 760, marginTop: 18 }}>
        {loading ? <Loading /> : error ? <Alert type="error">{t('track.notFound')}</Alert> : data && (
          <div className="iz-card">
            <div className="iz-flex iz-wrap" style={{ justifyContent: 'space-between' }}>
              <strong className="iz-mono">{data.reference}</strong>
              <StatusBadge status={data.statut} />
            </div>
            <div className="iz-detail-grid" style={{ marginTop: 16 }}>
              <div className="iz-detail-item"><span>{t('signal.plate')}</span><strong>{data.immatriculation}</strong></div>
              <div className="iz-detail-item"><span>{t('signal.category')}</span><strong>{data.categorie}</strong></div>
              <div className="iz-detail-item"><span>{t('track.created')}</span><strong>{String(data.createdAt).slice(0, 16).replace('T', ' ')}</strong></div>
              <div className="iz-detail-item"><span>{t('signal.address')}</span><strong>{data.adresse ?? '—'}</strong></div>
            </div>
            <p className="iz-muted" style={{ marginTop: 14 }}>{data.description}</p>
          </div>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Carte                                                               */
/* ------------------------------------------------------------------ */

export function MapPage() {
  const { t, theme } = useApp()
  const [layer, setLayer] = useState<'arret' | 'vehicle'>('arret')
  const [selectedKey, setSelectedKey] = useState('')
  const [center, setCenter] = useState({ latitude: -19.865, longitude: 47.033 })
  const [zoom, setZoom] = useState(13)
  const [basemap, setBasemap] = useState<'plan' | 'satellite'>('plan')
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')

  const { data: lines } = useAsync(() => izApi.lines(), [])
  const { data: vehicles } = useAsync(() => izApi.map(), [])
  const { data: stops } = useAsync(async () => {
    const all = await Promise.all((lines ?? []).map((line) => izApi.stops(line.id)))
    return all.flat()
  }, [lines])

  const points = useMemo<MapPoint[]>(() => {
    const result: MapPoint[] = []
    if (layer === 'arret') {
      for (const stop of stops ?? []) {
        if (stop.latitude == null) continue
        result.push({
          key: `arret-${stop.id}`, label: stop.nom, kind: 'arret', color: '#2563eb',
          latitude: Number(stop.latitude), longitude: Number(stop.longitude),
        })
      }
    }
    if (layer === 'vehicle') {
      for (const vehicle of vehicles ?? []) {
        if (vehicle.latitude == null) continue
        result.push({
          key: `vehicle-${vehicle.id}`, label: vehicle.immatriculation, kind: 'vehicle',
          color: vehicle.statutLicence === 'Valide' ? '#16a34a' : '#dc2626',
          latitude: Number(vehicle.latitude), longitude: Number(vehicle.longitude),
        })
      }
    }
    return result
  }, [layer, stops, vehicles])

  const mapLines = useMemo<MapLine[]>(() => {
    if (layer !== 'arret' || !lines) return []
    return lines.map((line) => ({
      key: `ligne-${line.id}`, color: line.couleur ?? '#2563eb',
      points: (stops ?? [])
        .filter((stop) => String(stop.nom).endsWith(String(line.code)))
        .map((stop) => ({ latitude: Number(stop.latitude), longitude: Number(stop.longitude) })),
    })).filter((item) => item.points.length > 1)
  }, [layer, lines, stops])

  return (
    <>
      <PageHead
        title={t('map.title')}
        subtitle={t('map.subtitle')}
        action={
          <div className="iz-flex iz-wrap">
            <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setBasemap(basemap === 'plan' ? 'satellite' : 'plan')}>
              {basemap === 'plan' ? '🛰 Satellite' : '🗺 Plan'}
            </button>
            <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')}>
              {viewMode.toUpperCase()}
            </button>
          </div>
        }
      />
      <div className="iz-map-layout">
        <div className="iz-map-box">
          <MapCanvas
            points={points}
            lines={mapLines}
            vehicle={null}
            follow={false}
            terrain={viewMode === '3d'}
            focus={null}
            selectedKey={selectedKey}
            center={center}
            zoom={zoom}
            basemap={basemap}
            viewMode={viewMode}
            night={theme === 'dark'}
            onSelect={setSelectedKey}
            onMove={(nextCenter, nextZoom) => { setCenter(nextCenter); setZoom(nextZoom) }}
          />
        </div>
        <aside className="iz-card">
          <h3 style={{ fontSize: '.95rem', marginBottom: 10 }}>{t('map.selectLayer')}</h3>
          {(['arret', 'vehicle'] as const).map((name) => (
            <div className="iz-map-layer" key={name}>
              <button className={`iz-btn ${layer === name ? 'iz-btn-primary' : 'iz-btn-ghost'} iz-btn-sm`} onClick={() => { setLayer(name); setSelectedKey('') }}>
                {t(name === 'arret' ? 'map.stops' : 'map.vehicles')}
              </button>
              <span className="iz-badge">{name === 'arret' ? stops?.length : vehicles?.length}</span>
            </div>
          ))}
          <h3 style={{ fontSize: '.9rem', margin: '16px 0 6px' }}>{t('common.details')}</h3>
          <div className="iz-map-list">
            {points.length ? points.map((point) => (
              <button key={point.key} className={selectedKey === point.key ? 'active' : ''} onClick={() => {
                setSelectedKey(point.key)
                setCenter({ latitude: point.latitude, longitude: point.longitude })
                setZoom(15)
              }}>
                <strong>{point.label}</strong>
                <span className="iz-small iz-muted" style={{ display: 'block' }}>
                  {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                </span>
              </button>
            )) : <p className="iz-muted iz-small">{t('map.none')}</p>}
          </div>
        </aside>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Coopératives                                                        */
/* ------------------------------------------------------------------ */

export function CooperativesPage() {
  const { t, navigate } = useApp()
  const { data, loading } = useAsync(() => izApi.cooperatives(), [])
  const [active, setActive] = useState<IZRecord | null>(null)
  const [buses, setBuses] = useState<IZRecord[]>([])
  const [busesLoading, setBusesLoading] = useState(false)

  const openCoop = async (coop: IZRecord) => {
    setActive(coop)
    setBuses([])
    setBusesLoading(true)
    try {
      const result = await izApi.vehicles({ cooperative: String(coop.code), limit: 500 })
      setBuses(result.data)
    } catch {
      setBuses([])
    } finally {
      setBusesLoading(false)
    }
  }

  return (
    <>
      <PageHead title={t('coops.title')} subtitle={t('coops.subtitle')} />
      {loading ? <Loading /> : (
        <div className="iz-grid iz-grid-3">
          {(data ?? []).map((coop) => (
            <button type="button" className="iz-card iz-card-hover iz-link-card" key={coop.id} onClick={() => void openCoop(coop)}>
              <div className="iz-flex" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '1.05rem' }}>{coop.nom}</strong>
                <span className="iz-chip">{coop.code}</span>
              </div>
              <p className="iz-muted iz-small" style={{ margin: '10px 0 16px' }}>{coop.description}</p>
              <div className="iz-flex iz-wrap">
                <span className="iz-badge iz-badge-blue">{coop.vehicules} {t('coops.vehicles')}</span>
                <span className="iz-badge">{t('coops.lines')} : {coop.description?.replace(/[^\d,]/g, '') || '—'}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {active && (
        <Modal wide title={`${active.nom} — ${buses.length} ${t('coops.vehicles')}`} onClose={() => setActive(null)}>
          <p className="iz-small iz-muted">Code {active.code} · cliquez sur un véhicule pour ouvrir sa fiche.</p>
          {busesLoading ? <Loading /> : buses.length === 0 ? <Empty message="Aucun véhicule rattaché à cette coopérative." /> : (
            <div className="iz-table-wrap">
              <table className="iz-table">
                <thead><tr><th>{t('search.plate')}</th><th>{t('search.line')}</th><th>Type</th><th>{t('common.status')}</th></tr></thead>
                <tbody>
                  {buses.map((bus) => (
                    <tr key={bus.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/bus?plaque=' + encodeURIComponent(String(bus.immatriculation)))}>
                      <td><strong className="iz-mono">{bus.immatriculation}</strong></td>
                      <td>{bus.ligne ?? '—'}</td>
                      <td>{bus.type ?? '—'}</td>
                      <td><StatusBadge status={bus.statut} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Connexion                                                           */
/* ------------------------------------------------------------------ */

export function LoginPage() {
  const { t, notify, navigate, setUser, route } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetBusy, setResetBusy] = useState(false)
  const [resetMessage, setResetMessage] = useState('')

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setBusy(true)
    try {
      const user = await izApi.login(email, password)
      setUser(user)
      notify(`Bienvenue ${user.firstName || user.email}`, 'success')
      const destination = new URLSearchParams(route.split('?')[1]).get('retour')
      navigate(destination?.startsWith('/bus?') ? destination : route.startsWith('/controle') || route.startsWith('/admin') ? route : user.role === 'admin' || user.role === 'superadmin' ? '/admin' : '/controle')
    } catch (error) {
      notify(error instanceof Error ? error.message : t('auth.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const requestReset = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!resetEmail.trim()) return
    setResetBusy(true)
    setResetMessage('')
    try {
      const result = await izApi.requestPasswordReset(resetEmail.trim())
      setResetMessage(result.message)
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    } finally {
      setResetBusy(false)
    }
  }

  return (
    <div className="iz-auth-wrap">
      <div className="iz-card iz-auth-card">
        <div className="iz-brand">
          <img className="iz-brand-logo" src="/brand/logo-bus.png" alt="Logo bus" />
          <span>Gestion de Bus<small>CU/ABE · Commune Urbaine d’Antsirabe</small></span>
        </div>
        <div className="iz-center" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.3rem' }}>{t('auth.title')}</h2>
          <p className="iz-muted iz-small">{t('auth.subtitle')}</p>
        </div>
        <form className="iz-form-grid" onSubmit={submit}>
          <Field label={t('auth.email')} full>
            <input className="iz-input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t('auth.password')} full>
            <PasswordInput required autoComplete="current-password" value={password} onChange={setPassword} />
          </Field>
          <button className="iz-btn iz-btn-primary full" disabled={busy} type="submit">
            {busy ? <span className="iz-spinner" /> : null}{t('auth.button')}
          </button>
        </form>
        <div className="iz-center" style={{ marginTop: 12 }}>
          <button type="button" className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => { setForgotOpen((value) => !value); setResetEmail(email); setResetMessage('') }}>
            Mot de passe oublié ?
          </button>
        </div>
        {forgotOpen && (
          <form className="iz-card" style={{ marginTop: 12, boxShadow: 'none' }} onSubmit={requestReset}>
            <p className="iz-small iz-muted" style={{ marginTop: 0 }}>
              Indiquez l’adresse de votre compte. Le super administrateur validera la demande et définira un nouveau mot de passe.
            </p>
            <Field label={t('auth.email')} full>
              <input className="iz-input" type="email" required autoComplete="username" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
            </Field>
            <div className="iz-flex iz-wrap" style={{ marginTop: 10 }}>
              <button className="iz-btn iz-btn-primary iz-btn-sm" disabled={resetBusy} type="submit">
                {resetBusy ? <span className="iz-spinner" /> : null}Envoyer la demande
              </button>
              <button className="iz-btn iz-btn-outline iz-btn-sm" type="button" onClick={() => setForgotOpen(false)}>{t('common.cancel')}</button>
            </div>
            {resetMessage && <p className="iz-small" role="status" style={{ marginBottom: 0 }}>{resetMessage}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
