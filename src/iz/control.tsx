import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { izApi } from './api'
import type { IZRecord } from './api'
import {
  Alert, Empty, Field, Loading, PageHead, StatCard, StatusBadge, useApp, useAsync,
} from './components'
import { DashboardShell } from './dashboard'

const when = (value?: string | null) => (value ? String(value).slice(0, 16).replace('T', ' ') : '—')

export function ControlLayout({ children }: { children: ReactNode }) {
  const { t, navigate } = useApp()
  const links = [
    { path: '/controle', label: t('control.dashboard'), icon: '📊' },
    { path: '/controle/scan', label: t('control.scanTitle'), icon: '🔍' },
    { path: '/controle/scans', label: t('control.scans'), icon: '📋' },
    { path: '/controle/infractions', label: t('control.infractions'), icon: '⚠️' },
    { path: '/controle/signals', label: t('control.signals'), icon: '📣' },
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
  const { t, notify } = useApp()
  const [plate, setPlate] = useState('')
  const [observation, setObservation] = useState('')
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null)
  const [result, setResult] = useState<IZRecord | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setBusy(true)
    try {
      const response = await izApi.scan({ immatriculation: plate, observation, ...position })
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
            <div className="iz-detail-grid" style={{ marginTop: 16 }}>
              <div className="iz-detail-item"><span>{t('search.owner')}</span><strong>{result.vehicle.proprietaireNom ?? '—'}</strong></div>
              <div className="iz-detail-item"><span>{t('search.cooperative')}</span><strong>{result.vehicle.cooperativeNom ?? '—'}</strong></div>
              <div className="iz-detail-item"><span>{t('search.licence')}</span><strong className="iz-mono">{result.vehicle.licenceNumero ?? '—'}</strong></div>
              <div className="iz-detail-item"><span>{t('search.validity')}</span><strong>{String(result.vehicle.licenceFin ?? '—').slice(0, 10)}</strong></div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export function ScansPage() {
  const { t } = useApp()
  const { data, loading } = useAsync(() => izApi.scans(), [])
  return (
    <>
      <PageHead title={t('control.scans')} />
      {loading ? <Loading /> : !data?.length ? <Empty /> : (
        <div className="iz-table-wrap">
          <table className="iz-table">
            <thead><tr><th>{t('common.date')}</th><th>{t('search.plate')}</th><th>{t('common.status')}</th><th>{t('search.owner')}</th><th>{t('signal.address')}</th></tr></thead>
            <tbody>
              {data.map((scan) => (
                <tr key={scan.id}>
                  <td className="iz-small iz-nowrap">{when(scan.scanTime)}</td>
                  <td className="iz-mono iz-upper">{scan.immatriculation ?? '—'}</td>
                  <td><StatusBadge status={scan.resultat} /></td>
                  <td>{scan.controleurNom ?? '—'}</td>
                  <td className="iz-small">{scan.observation ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export function InfractionsPage() {
  const { t, notify } = useApp()
  const { data, loading, reload } = useAsync(() => izApi.infractions(), [])
  const setStatut = async (id: number, statut: string) => {
    try {
      await izApi.updateInfraction(id, { statut })
      notify(`${t('control.infractions')} : ${statut}`, 'success')
      await reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    }
  }
  return (
    <>
      <PageHead title={t('control.infractions')} />
      {loading ? <Loading /> : !data?.length ? <Empty /> : (
        <div className="iz-table-wrap">
          <table className="iz-table">
            <thead><tr><th>{t('common.date')}</th><th>{t('search.plate')}</th><th>{t('signal.category')}</th><th>{t('admin.amount')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr></thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id}>
                  <td className="iz-small iz-nowrap">{when(item.dateInfraction)}</td>
                  <td className="iz-mono">{item.immatriculation ?? '—'}</td>
                  <td>{item.type}</td>
                  <td>{item.montant} Ar</td>
                  <td><StatusBadge status={item.statut} /></td>
                  <td className="iz-nowrap">
                    <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setStatut(item.id, 'Clôturée')}>
                      {t('admin.approve')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export function ControlSignalsPage() {
  const { t, notify } = useApp()
  const { data, loading, reload } = useAsync(() => izApi.controlSignals(), [])
  const resolve = async (id: number, statut: string) => {
    try {
      await izApi.resolveSignal(id, { statut })
      notify(`${t('control.signals')} : ${statut}`, 'success')
      await reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    }
  }
  return (
    <>
      <PageHead title={t('control.signals')} />
      {loading ? <Loading /> : !data?.length ? <Empty /> : (
        <div className="iz-table-wrap">
          <table className="iz-table">
            <thead><tr><th>{t('admin.reference')}</th><th>{t('search.plate')}</th><th>{t('signal.category')}</th><th>{t('signal.description')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr></thead>
            <tbody>
              {data.map((signal) => (
                <tr key={signal.id}>
                  <td className="iz-mono iz-small">{signal.reference}</td>
                  <td className="iz-mono">{signal.immatriculation}</td>
                  <td>{signal.categorie}</td>
                  <td className="iz-small" style={{ maxWidth: 260 }}>{signal.description}</td>
                  <td><StatusBadge status={signal.statut} /></td>
                  <td className="iz-nowrap">
                    <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => resolve(signal.id, 'En cours')}>{t('control.process')}</button>
                    {' '}
                    <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => resolve(signal.id, 'Résolu')}>✓</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
