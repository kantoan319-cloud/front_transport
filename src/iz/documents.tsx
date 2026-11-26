import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Bus } from 'lucide-react'
import { izApi } from './api'
import type { IZRecord } from './api'
import { translateError, translateValue } from './i18n'
import { Alert, ConfirmDialog, Field, Loading, Modal, PageHead, StatusBadge, useApp, useAsync } from './components'

const DOCUMENT_TYPES = ['Licence', 'Patente', 'Carte grise', 'Assurance', 'Visite technique', 'Autre']
const DOCUMENT_MIME = /^(application\/pdf|image\/(jpeg|png|webp))$/
const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024

type ViewMode = 'list' | 'icons' | 'large'
type SortKey = 'immatriculation' | 'ligne' | 'proprietaireNom' | 'cooperativeNom' | 'documents'

function formatDate(value: unknown): string {
  const text = String(value ?? '')
  const [y, m, d] = text.split('-')
  return d && m && y ? `${d}/${m}/${y}` : text
}

function formatSize(bytes: unknown): string {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
  return `${Math.max(1, Math.round(value / 1024))} Ko`
}

function compare(a: unknown, b: unknown): number {
  const left = a == null ? '' : a
  const right = b == null ? '' : b
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right), 'fr', { numeric: true, sensitivity: 'base' })
}

function DocumentThumb({ doc, large = false }: { doc: IZRecord; large?: boolean }) {
  const { t } = useApp()
  const className = `iz-doc-thumb${large ? ' iz-doc-thumb-lg' : ''}`
  if (String(doc.mime ?? '').startsWith('image/')) {
    return <img className={className} src={izApi.documentFileUrl(Number(doc.id))} alt={String(doc.nomFichier ?? '')} loading="lazy" />
  }
  return (
    <div className={`${className} iz-doc-thumb-pdf`} aria-label={t('docs.pdfLabel')}>
      <span>PDF</span>
    </div>
  )
}

/** Administration → Documents : liste des véhicules puis gestion de leurs documents. */
export function AdminDocuments() {
  const { t } = useApp()
  const { data, loading, error } = useAsync(() => izApi.adminDocumentVehicles(), [])
  const vehicles: IZRecord[] = data ?? []
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('list')
  const [sort, setSort] = useState<SortKey>('immatriculation')
  const [ascending, setAscending] = useState(true)
  const [selected, setSelected] = useState<IZRecord | null>(null)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? vehicles.filter((vehicle) => [vehicle.immatriculation, vehicle.ligne, vehicle.proprietaireNom, vehicle.cooperativeNom]
        .map((value) => String(value ?? '')).join(' ').toLowerCase().includes(needle))
      : vehicles
    const direction = ascending ? 1 : -1
    return [...filtered].sort((a, b) => direction * compare(a[sort], b[sort]))
  }, [vehicles, query, sort, ascending])

  if (selected) {
    return <VehicleDocuments vehicle={selected} onBack={() => setSelected(null)} />
  }

  const sortOptions: { id: SortKey; label: string }[] = [
    { id: 'immatriculation', label: t('docs.sortPlate') },
    { id: 'ligne', label: t('docs.line') },
    { id: 'proprietaireNom', label: t('docs.owner') },
    { id: 'cooperativeNom', label: t('docs.coop') },
    { id: 'documents', label: t('docs.documents') },
  ]
  const views: { id: ViewMode; label: string }[] = [
    { id: 'list', label: t('docs.viewList') },
    { id: 'icons', label: t('docs.viewIcons') },
    { id: 'large', label: t('docs.viewLarge') },
  ]

  return (
    <>
      <PageHead title={t('docs.title')} subtitle={t('docs.subtitle')} />
      <div className="iz-list-tools">
        <input
          className="iz-input iz-list-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('docs.search')}
        />
        <label className="iz-flex iz-small iz-muted iz-list-sort">
          {t('docs.sort')}
          <select className="iz-input" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            {sortOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="iz-btn iz-btn-outline iz-btn-sm"
          title={ascending ? t('docs.sortAscending') : t('docs.sortDescending')}
          onClick={() => setAscending((current) => !current)}
        >
          {ascending ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
        </button>
        <div className="iz-doc-views" role="group" aria-label={t('docs.viewMode')}>
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`iz-btn iz-btn-sm ${view === item.id ? 'iz-btn-primary' : 'iz-btn-outline'}`}
              aria-pressed={view === item.id}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="iz-small iz-muted">{t('docs.vehiclesCount', { count: visible.length })}</span>
      </div>
      {loading ? <Loading /> : error ? <Alert type="error">{error}</Alert> : visible.length === 0
        ? <div className="iz-card"><p className="iz-small iz-muted">{t('docs.noVehicle')}</p></div>
        : view === 'list' ? (
          <div className="iz-doc-list">
            {visible.map((vehicle) => (
              <VehicleRow key={String(vehicle.id)} vehicle={vehicle} onOpen={() => setSelected(vehicle)} />
            ))}
          </div>
        ) : (
          <div className={view === 'large' ? 'iz-doc-grid iz-doc-grid-lg' : 'iz-doc-grid'}>
            {visible.map((vehicle) => (
              <VehicleCard
                key={String(vehicle.id)}
                vehicle={vehicle}
                large={view === 'large'}
                onOpen={() => setSelected(vehicle)}
              />
            ))}
          </div>
        )}
    </>
  )
}

function VehicleCounts({ vehicle }: { vehicle: IZRecord }) {
  const { t } = useApp()
  const documents = Number(vehicle.documents ?? 0)
  const expires = Number(vehicle.expires ?? 0)
  return (
    <div className="iz-flex iz-wrap" style={{ gap: 6 }}>
      <span className={`iz-badge${documents ? ' iz-badge-blue' : ''}`}><span className="iz-dot" />{t('docs.documentsCount', { count: documents })}</span>
      {expires > 0 && <span className="iz-badge iz-badge-red"><span className="iz-dot" />{t('docs.expiredCount', { count: expires })}</span>}
    </div>
  )
}

function VehicleRow({ vehicle, onOpen }: { vehicle: IZRecord; onOpen: () => void }) {
  const { t } = useApp()
  return (
    <article className="iz-doc-row">
      <div className="iz-doc-vehicle-icon" aria-hidden="true"><Bus size={18} /></div>
      <div className="iz-doc-main">
        <strong>{String(vehicle.immatriculation ?? '')}</strong>
        <span className="iz-small iz-muted">
          {t('docs.line')} : {String(vehicle.ligne ?? '—')} · {t('docs.coop')} : {String(vehicle.cooperativeNom ?? '—')}
        </span>
        <span className="iz-small iz-muted">
          {t('docs.owner')} : {String(vehicle.proprietaireNom ?? '—')}
        </span>
      </div>
      <VehicleCounts vehicle={vehicle} />
      <div className="iz-doc-actions">
        <button type="button" className="iz-btn iz-btn-primary iz-btn-sm" onClick={onOpen}>{t('docs.manage')}</button>
      </div>
    </article>
  )
}

function VehicleCard({ vehicle, large, onOpen }: { vehicle: IZRecord; large: boolean; onOpen: () => void }) {
  const { t } = useApp()
  return (
    <article className={`iz-doc-card${large ? ' iz-doc-card-lg' : ''}`}>
      <div className={`iz-doc-vehicle-icon${large ? ' iz-doc-vehicle-icon-lg' : ''}`} aria-hidden="true"><Bus size={large ? 26 : 20} /></div>
      <strong className="iz-doc-name">{String(vehicle.immatriculation ?? '')}</strong>
      {large && <span className="iz-small iz-muted">{t('docs.line')} : {String(vehicle.ligne ?? '—')}</span>}
      <span className="iz-small iz-muted">{String(vehicle.cooperativeNom ?? '—')}</span>
      {large && <span className="iz-small iz-muted">{t('docs.owner')} : {String(vehicle.proprietaireNom ?? '—')}</span>}
      <VehicleCounts vehicle={vehicle} />
      <div className="iz-doc-actions">
        <button type="button" className="iz-btn iz-btn-primary iz-btn-sm" onClick={onOpen}>{t('docs.manage')}</button>
      </div>
    </article>
  )
}

function VehicleDocuments({ vehicle, onBack }: { vehicle: IZRecord; onBack: () => void }) {
  const { t, lang, notify } = useApp()
  const plate = String(vehicle.immatriculation ?? '')
  const { data, loading, error, reload } = useAsync(() => izApi.vehicleDocuments(plate), [plate])
  const documents: IZRecord[] = data ?? []
  const [view, setView] = useState<ViewMode>('list')
  const [preview, setPreview] = useState<{ doc: IZRecord; src: string } | null>(null)
  const [editing, setEditing] = useState<IZRecord | null>(null)
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const [busy, setBusy] = useState(false)

  const views: { id: ViewMode; label: string }[] = [
    { id: 'list', label: t('docs.viewList') },
    { id: 'icons', label: t('docs.viewIcons') },
    { id: 'large', label: t('docs.viewLarge') },
  ]

  const viewDoc = async (doc: IZRecord) => {
    try {
      const blob = await izApi.vehicleDocumentFile(Number(doc.id))
      const url = URL.createObjectURL(blob)
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.src)
        return { doc, src: url }
      })
    } catch (reason) { notify(translateError(lang, reason, 'docs.failed'), 'error') }
  }

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.src)
    setPreview(null)
  }

  const download = async (doc: IZRecord) => {
    try {
      const blob = await izApi.vehicleDocumentFile(Number(doc.id))
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = String(doc.nomFichier ?? 'document')
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (reason) { notify(translateError(lang, reason, 'docs.failed'), 'error') }
  }

  const remove = async () => {
    if (!deleting) return
    const target = deleting
    setDeleting(null)
    try {
      await izApi.deleteVehicleDocument(Number(target.id))
      await reload()
      notify(t('docs.deleted'), 'success')
    } catch (reason) { notify(translateError(lang, reason, 'docs.failed'), 'error') }
  }

  const actions = (doc: IZRecord) => (
    <div className="iz-doc-actions">
      <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => void viewDoc(doc)}>{t('docs.view')}</button>
      <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setEditing(doc)}>{t('common.edit')}</button>
      <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => void download(doc)}>{t('docs.download')}</button>
      <button type="button" className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setDeleting(doc)}>{t('common.delete')}</button>
    </div>
  )

  return (
    <>
      <PageHead title={t('docs.vehicleDocs', { plate })} subtitle={t('docs.vehicleSubtitle')} />
      <div className="iz-flex iz-wrap" style={{ marginBottom: 12, gap: 8, alignItems: 'center' }}>
        <button type="button" className="iz-btn iz-btn-ghost iz-btn-sm" onClick={onBack}><ArrowLeft size={15} /> {t('docs.back')}</button>
        <span className="iz-small iz-muted">
          {t('docs.line')} : {String(vehicle.ligne ?? '—')} · {t('docs.coop')} : {String(vehicle.cooperativeNom ?? '—')} · {t('docs.owner')} : {String(vehicle.proprietaireNom ?? '—')}
        </span>
      </div>
      <DocumentAddForm
        plate={plate}
        busy={busy}
        onAdd={async (payload) => {
          setBusy(true)
          try {
            await izApi.createVehicleDocument(plate, payload)
            await reload()
            notify(t('docs.added'), 'success')
          } catch (reason) { notify(translateError(lang, reason, 'docs.failed'), 'error') }
          finally { setBusy(false) }
        }}
      />
      <div className="iz-list-tools" style={{ marginTop: 16 }}>
        <div className="iz-doc-views" role="group" aria-label={t('docs.viewMode')}>
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`iz-btn iz-btn-sm ${view === item.id ? 'iz-btn-primary' : 'iz-btn-outline'}`}
              aria-pressed={view === item.id}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="iz-small iz-muted">{t('docs.documentsCount', { count: documents.length })}</span>
      </div>
      {loading ? <Loading /> : error ? <Alert type="error">{error}</Alert> : documents.length === 0
        ? <div className="iz-card"><p className="iz-small iz-muted">{t('docs.noVehicleDocs')}</p></div>
        : view === 'list' ? (
          <div className="iz-doc-list">
            {documents.map((doc) => (
              <article key={String(doc.id)} className="iz-doc-row">
                <DocumentThumb doc={doc} />
                <div className="iz-doc-main">
                  <strong>{String(doc.nomFichier ?? '')}</strong>
                  <span className="iz-small iz-muted">{translateValue(lang, String(doc.type ?? ''))}</span>
                  <span className="iz-small iz-muted">
                    {t('docs.expiry')} : {doc.expireLe ? formatDate(doc.expireLe) : t('docs.noExpiry')} · {formatSize(doc.taille)}
                  </span>
                </div>
                <StatusBadge status={String(doc.statut ?? '')} />
                {actions(doc)}
              </article>
            ))}
          </div>
        ) : (
          <div className={view === 'large' ? 'iz-doc-grid iz-doc-grid-lg' : 'iz-doc-grid'}>
            {documents.map((doc) => (
              <article key={String(doc.id)} className={`iz-doc-card${view === 'large' ? ' iz-doc-card-lg' : ''}`}>
                <button type="button" className="iz-doc-preview" onClick={() => void viewDoc(doc)} title={t('docs.view')}>
                  <DocumentThumb doc={doc} large={view === 'large'} />
                </button>
                <strong className="iz-doc-name" title={String(doc.nomFichier ?? '')}>{String(doc.nomFichier ?? '')}</strong>
                <span className="iz-small iz-muted">{translateValue(lang, String(doc.type ?? ''))}</span>
                {view === 'large' && (
                  <span className="iz-small iz-muted">{t('docs.expiry')} : {doc.expireLe ? formatDate(doc.expireLe) : t('docs.noExpiry')}</span>
                )}
                <StatusBadge status={String(doc.statut ?? '')} />
                {actions(doc)}
              </article>
            ))}
          </div>
        )}
      {preview && (
        <Modal
          title={String(preview.doc.nomFichier ?? '')}
          onClose={closePreview}
          footer={(
            <>
              <button type="button" className="iz-btn iz-btn-outline" onClick={closePreview}>{t('common.close')}</button>
              <button type="button" className="iz-btn iz-btn-primary" onClick={() => void download(preview.doc)}>{t('docs.download')}</button>
            </>
          )}
        >
          {String(preview.doc.mime ?? '').startsWith('image/') ? (
            <img src={preview.src} alt={String(preview.doc.nomFichier ?? '')} style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto' }} />
          ) : (
            <iframe src={preview.src} title={String(preview.doc.nomFichier ?? '')} style={{ width: '100%', height: '70vh', border: 0 }} />
          )}
        </Modal>
      )}
      {editing && (
        <DocumentEditDialog
          doc={editing}
          busy={busy}
          onClose={() => { if (!busy) setEditing(null) }}
          onSave={async (changes) => {
            setBusy(true)
            try {
              await izApi.updateVehicleDocument(Number(editing.id), changes)
              setEditing(null)
              await reload()
              notify(t('docs.saved'), 'success')
            } catch (reason) { notify(translateError(lang, reason, 'docs.failed'), 'error') }
            finally { setBusy(false) }
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          message={t('docs.deleteConfirm', { name: String(deleting.nomFichier ?? '') })}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}

function DocumentAddForm({ plate, busy, onAdd }: {
  plate: string
  busy: boolean
  onAdd: (payload: IZRecord) => Promise<void>
}) {
  const { t, lang, notify } = useApp()
  const [type, setType] = useState(DOCUMENT_TYPES[0])
  const [expireLe, setExpireLe] = useState('')
  const [fichier, setFichier] = useState<{ data: string; nomFichier: string } | null>(null)

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!DOCUMENT_MIME.test(file.type)) { notify(t('bus.docBadFormat'), 'error'); return }
    if (file.size > DOCUMENT_MAX_BYTES) { notify(t('bus.docTooBig'), 'error'); return }
    const reader = new FileReader()
    reader.onload = () => setFichier({ data: String(reader.result ?? ''), nomFichier: file.name })
    reader.onerror = () => notify(t('bus.docBadFormat'), 'error')
    reader.readAsDataURL(file)
  }

  return (
    <div className="iz-card">
      <h3 style={{ fontSize: '.95rem', marginBottom: 10 }}>{t('docs.addTitle')}</h3>
      <div className="iz-flex iz-wrap" style={{ gap: 8 }}>
        <select className="iz-input" value={type} onChange={(event) => setType(event.target.value)} style={{ maxWidth: 200 }}>
          {DOCUMENT_TYPES.map((value) => <option key={value} value={value}>{translateValue(lang, value)}</option>)}
        </select>
        <input
          className="iz-input"
          type="date"
          value={expireLe}
          title={t('docs.expiry')}
          onChange={(event) => setExpireLe(event.target.value)}
          style={{ maxWidth: 170 }}
        />
        <label className="iz-btn iz-btn-outline iz-btn-sm" style={{ cursor: 'pointer' }}>
          {fichier ? fichier.nomFichier : t('bus.docChooseFile')}
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={pick} style={{ display: 'none' }} />
        </label>
        <button
          type="button"
          className="iz-btn iz-btn-primary iz-btn-sm"
          disabled={!fichier || busy}
          onClick={() => {
            if (!fichier) return
            void onAdd({ type, expireLe, nomFichier: fichier.nomFichier, data: fichier.data }).then(() => {
              setFichier(null)
              setExpireLe('')
            })
          }}
          aria-label={`${t('docs.addTitle')} — ${plate}`}
        >
          {busy ? t('bus.docUploading') : t('docs.add')}
        </button>
      </div>
    </div>
  )
}

function DocumentEditDialog({ doc, busy, onClose, onSave }: {
  doc: IZRecord
  busy: boolean
  onClose: () => void
  onSave: (changes: IZRecord) => Promise<void>
}) {
  const { t, lang, notify } = useApp()
  const [type, setType] = useState(String(doc.type ?? DOCUMENT_TYPES[0]))
  const [nomFichier, setNomFichier] = useState(String(doc.nomFichier ?? ''))
  const [expireLe, setExpireLe] = useState(String(doc.expireLe ?? ''))
  const [data, setData] = useState<string | undefined>(undefined)

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!DOCUMENT_MIME.test(file.type)) { notify(t('bus.docBadFormat'), 'error'); return }
    if (file.size > DOCUMENT_MAX_BYTES) { notify(t('bus.docTooBig'), 'error'); return }
    const reader = new FileReader()
    reader.onload = () => {
      setData(String(reader.result ?? ''))
      if (!nomFichier.trim()) setNomFichier(file.name)
    }
    reader.onerror = () => notify(t('bus.docBadFormat'), 'error')
    reader.readAsDataURL(file)
  }

  return (
    <Modal
      title={t('docs.editTitle')}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="iz-btn iz-btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            type="button"
            className="iz-btn iz-btn-primary"
            disabled={busy}
            onClick={() => void onSave({ type, nomFichier: nomFichier.trim(), expireLe, data })}
          >
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      )}
    >
      <div className="iz-form-grid">
        <Field label={t('docs.vehicle')}>
          <input className="iz-input" value={String(doc.immatriculation ?? '')} readOnly />
        </Field>
        <Field label={t('docs.type')}>
          <select className="iz-input" value={type} onChange={(event) => setType(event.target.value)}>
            {DOCUMENT_TYPES.map((value) => <option key={value} value={value}>{translateValue(lang, value)}</option>)}
          </select>
        </Field>
        <Field label={t('docs.fileName')} full>
          <input className="iz-input" maxLength={160} value={nomFichier} onChange={(event) => setNomFichier(event.target.value)} />
        </Field>
        <Field label={t('docs.expiry')}>
          <input className="iz-input" type="date" value={expireLe} onChange={(event) => setExpireLe(event.target.value)} />
        </Field>
        <Field label={t('docs.replaceFile')}>
          <label className="iz-btn iz-btn-outline iz-btn-sm" style={{ cursor: 'pointer' }}>
            {data ? t('docs.fileSelected') : t('bus.docChooseFile')}
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={pick} style={{ display: 'none' }} />
          </label>
        </Field>
      </div>
    </Modal>
  )
}
