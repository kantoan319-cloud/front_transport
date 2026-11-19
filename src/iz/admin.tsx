import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { izApi } from './api'
import type { IZRecord } from './api'
import {
  ConfirmDialog, Empty, Field, Loading, Modal, PageHead, StatCard,
  StatusBadge, useApp, useAsync,
} from './components'
import { DashboardShell } from './dashboard'

const when = (value?: string | null) => (value ? String(value).slice(0, 16).replace('T', ' ') : '—')
const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : '')

/* ------------------------------------------------------------------ */
/* Mise en page                                                        */
/* ------------------------------------------------------------------ */

export function AdminLayout({ children }: { children: ReactNode }) {
  const { t, navigate } = useApp()
  const links = [
    { path: '/admin', label: t('admin.dashboard'), icon: '📊' },
    { path: '/admin/vehicles', label: t('admin.vehicles'), icon: '🚐' },
    { path: '/admin/cooperatives', label: t('nav.coops'), icon: '🤝' },
    { path: '/admin/owners', label: t('admin.owners'), icon: '👥' },
    { path: '/admin/lines', label: t('admin.lines'), icon: '🛣️' },
    { path: '/admin/studies', label: t('admin.studies'), icon: '🧮' },
    { path: '/admin/parkings', label: t('nav.parkings'), icon: '🅿️' },
    { path: '/admin/payments', label: t('admin.payments'), icon: '💳' },
    { path: '/admin/requests', label: t('admin.requests'), icon: '📝' },
    { path: '/admin/users', label: t('admin.users'), icon: '🔐' },
    { path: '/admin/activity', label: t('admin.activity'), icon: '🕘' },
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
  const { t } = useApp()
  const { data, loading } = useAsync(() => izApi.adminStats(), [])
  return (
    <>
      <PageHead title={t('admin.dashboard')} subtitle={t('app.tagline')} />
      {loading ? <Loading /> : (
        <>
          <div className="iz-grid iz-grid-4">
            <StatCard icon="🚐" value={data?.vehicles?.total ?? 0} label={t('admin.vehicles')} />
            <StatCard icon="✅" value={data?.vehicles?.valides ?? 0} label={t('search.valid')} />
            <StatCard icon="⚠️" value={data?.vehicles?.expires ?? 0} label={t('search.expired')} />
            <StatCard icon="🤝" value={data?.cooperatives?.total ?? 0} label={t('nav.coops')} />
          </div>
          <div className="iz-grid iz-grid-4" style={{ marginTop: 16 }}>
            <StatCard value={data?.scans?.total ?? 0} label={t('control.scans')} />
            <StatCard value={data?.signals?.nouveaux ?? 0} label={t('control.signals')} />
            <StatCard value={data?.studies?.total ?? 0} label={t('admin.studies')} />
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
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox'
  options?: { value: string; label: string }[]
  full?: boolean
  required?: boolean
}

interface Column {
  label: string
  render: (row: IZRecord) => ReactNode
}

interface CrudProps {
  title: string
  subtitle?: string
  columns: Column[]
  load: () => Promise<IZRecord[]>
  fields: FieldDef[]
  create: (data: IZRecord) => Promise<unknown>
  update?: (id: number, data: IZRecord) => Promise<unknown>
  remove?: (id: number) => Promise<unknown>
  addLabel?: string
  toForm?: (row: IZRecord) => IZRecord
  extra?: ReactNode
  searchable?: boolean
  searchKey?: string
}

export function CrudPage(props: CrudProps) {
  const { t, notify } = useApp()
  const { data, loading, reload } = useAsync(props.load, [])
  const [editing, setEditing] = useState<IZRecord | null>(null)
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const [form, setForm] = useState<IZRecord>({})
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const openCreate = () => {
    setEditing({ __new: true })
    setForm({})
  }
  const openEdit = (row: IZRecord) => {
    setEditing(row)
    setForm(props.toForm ? props.toForm(row) : { ...row })
  }
  const change = (key: string, value: string | number | boolean) =>
    setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setBusy(true)
    try {
      const payload: IZRecord = {}
      for (const field of props.fields) {
        let value = form[field.key]
        if (field.type === 'number' && value !== undefined && value !== '') value = Number(value)
        if (field.type === 'checkbox') value = Boolean(value)
        if (value === '' || value === undefined) continue
        payload[field.key] = value
      }
      if (editing?.id && props.update) await props.update(Number(editing.id), payload)
      else await props.create(payload)
      notify(t('common.save'), 'success')
      setEditing(null)
      await reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!deleting || !props.remove) return
    try {
      await props.remove(Number(deleting.id))
      notify(t('common.delete'), 'success')
      setDeleting(null)
      await reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    }
  }

  const rows = (data ?? []).filter((row) => {
    if (!search || !props.searchKey) return true
    return String(row[props.searchKey] ?? '').toLowerCase().includes(search.toLowerCase())
  })

  return (
    <>
      <PageHead
        title={props.title}
        subtitle={props.subtitle}
        action={
          <div className="iz-flex iz-wrap">
            {props.searchable && (
              <input className="iz-input" style={{ width: 200 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search')} />
            )}
            <button className="iz-btn iz-btn-primary" onClick={openCreate}>+ {props.addLabel ?? t('common.add')}</button>
          </div>
        }
      />
      {props.extra}
      {loading ? <Loading /> : !rows.length ? <Empty /> : (
        <div className="iz-table-wrap">
          <table className="iz-table">
            <thead><tr>{props.columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id ?? index}>
                  {props.columns.map((column) => <td key={column.label}>{column.render(row)}</td>)}
                  <td className="iz-nowrap">
                    {props.update && <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => openEdit(row)}>{t('common.edit')}</button>}
                    {props.remove && <button className="iz-btn iz-btn-danger iz-btn-sm" style={{ marginLeft: 6 }} onClick={() => setDeleting(row)}>{t('common.delete')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal
          title={`${editing.id ? t('common.edit') : t('common.add')} — ${props.title}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="iz-btn iz-btn-outline" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
              <button className="iz-btn iz-btn-primary" disabled={busy} onClick={() => void submit()}>{t('common.save')}</button>
            </>
          }
        >
          <form className="iz-form-grid" onSubmit={submit}>
            {props.fields.map((field) => (
              <Field key={field.key} label={field.label} full={field.full}>
                {field.type === 'textarea' ? (
                  <textarea className="iz-textarea" value={String(form[field.key] ?? '')} onChange={(e) => change(field.key, e.target.value)} />
                ) : field.type === 'select' ? (
                  <select className="iz-select" value={String(form[field.key] ?? '')} onChange={(e) => change(field.key, e.target.value)}>
                    <option value="">—</option>
                    {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <input type="checkbox" checked={Boolean(form[field.key])} onChange={(e) => change(field.key, e.target.checked)} />
                ) : (
                  <input
                    className="iz-input"
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    required={field.required}
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
        <ConfirmDialog message={`${t('common.confirmDelete')} ${deleting.immatriculation ?? deleting.nom ?? deleting.code ?? ''}`} onCancel={() => setDeleting(null)} onConfirm={remove} />
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
  const { t } = useApp()
  const coops = useAsync(() => izApi.adminCooperatives(), [])
  const coopOptions = (coops.data ?? []).map((coop) => ({ value: String(coop.id), label: coop.nom }))
  return (
    <CrudPage
      title={t('admin.vehicles')}
      addLabel={t('admin.newVehicle')}
      searchable
      searchKey="immatriculation"
      load={() => izApi.adminVehicles({ limit: 300 })}
      create={izApi.createVehicle}
      update={izApi.updateVehicle}
      remove={izApi.deleteVehicle}
      columns={[
        { label: t('search.plate'), render: (row) => <strong className="iz-mono">{row.immatriculation}</strong> },
        { label: t('search.owner'), render: (row) => text(row.proprietaireNom) },
        { label: t('search.cooperative'), render: (row) => <span className="iz-chip">{row.cooperativeCode ?? '—'}</span> },
        { label: t('search.line'), render: (row) => text(row.ligne) },
        { label: t('search.licence'), render: (row) => mono(row.licenceNumero) },
        { label: t('search.validity'), render: (row) => mono(dateOnly(row.licenceFin)) },
        { label: t('common.status'), render: (row) => <StatusBadge status={row.statut} /> },
      ]}
      fields={[
        { key: 'immatriculation', label: t('search.plate'), required: true },
        { key: 'proprietaireNom', label: t('search.owner') },
        { key: 'cooperativeId', label: t('search.cooperative'), type: 'select', options: coopOptions },
        { key: 'ligne', label: t('search.line') },
        { key: 'licenceNumero', label: t('search.licence') },
        { key: 'licenceDebut', label: t('search.validity') + ' 1', type: 'date' },
        { key: 'licenceFin', label: t('search.validity') + ' 2', type: 'date' },
        { key: 'statut', label: t('common.status'), type: 'select', options: [
          { value: 'Normal', label: 'Normal' }, { value: 'Suspendu', label: 'Suspendu' },
        ] },
        { key: 'latitude', label: 'Latitude', type: 'number' },
        { key: 'longitude', label: 'Longitude', type: 'number' },
      ]}
      toForm={(row) => ({
        ...row,
        licenceDebut: dateOnly(row.licenceDebut),
        licenceFin: dateOnly(row.licenceFin),
      })}
    />
  )
}

export function AdminCooperatives() {
  const { t } = useApp()
  return (
    <CrudPage
      title={t('nav.coops')}
      addLabel={t('admin.newCoop')}
      load={izApi.adminCooperatives}
      create={izApi.createCooperative}
      update={izApi.updateCooperative}
      remove={izApi.deleteCooperative}
      columns={[
        { label: t('search.cooperative'), render: (row) => <strong>{row.nom}</strong> },
        { label: 'Code', render: (row) => <span className="iz-chip">{row.code}</span> },
        { label: t('coops.lines'), render: (row) => text(row.description) },
        { label: t('admin.vehicles'), render: (row) => <span className="iz-badge iz-badge-blue">{row.vehicules}</span> },
      ]}
      fields={[
        { key: 'code', label: 'Code', required: true },
        { key: 'nom', label: t('search.cooperative'), required: true },
        { key: 'description', label: t('coops.lines'), full: true },
        { key: 'ligneCodes', label: 'Codes lignes' },
        { key: 'contact', label: 'Contact' },
      ]}
    />
  )
}

export function AdminOwners() {
  const { t } = useApp()
  return (
    <CrudPage
      title={t('admin.owners')}
      load={izApi.owners}
      create={izApi.createOwner}
      remove={izApi.deleteOwner}
      columns={[
        { label: t('search.owner'), render: (row) => <strong>{row.nom}</strong> },
        { label: 'Téléphone', render: (row) => text(row.telephone) },
        { label: t('search.cooperative'), render: (row) => text(row.cooperativeCode) },
      ]}
      fields={[
        { key: 'nom', label: t('search.owner'), required: true },
        { key: 'telephone', label: 'Téléphone' },
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
        addLabel={t('admin.newLine')}
        load={izApi.adminLines}
        create={izApi.createLine}
        update={izApi.updateLine}
        remove={izApi.deleteLine}
        columns={[
          { label: 'Code', render: (row) => <span className="iz-chip">{row.code}</span> },
          { label: t('search.line'), render: (row) => <strong>{row.nom}</strong> },
          { label: t('search.cooperative'), render: (row) => text(row.cooperativeCode) },
          { label: t('map.stops'), render: (row) => (
            <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setLineId(Number(row.id))}>
              {row.arrets} {t('map.stops')}
            </button>
          ) },
        ]}
        fields={[
          { key: 'code', label: 'Code', required: true },
          { key: 'nom', label: t('search.line'), required: true },
          { key: 'cooperativeId', label: t('search.cooperative'), type: 'select', options: coopOptions },
          { key: 'couleur', label: 'Couleur' },
          { key: 'active', label: 'Actif', type: 'checkbox' },
        ]}
      />
      {lineId && (
        <div className="iz-card" style={{ marginTop: 24 }}>
          <div className="iz-section-head">
            <h2 style={{ fontSize: '1.1rem' }}>{t('map.stops')} — {lineId}</h2>
            <button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => setLineId(null)}>{t('common.close')}</button>
          </div>
          {stops.loading ? <Loading /> : (
            <CrudPage
              title={t('map.stops')}
              load={() => izApi.adminStops(lineId)}
              create={(data) => izApi.createStop({ ...data, lineId })}
              update={izApi.updateStop}
              remove={izApi.deleteStop}
              columns={[
                { label: t('map.stops'), render: (row) => <strong>{row.nom}</strong> },
                { label: 'Latitude', render: (row) => mono(row.latitude) },
                { label: 'Longitude', render: (row) => mono(row.longitude) },
                { label: '#', render: (row) => text(row.ordre) },
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

export function AdminStudies() {
  const { t, notify } = useApp()
  // Les zones de texte contiennent du JSON : on le convertit avant envoi,
  // car le backend valide `parametres` et `resultat` comme des objets.
  const parseJson = (data: IZRecord): IZRecord => {
    const payload = { ...data }
    for (const key of ['parametres', 'resultat']) {
      if (typeof payload[key] === 'string') {
        try {
          payload[key] = JSON.parse(payload[key])
        } catch {
          notify(`${key} : JSON invalide`, 'error')
          payload[key] = {}
        }
      }
    }
    return payload
  }
  return (
    <CrudPage
      title={t('admin.studies')}
      addLabel={t('admin.newStudy')}
      load={izApi.studies}
      create={(data) => izApi.createStudy(parseJson(data))}
      update={(id, data) => izApi.updateStudy(id, parseJson(data))}
      remove={izApi.deleteStudy}
      columns={[
        { label: t('common.details'), render: (row) => <strong>{row.titre}</strong> },
        { label: t('admin.methode'), render: (row) => <span className="iz-chip">{row.methode}</span> },
        { label: t('search.line'), render: (row) => text(row.ligneCode) },
        { label: t('common.status'), render: (row) => <StatusBadge status={row.statut} /> },
        { label: t('common.date'), render: (row) => mono(when(row.createdAt)) },
      ]}
      fields={[
        { key: 'titre', label: t('common.details'), required: true, full: true },
        { key: 'methode', label: t('admin.methode'), type: 'select', required: true, options: [
          { value: 'AHP', label: 'AHP' }, { value: 'TOPSIS', label: 'TOPSIS' }, { value: 'Autre', label: 'Autre' },
        ] },
        { key: 'statut', label: t('common.status'), type: 'select', options: [
          { value: 'Brouillon', label: 'Brouillon' }, { value: 'En cours', label: 'En cours' },
          { value: 'Terminée', label: 'Terminée' },
        ] },
        { key: 'parametres', label: t('admin.parametres'), type: 'textarea', full: true },
        { key: 'resultat', label: t('admin.resultat'), type: 'textarea', full: true },
      ]}
      toForm={(row) => ({
        titre: row.titre, methode: row.methode, statut: row.statut,
        parametres: JSON.stringify(row.parametres ?? {}),
        resultat: JSON.stringify(row.resultat ?? {}),
      })}
    />
  )
}

export function AdminParkings() {
  const { t } = useApp()
  return (
    <CrudPage
      title={t('nav.parkings')}
      addLabel={t('admin.newParking')}
      load={izApi.adminParkings}
      create={izApi.createParking}
      update={izApi.updateParking}
      remove={izApi.deleteParking}
      columns={[
        { label: 'Parking', render: (row) => <strong>{row.nom}</strong> },
        { label: 'Commune', render: (row) => text(row.commune) },
        { label: t('parking.capacity'), render: (row) => text(row.capacite) },
        { label: t('parking.free'), render: (row) => text(Number(row.capacite ?? 0) - Number(row.placesOccupees ?? 0)) },
        { label: t('parking.tariff'), render: (row) => `${row.tarifHoraire} Ar` },
        { label: t('common.status'), render: (row) => <StatusBadge status={row.statut} /> },
      ]}
      fields={[
        { key: 'nom', label: 'Parking', required: true },
        { key: 'commune', label: 'Commune' },
        { key: 'adresse', label: t('signal.address') },
        { key: 'latitude', label: 'Latitude', type: 'number' },
        { key: 'longitude', label: 'Longitude', type: 'number' },
        { key: 'capacite', label: t('parking.capacity'), type: 'number' },
        { key: 'placesOccupees', label: 'Occupées', type: 'number' },
        { key: 'tarifHoraire', label: t('parking.tariff'), type: 'number' },
        { key: 'statut', label: t('common.status'), type: 'select', options: [
          { value: 'Ouvert', label: 'Ouvert' }, { value: 'Fermé', label: 'Fermé' },
        ] },
      ]}
    />
  )
}

export function AdminPayments() {
  const { t, notify } = useApp()
  const { data, loading, reload } = useAsync(() => izApi.payments(), [])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<IZRecord>({ type: 'Adhésion', moyen: 'Orange Money', montant: '' })
  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    try {
      await izApi.createPayment({ ...form, montant: Number(form.montant) })
      notify(t('common.save'), 'success')
      setOpen(false)
      await reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    }
  }
  const setStatut = async (id: number, statut: string) => {
    await izApi.updatePayment(id, { statut })
    await reload()
  }
  return (
    <>
      <PageHead title={t('admin.payments')} action={<button className="iz-btn iz-btn-primary" onClick={() => setOpen(true)}>+ {t('admin.newPayment')}</button>} />
      {loading ? <Loading /> : !data?.length ? <Empty /> : (
        <div className="iz-table-wrap">
          <table className="iz-table">
            <thead><tr><th>{t('admin.reference')}</th><th>Type</th><th>{t('search.plate')}</th><th>{t('admin.amount')}</th><th>{t('admin.moyen')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr></thead>
            <tbody>
              {data.map((payment) => (
                <tr key={payment.id}>
                  <td className="iz-mono iz-small">{payment.reference}</td>
                  <td>{payment.type}</td>
                  <td className="iz-mono">{payment.immatriculation ?? '—'}</td>
                  <td>{Number(payment.montant).toLocaleString('fr-FR')} Ar</td>
                  <td>{payment.moyen}</td>
                  <td><StatusBadge status={payment.statut} /></td>
                  <td>
                    <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => setStatut(payment.id, 'Payé')}>{t('admin.approve')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <Modal title={t('admin.newPayment')} onClose={() => setOpen(false)} footer={
          <button className="iz-btn iz-btn-primary" onClick={() => void submit()}>{t('common.save')}</button>
        }>
          <form className="iz-form-grid" onSubmit={submit}>
            <Field label="Type">
              <select className="iz-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {['Adhésion', 'Affectation', 'Vignette', 'Amende', 'Parking', 'Autre'].map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label={t('admin.amount')}>
              <input className="iz-input" type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
            </Field>
            <Field label={t('admin.moyen')}>
              <select className="iz-select" value={form.moyen} onChange={(e) => setForm({ ...form, moyen: e.target.value })}>
                {['Orange Money', 'MTN MoMo', 'Airtel Money', 'Espèces', 'Autre'].map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Téléphone">
              <input className="iz-input" value={form.telephone ?? ''} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </Field>
            <Field label={t('admin.reference')} full>
              <input className="iz-input" value={form.referenceExterne ?? ''} onChange={(e) => setForm({ ...form, referenceExterne: e.target.value })} />
            </Field>
          </form>
        </Modal>
      )}
    </>
  )
}

export function AdminRequests() {
  const { t, notify } = useApp()
  const { data, loading, reload } = useAsync(() => izApi.licenceRequests(), [])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<IZRecord>({ immatriculation: '', nomProprietaire: '' })
  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    try {
      await izApi.createLicenceRequest(form)
      setOpen(false)
      await reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    }
  }
  const decide = async (id: number, statut: string) => {
    await izApi.updateLicenceRequest(id, { statut })
    await reload()
  }
  return (
    <>
      <PageHead title={t('admin.requests')} action={<button className="iz-btn iz-btn-primary" onClick={() => setOpen(true)}>+ {t('common.add')}</button>} />
      {loading ? <Loading /> : !data?.length ? <Empty /> : (
        <div className="iz-table-wrap">
          <table className="iz-table">
            <thead><tr><th>{t('search.plate')}</th><th>{t('search.owner')}</th><th>{t('search.cooperative')}</th><th>{t('common.date')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr></thead>
            <tbody>
              {data.map((request) => (
                <tr key={request.id}>
                  <td className="iz-mono">{request.immatriculation}</td>
                  <td>{request.nomProprietaire}</td>
                  <td>{request.cooperativeCode ?? '—'}</td>
                  <td className="iz-small">{when(request.createdAt)}</td>
                  <td><StatusBadge status={request.statut} /></td>
                  <td className="iz-nowrap">
                    <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => decide(request.id, 'Acceptée')}>{t('admin.approve')}</button>
                    {' '}
                    <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => decide(request.id, 'Rejetée')}>{t('admin.reject')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const { t, notify } = useApp()
  const users = useAsync(() => izApi.adminUsers(), [])
  const roles = useAsync(() => izApi.roles(), [])
  const [userId, setUserId] = useState('')
  const [roleId, setRoleId] = useState('')
  const assign = async () => {
    const role = (roles.data ?? []).find((item) => String(item.id) === roleId)
    if (!userId || !role) return
    try {
      await izApi.assignRole({ userId: Number(userId), code: role.code })
      notify(t('common.save'), 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : t('common.error'), 'error')
    }
  }
  return (
    <>
      <PageHead title={t('admin.users')} />
      <div className="iz-card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('admin.users')}</h3>
        <div className="iz-form-grid">
          <Field label="Utilisateur">
            <select className="iz-select" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">—</option>
              {(users.data ?? []).map((user) => <option key={user.id} value={user.id}>{user.nom} {user.prenom} — {user.email}</option>)}
            </select>
          </Field>
          <Field label="Rôle iZOTRA">
            <select className="iz-select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">—</option>
              {(roles.data ?? []).map((role) => <option key={role.id} value={role.id}>{role.libelle}</option>)}
            </select>
          </Field>
          <div className="full"><button className="iz-btn iz-btn-primary" onClick={assign}>{t('common.save')}</button></div>
        </div>
      </div>
      {users.loading ? <Loading /> : (
        <div className="iz-table-wrap">
          <table className="iz-table">
            <thead><tr><th>Nom</th><th>Email</th><th>{t('common.status')}</th></tr></thead>
            <tbody>
              {(users.data ?? []).map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.nom} {user.prenom}</strong></td>
                  <td>{user.email}</td>
                  <td><StatusBadge status={user.role} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export function AdminActivity() {
  const { t } = useApp()
  const { data, loading } = useAsync(() => izApi.activity(), [])
  return (
    <>
      <PageHead title={t('admin.activity')} />
      {loading ? <Loading /> : !data?.length ? <Empty /> : (
        <div className="iz-table-wrap">
          <table className="iz-table">
            <thead><tr><th>{t('common.date')}</th><th>Utilisateur</th><th>Action</th><th>{t('common.details')}</th></tr></thead>
            <tbody>
              {data.map((entry) => (
                <tr key={entry.id}>
                  <td className="iz-small iz-nowrap">{when(entry.createdAt)}</td>
                  <td>{entry.auteur ?? '—'}</td>
                  <td>{entry.action} — {entry.entite}</td>
                  <td className="iz-small">{entry.entiteId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
