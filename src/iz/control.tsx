import { useState } from 'react'
import { BusInformation, QrScanner, plateFromQr } from './bus'
import type { FormEvent, ReactNode } from 'react'
import { izApi } from './api'
import type { IZRecord } from './api'
import {
  Alert, ConfirmDialog, Empty, ExportButton, Field, Loading, PageHead, StatCard, StatusBadge, useApp, useAsync,
} from './components'
import { DashboardShell } from './dashboard'
import { DataTable } from './DataTable'

const when = (value?: string | null) => (value ? String(value).slice(0, 16).replace('T', ' ') : '—')

export function ControlLayout({ children }: { children: ReactNode }) {
  const { t, navigate } = useApp()
  const links = [
    { path: '/controle', label: t('control.dashboard'), icon: '📊' },
    { path: '/controle/scan', label: t('control.scanTitle'), icon: '🔍' },
    { path: '/controle/scans', label: t('control.scans'), icon: '📋' },
    { path: '/controle/infractions', label: t('control.infractions'), icon: '⚠️' },
    { path: '/controle/signals', label: t('control.signals'), icon: '📣' },
    { path: '/controle/fourriere', label: 'Fourrière', icon: 'P' },
    { path: '/signaler', label: 'Faire un signalement', icon: '+' },
  ]
  return (
    <DashboardShell
      title={t('nav.control')}
      links={links}
    >
      <div className="iz-flex iz-small iz-muted" style={{ marginBottom: 14 }}>
        <button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => navigate('/')}>← {t('nav.home')}</button>
      </div>
      {children}
    </DashboardShell>
  )
}

export function ControlDashboard() {
  const { t, navigate } = useApp()
  const { data, loading } = useAsync(() => izApi.controlDashboard(), [])
  return (
    <>
      <PageHead title={t('control.dashboard')} subtitle={t('app.tagline')} />
      {loading ? <Loading /> : (
        <>
          <div className="iz-grid iz-grid-4">
            <StatCard icon="🔍" value={data?.scans?.total ?? 0} label={t('control.scans')} />
            <StatCard icon="✅" value={data?.scans?.conformes ?? 0} label={t('control.conforme')} />
            <StatCard icon="⚠️" value={data?.infractions?.ouvertes ?? 0} label={t('control.infractions')} />
            <StatCard icon="📣" value={data?.signals?.nouveaux ?? 0} label={t('control.signals')} />
          </div>
          <div className="iz-grid iz-grid-2" style={{ marginTop: 22 }}>
            <button className="iz-card iz-card-hover" style={{ textAlign: 'left' }} onClick={() => navigate('/controle/scan')}>
              <div className="iz-feature-icon">🔍</div>
              <h3>{t('control.scanTitle')}</h3>
              <p className="iz-muted iz-small">{t('control.scanSubtitle')}</p>
            </button>
            <button className="iz-card iz-card-hover" style={{ textAlign: 'left' }} onClick={() => navigate('/controle/signals')}>
              <div className="iz-feature-icon">📣</div>
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
  const { t, notify, navigate, route } = useApp()
  const [plate, setPlate] = useState(new URLSearchParams(route.split('?')[1]).get('plaque') ?? '')
  const [observation, setObservation] = useState('')
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null)
  const [result, setResult] = useState<IZRecord | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setBusy(true)
    try {
      const response = await izApi.scan({ immatriculation: plateFromQr(plate), observation, genererInfraction: false, ...position })
      setResult(response)
      notify(response.scan?.resultat ?? '', response.scan?.resultat === 'Conforme' ? 'success' : 'error')
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (coords) => setPosition({ latitude: coords.coords.latitude, longitude: coords.coords.longitude }),
      () => notify('Position indisponible.', 'error'),
    )
  }

  return (
    <>
      <PageHead title={t('control.scanTitle')} subtitle={t('control.scanSubtitle')} />
      <div className="iz-card" style={{ maxWidth: 640 }}>
        <QrScanner onScan={(value) => navigate(`/bus?${new URLSearchParams({ plaque: value })}`)} />
        <form className="iz-form-grid" onSubmit={submit}>
          <Field label={t('control.plate')} full>
            <input className="iz-input iz-upper" required value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="0169 TBF" />
          </Field>
          <Field label={t('signal.description')} full>
            <textarea className="iz-textarea" value={observation} onChange={(e) => setObservation(e.target.value)} />
          </Field>
          <div className="full iz-flex iz-wrap">
            <button className="iz-btn iz-btn-primary" disabled={busy} type="submit">
              {busy ? <span className="iz-spinner" /> : null}{t('control.scan')}
            </button>
            <button className="iz-btn iz-btn-outline" type="button" onClick={locate}>📍 GPS</button>
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
              <BusInformation vehicle={result.vehicle} staff />
              <button className="iz-btn iz-btn-outline" style={{ marginTop: 16 }} onClick={() => navigate(`/bus?${new URLSearchParams({ plaque: result.vehicle.immatriculation })}`)}>Fiche, signalement et fourrière</button>
            </>
          )}
        </div>
      )}
    </>
  )
}

export function ScansPage() {
  const { t, user, notify } = useApp()
  const { data, loading, reload } = useAsync(() => izApi.scans(), [])
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const isSuper = user?.role === 'superadmin'
  const remove = async () => {
    if (!deleting) return
    try {
      await izApi.deleteScan(Number(deleting.id))
      notify('Scan supprimé.', 'success')
      setDeleting(null)
      await reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    }
  }
  return (
    <>
      <PageHead title={t('control.scans')} action={(user?.role === 'admin' || user?.role === 'superadmin') ? <ExportButton cible="scans" label="Excel" /> : undefined} />
      {loading ? <Loading /> : (
        <DataTable
          rows={data ?? []}
          rowKey={(scan) => String(scan.id)}
          searchText={(scan) => [scan.immatriculation, scan.resultat, scan.controleurNom, scan.observation].join(' ')}
          initialSort="scanTime"
          empty={<Empty />}
          columns={[
            { key: 'scanTime', label: t('common.date'), sortValue: (scan) => String(scan.scanTime ?? ''), render: (scan) => <span className="iz-small iz-nowrap">{when(scan.scanTime)}</span> },
            { key: 'immatriculation', label: t('search.plate'), sortValue: (scan) => String(scan.immatriculation ?? ''), render: (scan) => <span className="iz-mono iz-upper">{scan.immatriculation ?? '—'}</span> },
            { key: 'resultat', label: t('common.status'), sortValue: (scan) => String(scan.resultat ?? ''), render: (scan) => <StatusBadge status={scan.resultat} /> },
            { key: 'controleurNom', label: t('search.owner'), sortValue: (scan) => String(scan.controleurNom ?? ''), render: (scan) => <>{scan.controleurNom ?? '—'}</> },
            { key: 'observation', label: t('signal.address'), sortValue: (scan) => String(scan.observation ?? ''), render: (scan) => <span className="iz-small">{scan.observation ?? '—'}</span> },
          ]}
          actions={isSuper ? (scan) => (
            <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setDeleting(scan)}>Supprimer</button>
          ) : undefined}
        />
      )}
      {deleting && (
        <ConfirmDialog
          message={`Supprimer définitivement le scan du ${when(deleting.scanTime)} ?`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}

export function InfractionsPage() {
  const { t, notify, user } = useApp()
  const { data, loading, reload } = useAsync(() => izApi.infractions(), [])
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const isSuper = user?.role === 'superadmin'
  const setStatut = async (id: number, statut: string) => {
    try {
      await izApi.updateInfraction(id, { statut })
      notify(`${t('control.infractions')} : ${statut}`, 'success')
      await reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    }
  }
  const remove = async () => {
    if (!deleting) return
    try {
      await izApi.deleteInfraction(Number(deleting.id))
      notify('Infraction supprimée.', 'success')
      setDeleting(null)
      await reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    }
  }
  return (
    <>
      <PageHead title={t('control.infractions')} action={(user?.role === 'admin' || user?.role === 'superadmin') ? <ExportButton cible="infractions" label="Excel" /> : undefined} />
      {loading ? <Loading /> : (
        <DataTable
          rows={data ?? []}
          rowKey={(item) => String(item.id)}
          searchText={(item) => [item.immatriculation, item.type, item.statut].join(' ')}
          initialSort="dateInfraction"
          empty={<Empty />}
          columns={[
            { key: 'dateInfraction', label: t('common.date'), sortValue: (item) => String(item.dateInfraction ?? ''), render: (item) => <span className="iz-small iz-nowrap">{when(item.dateInfraction)}</span> },
            { key: 'immatriculation', label: t('search.plate'), sortValue: (item) => String(item.immatriculation ?? ''), render: (item) => <span className="iz-mono">{item.immatriculation ?? '—'}</span> },
            { key: 'type', label: t('signal.category'), sortValue: (item) => String(item.type ?? ''), render: (item) => <>{item.type}</> },
            { key: 'montant', label: t('admin.amount'), sortValue: (item) => Number(item.montant ?? 0), render: (item) => <>{item.montant} Ar</> },
            { key: 'statut', label: t('common.status'), sortValue: (item) => String(item.statut ?? ''), render: (item) => <StatusBadge status={item.statut} /> },
          ]}
          actions={(item) => (
            <>
              <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setStatut(Number(item.id), 'Clôturée')}>
                {t('admin.approve')}
              </button>
              {isSuper && (
                <> <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setDeleting(item)}>Supprimer</button></>
              )}
            </>
          )}
        />
      )}
      {deleting && (
        <ConfirmDialog
          message={`Supprimer définitivement l'infraction ${deleting.type ?? ''} du ${when(deleting.dateInfraction)} ?`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}

export function ControlSignalsPage() {
  const { t, notify, user } = useApp()
  const { data, loading, reload } = useAsync(() => izApi.controlSignals(), [])
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const isSuper = user?.role === 'superadmin'
  const resolve = async (id: number, statut: string) => {
    try {
      await izApi.resolveSignal(id, { statut })
      notify(`${t('control.signals')} : ${statut}`, 'success')
      await reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    }
  }
  const remove = async () => {
    if (!deleting) return
    try {
      await izApi.deleteSignal(Number(deleting.id))
      notify('Signalement supprimé.', 'success')
      setDeleting(null)
      await reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    }
  }
  return (
    <>
      <PageHead title={t('control.signals')} action={(user?.role === 'admin' || user?.role === 'superadmin') ? <ExportButton cible="signalements" label="Excel" /> : undefined} />
      {loading ? <Loading /> : (
        <DataTable
          rows={data ?? []}
          rowKey={(signal) => String(signal.id)}
          searchText={(signal) => [signal.reference, signal.immatriculation, signal.categorie, signal.description, signal.statut].join(' ')}
          initialSort="createdAt"
          empty={<Empty />}
          columns={[
            { key: 'reference', label: t('admin.reference'), sortValue: (signal) => String(signal.reference ?? ''), render: (signal) => <span className="iz-mono iz-small">{signal.reference}</span> },
            { key: 'immatriculation', label: t('search.plate'), sortValue: (signal) => String(signal.immatriculation ?? ''), render: (signal) => <span className="iz-mono">{signal.immatriculation}</span> },
            { key: 'categorie', label: t('signal.category'), sortValue: (signal) => String(signal.categorie ?? ''), render: (signal) => <>{signal.categorie}</> },
            { key: 'description', label: t('signal.description'), sortValue: (signal) => String(signal.description ?? ''), render: (signal) => <span className="iz-small" style={{ maxWidth: 260 }}>{signal.description}</span> },
            { key: 'createdAt', label: t('common.date'), sortValue: (signal) => String(signal.createdAt ?? ''), render: (signal) => <span className="iz-small iz-nowrap">{when(signal.createdAt)}</span> },
            { key: 'statut', label: t('common.status'), sortValue: (signal) => String(signal.statut ?? ''), render: (signal) => <StatusBadge status={signal.statut} /> },
          ]}
          actions={(signal) => (
            <>
              <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => resolve(Number(signal.id), 'En cours')}>{t('control.process')}</button>{' '}
              <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => resolve(Number(signal.id), 'Résolu')}>✓</button>
              {isSuper && (
                <> <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setDeleting(signal)}>Supprimer</button></>
              )}
            </>
          )}
        />
      )}
      {deleting && (
        <ConfirmDialog
          message={`Supprimer définitivement le signalement ${deleting.reference ?? ''} ?`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}
