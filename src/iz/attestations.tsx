import { useMemo, useState } from 'react'
import { izApi } from './api'
import type { IZRecord } from './api'
import {
  Alert, Field, Loading, Modal, PageHead, StatusBadge, useApp, useAsync,
} from './components'
import { translateError, translateValue } from './i18n'
import { DataTable } from './DataTable'
import { attestationState } from './attestation-utils'

type AttestationType = 'capacite' | 'receveur'

const typeKey = (type: AttestationType) => (type === 'capacite' ? 'att.cap' : 'att.rec')

const dateOnly = (value: unknown) => {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ''))
  return match ? match[1] : ''
}

const holder = (row: IZRecord, fallback = '') =>
  [row.nom, row.prenoms].filter(Boolean).join(' ') || fallback

const number = (row: IZRecord) =>
  String(row.numero_attestation || row.numero_attestation_receveur || '—')

type Translate = (key: string) => string

function detailFields(type: AttestationType, row: IZRecord, t: Translate): [string, unknown][] {
  const common: [string, unknown][] = [
    [t('att.fNumber'), number(row)],
    [t('att.fLast'), row.nom],
    [t('att.fFirst'), row.prenoms],
    [t('att.fBirth'), dateOnly(row.date_naissance) || row.naissance_texte],
    [t('att.fBirthPlace'), row.lieu_naissance],
  ]
  if (type === 'capacite') {
    return [
      ...common,
      [t('att.fPermis'), row.permis_numero],
      [t('att.fPermisCat'), row.permis_categorie],
      [t('att.fPermisDate'), dateOnly(row.permis_delivre_le) || row.permis_delivre_texte],
      [t('att.fPermisPlace'), row.permis_delivre_lieu],
      [t('att.fExam'), dateOnly(row.date_examen) || row.date_examen_texte],
      [t('att.fCert'), row.numero_certificat],
      [t('att.fUntil'), dateOnly(row.valable_jusquau) || row.valable_texte],
      [t('common.status'), attestationState(row)],
      [t('att.fSource'), row.fichier_source],
      [t('att.fRemark'), row.remarque],
    ]
  }
  return [
    ...common,
    ['CIN', row.cin],
    [t('att.fCinDate'), dateOnly(row.cin_delivree_le) || row.cin_texte],
    [t('att.fCinPlace'), row.cin_delivree_lieu],
    [t('att.fExam'), dateOnly(row.date_examen) || row.date_examen_texte],
    [t('att.fRecNumber'), row.numero_attestation_receveur],
    [t('att.fUntil'), dateOnly(row.valable_jusquau) || row.valable_texte],
    [t('common.status'), attestationState(row)],
    [t('att.fSource'), row.fichier_source],
    [t('att.fRemark'), row.remarque],
  ]
}

export function AdminAttestations() {
  const { t, lang, notify, navigate } = useApp()
  const [type, setType] = useState<AttestationType>('capacite')
  const [unlinkedOnly, setUnlinkedOnly] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [status, setStatus] = useState('')
  const [target, setTarget] = useState<IZRecord | null>(null)
  const [detail, setDetail] = useState<IZRecord | null>(null)
  const [selectedBus, setSelectedBus] = useState<number | null>(null)
  const [busQuery, setBusQuery] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, loading, error, reload, setData } = useAsync(
    () => izApi.adminAttestations(type, showHistory),
    [type, showHistory],
  )
  const vehicles = useAsync(() => izApi.adminVehicles({ limit: 500 }), [])

  const switchType = (next: AttestationType) => {
    if (next === type) return
    setData(null)
    setUnlinkedOnly(false)
    setStatus('')
    setType(next)
  }

  const rows = useMemo(() => {
    const source = data ?? []
    return source.filter((row) => {
      if (unlinkedOnly && row.vehicle_id != null) return false
      if (status && attestationState(row) !== status) return false
      return true
    })
  }, [data, status, unlinkedOnly])

  const buses = useMemo(() => {
    const needle = busQuery.trim().toLocaleLowerCase()
    const list = (vehicles.data ?? []).filter((vehicle) => {
      if (!needle) return true
      return [vehicle.immatriculation, vehicle.ligne, vehicle.proprietaireNom, vehicle.cooperativeCode]
        .join(' ')
        .toLocaleLowerCase()
        .includes(needle)
    })
    return list.slice(0, 40)
  }, [busQuery, vehicles.data])

  const openLink = (row: IZRecord) => {
    setTarget(row)
    setSelectedBus(row.vehicle_id == null ? null : Number(row.vehicle_id))
    setBusQuery('')
  }

  const submitLink = async (vehicleId: number | null) => {
    if (!target || busy) return
    setBusy(true)
    try {
      await izApi.linkAttestation(type, Number(target.id), vehicleId)
      notify(vehicleId === null ? t('att.detached') : t('att.linked'), 'success')
      setTarget(null)
      await reload()
    } catch (reason) {
      notify(translateError(lang, reason, 'att.linkFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const unlink = async (row: IZRecord) => {
    if (busy) return
    setBusy(true)
    try {
      await izApi.linkAttestation(type, Number(row.id), null)
      notify(t('att.detached'), 'success')
      await reload()
    } catch (reason) {
      notify(translateError(lang, reason, 'att.linkFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const replacement = target && selectedBus != null
    ? (data ?? []).find((row) => row.vehicle_id != null
      && Number(row.vehicle_id) === selectedBus
      && Number(row.id) !== Number(target.id))
    : undefined
  const selectedVehicle = (vehicles.data ?? []).find((vehicle) => Number(vehicle.id) === selectedBus)

  return (
    <>
      <PageHead
        title={t('att.title')}
        subtitle={t('att.subtitle')}
      />

      <div className="iz-card" style={{ marginBottom: 16 }}>
        <div className="iz-flex iz-wrap" style={{ gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className={`iz-btn ${type === 'capacite' ? 'iz-btn-primary' : 'iz-btn-outline'}`}
            onClick={() => switchType('capacite')}
          >
            {t('att.capPlural')}
          </button>
          <button
            type="button"
            className={`iz-btn ${type === 'receveur' ? 'iz-btn-primary' : 'iz-btn-outline'}`}
            onClick={() => switchType('receveur')}
          >
            {t('att.recPlural')}
          </button>
          <label className="iz-flex iz-small" style={{ gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={unlinkedOnly}
              onChange={(event) => setUnlinkedOnly(event.target.checked)}
            />
            {t('att.unlinkedOnly')}
          </label>
          <label className="iz-flex iz-small" style={{ gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(event) => setShowHistory(event.target.checked)}
            />
            {t('att.includeHistory')}
          </label>
          <label className="iz-flex iz-small" style={{ gap: 6, alignItems: 'center' }}>
            {t('common.status')}
            <select className="iz-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{t('att.all')}</option>
              <option value="Valable">{t('att.valid')}</option>
              <option value="Expirée">{t('att.expired')}</option>
              <option value="Validité inconnue">{t('att.unknownValidity')}</option>
            </select>
          </label>
          {data && (
            <span className="iz-small iz-muted">
              {showHistory
                ? t('att.countHistory', { rows: rows.length, total: data.length })
                : t('att.countUnique', { rows: rows.length, total: data.length })}
            </span>
          )}
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {loading ? <Loading /> : (
        <DataTable
          key={type}
          rows={rows}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => holder(row, t('att.holderFallback'))}
          searchText={(row) => [
            row.nom, row.prenoms, row.numero_attestation, row.numero_attestation_receveur,
            row.cin, row.permis_numero, row.busImmatriculation, row.busLigne,
            row.fichier_source, row.remarque,
          ].join(' ')}
          searchPlaceholder={t('att.searchPlaceholder')}
          initialSort="validite"
          empty={<p className="iz-list-empty">{t('att.empty')}</p>}
          columns={[
            {
              key: 'titulaire', label: t('att.colHolder'),
              sortValue: (row) => holder(row),
              render: (row) => <div>
                <strong>{holder(row, t('att.holderFallback'))}</strong>
                <div className="iz-small iz-muted">
                  {type === 'capacite'
                    ? t('att.permisLine', { cat: row.permis_categorie || '—', num: row.permis_numero || '—' })
                    : t('att.cinLine', { cin: row.cin || '—' })}
                </div>
              </div>,
            },
            {
              key: 'numero', label: t('att.colNumber'),
              sortValue: (row) => number(row),
              render: (row) => <span className="iz-mono iz-small">{number(row)}</span>,
            },
            {
              key: 'validite', label: t('att.colValidity'),
              sortValue: (row) => dateOnly(row.valable_jusquau) || String(row.statut ?? ''),
              render: (row) => <div className="iz-small iz-nowrap">
                <div>{dateOnly(row.valable_jusquau) || row.valable_texte || '—'}</div>
                <StatusBadge status={attestationState(row)} />
              </div>,
            },
            {
              key: 'bus', label: t('att.colBus'),
              sortValue: (row) => String(row.busImmatriculation ?? ''),
              render: (row) => row.busImmatriculation
                ? <button
                    type="button"
                    className="iz-btn iz-btn-outline iz-btn-sm"
                    onClick={() => navigate(`/bus?${new URLSearchParams({ plaque: String(row.busImmatriculation) })}`)}
                  >
                    {row.busImmatriculation}
                  </button>
                : <span className="iz-small iz-muted">{t('att.notLinked')}</span>,
            },
          ]}
          actions={(row) => (
            <div className="iz-flex iz-wrap" style={{ gap: 6 }}>
              <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => openLink(row)}>
                {row.vehicle_id == null ? t('att.linkBus') : t('att.changeBus')}
              </button>
              {row.vehicle_id != null && (
                <button
                  className="iz-btn iz-btn-outline iz-btn-sm"
                  disabled={busy}
                  onClick={() => void unlink(row)}
                >
                  {t('att.unlink')}
                </button>
              )}
              <button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => setDetail(row)}>
                {t('common.details')}
              </button>
            </div>
          )}
        />
      )}

      {target && (
        <Modal
          title={`${target.vehicle_id == null ? t('att.linkTitle') : t('att.changeTitle')} — ${t(typeKey(type))}`}
          onClose={() => { if (!busy) setTarget(null) }}
          footer={
            <>
              <button className="iz-btn iz-btn-outline" disabled={busy} onClick={() => setTarget(null)}>{t('common.cancel')}</button>
              <button
                className="iz-btn iz-btn-primary"
                disabled={busy || selectedBus == null}
                onClick={() => void submitLink(selectedBus)}
              >
                {busy ? t('att.saving') : t('att.saveLink')}
              </button>
            </>
          }
        >
          <p className="iz-small iz-muted" style={{ marginTop: 0 }}>
            {holder(target, t('att.holderFallback'))} — {number(target)}
          </p>
          {target.busImmatriculation && (
            <p className="iz-small">
              {t('att.currentBus')} <strong>{target.busImmatriculation}</strong>
            </p>
          )}
          <Field label={t('att.searchBus')} full>
            <input
              className="iz-input"
              value={busQuery}
              onChange={(event) => setBusQuery(event.target.value)}
              placeholder={t('att.busPlaceholder')}
              autoFocus
            />
          </Field>
          {vehicles.loading && <Loading />}
          {vehicles.error && <Alert type="error">{vehicles.error}</Alert>}
          {!vehicles.loading && (
            <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #d8d8d8', borderRadius: 10, marginTop: 10 }}>
              {buses.length === 0 ? (
                <p className="iz-small iz-muted" style={{ padding: 12, margin: 0 }}>{t('att.noBusMatch')}</p>
              ) : buses.map((vehicle) => {
                const active = Number(vehicle.id) === selectedBus
                return (
                  <button
                    type="button"
                    key={String(vehicle.id)}
                    className="iz-btn iz-btn-ghost"
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', borderRadius: 0,
                      background: active ? '#e7f3ec' : 'transparent',
                      padding: '10px 12px', borderBottom: '1px solid #eee',
                    }}
                    onClick={() => setSelectedBus(Number(vehicle.id))}
                  >
                    <strong className="iz-mono">{vehicle.immatriculation}</strong>
                    <span className="iz-small iz-muted">
                      {' '}· {t('search.line')} {vehicle.ligne || '—'} · {vehicle.cooperativeCode || '—'}
                      {vehicle.proprietaireNom ? ` · ${vehicle.proprietaireNom}` : ''}
                    </span>
                    {active && <span className="iz-chip" style={{ marginLeft: 8 }}>{t('att.selected')}</span>}
                  </button>
                )
              })}
            </div>
          )}
          {selectedVehicle && (
            <p className="iz-small" style={{ marginBottom: 0 }}>
              {t('att.selectedBus')} <strong>{selectedVehicle.immatriculation}</strong>
            </p>
          )}
          {replacement && (
            <Alert type="error">
              {t('att.conflict', {
                plate: selectedVehicle?.immatriculation ?? t('att.thisBus'),
                kind: t(type === 'capacite' ? 'att.kindCap' : 'att.kindRec'),
                holder: holder(replacement, t('att.holderFallback')),
              })}
            </Alert>
          )}
          {target.vehicle_id != null && (
            <button
              type="button"
              className="iz-btn iz-btn-danger iz-btn-sm"
              disabled={busy}
              onClick={() => void submitLink(null)}
            >
              {t('att.detach')}
            </button>
          )}
        </Modal>
      )}

      {detail && (
        <Modal
          title={t('att.detailsTitle', { type: t(typeKey(type)) })}
          onClose={() => setDetail(null)}
          footer={<button className="iz-btn iz-btn-outline" onClick={() => setDetail(null)}>{t('att.close')}</button>}
        >
          <div className="iz-detail-grid">
            {detailFields(type, detail, t).map(([label, value]) => {
              const text = value === true ? t('att.yes') : value === false ? t('att.no')
                : value == null || value === '' ? t('att.notProvided') : translateValue(lang, String(value))
              return (
                <div className="iz-detail-item" key={label}>
                  <span>{label}</span>
                  <strong>{text}</strong>
                </div>
              )
            })}
            <div className="iz-detail-item">
              <span>{t('att.colBus')}</span>
              <strong>{detail.busImmatriculation || t('att.notLinked')}</strong>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
