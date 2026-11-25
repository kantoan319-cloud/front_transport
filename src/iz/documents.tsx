import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { izApi } from './api'
import type { IZRecord } from './api'
import { translateError, translateValue } from './i18n'
import { Alert, ConfirmDialog, Field, Loading, Modal, PageHead, StatusBadge, useApp, useAsync } from './components'

const DOCUMENT_TYPES = ['Licence', 'Patente', 'Carte grise', 'Assurance', 'Visite technique', 'Autre']
const DOCUMENT_MIME = /^(application\/pdf|image\/(jpeg|png|webp))$/
const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024

type DocView = 'list' | 'icons' | 'large'

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

function DocumentActions({ doc, onView, onEdit, onDownload, onDelete }: {
  doc: IZRecord
  onView: (doc: IZRecord) => void
  onEdit: (doc: IZRecord) => void
  onDownload: (doc: IZRecord) => void
  onDelete: (doc: IZRecord) => void
}) {
  const { t } = useApp()
  return (
    <div className="iz-doc-actions">
      <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => onView(doc)}>{t('docs.view')}</button>
      <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => onEdit(doc)}>{t('common.edit')}</button>
      <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => onDownload(doc)}>{t('docs.download')}</button>
      <button type="button" className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => onDelete(doc)}>{t('common.delete')}</button>
    </div>
  )
}

/** Administration → Documents : tous les documents des bus, en liste ou icônes. */
export function AdminDocuments() {
  const { t, lang, notify } = useApp()
  const { data, loading, error, reload } = useAsync(() => izApi.adminDocuments(), [])
  const documents: IZRecord[] = data ?? []
  const [view, setView] = useState<DocView>('list')
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<{ doc: IZRecord; src: string } | null>(null)
  const [editing, setEditing] = useState<IZRecord | null>(null)
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const [busy, setBusy] = useState(false)

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? documents.filter((doc) => [doc.immatriculation, doc.cooperativeNom, doc.type, doc.nomFichier, doc.statut]
      .map((value) => String(value ?? '')).join(' ').toLowerCase().includes(needle))
    : documents

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

  const views: { id: DocView; label: string }[] = [
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
        <span className="iz-small iz-muted">{t('docs.count', { count: visible.length })}</span>
      </div>
      {loading ? <Loading /> : error ? <Alert type="error">{error}</Alert> : visible.length === 0
        ? <div className="iz-card"><p className="iz-small iz-muted">{t('docs.empty')}</p></div>
        : view === 'list' ? (
          <div className="iz-doc-list">
            {visible.map((doc) => (
              <article key={String(doc.id)} className="iz-doc-row">
                <DocumentThumb doc={doc} />
                <div className="iz-doc-main">
                  <strong>{String(doc.nomFichier ?? '')}</strong>
                  <span className="iz-small iz-muted">
                    {String(doc.immatriculation ?? '')}
                    {doc.cooperativeNom ? ` — ${String(doc.cooperativeNom)}` : ''}
                  </span>
                  <span className="iz-small iz-muted">
                    {translateValue(lang, String(doc.type ?? ''))} · {t('docs.expiry')} : {doc.expireLe ? formatDate(doc.expireLe) : t('docs.noExpiry')} · {formatSize(doc.taille)}
                  </span>
                </div>
                <StatusBadge status={String(doc.statut ?? '')} />
                <DocumentActions doc={doc} onView={(item) => void viewDoc(item)} onEdit={setEditing} onDownload={(item) => void download(item)} onDelete={setDeleting} />
              </article>
            ))}
          </div>
        ) : (
          <div className={view === 'large' ? 'iz-doc-grid iz-doc-grid-lg' : 'iz-doc-grid'}>
            {visible.map((doc) => (
              <article key={String(doc.id)} className={`iz-doc-card${view === 'large' ? ' iz-doc-card-lg' : ''}`}>
                <button type="button" className="iz-doc-preview" onClick={() => void viewDoc(doc)} title={t('docs.view')}>
                  <DocumentThumb doc={doc} large={view === 'large'} />
                </button>
                <strong className="iz-doc-name" title={String(doc.nomFichier ?? '')}>{String(doc.nomFichier ?? '')}</strong>
                {view === 'large' && <span className="iz-small iz-muted">{String(doc.immatriculation ?? '')}{doc.cooperativeNom ? ` — ${String(doc.cooperativeNom)}` : ''}</span>}
                <span className="iz-small iz-muted">{translateValue(lang, String(doc.type ?? ''))}</span>
                {view === 'large' && (
                  <span className="iz-small iz-muted">{t('docs.expiry')} : {doc.expireLe ? formatDate(doc.expireLe) : t('docs.noExpiry')}</span>
                )}
                <StatusBadge status={String(doc.statut ?? '')} />
                <DocumentActions doc={doc} onView={(item) => void viewDoc(item)} onEdit={setEditing} onDownload={(item) => void download(item)} onDelete={setDeleting} />
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
