import { useMemo, useState } from 'react'
import MapCanvas from '../MapCanvas'
import type { MapPoint } from '../MapCanvas'
import {
  ArrowLeft, Bell, BookOpen, Check, CircleCheck, ClipboardList, LayoutDashboard,
  MapPin, Megaphone, Plus, Search, Smartphone, TriangleAlert, UserRound, Warehouse,
} from 'lucide-react'
import { BusInformation, QrScanner, plateFromQr } from './bus'
import type { FormEvent, ReactNode } from 'react'
import { izApi } from './api'
import type { IZRecord } from './api'
import {
  Alert, ConfirmDialog, Empty, ExportButton, Field, Loading, PageHead, StatCard, StatusBadge, useApp, useAsync,
} from './components'
import { DashboardShell } from './dashboard'
import { DataTable } from './DataTable'
import { translateError, translateValue } from './i18n'
import { AgentIdentityButton, AgentProfileDialog } from './profiles'

const when = (value?: string | null) => (value ? String(value).slice(0, 16).replace('T', ' ') : '—')

export function ControlLayout({ children }: { children: ReactNode }) {
  const { t, navigate } = useApp()
  const links = [
    { path: '/controle', label: t('control.dashboard'), icon: <LayoutDashboard size={17} /> },
    { path: '/notifications', label: t('nav.notifications'), icon: <Bell size={17} />, badge: true },
    { path: '/controle/scan', label: t('control.scanTitle'), icon: <Search size={17} /> },
    { path: '/controle/scans', label: t('control.scans'), icon: <ClipboardList size={17} /> },
    { path: '/controle/infractions', label: t('control.infractions'), icon: <TriangleAlert size={17} /> },
    { path: '/controle/signals', label: t('control.signals'), icon: <Megaphone size={17} /> },
    { path: '/controle/fourriere', label: t('control.fourriere'), icon: <Warehouse size={17} /> },
    { path: '/signaler', label: t('control.makeSignal'), icon: <Plus size={17} /> },
    { path: '/controle/profil', label: t('control.myProfile'), icon: <UserRound size={17} /> },
    { path: '/controle/manuel', label: t('control.manual'), icon: <BookOpen size={17} /> },
  ]
  return (
    <DashboardShell
      title={t('nav.control')}
      links={links}
    >
      <div className="iz-flex iz-small iz-muted" style={{ marginBottom: 14 }}>
        <button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => navigate('/')}><ArrowLeft size={15} /> {t('nav.home')}</button>
      </div>
      {children}
    </DashboardShell>
  )
}

export function ControlDashboard() {
  const { t, navigate, user } = useApp()
  const { data, loading } = useAsync(() => izApi.controlDashboard(), [])
  return (
    <>
      <PageHead title={t('control.dashboard')} subtitle={t('app.tagline')} />
      {user?.role === 'controleur' && !user.profilComplet && (
        <div style={{ marginBottom: 16 }}>
          <Alert type="error">
            {t('control.profileIncomplete')}{' '}
            <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => navigate('/controle/profil')}>
              {t('control.completeProfile')}
            </button>
          </Alert>
        </div>
      )}
      {loading ? <Loading /> : (
        <>
          <div className="iz-grid iz-grid-4">
            <StatCard icon={<Search size={20} />} value={data?.scans?.total ?? 0} label={t('control.scans')} />
            <StatCard icon={<CircleCheck size={20} />} value={data?.scans?.conformes ?? 0} label={t('control.conforme')} />
            <StatCard icon={<TriangleAlert size={20} />} value={data?.infractions?.ouvertes ?? 0} label={t('control.infractions')} />
            <StatCard icon={<Megaphone size={20} />} value={data?.signals?.nouveaux ?? 0} label={t('control.signals')} />
          </div>
          <div className="iz-grid iz-grid-2" style={{ marginTop: 22 }}>
            <button className="iz-card iz-card-hover" style={{ textAlign: 'left' }} onClick={() => navigate('/controle/scan')}>
              <div className="iz-feature-icon"><Search size={22} /></div>
              <h3>{t('control.scanTitle')}</h3>
              <p className="iz-muted iz-small">{t('control.scanSubtitle')}</p>
            </button>
            <button className="iz-card iz-card-hover" style={{ textAlign: 'left' }} onClick={() => navigate('/controle/signals')}>
              <div className="iz-feature-icon"><Megaphone size={22} /></div>
              <h3>{t('control.signals')}</h3>
              <p className="iz-muted iz-small">{data?.signals?.nouveaux ?? 0} {t('control.signals')}</p>
            </button>
          </div>
        </>
      )}
    </>
  )
}

export function ScanPage() {
  const { t, lang, notify, navigate, route, user } = useApp()
  const [plate, setPlate] = useState(new URLSearchParams(route.split('?')[1]).get('plaque') ?? '')
  const [observation, setObservation] = useState('')
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null)
  const [result, setResult] = useState<IZRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const profilBloque = user?.role === 'controleur' && !user.profilComplet

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setBusy(true)
    try {
      const response = await izApi.scan({ immatriculation: plateFromQr(plate), observation, genererInfraction: false, ...position })
      setResult(response)
      const statut = response.scan?.resultat
      notify(statut ? translateValue(lang, statut) : '', statut === 'Conforme' ? 'success' : 'error')
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (coords) => setPosition({ latitude: coords.coords.latitude, longitude: coords.coords.longitude }),
      () => notify(t('control.gpsUnavailable'), 'error'),
    )
  }

  return (
    <>
      <PageHead title={t('control.scanTitle')} subtitle={t('control.scanSubtitle')} />
      {profilBloque && (
        <div style={{ marginBottom: 16 }}>
          <Alert type="error">
            {t('control.profileRequiredScan')}{' '}
            <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => navigate('/controle/profil')}>{t('signal.myProfile')}</button>
          </Alert>
        </div>
      )}
      <div className="iz-card" style={{ maxWidth: 640 }}>
        <QrScanner onScan={(value) => navigate(`/bus?${new URLSearchParams({ plaque: value })}`)} />
        <form className="iz-form-grid" onSubmit={submit}>
          <Field label={t('control.plate')} full>
            <input className="iz-input iz-upper" required value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="0169 TBF" />
          </Field>
          <Field label={t('control.observation')} full>
            <textarea className="iz-textarea" value={observation} onChange={(e) => setObservation(e.target.value)} />
          </Field>
          <div className="full iz-flex iz-wrap">
            <button className="iz-btn iz-btn-primary" disabled={busy || profilBloque} type="submit">
              {busy ? <span className="iz-spinner" /> : null}{t('control.scan')}
            </button>
            <button className="iz-btn iz-btn-outline" type="button" onClick={locate}><MapPin size={15} /> GPS</button>
          </div>
        </form>
      </div>
      {result && (
        <div className="iz-card" style={{ maxWidth: 640, marginTop: 18 }}>
          <div className="iz-flex" style={{ justifyContent: 'space-between' }}>
            <strong style={{ fontSize: '1.1rem' }}>{result.vehicle?.immatriculation ?? plate.toUpperCase()}</strong>
            <StatusBadge status={result.scan?.resultat} />
          </div>
          {result.infraction && <div style={{ marginTop: 12 }}><Alert type="error">{t('control.infractionCreated')}</Alert></div>}
          {result.vehicle && (
            <>
              <BusInformation
                vehicle={result.vehicle}
                staff
                canEditPhoto
                onPhotoChanged={(photoUrl) => setResult((current) => current
                  ? { ...current, vehicle: { ...current.vehicle, photoUrl } }
                  : current)}
              />
              <button className="iz-btn iz-btn-outline" style={{ marginTop: 16 }} onClick={() => navigate(`/bus?${new URLSearchParams({ plaque: result.vehicle.immatriculation })}`)}>{t('control.ficheLink')}</button>
            </>
          )}
        </div>
      )}
    </>
  )
}

export function ScansPage() {
  const { t, lang, user, notify } = useApp()
  const { data, loading, reload } = useAsync(() => izApi.scans(), [])
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const [viewingAgent, setViewingAgent] = useState<number | null>(null)
  const isSuper = user?.role === 'superadmin'
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const remove = async () => {
    if (!deleting) return
    try {
      await izApi.deleteScan(Number(deleting.id))
      notify(t('control.scanDeleted'), 'success')
      setDeleting(null)
      await reload()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    }
  }
  return (
    <>
      <PageHead title={t('control.scans')} action={(user?.role === 'admin' || user?.role === 'superadmin') ? <ExportButton cible="scans" label="Excel" /> : undefined} />
      {loading ? <Loading /> : (
        <DataTable
          rows={data ?? []}
          rowKey={(scan) => String(scan.id)}
          searchText={(scan) => [scan.immatriculation, scan.resultat, scan.controleurNom, scan.agentPrenom, scan.agentCin, scan.agentFonction, scan.agentMatricule, scan.agentTelephone, scan.observation].join(' ')}
          initialSort="scanTime"
          empty={<Empty />}
          columns={[
            { key: 'scanTime', label: t('common.date'), sortValue: (scan) => String(scan.scanTime ?? ''), render: (scan) => <span className="iz-small iz-nowrap">{when(scan.scanTime)}</span> },
            { key: 'immatriculation', label: t('search.plate'), sortValue: (scan) => String(scan.immatriculation ?? ''), render: (scan) => <span className="iz-mono iz-upper">{scan.immatriculation ?? '—'}</span> },
            { key: 'resultat', label: t('common.status'), sortValue: (scan) => String(scan.resultat ?? ''), render: (scan) => <StatusBadge status={scan.resultat} /> },
            {
              key: 'controleurNom', label: t('control.controller'),
              sortValue: (scan) => `${scan.agentPrenom ?? ''} ${scan.controleurNom ?? ''}`,
              render: (scan) => (
                <AgentIdentityButton
                  id={isAdmin ? scan.agentId : null}
                  name={[scan.agentPrenom, scan.controleurNom].filter(Boolean).join(' ') || scan.controleurNom}
                  onOpen={setViewingAgent}
                />
              ),
            },
            ...(isAdmin ? [
              { key: 'agentCin', label: t('control.cin'), sortValue: (scan: IZRecord) => String(scan.agentCin ?? ''), render: (scan: IZRecord) => <span className="iz-small iz-mono">{scan.agentCin ?? '—'}</span> },
              { key: 'agentFonction', label: t('control.fonction'), sortValue: (scan: IZRecord) => String(scan.agentFonction ?? ''), render: (scan: IZRecord) => <span className="iz-small">{scan.agentFonction ?? '—'}</span> },
              { key: 'agentMatricule', label: t('control.matricule'), sortValue: (scan: IZRecord) => String(scan.agentMatricule ?? ''), render: (scan: IZRecord) => <span className="iz-small iz-mono">{scan.agentMatricule ?? '—'}</span> },
              { key: 'agentTelephone', label: t('control.phone'), sortValue: (scan: IZRecord) => String(scan.agentTelephone ?? ''), render: (scan: IZRecord) => <span className="iz-small">{scan.agentTelephone ?? '—'}</span> },
            ] : []),
            { key: 'observation', label: t('control.observation'), sortValue: (scan) => String(scan.observation ?? ''), render: (scan) => <span className="iz-small">{scan.observation ?? '—'}</span> },
          ]}
          actions={isSuper ? (scan) => (
            <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setDeleting(scan)}>{t('common.delete')}</button>
          ) : undefined}
        />
      )}
      {viewingAgent && <AgentProfileDialog id={viewingAgent} onClose={() => setViewingAgent(null)} />}
      {deleting && (
        <ConfirmDialog
          message={t('control.deleteScan', { date: when(deleting.scanTime) })}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}

export function InfractionsPage() {
  const { t, lang, notify, user } = useApp()
  const { data, loading, reload } = useAsync(() => izApi.infractions(), [])
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const [viewingAgent, setViewingAgent] = useState<number | null>(null)
  const isSuper = user?.role === 'superadmin'
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const setStatut = async (id: number, statut: string) => {
    try {
      await izApi.updateInfraction(id, { statut })
      notify(`${t('control.infractions')} : ${translateValue(lang, statut)}`, 'success')
      await reload()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    }
  }
  const remove = async () => {
    if (!deleting) return
    try {
      await izApi.deleteInfraction(Number(deleting.id))
      notify(t('control.infractionDeleted'), 'success')
      setDeleting(null)
      await reload()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    }
  }
  return (
    <>
      <PageHead title={t('control.infractions')} action={(user?.role === 'admin' || user?.role === 'superadmin') ? <ExportButton cible="infractions" label="Excel" /> : undefined} />
      {loading ? <Loading /> : (
        <DataTable
          rows={data ?? []}
          rowKey={(item) => String(item.id)}
          searchText={(item) => [item.immatriculation, item.type, item.statut, item.controleurNom, item.agentPrenom, item.agentCin, item.agentFonction, item.agentMatricule, item.agentTelephone].join(' ')}
          initialSort="dateInfraction"
          empty={<Empty />}
          columns={[
            { key: 'dateInfraction', label: t('common.date'), sortValue: (item) => String(item.dateInfraction ?? ''), render: (item) => <span className="iz-small iz-nowrap">{when(item.dateInfraction)}</span> },
            { key: 'immatriculation', label: t('search.plate'), sortValue: (item) => String(item.immatriculation ?? ''), render: (item) => <span className="iz-mono">{item.immatriculation ?? '—'}</span> },
            { key: 'type', label: t('signal.category'), sortValue: (item) => String(item.type ?? ''), render: (item) => <>{translateValue(lang, item.type)}</> },
            { key: 'montant', label: t('admin.amount'), sortValue: (item) => Number(item.montant ?? 0), render: (item) => <>{item.montant} Ar</> },
            { key: 'statut', label: t('common.status'), sortValue: (item) => String(item.statut ?? ''), render: (item) => <StatusBadge status={item.statut} /> },
            {
              key: 'controleurNom', label: t('control.agent'),
              sortValue: (item) => `${item.agentPrenom ?? ''} ${item.controleurNom ?? ''}`,
              render: (item) => (
                <AgentIdentityButton
                  id={isAdmin ? item.agentId : null}
                  name={[item.agentPrenom, item.controleurNom].filter(Boolean).join(' ') || item.controleurNom}
                  onOpen={setViewingAgent}
                />
              ),
            },
            ...(isAdmin ? [
              { key: 'agentCin', label: t('control.cin'), sortValue: (item: IZRecord) => String(item.agentCin ?? ''), render: (item: IZRecord) => <span className="iz-small iz-mono">{item.agentCin ?? '—'}</span> },
              { key: 'agentFonction', label: t('control.fonction'), sortValue: (item: IZRecord) => String(item.agentFonction ?? ''), render: (item: IZRecord) => <span className="iz-small">{item.agentFonction ?? '—'}</span> },
              { key: 'agentMatricule', label: t('control.matricule'), sortValue: (item: IZRecord) => String(item.agentMatricule ?? ''), render: (item: IZRecord) => <span className="iz-small iz-mono">{item.agentMatricule ?? '—'}</span> },
              { key: 'agentTelephone', label: t('control.phone'), sortValue: (item: IZRecord) => String(item.agentTelephone ?? ''), render: (item: IZRecord) => <span className="iz-small">{item.agentTelephone ?? '—'}</span> },
            ] : []),
          ]}
          actions={(item) => (
            <>
              <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setStatut(Number(item.id), 'Clôturée')}>
                {t('admin.approve')}
              </button>
              {isSuper && (
                <> <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setDeleting(item)}>{t('common.delete')}</button></>
              )}
            </>
          )}
        />
      )}
      {deleting && (
        <ConfirmDialog
          message={t('control.deleteInfraction', { type: String(deleting.type ?? ''), date: when(deleting.dateInfraction) })}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
      {viewingAgent && <AgentProfileDialog id={viewingAgent} onClose={() => setViewingAgent(null)} />}
    </>
  )
}

export function ControlSignalsPage() {
  const { t, lang, notify, user, navigate, theme } = useApp()
  const { data, loading, reload } = useAsync(() => izApi.controlSignals(), [])
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const [viewingAgent, setViewingAgent] = useState<number | null>(null)
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  // Scans QR du public : positions transmises uniquement aux administrateurs.
  const { data: scans, reload: reloadScans } = useAsync(
    () => (isAdmin ? izApi.adminPublicScans() : Promise.resolve([])),
    [isAdmin],
  )
  const [deletingScan, setDeletingScan] = useState<IZRecord | null>(null)
  const mapPoints = useMemo<MapPoint[]>(() => {
    const list: MapPoint[] = []
    for (const signal of data ?? []) {
      if (signal.latitude == null || signal.longitude == null) continue
      list.push({
        key: `signal-${signal.id}`,
        label: `${String(signal.reference ?? t('track.signalLabel'))} · ${translateValue(lang, signal.categorie)}`,
        kind: 'signal', color: '#dc2626',
        latitude: Number(signal.latitude), longitude: Number(signal.longitude),
      })
    }
    for (const scan of scans ?? []) {
      list.push({
        key: `scan-${scan.id}`,
        label: `Scan QR · ${String(scan.immatriculation ?? t('control.publicSignal'))}`,
        kind: 'scan', color: '#0ea5e9',
        latitude: Number(scan.latitude), longitude: Number(scan.longitude),
      })
    }
    return list
  }, [data, scans, lang, t])
  const resolve = async (id: number, statut: string) => {
    try {
      await izApi.resolveSignal(id, { statut })
      notify(`${t('control.signals')} : ${translateValue(lang, statut)}`, 'success')
      await reload()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    }
  }
  const remove = async () => {
    if (!deleting) return
    try {
      await izApi.deleteSignal(Number(deleting.id))
      notify(t('control.signalDeleted'), 'success')
      setDeleting(null)
      await reload()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    }
  }
  const removeScan = async () => {
    if (!deletingScan) return
    try {
      await izApi.deletePublicScan(Number(deletingScan.id))
      notify(t('control.scanPosDeleted'), 'success')
      setDeletingScan(null)
      await reloadScans()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    }
  }
  return (
    <>
      <PageHead
        title={t('control.signals')}
        subtitle={isAdmin ? t('control.signalsAdminSubtitle') : undefined}
        action={(user?.role === 'admin' || user?.role === 'superadmin') ? <ExportButton cible="signalements" label="Excel" /> : undefined}
      />
      {isAdmin && (
        <div className="iz-card" style={{ marginBottom: 16 }}>
          <div className="iz-flex iz-wrap" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ fontSize: '.95rem', margin: 0 }}><MapPin size={15} className="iz-inline-icon" />{t('control.positionsSent')}</h3>
            <span className="iz-small iz-muted">
              <span className="iz-badge iz-badge-orange">{t('track.signalLabel')}</span>{' '}
              <span className="iz-badge">Scan QR</span> · {t('control.points', { count: mapPoints.length })}
            </span>
          </div>
          <div className="iz-map-box" style={{ height: 380 }}>
            <MapCanvas
              points={mapPoints}
              lines={[]}
              vehicle={null}
              follow={false}
              terrain={false}
              focus={null}
              selectedKey=""
              center={{ latitude: -19.865, longitude: 47.033 }}
              zoom={12.5}
              basemap="plan"
              viewMode="2d"
              night={theme === 'dark'}
              zoomLabels={{ group: t('map.zoomGroup'), zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut') }}
              mapLabel={t('map.canvasAria')}
              onSelect={(key) => {
                const signal = (data ?? []).find((item) => `signal-${item.id}` === key)
                if (signal?.reference) navigate(`/suivi?ref=${encodeURIComponent(String(signal.reference))}`)
              }}
              onMove={() => {}}
            />
          </div>
          <p className="iz-small iz-muted" style={{ marginTop: 8 }}>
            {t('control.mapHint')}
          </p>
        </div>
      )}
      {loading ? <Loading /> : (
        <DataTable
          rows={data ?? []}
          rowKey={(signal) => String(signal.id)}
          searchText={(signal) => [signal.reference, signal.immatriculation, signal.categorie, signal.description, signal.statut, signal.controleurNom, signal.agentPrenom, signal.agentCin, signal.agentFonction, signal.agentMatricule, signal.agentTelephone].join(' ')}
          initialSort="createdAt"
          empty={<Empty />}
          columns={[
            { key: 'reference', label: t('admin.reference'), sortValue: (signal) => String(signal.reference ?? ''), render: (signal) => <span className="iz-mono iz-small">{signal.reference}</span> },
            { key: 'immatriculation', label: t('search.plate'), sortValue: (signal) => String(signal.immatriculation ?? ''), render: (signal) => <span className="iz-mono">{signal.immatriculation}</span> },
            { key: 'categorie', label: t('signal.category'), sortValue: (signal) => String(signal.categorie ?? ''), render: (signal) => <>{translateValue(lang, signal.categorie)}</> },
            { key: 'description', label: t('signal.description'), sortValue: (signal) => String(signal.description ?? ''), render: (signal) => <span className="iz-small" style={{ maxWidth: 260 }}>{signal.description}</span> },
            { key: 'createdAt', label: t('common.date'), sortValue: (signal) => String(signal.createdAt ?? ''), render: (signal) => <span className="iz-small iz-nowrap">{when(signal.createdAt)}</span> },
            {
              key: 'agent', label: t('control.agent'),
              sortValue: (signal) => `${signal.agentPrenom ?? ''} ${signal.controleurNom ?? ''}`,
              render: (signal) => signal.agentId ? (
                <AgentIdentityButton
                  id={isAdmin ? signal.agentId : null}
                  name={[signal.agentPrenom, signal.controleurNom].filter(Boolean).join(' ')}
                  onOpen={setViewingAgent}
                />
              ) : <span className="iz-small iz-muted">{t('control.publicSignal')}</span>,
            },
            ...(isAdmin ? [
              { key: 'agentCin', label: t('control.cin'), sortValue: (signal: IZRecord) => String(signal.agentCin ?? ''), render: (signal: IZRecord) => <span className="iz-small iz-mono">{signal.agentCin ?? '—'}</span> },
              { key: 'agentFonction', label: t('control.fonction'), sortValue: (signal: IZRecord) => String(signal.agentFonction ?? ''), render: (signal: IZRecord) => <span className="iz-small">{signal.agentFonction ?? '—'}</span> },
              { key: 'agentMatricule', label: t('control.matricule'), sortValue: (signal: IZRecord) => String(signal.agentMatricule ?? ''), render: (signal: IZRecord) => <span className="iz-small iz-mono">{signal.agentMatricule ?? '—'}</span> },
              { key: 'agentTelephone', label: t('control.phone'), sortValue: (signal: IZRecord) => String(signal.agentTelephone ?? ''), render: (signal: IZRecord) => <span className="iz-small">{signal.agentTelephone ?? '—'}</span> },
            ] : []),
            { key: 'position', label: t('control.position'), sortValue: (signal) => (signal.latitude == null ? '' : 'GPS'), render: (signal) => signal.latitude != null && signal.longitude != null ? (
              <button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => navigate(`/suivi?ref=${encodeURIComponent(String(signal.reference))}`)}>{t('control.viewMap')}</button>
            ) : <span className="iz-small iz-muted">—</span> },
            { key: 'statut', label: t('common.status'), sortValue: (signal) => String(signal.statut ?? ''), render: (signal) => <StatusBadge status={signal.statut} /> },
          ]}
          actions={(signal) => (
            <>
              <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => resolve(Number(signal.id), 'En cours')}>{t('control.process')}</button>{' '}
              <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => resolve(Number(signal.id), 'Résolu')} title={t('common.status')}><Check size={15} /></button>
              {isAdmin && (
                <> <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setDeleting(signal)}>{t('common.delete')}</button></>
              )}
            </>
          )}
        />
      )}
      {isAdmin && (
        <div className="iz-card" style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: '.95rem', marginBottom: 10 }}><Smartphone size={15} className="iz-inline-icon" />{t('control.publicScans')}</h3>
          {scans?.length ? (
            <div className="iz-table-wrap">
              <table className="iz-report-table">
                <thead><tr><th>{t('control.dateTime')}</th><th>{t('control.busColumn')}</th><th>{t('control.position')}</th><th /></tr></thead>
                <tbody>
                  {scans.slice(0, 30).map((scan) => (
                    <tr key={scan.id}>
                      <td>{when(scan.createdAt)}</td>
                      <td className="iz-mono">{scan.immatriculation ?? '—'}</td>
                      <td className="iz-small">{Number(scan.latitude).toFixed(5)}, {Number(scan.longitude).toFixed(5)}</td>
                      <td>{isAdmin && <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setDeletingScan(scan)}>{t('common.delete')}</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="iz-small iz-muted">{t('control.noPublicScans')}</p>}
        </div>
      )}
      {deleting && (
        <ConfirmDialog
          message={t('control.deleteSignal', { ref: String(deleting.reference ?? '') })}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
      {deletingScan && (
        <ConfirmDialog
          message={t('control.deleteScanPos')}
          onCancel={() => setDeletingScan(null)}
          onConfirm={() => void removeScan()}
        />
      )}
      {viewingAgent && <AgentProfileDialog id={viewingAgent} onClose={() => setViewingAgent(null)} />}
    </>
  )
}
