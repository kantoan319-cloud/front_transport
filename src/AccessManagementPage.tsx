import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, type AdminController, type DriverImportResult, type PasswordResetRequest, type PhotoLinkResult } from './api'
import { usePreferences } from './Preferences'
import './AccessManagementPage.css'

interface AccessManagementPageProps {
  initialTab: 'users' | 'passwordRequests' | 'imports'
}

type AccessTab = AccessManagementPageProps['initialTab']

function makeTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$'
  const random = new Uint32Array(14)
  crypto.getRandomValues(random)
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join('')
}

function formattedDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('fr-FR')
}

export default function AccessManagementPage({ initialTab }: AccessManagementPageProps) {
  const { t } = usePreferences()
  const [tab, setTab] = useState(initialTab)
  const [users, setUsers] = useState<AdminController[]>([])
  const [requests, setRequests] = useState<PasswordResetRequest[]>([])
  const [importSource, setImportSource] = useState('cyclo_pousse')
  const [importPreview, setImportPreview] = useState<DriverImportResult | null>(null)
  const [importMode, setImportMode] = useState<'drivers' | 'photos'>('drivers')
  const [replaceExistingPhotos, setReplaceExistingPhotos] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<PhotoLinkResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      if (tab === 'users') setUsers(await api.users())
      else if (tab === 'passwordRequests') setRequests(await api.passwordResetRequests())
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les données.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { void refresh() }, [refresh])

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    const formElement = event.currentTarget
    const form = new FormData(event.currentTarget)
    try {
      await api.createUser({
        nom: String(form.get('nom') ?? '').trim(),
        prenom: String(form.get('prenom') ?? '').trim(),
        email: String(form.get('email') ?? '').trim(),
        motDePasse: String(form.get('motDePasse') ?? ''),
        telephone: String(form.get('telephone') ?? '').trim(),
      })
      formElement.reset()
      setSuccess('Le compte contrôleur a été créé.')
      await refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'La création du compte a échoué.')
    } finally {
      setBusy(false)
    }
  }

  async function removeUser(user: AdminController) {
    const label = `${user.prenom ?? ''} ${user.nom}`.trim() || user.email
    if (!window.confirm(`Supprimer le compte contrôleur de ${label} ?`)) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await api.removeUser(user.id)
      setSuccess('Le compte contrôleur a été supprimé.')
      await refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'La suppression du compte a échoué.')
    } finally {
      setBusy(false)
    }
  }

  async function resolveRequest(request: PasswordResetRequest, action: 'approve' | 'reject') {
    let password: string | undefined
    if (action === 'approve') {
      password = makeTemporaryPassword()
      if (!window.confirm(`Le nouveau mot de passe temporaire sera :\n\n${password}\n\nNotez-le avant de continuer et communiquez-le à l’utilisateur par un canal sécurisé. Approuver ?`)) return
    } else if (!window.confirm(`Refuser la demande de ${request.email} ?`)) return

    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await api.resolvePasswordResetRequest(request.id, action, password)
      setSuccess(action === 'approve'
        ? `Mot de passe modifié pour ${request.email}. Communiquez-le de manière sécurisée.`
        : 'Demande de réinitialisation refusée.')
      await refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Le traitement de la demande a échoué.')
    } finally {
      setBusy(false)
    }
  }

  async function previewImport() {
    setBusy(true)
    setError('')
    setSuccess('')
    setImportPreview(null)
    try {
      const result = await api.previewDriverImport(importSource.trim())
      setImportPreview(result)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'La simulation de l’import a échoué.')
    } finally {
      setBusy(false)
    }
  }

  async function runImport() {
    if (!importPreview) return
    if (!window.confirm(`Importer ${importPreview.summary.newDrivers} conducteur(s) et ${importPreview.summary.newVisits} visite(s) médicale(s) depuis ${importSource} ? Les doublons seront ignorés.`)) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const result = await api.runDriverImport(importSource.trim())
      setSuccess(`Import terminé : ${result.summary.newDrivers} conducteur(s) et ${result.summary.newVisits} visite(s) ajoutés.`)
      setImportPreview(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'L’import a échoué.')
    } finally {
      setBusy(false)
    }
  }

  async function previewPhotoLinks() {
    setBusy(true)
    setError('')
    setSuccess('')
    setPhotoPreview(null)
    try {
      setPhotoPreview(await api.previewPhotoLinks(replaceExistingPhotos))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'La simulation des liaisons photo a échoué.')
    } finally {
      setBusy(false)
    }
  }

  async function runPhotoLinks() {
    if (!photoPreview) return
    const { toLink } = photoPreview.summary
    if (!window.confirm(`Relier ${toLink} photo(s) du dossier PhotoCycloPousses aux véhicules ?${replaceExistingPhotos ? '\nLes photos existantes pourront être remplacées.' : ''}`)) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const result = await api.runPhotoLinks(replaceExistingPhotos)
      setSuccess(`Liaison terminée : ${result.summary.toLink} photo(s) reliée(s).`)
      setPhotoPreview(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'La liaison des photos a échoué.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="content-card access-manager">
      <div className="list-toolbar">
        <div className="list-title"><h2>{tab === 'users' ? t('Comptes contrôleurs') : tab === 'passwordRequests' ? t('Demandes de réinitialisation') : t('Imports')}</h2></div>
        <div className="access-tabs" role="tablist" aria-label="Gestion des accès">
          {([['users', 'Comptes'], ['passwordRequests', 'Mots de passe'], ['imports', 'Imports']] as [AccessTab, string][]).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => { setLoading(id !== 'imports'); setTab(id) }}>{t(label)}</button>)}
        </div>
      </div>

      <div className="access-content">
        {error && <div className="alert error" role="alert">{error}</div>}
        {success && <div className="alert success" role="status">{success}</div>}

        {tab === 'users' && (
          <form className="access-create-form" onSubmit={(event) => void createUser(event)}>
            <h3>{t('Créer un compte contrôleur')}</h3>
            <label>{t('Nom')}<input name="nom" required maxLength={100} /></label>
            <label>{t('Prénom')}<input name="prenom" maxLength={100} /></label>
            <label>{t('E-mail')}<input name="email" type="email" required maxLength={190} /></label>
            <label>{t('Téléphone')}<input name="telephone" maxLength={30} /></label>
            <label>{t('Mot de passe initial')}<input name="motDePasse" type="password" minLength={6} maxLength={100} required autoComplete="new-password" /></label>
            <button type="submit" className="button primary" disabled={busy}>{busy ? t('Création…') : t('Créer le compte')}</button>
          </form>
        )}
        {tab === 'imports' && (
          <section className="driver-import">
            <div className="access-tabs" role="tablist" aria-label={t('Type d’import')}>
              <button type="button" role="tab" aria-selected={importMode === 'drivers'} className={importMode === 'drivers' ? 'active' : ''} onClick={() => setImportMode('drivers')}>{t('Conducteurs')}</button>
              <button type="button" role="tab" aria-selected={importMode === 'photos'} className={importMode === 'photos' ? 'active' : ''} onClick={() => setImportMode('photos')}>{t('Photos des véhicules')}</button>
            </div>
            {importMode === 'drivers' ? <>
            <p>{t('Cette simulation lit la table source')} <code>conducteurs_permis_2026</code> {t('de la base MySQL choisie. Elle n’écrit rien. L’import ajoute les conducteurs et visites médicales manquants dans la base XAMPP, sans dupliquer les entrées reconnues.')}</p>
            <label>{t('Base source MySQL')}<input value={importSource} onChange={(event) => { setImportSource(event.target.value); setImportPreview(null) }} maxLength={64} pattern="[A-Za-z0-9_]+" /></label>
            <div className="driver-import-actions"><button className="button secondary" type="button" disabled={busy || !importSource.trim()} onClick={() => void previewImport()}>{busy ? t('Simulation…') : t('Simuler sans modifier')}</button>
              <button className="button primary" type="button" disabled={busy || !importPreview || !importPreview.simulation} onClick={() => void runImport()}>{busy ? t('Import en cours…') : t('Importer les résultats')}</button></div>
            {importPreview && <div className="driver-import-results">
              <h3>{t('Simulation')} · {importPreview.summary.sourceCount} {t('lignes source')}</h3>
              <dl>{[
                ['Nouveaux conducteurs', importPreview.summary.newDrivers],
                ['Conducteurs déjà présents', importPreview.summary.existingDrivers],
                ['Nouvelles visites médicales', importPreview.summary.newVisits],
                ['Visites déjà présentes', importPreview.summary.existingVisits],
                ['Permis en double ignorés', importPreview.summary.duplicateLicenses],
                ['Dates de naissance invalides', importPreview.summary.invalidBirthDates],
                ['Expirations de visite corrigées', importPreview.summary.correctedExpirations],
                ['Lignes vides ignorées', importPreview.summary.emptyRows],
              ].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
              <p>{t('Les données source resteront intactes. L’import est transactionnel ; en cas d’erreur, les ajouts seront annulés.')}</p>
            </div>}
            </> : <>
              <p>{t('Simulez la liaison des fichiers déjà présents dans')} <code>PhotoCycloPousses</code> {t('aux véhicules dont l’immatriculation correspond (ex.')} <code>15_cp_abe.jpg</code> → <code>15/CP/ABE</code>). {t('La simulation ne modifie ni les fichiers ni la base.')}</p>
              <label className="photo-force-option"><input type="checkbox" checked={replaceExistingPhotos} onChange={(event) => { setReplaceExistingPhotos(event.target.checked); setPhotoPreview(null) }} /> {t('Remplacer les photos existantes')}</label>
              <div className="driver-import-actions"><button className="button secondary" type="button" disabled={busy} onClick={() => void previewPhotoLinks()}>{busy ? t('Simulation…') : t('Simuler les liaisons')}</button>
                <button className="button primary" type="button" disabled={busy || !photoPreview?.simulation || photoPreview.summary.toLink === 0} onClick={() => void runPhotoLinks()}>{busy ? t('Liaison…') : t('Lier les photos')}</button></div>
              {photoPreview && <div className="driver-import-results">
                <h3>{t('Simulation')} · {photoPreview.summary.files} {t('fichiers parcourus')}</h3>
                <dl>{[
                  ['À relier', photoPreview.summary.toLink],
                  ['Déjà reliées', photoPreview.summary.alreadyLinked],
                  ['Photo existante conservée', photoPreview.summary.existingPhotoSkipped],
                  ['Véhicule introuvable', photoPreview.summary.missingVehicles],
                  ['Correspondances ambiguës', photoPreview.summary.ambiguousVehicles],
                  ['Fichiers en doublon', photoPreview.summary.duplicateFiles],
                  ['Noms de fichier ignorés', photoPreview.summary.invalidFiles],
                ].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
                {Object.entries(photoPreview.details).filter(([, values]) => values.length > 0).map(([category, values]) => <details className="photo-import-details" key={category}><summary>{category} ({values.length}{values.length === 300 ? '+' : ''})</summary><ul>{values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}</ul></details>)}
                <p>{t('Une liaison réelle ne renomme ni ne supprime les images ; elle met à jour le chemin photo des véhicules dans une transaction.')}</p>
              </div>}
            </>}
          </section>
        )}

        {loading && tab !== 'imports' ? <div className="inline-state"><span className="spinner" /> {t('Chargement…')}</div>
          : tab === 'users' ? users.length === 0 ? <p className="access-empty">{t('Aucun compte disponible.')}</p> : (
            <div className="table-scroll"><table><thead><tr><th>{t('Nom')}</th><th>{t('E-mail')}</th><th>{t('Téléphone')}</th><th>{t('Créé le')}</th><th>{t('Action')}</th></tr></thead>
              <tbody>{users.map((user) => <tr key={user.id}>
                <td>{`${user.prenom ?? ''} ${user.nom}`.trim()}</td><td>{user.email}</td><td>{user.telephone || '—'}</td><td>{formattedDate(user.dateCreation)}</td>
                <td>{user.role === 'controleur' && <button className="table-action danger-action" disabled={busy} onClick={() => void removeUser(user)}>{t('Supprimer')}</button>}</td>
              </tr>)}</tbody>
            </table></div>
          ) : tab === 'passwordRequests' && requests.length === 0 ? <p className="access-empty">{t('Aucune demande de réinitialisation.')}</p> : tab === 'passwordRequests' ? (
            <div className="access-request-list">{requests.map((request) => (
              <article className="access-request" key={request.id}>
                <div className="access-request-heading"><div><b>{request.email}</b><span>Demandé le {formattedDate(request.date)}</span></div><span className={`status-pill ${request.statut === 'En attente' ? 'warning' : request.statut === 'Refusée' ? 'danger' : 'success'}`}><i />{request.statut}</span></div>
                {request.statut === 'En attente' ? (
                  <div className="access-request-actions"><p>Un mot de passe temporaire sera généré et affiché avant approbation.</p><div>
                    <button className="button primary" disabled={busy} onClick={() => void resolveRequest(request, 'approve')}>Approuver</button>
                    <button className="button secondary" disabled={busy} onClick={() => void resolveRequest(request, 'reject')}>Refuser</button>
                  </div></div>
                ) : <small>Traité par {request.traitePar || '—'} · {formattedDate(request.dateTraitement)}</small>}
              </article>
            ))}</div>
          ) : null}
      </div>
    </section>
  )
}
