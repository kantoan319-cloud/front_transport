import { useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import QRCode from 'qrcode'
import { izApi } from './api'
import type { IZAccountRole, IZCreateUser, IZRecord } from './api'
import {
  ConfirmDialog, Empty, ExportButton, Field, Loading, Modal, PageHead, PasswordInput,
  StatCard, StatusBadge, useApp, useAsync,
} from './components'
import { DataTable } from './DataTable'
import type { DataColumn, TableSelection } from './DataTable'
import { DashboardShell } from './dashboard'
import { downloadQrSheetPdf, downloadReceiptA4, downloadRegisterPdf, printReceipt, printRegisterPdf } from '../documentPdf'
import type { RegisterPayload } from '../documentPdf'
import { photoDataUrl } from './photo'
import { AgentProfileDialog, IdentityPhotoField } from './profiles'
import { translateError, translateValue } from './i18n'

const when = (value?: string | null) => (value ? String(value).slice(0, 16).replace('T', ' ') : '—')
const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : '')
const localToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
const licenceState = (debut?: string | null, fin?: string | null) => {
  const end = dateOnly(fin)
  if (!end) return 'Non renseignée'
  const start = dateOnly(debut)
  const today = localToday()
  if (start && start > today) return 'À venir'
  return end < today ? 'Expirée' : 'Valide'
}
/** Fin inclusive : veille du sixième anniversaire, jour borné à la fin du mois. */
const sixMonthEnd = (start: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const index = month - 1 + 6
  const targetYear = year + Math.floor(index / 12)
  if (targetYear > 9999) return ''
  const targetMonth = index % 12
  const monthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const date = new Date(Date.UTC(targetYear, targetMonth, Math.min(day, monthEnd)))
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ */
/* Mise en page                                                        */
/* ------------------------------------------------------------------ */

export function AdminLayout({ children }: { children: ReactNode }) {
  const { t, navigate, user } = useApp()
  const historyLink = user?.role === 'superadmin'
    ? { path: '/admin/activity', label: t('admin.historyAdmins'), icon: '🕘' }
    : { path: '/admin/activity', label: t('admin.historyControllers'), icon: '🕘' }
  const links = [
    { path: '/admin', label: t('admin.dashboard'), icon: '📊' },
    { path: '/notifications', label: t('nav.notifications'), icon: '🔔', badge: true },
    { path: '/admin/analytics', label: t('admin.analytics'), icon: '📈' },
    { path: '/admin/vehicles', label: t('admin.vehicles'), icon: '🚐' },
    { path: '/controle/scan', label: t('admin.scanControl'), icon: 'QR' },
    { path: '/controle/fourriere', label: t('control.fourriere'), icon: 'P' },
    { path: '/controle/signals', label: t('admin.signalements'), icon: '!' },
    { path: '/admin/cooperatives', label: t('nav.coops'), icon: '🤝' },
    { path: '/admin/owners', label: t('admin.owners'), icon: '👥' },
    { path: '/admin/lines', label: t('admin.lines'), icon: '🛣️' },
    { path: '/admin/attestations', label: t('att.title'), icon: '📄' },
    { path: '/admin/licenses', label: t('admin.licences'), icon: '⚠️' },
    { path: '/admin/payments', label: t('admin.payments'), icon: '💳' },
    { path: '/admin/payments/register', label: t('admin.paymentRegister'), icon: '🧾' },
    { path: '/admin/requests', label: t('admin.requests'), icon: '📝' },
    { path: '/admin/users', label: t('admin.users'), icon: '🔐' },
    { path: '/admin/profiles', label: t('admin.profiles'), icon: '👤' },
    { path: '/admin/manuel', label: t('admin.manual'), icon: '📘' },
    historyLink,
  ]
  return (
    <DashboardShell title={t('nav.admin')} links={links}>
      <div className="iz-flex iz-small iz-muted" style={{ marginBottom: 14 }}>
        <button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => navigate('/')}>← {t('nav.home')}</button>
      </div>
      {children}
    </DashboardShell>
  )
}

export function AdminDashboard() {
  const { t, navigate } = useApp()
  const { data, loading } = useAsync(() => izApi.adminStats(), [])
  return (
    <>
      <PageHead title={t('admin.dashboard')} subtitle={t('app.tagline')} />
      {loading ? <Loading /> : (
        <>
          <div className="iz-grid iz-grid-4">
            <StatCard icon="🚐" value={data?.vehicles?.total ?? 0} label={t('admin.vehicles')} />
            <StatCard icon="✅" value={data?.vehicles?.valides ?? 0} label={t('search.valid')} />
            <button type="button" className="iz-card iz-stat iz-card-hover iz-stat-link" onClick={() => navigate('/admin/licenses')} title={t('admin.viewExpired')}>
              <div className="iz-stat-icon">⚠️</div>
              <div className="iz-stat-value">{data?.vehicles?.expires ?? 0}</div>
              <div className="iz-stat-label">{t('search.expired')} →</div>
            </button>
            <StatCard icon="🤝" value={data?.cooperatives?.total ?? 0} label={t('nav.coops')} />
          </div>
          <div className="iz-grid iz-grid-4" style={{ marginTop: 16 }}>
            <StatCard value={data?.scans?.total ?? 0} label={t('control.scans')} />
            <StatCard value={data?.signals?.nouveaux ?? 0} label={t('control.signals')} />
            <StatCard value={data?.payments?.total ?? 0} label={t('admin.paid')} />
          </div>
          <div className="iz-card" style={{ marginTop: 22 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 10 }}>{t('admin.revenue')}</h3>
            <div className="iz-stat-value">{Number(data?.payments?.montant ?? 0).toLocaleString('fr-FR')} Ar</div>
          </div>
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* CRUD générique                                                      */
/* ------------------------------------------------------------------ */

interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | 'photo'
  options?: { value: string; label: string }[]
  full?: boolean
  required?: boolean
  numeric?: boolean
  clearValue?: '' | null
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
}

interface CrudProps {
  title: string
  subtitle?: string
  columns: DataColumn<IZRecord>[]
  load: () => Promise<IZRecord[]>
  fields: FieldDef[]
  create: (data: IZRecord) => Promise<unknown>
  update?: (id: number, data: IZRecord) => Promise<unknown>
  remove?: (id: number) => Promise<unknown>
  addLabel?: string
  toForm?: (row: IZRecord) => IZRecord
  initialValues?: IZRecord
  patchOnlyChanges?: boolean
  toPayload?: (data: IZRecord, form: IZRecord) => IZRecord
  formInfo?: (row: IZRecord) => ReactNode
  extra?: ReactNode
  searchText?: (row: IZRecord) => string
  searchPlaceholder?: string
  rowLabel?: (row: IZRecord) => string
  initialSort?: string
  exportCible?: string
  groupBy?: (row: IZRecord) => string
  groupLabel?: (group: string, rows: IZRecord[]) => ReactNode
  batch?: {
    label: string
    onRun: (rows: IZRecord[]) => void | Promise<void>
  }
}

export function CrudPage(props: CrudProps) {
  const { t, lang, notify } = useApp()
  const { data, loading, error, reload } = useAsync(props.load, [])
  const [editing, setEditing] = useState<IZRecord | null>(null)
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const [form, setForm] = useState<IZRecord>({})
  const [initialForm, setInitialForm] = useState<IZRecord>({})
  const formRef = useRef<HTMLFormElement>(null)
  const [busy, setBusy] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const openCreate = () => {
    setEditing({ __new: true })
    setForm({ ...props.initialValues })
    setInitialForm({})
  }
  const openEdit = (row: IZRecord) => {
    const values = props.toForm ? props.toForm(row) : { ...row }
    setEditing(row)
    setForm(values)
    setInitialForm(values)
  }
  const change = (key: string, value: string | number | boolean) =>
    setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (busy || !editing || !formRef.current?.reportValidity()) return
    setBusy(true)
    try {
      const isUpdate = Boolean(editing.id && props.update)
      const payload: IZRecord = {}
      for (const field of props.fields) {
        let value = form[field.key]
        const changed = field.type === 'checkbox'
          ? Boolean(value) !== Boolean(initialForm[field.key])
          : String(value ?? '') !== String(initialForm[field.key] ?? '')
        // Les champs facultatifs inchangés sont absents du PATCH : notamment
        // la date de début, dont le renvoi recalculerait une ancienne échéance.
        if (field.required && (value == null || String(value).trim() === '')) {
          throw new Error(t('admin.crudRequired', { label: field.label }))
        }
        if (isUpdate && !changed && (!field.required || props.patchOnlyChanges)) continue
        if (field.type === 'checkbox') value = Boolean(value)
        if (value == null) continue
        if (typeof value === 'string') value = value.trim()
        if (value === '') {
          if (!isUpdate || !changed) continue
          // Seul un effacement explicite peut envoyer null, et uniquement
          // pour les champs déclarés effaçables dans le formulaire.
          if (field.clearValue !== undefined) payload[field.key] = field.clearValue
          else if (field.type !== 'number' && field.type !== 'date' && !field.numeric) payload[field.key] = ''
          continue
        }
        if (field.type === 'number' || field.numeric) {
          value = Number(value)
          if (!Number.isFinite(value)) throw new Error(t('admin.crudInvalidNumber', { label: field.label }))
        }
        payload[field.key] = value
      }
      const data = props.toPayload ? props.toPayload(payload, form) : payload
      if (editing.id && props.update) await props.update(Number(editing.id), data)
      else await props.create(data)
      notify(t('admin.saved'), 'success')
      setEditing(null)
      await reload()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy || !deleting || !props.remove) return
    setBusy(true)
    try {
      await props.remove(Number(deleting.id))
      notify(t('admin.deleted'), 'success')
      setDeleting(null)
      await reload()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const rows = data ?? []
  const keyOf = (row: IZRecord) => String(row.id)
  const labelOf = (row: IZRecord) => props.rowLabel?.(row)
    ?? String(row.immatriculation ?? row.nom ?? row.code ?? row.titre ?? row.id ?? '')
  const selectedRows = useMemo(() => rows.filter((row) => selected.has(String(row.id))), [rows, selected])
  const selection: TableSelection<IZRecord> | undefined = props.batch ? {
    isSelected: (row) => selected.has(keyOf(row)),
    toggle: (row) => setSelected((current) => {
      const next = new Set(current)
      if (next.has(keyOf(row))) next.delete(keyOf(row))
      else next.add(keyOf(row))
      return next
    }),
    toggleAll: (visible) => setSelected((current) => {
      const next = new Set(current)
      const allVisible = visible.every((row) => next.has(keyOf(row)))
      for (const row of visible) {
        if (allVisible) next.delete(keyOf(row))
        else next.add(keyOf(row))
      }
      return next
    }),
    allSelected: rows.length > 0 && rows.every((row) => selected.has(keyOf(row))),
    label: (count) => t('common.selectedOnPage', { count }),
  } : undefined

  const runBatch = async () => {
    if (!props.batch || !selectedRows.length || batchBusy) return
    setBatchBusy(true)
    try {
      await props.batch.onRun(selectedRows)
      setSelected(new Set())
      await reload()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    } finally {
      setBatchBusy(false)
    }
  }

  return (
    <>
      <PageHead
        title={props.title}
        subtitle={props.subtitle}
        action={
          <div className="iz-flex iz-wrap">
            {props.exportCible && <ExportButton cible={props.exportCible} label="Excel" />}
            <button className="iz-btn iz-btn-primary" onClick={openCreate}>+ {props.addLabel ?? t('common.add')}</button>
          </div>
        }
      />
      {props.extra}
      {error && <div className="iz-card" role="alert">{error} <button className="iz-btn iz-btn-outline iz-btn-sm" disabled={loading} onClick={() => void reload()}>{t('common.retry')}</button></div>}
      {loading ? <Loading /> : (
        <DataTable
          rows={rows}
          columns={props.columns}
          rowKey={keyOf}
          rowLabel={labelOf}
          searchText={props.searchText}
          searchPlaceholder={props.searchPlaceholder}
          initialSort={props.initialSort}
          groupBy={props.groupBy}
          groupLabel={props.groupLabel}
          selection={selection}
          busy={batchBusy}
          empty={<Empty />}
          toolbar={props.batch && (
            <button className="iz-btn iz-btn-outline iz-btn-sm" disabled={!selectedRows.length || batchBusy} onClick={() => void runBatch()}>
              {batchBusy ? t('admin.treatment') : `${props.batch.label} (${selectedRows.length})`}
            </button>
          )}
          actions={(row) => (
            <>
              {props.update && <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => openEdit(row)}>{t('common.edit')}</button>}
              {props.remove && <button className="iz-btn iz-btn-danger iz-btn-sm" style={{ marginLeft: 6 }} onClick={() => setDeleting(row)}>{t('common.delete')}</button>}
            </>
          )}
        />
      )}
      {editing && (
        <Modal
          title={`${editing.id ? t('common.edit') : t('common.add')} — ${props.title}`}
          onClose={() => { if (!busy) setEditing(null) }}
          footer={
            <>
              <button className="iz-btn iz-btn-outline" disabled={busy} onClick={() => setEditing(null)}>{t('common.cancel')}</button>
              <button className="iz-btn iz-btn-primary" disabled={busy} onClick={() => formRef.current?.requestSubmit()}>{busy ? t('common.saving') : t('common.save')}</button>
            </>
          }
        >
          {props.formInfo?.(editing)}
          <form ref={formRef} className="iz-form-grid" onSubmit={submit} aria-busy={busy}>
            {props.fields.map((field) => (
              <Field key={field.key} label={field.label} full={field.full}>
                {field.type === 'textarea' ? (
                  <textarea className="iz-textarea" disabled={busy} required={field.required} value={String(form[field.key] ?? '')} onChange={(e) => change(field.key, e.target.value)} />
                ) : field.type === 'select' ? (
                  <select className="iz-select" disabled={busy} required={field.required} value={String(form[field.key] ?? '')} onChange={(e) => change(field.key, e.target.value)}>
                    <option value="">—</option>
                    {form[field.key] != null && form[field.key] !== '' && !field.options?.some((option) => option.value === String(form[field.key])) && (
                      <option value={String(form[field.key])} disabled>{String(form[field.key])} ({t('common.currentValue')})</option>
                    )}
                    {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <input type="checkbox" disabled={busy} required={field.required} checked={Boolean(form[field.key])} onChange={(e) => change(field.key, e.target.checked)} />
                ) : field.type === 'photo' ? (
                  <div className="iz-photo-field">
                    {form[field.key]
                      ? <img className="iz-photo-preview" src={String(form[field.key])} alt={field.label} />
                      : <div className="iz-photo-empty">{t('common.noPhoto')}</div>}
                    <div className="iz-flex iz-wrap" style={{ gap: 8 }}>
                      <label className="iz-btn iz-btn-outline iz-btn-sm">
                        {t('common.choosePhoto')}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={busy}
                          style={{ display: 'none' }}
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ''
                            if (!file) return
                            void photoDataUrl(file)
                              .then((value) => change(field.key, value))
                              .catch((error) => notify(translateError(lang, error, 'common.imageUnreadable'), 'error'))
                          }}
                        />
                      </label>
                      {form[field.key] && <button type="button" className="iz-btn iz-btn-ghost iz-btn-sm" disabled={busy} onClick={() => change(field.key, '')}>{t('common.remove')}</button>}
                    </div>
                  </div>
                ) : (
                  <input
                    className="iz-input"
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    required={field.required}
                    disabled={busy}
                    minLength={field.minLength}
                    maxLength={field.maxLength}
                    min={field.min}
                    max={field.max}
                    step={field.type === 'number' ? 'any' : undefined}
                    value={String(form[field.key] ?? '')}
                    onChange={(e) => change(field.key, e.target.value)}
                  />
                )}
              </Field>
            ))}
          </form>
        </Modal>
      )}
      {deleting && props.remove && (
        <ConfirmDialog message={`${t('common.confirmDelete')} ${deleting.immatriculation ?? deleting.nom ?? deleting.code ?? ''}`} onCancel={() => { if (!busy) setDeleting(null) }} onConfirm={remove} />
      )}
    </>
  )
}

const text = (value: unknown) => <span>{value == null || value === '' ? '—' : String(value)}</span>
const mono = (value: unknown) => <span className="iz-mono iz-small">{value == null || value === '' ? '—' : String(value)}</span>

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export function AdminVehicles() {
  const { t, lang, navigate, notify } = useApp()
  const coops = useAsync(() => izApi.adminCooperatives(), [])
  const coopOptions = (coops.data ?? []).map((coop) => ({ value: String(coop.id), label: String(coop.nom ?? '') }))
  const busPath = (row: IZRecord) => '/bus?plaque=' + encodeURIComponent(row.immatriculation)
  const batch = {
    label: t('admin.downloadQrBatch'),
    onRun: async (rows: IZRecord[]) => {
      const base = new URL(window.location.href)
      base.search = ''
      const items: { registration: string; image: string }[] = []
      for (const row of rows) {
        const url = new URL(base.toString())
        url.hash = busPath(row)
        const image = await QRCode.toDataURL(url.toString(), { errorCorrectionLevel: 'M', margin: 2, width: 360 })
        items.push({ registration: String(row.immatriculation), image })
      }
      await downloadQrSheetPdf(items, `QR_${items.length}_bus_A4.pdf`)
      notify(t('admin.qrBatchDone', { count: items.length }), 'success')
    },
  }
  return (
    <CrudPage
      title={t('admin.vehicles')}
      subtitle={t('admin.vehiclesSubtitle')}
      addLabel={t('admin.newVehicle')}
      extra={<div className="iz-flex iz-wrap" style={{ marginBottom: 14 }}>
        <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => navigate('/admin/licenses')}>{t('admin.expiredCta')}</button>
      </div>}
      searchText={(row) => [row.immatriculation, row.proprietaireNom, row.cooperativeCode, row.ligne, row.licenceNumero, row.conducteurNom, row.receveurNom].join(' ')}
      searchPlaceholder={t('admin.searchVehicles')}
      rowLabel={(row) => String(row.immatriculation ?? row.id)}
      initialSort="immatriculation"
      groupBy={(row) => (String(row.ligne ?? '').trim() ? t('search.lineGroup', { line: String(row.ligne).trim() }) : t('search.noLineGroup'))}
      groupLabel={(group, list) => `${group} · ${t('search.busCount', { count: list.length })}`}
      exportCible="vehicules"
      batch={batch}
      load={() => izApi.adminVehicles({ limit: 500 })}
      create={izApi.createVehicle}
      update={izApi.updateVehicle}
      remove={izApi.deleteVehicle}
      initialValues={{ type: 'Bus', statut: 'Normal' }}
      patchOnlyChanges
      toPayload={(payload, values) => {
        // Changer le numéro est une émission de licence : sa date et un NIF sont
        // requis, même si la date n'a pas changé.
        if (payload.licenceNumero && !payload.licenceDebut) {
          if (!values.licenceDebut) throw new Error(t('admin.licenceStartRequired'))
          if (String(values.licenceNif ?? '').trim().length < 3) throw new Error(t('admin.nifRequired'))
          return { ...payload, licenceDebut: values.licenceDebut }
        }
        return payload
      }}
      formInfo={(row) => (
        <div className="iz-small iz-muted" style={{ marginBottom: 16 }}>
          <p>{t('admin.licenceHelp1')}</p>
          <p>{t('admin.licenceHelp2')}</p>
          {row.id && <p>{t('admin.licenceHelp3', { date: dateOnly(row.licenceFin) || '—' })}</p>}
          {coops.error && <p role="alert">{coops.error} <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => void coops.reload()}>{t('admin.reloadCoops')}</button></p>}
        </div>
      )}
      columns={[
        { key: 'immatriculation', label: t('search.plate'), sortValue: (row) => String(row.immatriculation ?? ''), render: (row) => <><a href={`#${busPath(row)}`} onClick={(event) => { event.preventDefault(); navigate(busPath(row)) }}><strong className="iz-mono">{row.immatriculation}</strong></a><div className="iz-small iz-muted">{translateValue(lang, row.type)}</div><button className="iz-btn iz-btn-primary iz-btn-sm" style={{ marginTop: 8 }} onClick={() => navigate(busPath(row) + '&qr=1')} aria-label={t('admin.viewQrAria', { plate: String(row.immatriculation ?? '') })}>{t('admin.downloadQr')}</button></> },
        { key: 'photoUrl', label: t('bus.photoCaption'), render: (row) => row.photoUrl ? <img className="iz-thumb" src={String(row.photoUrl)} alt={t('bus.vehiclePhotoAlt', { plate: String(row.immatriculation ?? '') })} /> : <span className="iz-small iz-muted">—</span> },
        { key: 'proprietaireNom', label: t('search.owner'), sortValue: (row) => String(row.proprietaireNom ?? ''), render: (row) => text(row.proprietaireNom) },
        { key: 'cooperativeCode', label: t('search.cooperative'), sortValue: (row) => String(row.cooperativeCode ?? ''), render: (row) => <span className="iz-chip">{row.cooperativeCode ?? '—'}</span> },
        { key: 'ligne', label: t('search.line'), sortValue: (row) => String(row.ligne ?? ''), render: (row) => text(row.ligne) },
        { key: 'licenceNumero', label: t('admin.licenceNifStat'), sortValue: (row) => String(row.licenceNumero ?? ''), render: (row) => <div className="iz-small"><div>{t('admin.licenceLabel')} : {mono(row.licenceNumero)}</div><div>NIF : {mono(row.licenceNif)}</div><div>STAT : {mono(row.licenceStat)}</div></div> },
        { key: 'licenceFin', label: t('admin.licenceValidity'), sortValue: (row) => String(row.licenceFin ?? ''), render: (row) => <div className="iz-small iz-nowrap"><div>{t('admin.start')} : {mono(dateOnly(row.licenceDebut))}</div><div>{t('admin.end')} : {mono(dateOnly(row.licenceFin))}</div><div style={{ marginTop: 4 }}><StatusBadge status={licenceState(row.licenceDebut, row.licenceFin)} /></div>{row.licenceValidite && <div>{translateValue(lang, row.licenceValidite)}</div>}</div> },
        { key: 'conducteurNom', label: t('admin.crew'), sortValue: (row) => String(row.conducteurNom ?? ''), render: (row) => <div className="iz-small"><div>{t('admin.driver')} : {text(row.conducteurNom)}</div><div>{t('bus.receveur')} : {text(row.receveurNom)}</div></div> },
        { key: 'statut', label: t('common.status'), sortValue: (row) => String(row.statut ?? ''), render: (row) => <StatusBadge status={row.statut} /> },
      ]}
      fields={[
        { key: 'immatriculation', label: t('search.plate'), required: true, minLength: 4, maxLength: 40 },
        { key: 'type', label: t('admin.vehicleType'), type: 'select', required: true, options: [
          { value: 'Bus', label: t('bus.type') },
        ] },
        { key: 'proprietaireNom', label: t('admin.ownerName'), maxLength: 200, clearValue: null },
        { key: 'cooperativeId', label: t('bus.coop'), type: 'select', options: coopOptions, numeric: true, clearValue: null },
        { key: 'ligne', label: t('bus.line'), maxLength: 20, clearValue: '' },
        { key: 'licenceNumero', label: t('admin.licenceNumber'), maxLength: 80, clearValue: '' },
        { key: 'licenceDebut', label: t('admin.licenceStart'), type: 'date', clearValue: null },
        { key: 'licenceNif', label: t('admin.licenceNif'), maxLength: 80, clearValue: '' },
        { key: 'licenceStat', label: t('admin.licenceStat'), maxLength: 80, clearValue: '' },
        { key: 'conducteurNom', label: t('admin.driverName'), maxLength: 200, clearValue: '' },
        { key: 'conducteurPermis', label: t('admin.driverPermit'), maxLength: 80, clearValue: '' },
        { key: 'conducteurTelephone', label: t('admin.driverPhone'), maxLength: 40, clearValue: '' },
        { key: 'receveurNom', label: t('admin.receveurName'), maxLength: 200, clearValue: '' },
        { key: 'receveurTelephone', label: t('admin.receveurPhone'), maxLength: 40, clearValue: '' },
        { key: 'statut', label: t('common.status'), type: 'select', required: true, options: [
          { value: 'Normal', label: translateValue(lang, 'Normal') }, { value: 'Suspendu', label: translateValue(lang, 'Suspendu') }, { value: 'En fourrière', label: t('admin.statusStable') },
        ] },
        { key: 'latitude', label: 'Latitude', type: 'number', min: -90, max: 90, clearValue: null },
        { key: 'longitude', label: 'Longitude', type: 'number', min: -180, max: 180, clearValue: null },
        { key: 'photoUrl', label: t('admin.vehiclePhotoPublic'), type: 'photo', full: true, clearValue: null },
      ]}
      toForm={(row) => ({ ...row, licenceDebut: dateOnly(row.licenceDebut) })}
    />
  )
}

export function AdminLicences() {
  const { t, lang, notify } = useApp()
  const { data, loading, error, reload } = useAsync(() => izApi.expiredLicences(), [])
  const [target, setTarget] = useState<IZRecord | null>(null)
  const [form, setForm] = useState({ licenceNumero: '', licenceNif: '', licenceStat: '', licenceDebut: localToday() })
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const open = (row: IZRecord) => {
    setTarget(row)
    setForm({
      licenceNumero: String(row.licenceNumero ?? ''),
      licenceNif: String(row.licenceNif ?? ''),
      licenceStat: String(row.licenceStat ?? ''),
      licenceDebut: localToday(),
    })
  }
  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!target || busy || !formRef.current?.reportValidity()) return
    if (form.licenceNif.trim().length < 3) {
      notify(t('admin.nifRequired'), 'error')
      return
    }
    setBusy(true)
    try {
      const result = await izApi.deliverLicence(Number(target.id), {
        licenceNumero: form.licenceNumero.trim(),
        licenceNif: form.licenceNif.trim(),
        licenceStat: form.licenceStat.trim() || undefined,
        licenceDebut: form.licenceDebut,
      })
      notify(t('admin.licenceDelivered', { date: String(result.licenceFin ?? '') }), 'success')
      setTarget(null)
      await reload()
    } catch (cause) {
      notify(translateError(lang, cause, 'common.error'), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHead
        title={t('admin.licences')}
        subtitle={t('admin.licencesSubtitle')}
        action={<ExportButton cible="licences-expirees" label="Excel" />}
      />
      {error && <div className="iz-card" role="alert">{error} <button className="iz-btn iz-btn-outline iz-btn-sm" disabled={loading} onClick={() => void reload()}>{t('common.retry')}</button></div>}
      {loading ? <Loading /> : (
        <DataTable
          rows={data ?? []}
          rowKey={(vehicle) => String(vehicle.id)}
          rowLabel={(vehicle) => String(vehicle.immatriculation ?? vehicle.id)}
          searchText={(vehicle) => [vehicle.immatriculation, vehicle.proprietaireNom, vehicle.cooperativeCode, vehicle.licenceNumero, vehicle.licenceNif].join(' ')}
          searchPlaceholder={t('admin.searchLicences')}
          initialSort="licenceFin"
          empty={<Empty message={t('admin.noExpired')} />}
          columns={[
            { key: 'immatriculation', label: t('search.plate'), sortValue: (vehicle) => String(vehicle.immatriculation ?? ''), render: (vehicle) => <strong className="iz-mono">{vehicle.immatriculation}</strong> },
            { key: 'proprietaireNom', label: t('search.owner'), sortValue: (vehicle) => String(vehicle.proprietaireNom ?? ''), render: (vehicle) => text(vehicle.proprietaireNom) },
            { key: 'cooperativeCode', label: t('search.cooperative'), sortValue: (vehicle) => String(vehicle.cooperativeCode ?? ''), render: (vehicle) => <span className="iz-chip">{vehicle.cooperativeCode ?? '—'}</span> },
            { key: 'licenceNumero', label: t('admin.licenceNifShort'), sortValue: (vehicle) => String(vehicle.licenceNumero ?? ''), render: (vehicle) => <div className="iz-small"><div>{t('admin.licenceLabel')} : {mono(vehicle.licenceNumero)}</div><div>NIF : {mono(vehicle.licenceNif)}</div></div> },
            { key: 'licenceFin', label: t('admin.deadline'), sortValue: (vehicle) => String(vehicle.licenceFin ?? ''), render: (vehicle) => <div className="iz-small iz-nowrap"><div>{t('admin.start')} : {mono(dateOnly(vehicle.licenceDebut))}</div><div>{t('admin.end')} : {mono(dateOnly(vehicle.licenceFin))}</div><div style={{ marginTop: 4 }}><StatusBadge status={licenceState(vehicle.licenceDebut, vehicle.licenceFin)} /></div></div> },
          ]}
          actions={(vehicle) => (
            <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => open(vehicle)}>{t('admin.deliverLicence')}</button>
          )}
        />
      )}
      {target && (
        <Modal
          title={t('admin.newLicenceTitle', { plate: String(target.immatriculation ?? '') })}
          onClose={() => { if (!busy) setTarget(null) }}
          footer={<>
            <button className="iz-btn iz-btn-outline" disabled={busy} onClick={() => setTarget(null)}>{t('common.cancel')}</button>
            <button className="iz-btn iz-btn-primary" disabled={busy} onClick={() => formRef.current?.requestSubmit()}>{busy ? t('admin.delivering') : t('admin.deliverLicenceBtn')}</button>
          </>}
        >
          <p className="iz-small iz-muted">{t('admin.licenceFormHelp')}</p>
          <form ref={formRef} className="iz-form-grid" onSubmit={submit} aria-busy={busy}>
            <Field label={t('admin.licenceNumberRequired')}>
              <input className="iz-input" required minLength={2} maxLength={80} disabled={busy} value={form.licenceNumero} onChange={(event) => setForm({ ...form, licenceNumero: event.target.value })} />
            </Field>
            <Field label={t('admin.nifMin')}>
              <input className="iz-input" required minLength={3} maxLength={80} disabled={busy} value={form.licenceNif} onChange={(event) => setForm({ ...form, licenceNif: event.target.value })} />
            </Field>
            <Field label="STAT">
              <input className="iz-input" maxLength={80} disabled={busy} value={form.licenceStat} onChange={(event) => setForm({ ...form, licenceStat: event.target.value })} />
            </Field>
            <Field label={t('admin.licenceStartRequiredField')}>
              <input className="iz-input" type="date" required disabled={busy} value={form.licenceDebut} onChange={(event) => setForm({ ...form, licenceDebut: event.target.value })} />
            </Field>
            <p className="iz-small iz-muted full" style={{ margin: 0 }}>
              {t('admin.computedEnd', { date: sixMonthEnd(form.licenceDebut) || '—' })} <StatusBadge status={licenceState(form.licenceDebut, sixMonthEnd(form.licenceDebut))} />
            </p>
          </form>
        </Modal>
      )}
    </>
  )
}

export function AdminCooperatives() {
  const { t, lang, notify, navigate } = useApp()
  const [detail, setDetail] = useState<IZRecord | null>(null)
  const [buses, setBuses] = useState<IZRecord[]>([])
  const [busesLoading, setBusesLoading] = useState(false)
  const [deletingBus, setDeletingBus] = useState<IZRecord | null>(null)
  const [busBusy, setBusBusy] = useState(false)

  const openDetail = async (coop: IZRecord) => {
    setDetail(coop)
    setBuses([])
    setBusesLoading(true)
    try {
      setBuses(await izApi.adminVehicles({ cooperative: String(coop.code), limit: 500 }))
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    } finally {
      setBusesLoading(false)
    }
  }

  const removeBus = async () => {
    if (!deletingBus || busBusy) return
    setBusBusy(true)
    try {
      await izApi.deleteVehicle(Number(deletingBus.id))
      setBuses((current) => current.filter((bus) => String(bus.id) !== String(deletingBus.id)))
      notify(t('admin.vehicleDeleted'), 'success')
      setDeletingBus(null)
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    } finally {
      setBusBusy(false)
    }
  }

  return (
    <>
      <CrudPage
        title={t('nav.coops')}
        subtitle={t('admin.coopsSubtitle')}
        addLabel={t('admin.newCoop')}
        load={izApi.adminCooperatives}
        create={izApi.createCooperative}
        update={izApi.updateCooperative}
        remove={izApi.deleteCooperative}
        searchText={(row) => [row.nom, row.code, row.description, row.contact].join(' ')}
        initialSort="nom"
        exportCible="cooperatives"
        batch={{
          label: t('admin.deleteSelection'),
          onRun: async (rows) => {
            if (!window.confirm(t('admin.deleteCoopsConfirm', { count: rows.length }))) {
              throw new Error(t('admin.deleteCancelled'))
            }
            for (const row of rows) await izApi.deleteCooperative(Number(row.id))
            notify(t('admin.coopsDeleted', { count: rows.length }), 'success')
          },
        }}
        columns={[
          { key: 'nom', label: t('search.cooperative'), sortValue: (row) => String(row.nom ?? ''), render: (row) => <button type="button" className="iz-link-button" onClick={() => void openDetail(row)}><strong>{row.nom}</strong></button> },
          { key: 'code', label: t('admin.code'), sortValue: (row) => String(row.code ?? ''), render: (row) => <span className="iz-chip">{row.code}</span> },
          { key: 'description', label: t('coops.lines'), sortValue: (row) => String(row.description ?? ''), render: (row) => text(row.description) },
          { key: 'vehicules', label: t('admin.vehicles'), sortValue: (row) => Number(row.vehicules ?? 0), render: (row) => <button type="button" className="iz-badge iz-badge-blue iz-link-button" onClick={() => void openDetail(row)}>{t('search.busCount', { count: Number(row.vehicules ?? 0) })}</button> },
        ]}
        fields={[
          { key: 'code', label: t('admin.code'), required: true },
          { key: 'nom', label: t('search.cooperative'), required: true },
          { key: 'description', label: t('coops.lines'), full: true },
          { key: 'ligneCodes', label: t('admin.lineCodes') },
          { key: 'contact', label: t('admin.contact') },
        ]}
      />
      {detail && (
        <Modal wide title={t('admin.coopModalTitle', { name: String(detail.nom ?? ''), count: buses.length })} onClose={() => setDetail(null)}>
          <div className="iz-flex iz-wrap" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <p className="iz-small iz-muted" style={{ margin: 0 }}>{t('admin.code')} {detail.code} · {detail.description ?? '—'}</p>
            <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setDetail(null)}>{t('common.close')}</button>
          </div>
          {busesLoading ? <Loading /> : buses.length === 0 ? <Empty message={t('coops.none')} /> : (
            <DataTable
              rows={buses}
              rowKey={(bus) => String(bus.id)}
              rowLabel={(bus) => String(bus.immatriculation ?? bus.id)}
              searchText={(bus) => [bus.immatriculation, bus.proprietaireNom, bus.ligne, bus.licenceNumero].join(' ')}
              initialSort="immatriculation"
              empty={<Empty />}
              columns={[
                { key: 'immatriculation', label: t('search.plate'), sortValue: (bus) => String(bus.immatriculation ?? ''), render: (bus) => <strong className="iz-mono">{bus.immatriculation}</strong> },
                { key: 'proprietaireNom', label: t('search.owner'), sortValue: (bus) => String(bus.proprietaireNom ?? ''), render: (bus) => text(bus.proprietaireNom) },
                { key: 'ligne', label: t('search.line'), sortValue: (bus) => String(bus.ligne ?? ''), render: (bus) => text(bus.ligne) },
                { key: 'licenceFin', label: t('admin.licenceLabel'), sortValue: (bus) => String(bus.licenceFin ?? ''), render: (bus) => <div className="iz-small"><div>{mono(dateOnly(bus.licenceFin))}</div><div style={{ marginTop: 4 }}><StatusBadge status={licenceState(bus.licenceDebut, bus.licenceFin)} /></div></div> },
                { key: 'statut', label: t('common.status'), sortValue: (bus) => String(bus.statut ?? ''), render: (bus) => <StatusBadge status={bus.statut} /> },
              ]}
              actions={(bus) => (
                <>
                  <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => navigate('/bus?plaque=' + encodeURIComponent(String(bus.immatriculation)))}>{t('admin.fiche')}</button>{' '}
                  <button className="iz-btn iz-btn-danger iz-btn-sm" disabled={busBusy} onClick={() => setDeletingBus(bus)}>{t('common.delete')}</button>
                </>
              )}
            />
          )}
        </Modal>
      )}
      {deletingBus && (
        <ConfirmDialog
          message={t('admin.deleteBusConfirm', { plate: String(deletingBus.immatriculation ?? '') })}
          onCancel={() => { if (!busBusy) setDeletingBus(null) }}
          onConfirm={() => void removeBus()}
        />
      )}
    </>
  )
}

export function AdminOwners() {
  const { t } = useApp()
  const coops = useAsync(() => izApi.adminCooperatives(), [])
  const coopOptions = (coops.data ?? []).map((coop) => ({ value: String(coop.id), label: coop.nom }))
  return (
    <CrudPage
      title={t('admin.owners')}
      subtitle={t('admin.ownersSubtitle')}
      load={izApi.owners}
      create={izApi.createOwner}
      update={izApi.updateOwner}
      remove={izApi.deleteOwner}
      patchOnlyChanges
      searchText={(row) => [row.nom, row.telephone, row.cin, row.adresse, row.cooperativeCode].join(' ')}
      initialSort="nom"
      exportCible="proprietaires"
      columns={[
        { key: 'photoUrl', label: t('admin.photo'), render: (row) => row.photoUrl ? <img className="iz-thumb" src={String(row.photoUrl)} alt={t('admin.ownerPhotoAlt', { name: String(row.nom ?? '') })} /> : <span className="iz-small iz-muted">—</span> },
        { key: 'nom', label: t('search.owner'), sortValue: (row) => String(row.nom ?? ''), render: (row) => <strong>{row.nom}</strong> },
        { key: 'telephone', label: t('admin.phone'), sortValue: (row) => String(row.telephone ?? ''), render: (row) => text(row.telephone) },
        { key: 'cin', label: t('admin.cin'), sortValue: (row) => String(row.cin ?? ''), render: (row) => text(row.cin) },
        { key: 'adresse', label: t('admin.address'), sortValue: (row) => String(row.adresse ?? ''), render: (row) => text(row.adresse) },
        { key: 'cooperativeCode', label: t('search.cooperative'), sortValue: (row) => String(row.cooperativeCode ?? ''), render: (row) => text(row.cooperativeCode) },
      ]}
      fields={[
        { key: 'nom', label: t('search.owner'), required: true, maxLength: 200 },
        { key: 'telephone', label: t('admin.phone'), maxLength: 40, clearValue: null },
        { key: 'cin', label: t('admin.cinNumber'), maxLength: 40, clearValue: null },
        { key: 'adresse', label: t('admin.address'), maxLength: 200, full: true, clearValue: null },
        { key: 'cooperativeId', label: t('search.cooperative'), type: 'select', options: coopOptions, numeric: true, clearValue: null },
        { key: 'photoUrl', label: t('admin.ownerPhoto'), type: 'photo', full: true, clearValue: null },
      ]}
    />
  )
}

export function AdminLines() {
  const { t } = useApp()
  const [lineId, setLineId] = useState<number | null>(null)
  const coops = useAsync(() => izApi.adminCooperatives(), [])
  const coopOptions = (coops.data ?? []).map((coop) => ({ value: String(coop.id), label: coop.nom }))
  const stops = useAsync(() => (lineId ? izApi.adminStops(lineId) : Promise.resolve([])), [lineId])
  return (
    <>
      <CrudPage
        title={t('admin.lines')}
        subtitle={t('admin.linesSubtitle')}
        addLabel={t('admin.newLine')}
        load={izApi.adminLines}
        create={izApi.createLine}
        update={izApi.updateLine}
        remove={izApi.deleteLine}
        searchText={(row) => [row.code, row.nom, row.cooperativeCode].join(' ')}
        initialSort="code"
        exportCible="lignes"
        columns={[
          { key: 'code', label: t('admin.code'), sortValue: (row) => String(row.code ?? ''), render: (row) => <span className="iz-chip">{row.code}</span> },
          { key: 'nom', label: t('search.line'), sortValue: (row) => String(row.nom ?? ''), render: (row) => <strong>{row.nom}</strong> },
          { key: 'couleur', label: t('admin.color'), sortValue: (row) => String(row.couleur ?? ''), render: (row) => (
            <span className="iz-flex" style={{ gap: 6, alignItems: 'center' }}>
              <span className="iz-color-dot" style={{ background: String(row.couleur ?? '#2563eb') }} />
              <span className="iz-mono iz-small">{row.couleur ?? '—'}</span>
            </span>
          ) },
          { key: 'cooperativeCode', label: t('search.cooperative'), sortValue: (row) => String(row.cooperativeCode ?? ''), render: (row) => text(row.cooperativeCode) },
          { key: 'arrets', label: t('map.stops'), sortValue: (row) => Number(row.arrets ?? 0), render: (row) => (
            <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setLineId(Number(row.id))}>
              {row.arrets} {t('map.stops')}
            </button>
          ) },
        ]}
        fields={[
          { key: 'code', label: t('admin.code'), required: true },
          { key: 'nom', label: t('search.line'), required: true },
          { key: 'cooperativeId', label: t('search.cooperative'), type: 'select', options: coopOptions },
          { key: 'couleur', label: t('admin.color') },
          { key: 'active', label: t('admin.active'), type: 'checkbox' },
        ]}
      />
      {lineId && (
        <div className="iz-card" style={{ marginTop: 24 }}>
          <div className="iz-section-head">
            <h2 style={{ fontSize: '1.1rem' }}>{t('admin.stopsOfLine', { id: lineId })}</h2>
            <button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => setLineId(null)}>{t('common.close')}</button>
          </div>
          {stops.loading ? <Loading /> : (
            <CrudPage
              title={t('map.stops')}
              load={() => izApi.adminStops(lineId)}
              create={(data) => izApi.createStop({ ...data, lineId })}
              update={izApi.updateStop}
              remove={izApi.deleteStop}
              searchText={(row) => [row.nom, row.ordre].join(' ')}
              initialSort="ordre"
              exportCible="arrets"
              columns={[
                { key: 'nom', label: t('map.stops'), sortValue: (row) => String(row.nom ?? ''), render: (row) => <strong>{row.nom}</strong> },
                { key: 'latitude', label: 'Latitude', sortValue: (row) => Number(row.latitude ?? 0), render: (row) => mono(row.latitude) },
                { key: 'longitude', label: 'Longitude', sortValue: (row) => Number(row.longitude ?? 0), render: (row) => mono(row.longitude) },
                { key: 'ordre', label: '#', sortValue: (row) => Number(row.ordre ?? 0), render: (row) => text(row.ordre) },
              ]}
              fields={[
                { key: 'nom', label: t('map.stops'), required: true },
                { key: 'latitude', label: 'Latitude', type: 'number', required: true },
                { key: 'longitude', label: 'Longitude', type: 'number', required: true },
                { key: 'ordre', label: '#', type: 'number' },
              ]}
              toForm={(row) => ({ ...row, lineId })}
            />
          )}
        </div>
      )}
    </>
  )
}

export function AdminPayments() {
  const { t, lang, notify, user, navigate } = useApp()
  const isSuper = user?.role === 'superadmin'
  const { data, loading, reload } = useAsync(() => izApi.payments(), [])
  const vehicles = useAsync(() => izApi.adminVehicles({ limit: 500 }), [])
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const [form, setForm] = useState<IZRecord>({ type: 'Adhésion', moyen: 'Orange Money', montant: '', vehicleId: '' })
  const selectedVehicle = (vehicles.data ?? []).find((bus) => String(bus.id) === String(form.vehicleId))
  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    try {
      await izApi.createPayment({
        ...form,
        montant: Number(form.montant),
        vehicleId: form.vehicleId ? Number(form.vehicleId) : undefined,
      })
      notify(t('admin.saved'), 'success')
      setOpen(false)
      await reload()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    }
  }
  const setStatut = async (id: number, statut: string) => {
    await izApi.updatePayment(id, { statut })
    await reload()
  }
  const remove = async () => {
    if (!deleting) return
    try {
      await izApi.deletePayment(Number(deleting.id))
      notify(t('admin.paymentDeletedOk'), 'success')
      setDeleting(null)
      await reload()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    }
  }
  const receiptOf = (payment: IZRecord) => ({
    reference: String(payment.reference ?? ''),
    type: String(payment.type ?? ''),
    montant: Number(payment.montant ?? 0),
    moyen: String(payment.moyen ?? ''),
    statut: String(payment.statut ?? ''),
    telephone: payment.telephone ? String(payment.telephone) : null,
    referenceExterne: payment.referenceExterne ? String(payment.referenceExterne) : null,
    immatriculation: payment.immatriculation ? String(payment.immatriculation) : null,
    proprietaireNom: payment.proprietaireNom ? String(payment.proprietaireNom) : null,
    createdAt: payment.createdAt ? String(payment.createdAt) : null,
    validatedAt: payment.validatedAt ? String(payment.validatedAt) : null,
    validatedByName: payment.validatedByName ? String(payment.validatedByName) : null,
  })
  return (
    <>
      <PageHead
        title={t('admin.payments')}
        action={(
          <div className="iz-flex iz-wrap">
            <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => navigate('/admin/payments/register')}>{t('admin.registerBtn')}</button>
            <ExportButton cible="paiements" label="Excel" />
            <button className="iz-btn iz-btn-primary" onClick={() => setOpen(true)}>+ {t('admin.newPayment')}</button>
          </div>
        )}
      />
      {loading ? <Loading /> : (
        <DataTable
          rows={data ?? []}
          rowKey={(payment) => String(payment.id)}
          searchText={(payment) => [payment.reference, payment.type, payment.immatriculation, payment.proprietaireNom, payment.moyen, payment.statut, payment.telephone].join(' ')}
          initialSort="createdAt"
          empty={<Empty />}
          columns={[
            { key: 'reference', label: t('admin.reference'), sortValue: (payment) => String(payment.reference ?? ''), render: (payment) => <span className="iz-mono iz-small">{payment.reference}</span> },
            { key: 'type', label: t('admin.type'), sortValue: (payment) => String(payment.type ?? ''), render: (payment) => <>{translateValue(lang, payment.type)}</> },
            { key: 'immatriculation', label: t('search.plate'), sortValue: (payment) => String(payment.immatriculation ?? ''), render: (payment) => <span className="iz-mono">{payment.immatriculation ?? '—'}</span> },
            { key: 'proprietaireNom', label: t('search.owner'), sortValue: (payment) => String(payment.proprietaireNom ?? ''), render: (payment) => <>{payment.proprietaireNom ?? '—'}</> },
            { key: 'montant', label: t('admin.amount'), sortValue: (payment) => Number(payment.montant ?? 0), render: (payment) => <>{Number(payment.montant).toLocaleString('fr-FR')} Ar</> },
            { key: 'moyen', label: t('admin.moyen'), sortValue: (payment) => String(payment.moyen ?? ''), render: (payment) => <>{translateValue(lang, payment.moyen)}</> },
            { key: 'statut', label: t('common.status'), sortValue: (payment) => String(payment.statut ?? ''), render: (payment) => <StatusBadge status={payment.statut} /> },
            { key: 'createdAt', label: t('common.date'), sortValue: (payment) => String(payment.createdAt ?? ''), render: (payment) => <span className="iz-small">{when(payment.createdAt)}</span> },
          ]}
          actions={(payment) => (
            <>
              <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => void setStatut(Number(payment.id), 'Payé')}>{t('admin.approve')}</button>{' '}
              <button className="iz-btn iz-btn-outline iz-btn-sm" title={t('admin.receiptPdfTitle')} onClick={() => void downloadReceiptA4(receiptOf(payment), undefined, lang)}>{t('admin.receiptPdf')}</button>{' '}
              <button className="iz-btn iz-btn-outline iz-btn-sm" title={t('admin.printReceiptTitle')} onClick={() => void printReceipt(receiptOf(payment), lang)}>{t('admin.printReceipt')}</button>
              {isSuper && (
                <> <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setDeleting(payment)}>{t('common.delete')}</button></>
              )}
            </>
          )}
        />
      )}
      {open && (
        <Modal title={t('admin.newPayment')} onClose={() => setOpen(false)} footer={
          <button className="iz-btn iz-btn-primary" onClick={() => void submit()}>{t('common.save')}</button>
        }>
          <form className="iz-form-grid" onSubmit={submit}>
            <Field label={t('admin.paymentType')}>
              <select className="iz-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {['Adhésion', 'Affectation', 'Vignette', 'Patente', 'Amende', 'Autre'].map((value) => <option key={value} value={value}>{value === 'Patente' ? t('admin.patenteOption') : translateValue(lang, value)}</option>)}
              </select>
            </Field>
            <Field label={t('admin.amount')}>
              <input className="iz-input" type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
            </Field>
            <Field label={t('admin.paymentVehicle')} full>
              <select className="iz-select" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                <option value="">{t('admin.noVehicle')}</option>
                {(vehicles.data ?? []).map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.immatriculation} — {bus.proprietaireNom ?? t('admin.ownerNotProvided')}
                  </option>
                ))}
              </select>
              {selectedVehicle && (
                <span className="iz-small iz-muted" style={{ marginTop: 4 }}>
                  {t('admin.vehicleSummary', {
                    plate: String(selectedVehicle.immatriculation ?? '—'),
                    owner: String(selectedVehicle.proprietaireNom ?? '—'),
                  })}
                </span>
              )}
            </Field>
            <Field label={t('admin.moyen')}>
              <select className="iz-select" value={form.moyen} onChange={(e) => setForm({ ...form, moyen: e.target.value })}>
                {['Orange Money', 'MTN MoMo', 'Airtel Money', 'Espèces', 'Autre'].map((value) => <option key={value} value={value}>{translateValue(lang, value)}</option>)}
              </select>
            </Field>
            <Field label={t('admin.paymentPhone')}>
              <input className="iz-input" value={form.telephone ?? ''} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </Field>
            <Field label={t('admin.reference')} full>
              <input className="iz-input" value={form.referenceExterne ?? ''} onChange={(e) => setForm({ ...form, referenceExterne: e.target.value })} />
            </Field>
          </form>
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          message={t('admin.deletePaymentConfirm', { ref: String(deleting.reference ?? '') })}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}

export function AdminPaymentsRegister() {
  const { t, lang, notify, user, navigate } = useApp()
  const isSuper = user?.role === 'superadmin'
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('day')
  const [date, setDate] = useState(localToday())
  const [busy, setBusy] = useState<'pdf' | 'print' | null>(null)
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const { data, loading, reload } = useAsync(() => izApi.paymentRegister(period, date), [period, date])
  const rows: IZRecord[] = data?.rows ?? []
  const summary = data?.summary ?? { total: 0, montant: 0, payes: 0, montantPaye: 0, enAttente: 0 }
  const payload = (): RegisterPayload => ({
    period,
    from: String(data?.from ?? date),
    to: String(data?.to ?? date),
    rows: rows.map((row) => ({
      id: row.id,
      reference: String(row.reference ?? ''),
      type: String(row.type ?? ''),
      montant: Number(row.montant ?? 0),
      moyen: String(row.moyen ?? ''),
      statut: String(row.statut ?? ''),
      immatriculation: row.immatriculation ?? null,
      proprietaireNom: row.proprietaireNom ?? null,
      createdAt: row.createdAt ?? null,
    })),
    summary: {
      total: Number(summary.total ?? 0),
      montant: Number(summary.montant ?? 0),
      payes: Number(summary.payes ?? 0),
      montantPaye: Number(summary.montantPaye ?? 0),
      enAttente: Number(summary.enAttente ?? 0),
    },
  })
  const exportPdf = async (mode: 'pdf' | 'print') => {
    setBusy(mode)
    try {
      if (mode === 'pdf') await downloadRegisterPdf(payload(), lang)
      else await printRegisterPdf(payload(), lang)
    } catch (error) {
      notify(translateError(lang, error, 'admin.generationFailed'), 'error')
    } finally {
      setBusy(null)
    }
  }
  const remove = async () => {
    if (!deleting) return
    try {
      await izApi.deletePayment(Number(deleting.id))
      notify(t('admin.paymentDeletedOk'), 'success')
      setDeleting(null)
      await reload()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    }
  }
  return (
    <>
      <PageHead
        title={t('admin.registerTitle')}
        subtitle={t('admin.registerSubtitle')}
        action={(
          <div className="iz-flex iz-wrap">
            <button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => navigate('/admin/payments')}>{t('admin.backPayments')}</button>
            <button className="iz-btn iz-btn-outline iz-btn-sm" disabled={busy !== null} onClick={() => void exportPdf('pdf')}>{busy === 'pdf' ? t('admin.generating') : t('admin.generatePdf')}</button>
            <button className="iz-btn iz-btn-primary iz-btn-sm" disabled={busy !== null} onClick={() => void exportPdf('print')}>{busy === 'print' ? t('admin.preparing') : t('admin.printRegister')}</button>
          </div>
        )}
      />
      <div className="iz-flex iz-wrap" style={{ gap: 8, marginBottom: 14 }}>
        {([
          ['day', 'admin.daily'],
          ['month', 'admin.monthly'],
          ['year', 'admin.yearly'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            className={`iz-btn iz-btn-sm ${period === value ? 'iz-btn-primary' : 'iz-btn-outline'}`}
            onClick={() => setPeriod(value)}
          >
            {t(label)}
          </button>
        ))}
        <label className="iz-flex iz-small iz-muted" style={{ gap: 6, marginLeft: 8 }}>
          {t('admin.dateLabel')}
          <input className="iz-input" type="date" value={date} onChange={(event) => setDate(event.target.value || localToday())} />
        </label>
      </div>
      <div className="iz-grid iz-grid-4">
        <StatCard value={summary.total} label={t('admin.operations')} />
        <StatCard value={`${Number(summary.montantPaye).toLocaleString('fr-FR')} Ar`} label={t('admin.collected')} />
        <StatCard value={summary.payes} label={t('admin.paidPayments')} />
        <StatCard value={summary.enAttente} label={t('admin.pending')} />
      </div>
      <div style={{ marginTop: 16 }}>
        {loading ? <Loading /> : (
          <DataTable
            rows={rows}
            rowKey={(payment) => String(payment.id)}
            searchText={(payment) => [payment.reference, payment.type, payment.immatriculation, payment.proprietaireNom, payment.moyen, payment.statut].join(' ')}
            initialSort="createdAt"
            empty={<Empty message={t('admin.noPaymentsPeriod')} />}
            columns={[
              { key: 'createdAt', label: t('admin.dateTime'), sortValue: (payment) => String(payment.createdAt ?? ''), render: (payment) => <span className="iz-small iz-nowrap">{when(payment.createdAt)}</span> },
              { key: 'reference', label: t('admin.reference'), sortValue: (payment) => String(payment.reference ?? ''), render: (payment) => <span className="iz-mono iz-small">{payment.reference}</span> },
              { key: 'type', label: t('admin.type'), sortValue: (payment) => String(payment.type ?? ''), render: (payment) => <>{translateValue(lang, payment.type)}</> },
              { key: 'immatriculation', label: t('search.plate'), sortValue: (payment) => String(payment.immatriculation ?? ''), render: (payment) => <span className="iz-mono">{payment.immatriculation ?? '—'}</span> },
              { key: 'proprietaireNom', label: t('search.owner'), sortValue: (payment) => String(payment.proprietaireNom ?? ''), render: (payment) => <>{payment.proprietaireNom ?? '—'}</> },
              { key: 'moyen', label: t('admin.moyen'), sortValue: (payment) => String(payment.moyen ?? ''), render: (payment) => <>{translateValue(lang, payment.moyen)}</> },
              { key: 'montant', label: t('admin.amount'), sortValue: (payment) => Number(payment.montant ?? 0), render: (payment) => <>{Number(payment.montant).toLocaleString('fr-FR')} Ar</> },
              { key: 'statut', label: t('common.status'), sortValue: (payment) => String(payment.statut ?? ''), render: (payment) => <StatusBadge status={payment.statut} /> },
            ]}
            actions={isSuper ? (payment) => (
              <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setDeleting(payment)}>{t('common.delete')}</button>
            ) : undefined}
          />
        )}
      </div>
      {deleting && (
        <ConfirmDialog
          message={t('admin.deletePaymentConfirm', { ref: String(deleting.reference ?? '') })}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Données décisionnelles (imprimable)                                 */
/* ------------------------------------------------------------------ */

const ar = (value: unknown) => `${Number(value ?? 0).toLocaleString('fr-FR')} Ar`

function ReportTable({
  title, headers, rows, empty,
}: {
  title: string
  headers: string[]
  rows: (string | number)[][]
  empty: string
}) {
  return (
    <section className="iz-card iz-report-section">
      <h3>{title}</h3>
      {rows.length ? (
        <table className="iz-report-table">
          <thead>
            <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={cellIndex > 0 ? 'iz-report-num' : ''}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="iz-small iz-muted">{empty}</p>}
    </section>
  )
}

export function AdminAnalytics() {
  const { t, lang, notify } = useApp()
  const { data, loading, reload } = useAsync(() => izApi.adminAnalytics(), [])
  const licences = data?.licences ?? {}
  const expired: IZRecord[] = data?.expired ?? []
  const expiring: IZRecord[] = data?.expiring ?? []
  const paymentsByMonth: IZRecord[] = data?.paymentsByMonth ?? []
  const paymentsByType: IZRecord[] = data?.paymentsByType ?? []
  const scansByMonth: IZRecord[] = data?.scansByMonth ?? []
  const infractionsByStatut: IZRecord[] = data?.infractionsByStatut ?? []
  const infractionsByType: IZRecord[] = data?.infractionsByType ?? []
  const signalsByStatut: IZRecord[] = data?.signalsByStatut ?? []
  const signalsByCategorie: IZRecord[] = data?.signalsByCategorie ?? []
  const topCooperatives: IZRecord[] = data?.topCooperatives ?? []
  const generated = data?.generatedAt ? when(data.generatedAt) : when(new Date().toISOString())
  const print = () => {
    try {
      window.print()
    } catch {
      notify(t('analytics.printFailed'), 'error')
    }
  }
  const licenceHeaders = [t('search.plate'), t('search.owner'), t('search.cooperative'), t('analytics.number'), t('analytics.licenceEnd')]
  return (
    <>
      <PageHead
        title={`📊 ${t('admin.analytics')}`}
        subtitle={t('admin.analyticsSubtitle')}
        action={(
          <div className="iz-flex iz-wrap iz-no-print">
            <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => void reload()}>{t('admin.refresh')}</button>
            <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={print}>{t('admin.print')}</button>
          </div>
        )}
      />
      {loading ? <Loading /> : (
        <div className="iz-printable">
          <div className="iz-print-head">
            <img src="/brand/logo-commune.png" alt={t('analytics.communeAlt')} />
            <div>
              <strong>{t('analytics.communeAlt')}</strong>
              <span>{t('analytics.reportTitle')}</span>
              <span>{t('analytics.generatedOn', { date: generated })}</span>
            </div>
          </div>

          <div className="iz-grid iz-grid-4">
            <StatCard icon="🚐" value={licences.total ?? 0} label={t('admin.registeredBuses')} />
            <StatCard icon="✅" value={licences.valides ?? 0} label={t('admin.validLicences')} />
            <StatCard icon="⏳" value={licences.expirent ?? 0} label={t('admin.expiringSoon')} />
            <StatCard icon="⚠️" value={licences.expirees ?? 0} label={t('admin.expiredLicences')} />
          </div>

          <ReportTable
            title={t('analytics.expiredTitle', { count: expired.length })}
            headers={licenceHeaders}
            rows={expired.map((row) => [
              String(row.immatriculation ?? '—'),
              String(row.proprietaireNom ?? '—'),
              String(row.cooperativeCode ?? '—'),
              String(row.licenceNumero ?? '—'),
              dateOnly(row.licenceFin) || '—',
            ])}
            empty={t('analytics.noExpired')}
          />
          <ReportTable
            title={t('analytics.expiringTitle', { count: expiring.length })}
            headers={licenceHeaders}
            rows={expiring.map((row) => [
              String(row.immatriculation ?? '—'),
              String(row.proprietaireNom ?? '—'),
              String(row.cooperativeCode ?? '—'),
              String(row.licenceNumero ?? '—'),
              dateOnly(row.licenceFin) || '—',
            ])}
            empty={t('analytics.noExpiring')}
          />

          <ReportTable
            title={t('admin.payments12')}
            headers={[t('analytics.month'), t('admin.operations'), t('analytics.totalAmount'), t('analytics.collectedAmount')]}
            rows={paymentsByMonth.map((row) => [
              String(row.mois),
              Number(row.total ?? 0),
              ar(row.montant),
              ar(row.montantPaye),
            ])}
            empty={t('analytics.noPayments')}
          />
          <ReportTable
            title={t('admin.paymentsByType')}
            headers={[t('admin.type'), t('admin.operations'), t('analytics.totalAmount')]}
            rows={paymentsByType.map((row) => [translateValue(lang, row.type), Number(row.total ?? 0), ar(row.montant)])}
            empty={t('analytics.noPayments')}
          />

          <ReportTable
            title={t('admin.scans6')}
            headers={[t('analytics.month'), t('analytics.scans')]}
            rows={scansByMonth.map((row) => [String(row.mois), Number(row.total ?? 0)])}
            empty={t('analytics.noScans')}
          />
          <ReportTable
            title={t('admin.infractionsByStatus')}
            headers={[t('common.status'), t('analytics.count'), t('admin.amount')]}
            rows={infractionsByStatut.map((row) => [translateValue(lang, row.statut), Number(row.total ?? 0), ar(row.montant)])}
            empty={t('analytics.noInfractions')}
          />
          <ReportTable
            title={t('admin.infractionsByType')}
            headers={[t('admin.type'), t('analytics.count'), t('admin.amount')]}
            rows={infractionsByType.map((row) => [translateValue(lang, row.type), Number(row.total ?? 0), ar(row.montant)])}
            empty={t('analytics.noInfractions')}
          />

          <ReportTable
            title={t('admin.signalsByStatus')}
            headers={[t('common.status'), t('analytics.count')]}
            rows={signalsByStatut.map((row) => [translateValue(lang, row.statut), Number(row.total ?? 0)])}
            empty={t('analytics.noSignals')}
          />
          <ReportTable
            title={t('admin.signalsByCategory')}
            headers={[t('analytics.category'), t('analytics.count')]}
            rows={signalsByCategorie.map((row) => [translateValue(lang, row.categorie), Number(row.total ?? 0)])}
            empty={t('analytics.noSignals')}
          />

          <ReportTable
            title={t('admin.coopsFleet')}
            headers={[t('admin.code'), t('search.cooperative'), t('admin.vehicles')]}
            rows={topCooperatives.map((row) => [String(row.code ?? '—'), String(row.nom ?? '—'), Number(row.vehicules ?? 0)])}
            empty={t('analytics.noCoops')}
          />
        </div>
      )}
    </>
  )
}

export function AdminRequests() {
  const { t, lang, notify, user } = useApp()
  const isSuper = user?.role === 'superadmin'
  const { data, loading, reload } = useAsync(() => izApi.licenceRequests(), [])
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const [form, setForm] = useState<IZRecord>({ immatriculation: '', nomProprietaire: '' })
  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    try {
      await izApi.createLicenceRequest(form)
      setOpen(false)
      await reload()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    }
  }
  const decide = async (id: number, statut: string) => {
    await izApi.updateLicenceRequest(id, { statut })
    await reload()
  }
  const remove = async () => {
    if (!deleting) return
    try {
      await izApi.deleteLicenceRequest(Number(deleting.id))
      notify(t('admin.requestDeleted'), 'success')
      setDeleting(null)
      await reload()
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    }
  }
  return (
    <>
      <PageHead title={t('admin.requests')} action={<div className="iz-flex iz-wrap"><ExportButton cible="demandes-licence" label="Excel" /><button className="iz-btn iz-btn-primary" onClick={() => setOpen(true)}>+ {t('common.add')}</button></div>} />
      {loading ? <Loading /> : (
        <DataTable
          rows={data ?? []}
          rowKey={(request) => String(request.id)}
          searchText={(request) => [request.immatriculation, request.nomProprietaire, request.cooperativeCode, request.statut].join(' ')}
          initialSort="createdAt"
          empty={<Empty />}
          columns={[
            { key: 'immatriculation', label: t('search.plate'), sortValue: (request) => String(request.immatriculation ?? ''), render: (request) => <span className="iz-mono">{request.immatriculation}</span> },
            { key: 'nomProprietaire', label: t('search.owner'), sortValue: (request) => String(request.nomProprietaire ?? ''), render: (request) => <>{request.nomProprietaire}</> },
            { key: 'cooperativeCode', label: t('search.cooperative'), sortValue: (request) => String(request.cooperativeCode ?? ''), render: (request) => <>{request.cooperativeCode ?? '—'}</> },
            { key: 'createdAt', label: t('common.date'), sortValue: (request) => String(request.createdAt ?? ''), render: (request) => <span className="iz-small">{when(request.createdAt)}</span> },
            { key: 'statut', label: t('common.status'), sortValue: (request) => String(request.statut ?? ''), render: (request) => <StatusBadge status={request.statut} /> },
          ]}
          actions={(request) => (
            <>
              <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => decide(Number(request.id), 'Acceptée')}>{t('admin.approve')}</button>{' '}
              <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => decide(Number(request.id), 'Rejetée')}>{t('admin.reject')}</button>
              {isSuper && (
                <> <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setDeleting(request)}>{t('common.delete')}</button></>
              )}
            </>
          )}
        />
      )}
      {deleting && (
        <ConfirmDialog
          message={t('admin.deleteRequest', { plate: String(deleting.immatriculation ?? '') })}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
      {open && (
        <Modal title={t('admin.requests')} onClose={() => setOpen(false)} footer={
          <button className="iz-btn iz-btn-primary" onClick={() => void submit()}>{t('common.save')}</button>
        }>
          <form className="iz-form-grid" onSubmit={submit}>
            <Field label={t('search.plate')}><input className="iz-input" required value={form.immatriculation} onChange={(e) => setForm({ ...form, immatriculation: e.target.value })} /></Field>
            <Field label={t('search.owner')}><input className="iz-input" required value={form.nomProprietaire} onChange={(e) => setForm({ ...form, nomProprietaire: e.target.value })} /></Field>
          </form>
        </Modal>
      )}
    </>
  )
}

export function AdminUsers() {
  const { t, lang, notify, user: currentUser } = useApp()
  const users = useAsync(() => izApi.adminUsers(), [])
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<IZCreateUser>({ nom: '', prenom: '', email: '', motDePasse: '', telephone: '', role: 'controleur' })
  const [editingAccount, setEditingAccount] = useState<IZRecord | null>(null)
  const [editForm, setEditForm] = useState<IZRecord>({ nom: '', prenom: '', email: '', telephone: '', motDePasse: '' })
  const [photoTouched, setPhotoTouched] = useState(false)
  const [viewingAgent, setViewingAgent] = useState<number | null>(null)
  const [resetTarget, setResetTarget] = useState<IZRecord | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const resetRequests = useAsync(() => izApi.passwordResetRequests(), [])
  const formRef = useRef<HTMLFormElement>(null)
  const accounts = users.data ?? []
  const admins = accounts.filter((account) => account.role === 'admin').length
  const controllers = accounts.filter((account) => account.role === 'controleur').length
  const superadmins = accounts.filter((account) => account.role === 'superadmin').length
  const isSuper = currentUser?.role === 'superadmin'
  const isAdmin = isSuper || currentUser?.role === 'admin'
  const atLimit = (role: IZAccountRole) => role === 'admin' ? admins >= 5 : role === 'controleur' ? controllers >= 100 : role === 'superadmin' && superadmins >= 1
  const isOwn = (account: IZRecord) => !currentUser || String(account.id) === String(currentUser.id)
  const canDelete = (account: IZRecord) => !isOwn(account) && (isSuper ? account.role !== 'superadmin' || superadmins > 1 : account.role === 'controleur')
  const roleLabel = (role: unknown) => role === 'superadmin' ? t('admin.superadminOption') : role === 'admin' ? t('admin.adminOption') : t('admin.controllerOption')
  const disabled = busy || users.loading || Boolean(users.error) || !currentUser
  const reportError = (cause: unknown) => {
    const message = translateError(lang, cause, 'common.error')
    setError(message)
    notify(message, 'error')
  }

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (disabled || !formRef.current?.reportValidity()) return
    setError('')
    if (!form.nom.trim()) {
      setError(t('admin.nameRequired'))
      return
    }
    if (atLimit(form.role)) {
      setError(t('admin.limitReached'))
      return
    }
    setBusy(true)
    try {
      await izApi.createUser({
        ...form,
        nom: form.nom.trim(),
        prenom: form.prenom?.trim(),
        email: form.email.trim(),
        telephone: form.telephone?.trim(),
        cin: form.cin?.trim(),
        fonction: form.fonction?.trim(),
        matricule: form.matricule?.trim(),
        photoIdentite: form.photoIdentite || null,
      })
      setForm({ nom: '', prenom: '', email: '', motDePasse: '', telephone: '', role: 'controleur', cin: '', fonction: '', matricule: '', photoIdentite: null })
      setCreating(false)
      notify(t('admin.accountCreated'), 'success')
      await users.reload()
    } catch (cause) {
      reportError(cause)
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (account: IZRecord, role: string) => {
    if (disabled || isOwn(account) || role === account.role) return
    if (role !== 'admin' && role !== 'controleur' && role !== 'superadmin') return
    if (!isSuper && role !== 'controleur') {
      setError(t('admin.superOnlyRole'))
      return
    }
    setError('')
    if (atLimit(role)) {
      setError(t('admin.limitReached'))
      return
    }
    setBusy(true)
    try {
      await izApi.updateUserRole(Number(account.id), role)
      notify(t('admin.roleUpdated'), 'success')
      await users.reload()
    } catch (cause) {
      reportError(cause)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (disabled || !deleting || !canDelete(deleting)) return
    setError('')
    setBusy(true)
    try {
      await izApi.deleteUser(Number(deleting.id))
      setDeleting(null)
      notify(t('admin.accountDeleted'), 'success')
      await users.reload()
    } catch (cause) {
      reportError(cause)
    } finally {
      setBusy(false)
    }
  }

  const openEdit = (account: IZRecord) => {
    setError('')
    setEditingAccount(account)
    setPhotoTouched(false)
    setEditForm({
      nom: account.nom ?? '', prenom: account.prenom ?? '',
      email: account.email ?? '', telephone: account.telephone ?? '',
      cin: account.cin ?? '', fonction: account.fonction ?? '',
      matricule: account.matricule ?? '', motDePasse: '',
    })
  }

  const saveEdit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (disabled || !editingAccount) return
    setError('')
    setBusy(true)
    try {
      const payload: IZRecord = {
        nom: String(editForm.nom ?? '').trim(),
        prenom: String(editForm.prenom ?? '').trim(),
        email: String(editForm.email ?? '').trim(),
        telephone: String(editForm.telephone ?? '').trim(),
        cin: String(editForm.cin ?? '').trim(),
        fonction: String(editForm.fonction ?? '').trim(),
        matricule: String(editForm.matricule ?? '').trim(),
      }
      if (editForm.motDePasse) payload.motDePasse = String(editForm.motDePasse)
      if (photoTouched) payload.photoIdentite = editForm.photoIdentite || null
      await izApi.updateUserDetails(Number(editingAccount.id), payload)
      notify(t('admin.accountUpdated'), 'success')
      setEditingAccount(null)
      await users.reload()
    } catch (cause) {
      reportError(cause)
    } finally {
      setBusy(false)
    }
  }

  const approveReset = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!resetTarget) return
    if (resetPassword !== resetConfirm) {
      setError(t('admin.confirmMismatch'))
      return
    }
    setError('')
    setBusy(true)
    try {
      await izApi.resolvePasswordResetRequest(Number(resetTarget.id), { action: 'approve', password: resetPassword })
      notify(t('admin.passwordResetDone'), 'success')
      setResetTarget(null)
      setResetPassword('')
      setResetConfirm('')
      await Promise.all([users.reload(), resetRequests.reload()])
    } catch (cause) {
      reportError(cause)
    } finally {
      setBusy(false)
    }
  }

  const rejectReset = async (request: IZRecord) => {
    setError('')
    setBusy(true)
    try {
      await izApi.resolvePasswordResetRequest(Number(request.id), { action: 'reject' })
      notify(t('admin.requestRejected'), 'success')
      await resetRequests.reload()
    } catch (cause) {
      reportError(cause)
    } finally {
      setBusy(false)
    }
  }

  const pendingResets = (resetRequests.data ?? []).filter((request) => request.statut === 'En attente')

  return (
    <>
      <PageHead title={t('admin.users')} subtitle={t('admin.usersSubtitle')}
        action={<div className="iz-flex iz-wrap">
          <ExportButton cible="utilisateurs" label="Excel" />
          <button className="iz-btn iz-btn-primary" disabled={disabled} onClick={() => {
            setError('')
            setForm({ nom: '', prenom: '', email: '', motDePasse: '', telephone: '', role: 'controleur', cin: '', fonction: '', matricule: '', photoIdentite: null })
            setCreating(true)
          }}>{t('admin.createAccount')}</button>
        </div>}
      />
      <p className="iz-small iz-muted" style={{ marginBottom: 16 }}>
        {t('admin.usersCount', { admins, controllers, superadmins })}
        {isSuper ? ` ${t('admin.superRights')}` : ` ${t('admin.adminRights')}`}
      </p>
      <div className="iz-card" style={{ marginBottom: 18 }}>
        <div className="iz-section-head">
          <h3 style={{ fontSize: '1rem' }}>{t('admin.resetsTitle')}</h3>
          <ExportButton cible="demandes-reinitialisation" label="Excel" />
        </div>
        {resetRequests.error && <p role="alert" className="iz-small">{resetRequests.error} <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => void resetRequests.reload()}>{t('common.retry')}</button></p>}
        {resetRequests.loading ? <p className="iz-small iz-muted">{t('common.loading')}</p>
          : pendingResets.length === 0 ? <p className="iz-small iz-muted" style={{ margin: 0 }}>{t('admin.noResets')}</p>
            : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {pendingResets.map((request) => (
                  <li key={request.id} className="iz-flex iz-wrap" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--iz-border, #e5e7eb)' }}>
                    <span className="iz-small"><strong>{request.email}</strong> · {when(request.date)}</span>
                    <span className="iz-flex iz-wrap">
                      <button className="iz-btn iz-btn-primary iz-btn-sm" disabled={busy} onClick={() => { setError(''); setResetTarget(request); setResetPassword(''); setResetConfirm('') }}>{t('admin.setPassword')}</button>
                      <button className="iz-btn iz-btn-danger iz-btn-sm" disabled={busy} onClick={() => void rejectReset(request)}>{t('admin.refuse')}</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
      </div>
      {error && !creating && !deleting && <p role="alert">{error}</p>}
      {users.error && <div className="iz-card" role="alert">{users.error} <button className="iz-btn iz-btn-outline iz-btn-sm" disabled={busy || users.loading} onClick={() => void users.reload()}>{t('common.retry')}</button></div>}
      {busy && <p className="iz-small" role="status">{t('common.busy')}</p>}
      {users.loading ? <Loading /> : (
        <DataTable
          rows={accounts}
          rowKey={(account) => String(account.id)}
          rowLabel={(account) => String(account.nom ?? account.email ?? account.id)}
          searchText={(account) => [account.nom, account.prenom, account.email, account.telephone, account.role, account.cin, account.fonction, account.matricule].join(' ')}
          initialSort="nom"
          busy={busy}
          empty={<Empty />}
          columns={[
            { key: 'nom', label: t('admin.name'), sortValue: (account) => String(account.nom ?? ''), render: (account) => <><strong>{account.nom} {account.prenom}</strong>{isOwn(account) && currentUser && <span className="iz-small iz-muted"> {t('admin.you')}</span>}</> },
            { key: 'email', label: t('admin.email'), sortValue: (account) => String(account.email ?? ''), render: (account) => <>{account.email}</> },
            { key: 'role', label: t('admin.role'), sortValue: (account) => String(account.role ?? ''), render: (account) => (
              <select className="iz-select" aria-label={t('admin.roleAria', { name: `${account.nom} ${account.prenom ?? ''}` })} value={account.role}
                disabled={disabled || isOwn(account) || (!isSuper && account.role !== 'controleur')} onChange={(event) => void changeRole(account, event.target.value)}>
                <option value="superadmin" disabled={!isSuper || (account.role !== 'superadmin' && superadmins >= 1)}>{t('admin.superadminOption')}</option>
                <option value="admin" disabled={!isSuper || (account.role !== 'admin' && admins >= 5)}>{t('admin.adminOption')}</option>
                <option value="controleur" disabled={account.role !== 'controleur' && controllers >= 100}>{t('admin.controllerOption')}</option>
              </select>
            ) },
            ...(isAdmin ? [
              { key: 'cin', label: t('admin.cin'), sortValue: (account: IZRecord) => String(account.cin ?? ''), render: (account: IZRecord) => <span className="iz-small iz-mono">{account.cin ?? '—'}</span> },
              { key: 'fonction', label: t('control.fonction'), sortValue: (account: IZRecord) => String(account.fonction ?? ''), render: (account: IZRecord) => <span className="iz-small">{account.fonction ?? '—'}</span> },
              { key: 'matricule', label: t('control.matricule'), sortValue: (account: IZRecord) => String(account.matricule ?? ''), render: (account: IZRecord) => <span className="iz-small iz-mono">{account.matricule ?? '—'}</span> },
              { key: 'profilComplet', label: t('admin.profile'), sortValue: (account: IZRecord) => (account.profilComplet ? 1 : 0), render: (account: IZRecord) => account.role === 'controleur' ? (
                <span className={`iz-badge ${account.profilComplet ? 'iz-badge-green' : 'iz-badge-amber'}`}>
                  {account.profilComplet ? t('admin.complete') : t('admin.toComplete')}
                </span>
              ) : <span className="iz-small iz-muted">—</span> },
            ] : []),
          ]}
          actions={(account) => (
            <>
              {account.role === 'controleur' && (
                <><button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => setViewingAgent(Number(account.id))}>{t('admin.profile')}</button>{' '}</>
              )}
              <button className="iz-btn iz-btn-outline iz-btn-sm" disabled={busy} onClick={() => openEdit(account)}>{t('common.edit')}</button>{' '}
              {canDelete(account) && (
                <button className="iz-btn iz-btn-danger iz-btn-sm" disabled={disabled} onClick={() => { setError(''); setDeleting(account) }}>{t('common.delete')}</button>
              )}
            </>
          )}
        />
      )}
      {creating && (
        <Modal title={t('admin.createAccountTitle')} onClose={() => { if (!busy) setCreating(false) }} footer={<>
          <button className="iz-btn iz-btn-outline" disabled={busy} onClick={() => setCreating(false)}>{t('common.cancel')}</button>
          <button className="iz-btn iz-btn-primary" disabled={disabled || atLimit(form.role)} onClick={() => formRef.current?.requestSubmit()}>{busy ? t('admin.creating') : t('admin.createAccountBtn')}</button>
        </>}>
          {error && <p role="alert">{error}</p>}
          <form ref={formRef} className="iz-form-grid" onSubmit={create} aria-busy={busy}>
            <Field label={t('admin.lastNameRequired')}><input className="iz-input" required maxLength={100} autoComplete="family-name" disabled={busy} value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} /></Field>
            <Field label={t('admin.firstName')}><input className="iz-input" maxLength={100} autoComplete="given-name" disabled={busy} value={form.prenom ?? ''} onChange={(event) => setForm({ ...form, prenom: event.target.value })} /></Field>
            <Field label={t('admin.emailRequired')}><input className="iz-input" type="email" required maxLength={190} autoComplete="off" disabled={busy} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
            <Field label={t('admin.phone')}><input className="iz-input" type="tel" maxLength={30} autoComplete="off" disabled={busy} value={form.telephone ?? ''} onChange={(event) => setForm({ ...form, telephone: event.target.value })} /></Field>
            <Field label={t('admin.cinNumber')}><input className="iz-input" maxLength={40} disabled={busy} value={form.cin ?? ''} onChange={(event) => setForm({ ...form, cin: event.target.value })} /></Field>
            <Field label={t('control.fonction')}><input className="iz-input" maxLength={120} disabled={busy} value={form.fonction ?? ''} onChange={(event) => setForm({ ...form, fonction: event.target.value })} /></Field>
            <Field label={t('control.matricule')}><input className="iz-input" maxLength={60} disabled={busy} value={form.matricule ?? ''} onChange={(event) => setForm({ ...form, matricule: event.target.value })} /></Field>
            <Field label={t('admin.identityPhotoLabel')} full>
              <IdentityPhotoField value={form.photoIdentite ?? null} onChange={(photo) => setForm({ ...form, photoIdentite: photo })} disabled={busy} />
            </Field>
            <Field label={t('admin.passwordRequired')} full>
              <PasswordInput required minLength={8} maxLength={100} autoComplete="new-password" disabled={busy} value={form.motDePasse} onChange={(value) => setForm({ ...form, motDePasse: value })} />
            </Field>
            <Field label={t('admin.roleRequired')}><select className="iz-select" required disabled={busy} value={form.role} onChange={(event) => {
              const role = event.target.value
              if (role === 'admin' || role === 'controleur' || role === 'superadmin') setForm({ ...form, role })
            }}>
              <option value="controleur" disabled={controllers >= 100}>{t('admin.controllerOption')}</option>
              {isSuper && <option value="admin" disabled={admins >= 5}>{t('admin.adminOption')}</option>}
              {isSuper && <option value="superadmin" disabled={superadmins >= 1}>{t('admin.superadminOption')}</option>}
            </select></Field>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title={t('admin.deleteAccountTitle')} onClose={() => { if (!busy) setDeleting(null) }} footer={<>
          <button className="iz-btn iz-btn-outline" disabled={busy} onClick={() => setDeleting(null)}>{t('common.cancel')}</button>
          <button className="iz-btn iz-btn-danger" disabled={disabled} onClick={() => void remove()}>{busy ? t('admin.deleting') : t('common.delete')}</button>
        </>}>
          <p>{t('admin.deleteAccountConfirm', { name: `${deleting.nom ?? ''} ${deleting.prenom ?? ''}`.trim(), email: String(deleting.email ?? ''), role: roleLabel(deleting.role) })}</p>
          {error && <p role="alert">{error}</p>}
        </Modal>
      )}
      {editingAccount && (
        <Modal title={t('admin.editAccountTitle', { email: String(editingAccount.email ?? '') })} onClose={() => { if (!busy) setEditingAccount(null) }} footer={<>
          <button className="iz-btn iz-btn-outline" disabled={busy} onClick={() => setEditingAccount(null)}>{t('common.cancel')}</button>
          <button className="iz-btn iz-btn-primary" disabled={busy} onClick={() => void saveEdit()}>{busy ? t('common.saving') : t('common.save')}</button>
        </>}>
          {error && <p role="alert">{error}</p>}
          <form className="iz-form-grid" onSubmit={saveEdit} aria-busy={busy}>
            <Field label={t('admin.lastNameRequired')}>
              <input className="iz-input" required maxLength={100} disabled={busy} value={String(editForm.nom ?? '')} onChange={(event) => setEditForm({ ...editForm, nom: event.target.value })} />
            </Field>
            <Field label={t('admin.firstName')}>
              <input className="iz-input" maxLength={100} disabled={busy} value={String(editForm.prenom ?? '')} onChange={(event) => setEditForm({ ...editForm, prenom: event.target.value })} />
            </Field>
            <Field label={t('admin.emailRequired')}>
              <input className="iz-input" type="email" required maxLength={190} disabled={busy} value={String(editForm.email ?? '')} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} />
            </Field>
            <Field label={t('admin.phone')}>
              <input className="iz-input" type="tel" maxLength={30} disabled={busy} value={String(editForm.telephone ?? '')} onChange={(event) => setEditForm({ ...editForm, telephone: event.target.value })} />
            </Field>
            <Field label={t('admin.cinNumber')}>
              <input className="iz-input" maxLength={40} disabled={busy} value={String(editForm.cin ?? '')} onChange={(event) => setEditForm({ ...editForm, cin: event.target.value })} />
            </Field>
            <Field label={t('control.fonction')}>
              <input className="iz-input" maxLength={120} disabled={busy} value={String(editForm.fonction ?? '')} onChange={(event) => setEditForm({ ...editForm, fonction: event.target.value })} />
            </Field>
            <Field label={t('control.matricule')}>
              <input className="iz-input" maxLength={60} disabled={busy} value={String(editForm.matricule ?? '')} onChange={(event) => setEditForm({ ...editForm, matricule: event.target.value })} />
            </Field>
            <Field label={t('admin.identityPhotoLabel')} full>
              <IdentityPhotoField
                value={String(editForm.photoIdentite ?? '') || null}
                existing={Boolean(editingAccount.photoDisponible) && !photoTouched}
                disabled={busy}
                onChange={(photo) => { setPhotoTouched(true); setEditForm({ ...editForm, photoIdentite: photo }) }}
              />
            </Field>
            <Field label={t('admin.newPasswordOptional')} full>
              <PasswordInput minLength={8} maxLength={100} autoComplete="new-password" disabled={busy} value={String(editForm.motDePasse ?? '')} onChange={(value) => setEditForm({ ...editForm, motDePasse: value })} />
            </Field>
          </form>
        </Modal>
      )}
      {resetTarget && (
        <Modal title={t('admin.resetPasswordTitle', { email: String(resetTarget.email ?? '') })} onClose={() => { if (!busy) setResetTarget(null) }} footer={<>
          <button className="iz-btn iz-btn-outline" disabled={busy} onClick={() => setResetTarget(null)}>{t('common.cancel')}</button>
          <button className="iz-btn iz-btn-primary" disabled={busy} onClick={() => void approveReset()}>{busy ? t('common.saving') : t('admin.validateRequest')}</button>
        </>}>
          {error && <p role="alert">{error}</p>}
          <p className="iz-small iz-muted">{t('admin.resetHelp')}</p>
          <form className="iz-form-grid" onSubmit={approveReset} aria-busy={busy}>
            <Field label={t('admin.newPasswordRequired')} full>
              <PasswordInput required minLength={8} maxLength={100} autoComplete="new-password" disabled={busy} value={resetPassword} onChange={setResetPassword} />
            </Field>
            <Field label={t('admin.confirmPassword')} full>
              <PasswordInput required minLength={8} maxLength={100} autoComplete="new-password" disabled={busy} value={resetConfirm} onChange={setResetConfirm} />
            </Field>
          </form>
        </Modal>
      )}
      {viewingAgent && <AgentProfileDialog id={viewingAgent} onClose={() => setViewingAgent(null)} />}
    </>
  )
}

export function AdminActivity() {
  const { t, user } = useApp()
  const isSuper = user?.role === 'superadmin'
  const [scope, setScope] = useState<'admins' | 'controleurs' | 'all'>(isSuper ? 'admins' : 'controleurs')
  const { data, loading } = useAsync(() => izApi.history(scope, 500), [scope])
  const rows = data?.rows ?? []
  const roleLabel = (role?: string | null) =>
    role === 'superadmin' ? t('admin.superadminOption') : role === 'admin' ? t('admin.adminOption') : t('admin.controllerOption')
  const details = (entry: IZRecord) => {
    const value = entry.details
    if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) return '—'
    if (typeof value === 'string') return value
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${val ?? '—'}`)
      .join(' · ')
  }
  return (
    <>
      <PageHead
        title={isSuper ? t('admin.activityAdminsTitle') : t('admin.activityControllersTitle')}
        subtitle={isSuper ? t('admin.activityAdminsSubtitle') : t('admin.activityControllersSubtitle')}
        action={<ExportButton cible="activite" label="Excel" />}
      />
      {isSuper && (
        <div className="iz-flex iz-wrap" style={{ gap: 8, marginBottom: 14 }}>
          {([
            ['admins', 'admin.scopeAdmins'],
            ['controleurs', 'admin.scopeControllers'],
            ['all', 'admin.scopeAll'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              className={`iz-btn iz-btn-sm ${scope === value ? 'iz-btn-primary' : 'iz-btn-outline'}`}
              onClick={() => setScope(value)}
            >
              {t(label)}
            </button>
          ))}
        </div>
      )}
      {loading ? <Loading /> : (
        <DataTable
          rows={rows}
          rowKey={(entry) => String(entry.id)}
          searchText={(entry) => [entry.auteur, entry.auteurPrenom, entry.email, entry.action, entry.entite, entry.entiteId].join(' ')}
          initialSort="createdAt"
          empty={<Empty message={t('admin.noActivity')} />}
          columns={[
            { key: 'createdAt', label: t('common.date'), sortValue: (entry) => String(entry.createdAt ?? ''), render: (entry) => <span className="iz-small iz-nowrap">{when(entry.createdAt)}</span> },
            {
              key: 'auteur', label: t('admin.user'),
              sortValue: (entry) => `${entry.auteur ?? ''} ${entry.auteurPrenom ?? ''}`,
              render: (entry) => (
                <span>
                  <strong>{[entry.auteurPrenom, entry.auteur].filter(Boolean).join(' ') || '—'}</strong>
                  <span className="iz-small iz-muted" style={{ display: 'block' }}>{entry.email ?? ''}</span>
                </span>
              ),
            },
            { key: 'role', label: t('admin.roleShort'), sortValue: (entry) => String(entry.role ?? ''), render: (entry) => <>{roleLabel(entry.role)}</> },
            { key: 'action', label: t('admin.action'), sortValue: (entry) => `${entry.action} ${entry.entite}`, render: (entry) => <>{entry.action} — {entry.entite}</> },
            { key: 'entiteId', label: t('admin.reference'), sortValue: (entry) => String(entry.entiteId ?? ''), render: (entry) => <span className="iz-small iz-mono">{entry.entiteId ?? '—'}</span> },
            { key: 'details', label: t('common.details'), sortValue: (entry) => details(entry), render: (entry) => <span className="iz-small">{details(entry)}</span> },
          ]}
        />
      )}
    </>
  )
}
