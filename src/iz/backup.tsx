import { useState } from 'react'
import { izApi } from './api'
import type { IZRecord } from './api'
import { translateError } from './i18n'
import { Alert, ConfirmDialog, Loading, PageHead, useApp, useAsync } from './components'

function formatSize(bytes: unknown): string {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
  return `${Math.max(1, Math.round(value / 1024))} Ko`
}

function formatDate(value: unknown): string {
  const date = new Date(String(value ?? ''))
  if (Number.isNaN(date.getTime())) return String(value ?? '')
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function telechargerFichier(blob: Blob, nomFichier: string) {
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Administration → Sauvegarde : téléchargement immédiat + sauvegardes hebdomadaires. */
export function AdminBackup() {
  const { t, lang, notify } = useApp()
  const { data, loading, error, reload } = useAsync(() => izApi.adminBackups(), [])
  const [busy, setBusy] = useState<'' | 'download' | 'store'>('')
  const [toDelete, setToDelete] = useState<IZRecord | null>(null)
  const backups: IZRecord[] = data ?? []

  const telechargerMaintenant = async () => {
    setBusy('download')
    try {
      const { blob, nomFichier } = await izApi.downloadAdminBackup()
      telechargerFichier(blob, nomFichier)
      notify(t('backup.downloaded'), 'success')
    } catch (raison) {
      notify(translateError(lang, raison, 'backup.failed'), 'error')
    } finally {
      setBusy('')
    }
  }

  const enregistrerMaintenant = async () => {
    setBusy('store')
    try {
      const resume = await izApi.createAdminBackup()
      notify(Number(resume?.erreurs ?? 0) > 0 ? t('backup.incomplete') : t('backup.stored'), 'success')
      await reload()
    } catch (raison) {
      notify(translateError(lang, raison, 'backup.failed'), 'error')
    } finally {
      setBusy('')
    }
  }

  const telechargerSauvegarde = async (backup: IZRecord) => {
    setBusy('download')
    try {
      const { blob, nomFichier } = await izApi.downloadStoredBackup(Number(backup.id))
      telechargerFichier(blob, nomFichier)
    } catch (raison) {
      notify(translateError(lang, raison, 'backup.failed'), 'error')
    } finally {
      setBusy('')
    }
  }

  const supprimer = async () => {
    if (!toDelete) return
    try {
      await izApi.deleteAdminBackup(Number(toDelete.id))
      notify(t('backup.deleted'), 'success')
      setToDelete(null)
      await reload()
    } catch (raison) {
      notify(translateError(lang, raison, 'backup.failed'), 'error')
    }
  }

  return (
    <>
      <PageHead
        title={t('backup.title')}
        subtitle={t('backup.subtitle')}
        action={
          <div className="iz-flex iz-wrap">
            <button type="button" className="iz-btn iz-btn-primary" disabled={busy !== ''} onClick={telechargerMaintenant}>
              {busy === 'download' ? t('backup.building') : t('backup.downloadNow')}
            </button>
            <button type="button" className="iz-btn iz-btn-outline" disabled={busy !== ''} onClick={enregistrerMaintenant}>
              {busy === 'store' ? t('backup.building') : t('backup.storeNow')}
            </button>
          </div>
        }
      />

      <div className="iz-grid iz-grid-2" style={{ marginBottom: 16 }}>
        <div className="iz-card">
          <h3>{t('backup.autoTitle')}</h3>
          <p className="iz-small iz-muted">{t('backup.autoInfo')}</p>
          <p className="iz-small iz-muted">{t('backup.intactInfo')}</p>
        </div>
        <div className="iz-card">
          <h3>{t('backup.contentsTitle')}</h3>
          <p className="iz-small iz-muted">{t('backup.contents')}</p>
          <p className="iz-small iz-muted">{t('backup.retention')}</p>
        </div>
      </div>

      <h3 className="iz-map-section-title">{t('backup.listTitle')}</h3>
      {loading ? <Loading /> : error ? <Alert type="error">{error}</Alert> : backups.length === 0 ? (
        <div className="iz-card"><p className="iz-small iz-muted">{t('backup.none')}</p></div>
      ) : (
        <div className="iz-table-wrap iz-stacked-wrap">
          <table className="iz-table iz-table-stacked">
            <thead>
              <tr>
                <th>{t('backup.date')}</th>
                <th>{t('backup.mode')}</th>
                <th>{t('backup.size')}</th>
                <th>{t('backup.rows')}</th>
                <th>{t('backup.documents')}</th>
                <th>{t('backup.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={String(backup.id)}>
                  <td data-label={t('backup.date')}>{formatDate(backup.createdAt)}</td>
                  <td data-label={t('backup.mode')}>
                    <span className={`iz-badge ${backup.mode === 'auto' ? 'iz-badge-blue' : 'iz-badge-amber'}`}>
                      <span className="iz-dot" />{backup.mode === 'auto' ? t('backup.modeAuto') : t('backup.modeManual')}
                    </span>
                  </td>
                  <td data-label={t('backup.size')}>{formatSize(backup.taille)}</td>
                  <td data-label={t('backup.rows')}>{Number(backup.nbLignes ?? 0).toLocaleString('fr-FR')}</td>
                  <td data-label={t('backup.documents')}>{Number(backup.nbDocuments ?? 0)}</td>
                  <td className="iz-actions-cell" data-label={t('backup.actions')}>
                    <div className="iz-flex iz-wrap">
                      <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" disabled={busy !== ''} onClick={() => telechargerSauvegarde(backup)}>
                        {t('backup.download')}
                      </button>
                      <button type="button" className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setToDelete(backup)}>
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          message={t('backup.deleteConfirm', { date: formatDate(toDelete.createdAt) })}
          onConfirm={supprimer}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  )
}
