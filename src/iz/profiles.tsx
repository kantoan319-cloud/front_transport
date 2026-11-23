import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { izApi } from './api'
import type { IZAgentProfile, IZRecord } from './api'
import {
  Alert, Empty, Field, Loading, Modal, PageHead, useApp, useAsync,
} from './components'
import { DataTable } from './DataTable'
import { photoDataUrl } from './photo'

const profileComplete = (profile: IZAgentProfile | IZRecord | null | undefined) =>
  ['cin', 'fonction', 'matricule', 'telephone', 'photoIdentite']
    .every((key) => Boolean(String((profile as Record<string, unknown> | null)?.[key] ?? '').trim()))

type ProfileForm = {
  telephone: string
  cin: string
  fonction: string
  matricule: string
  photoIdentite: string | null
}

const formFrom = (profile?: IZAgentProfile | null): ProfileForm => ({
  telephone: profile?.telephone ?? '',
  cin: profile?.cin ?? '',
  fonction: profile?.fonction ?? '',
  matricule: profile?.matricule ?? '',
  photoIdentite: profile?.photoIdentite ?? null,
})

export function IdentityPhotoField({
  value, onChange, disabled, existing,
}: {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  existing?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      onChange(await photoDataUrl(file))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Photo illisible.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="iz-photo-field">
      {value
        ? <img className="iz-photo-preview" src={value} alt="Photo d’identité" />
        : (
          <span className="iz-photo-empty">
            {existing ? 'Photo enregistrée' : 'Aucune photo'}
          </span>
        )}
      <div className="iz-flex iz-wrap">
        <label className={`iz-btn iz-btn-outline iz-btn-sm${disabled || busy ? ' iz-disabled' : ''}`}>
          {busy ? 'Lecture…' : value || existing ? 'Changer la photo' : 'Ajouter la photo'}
          <input type="file" accept="image/*" hidden disabled={disabled || busy} onChange={(event) => void pick(event)} />
        </label>
        {value && (
          <button type="button" className="iz-btn iz-btn-ghost iz-btn-sm" disabled={disabled || busy} onClick={() => onChange(null)}>
            Retirer
          </button>
        )}
      </div>
      {error && <span className="iz-small" role="alert">{error}</span>}
    </div>
  )
}

function ProfileAvatar({ photo, name, size }: { photo?: string | null; name?: string; size?: 'lg' }) {
  return photo
    ? <img className={`iz-profile-avatar${size ? ` ${size}` : ''}`} src={photo} alt={`Photo de ${name ?? 'l’agent'}`} />
    : <span className={`iz-profile-avatar placeholder${size ? ` ${size}` : ''}`} aria-hidden="true">{(name || '?').slice(0, 1).toUpperCase()}</span>
}

export function ControllerProfilePage() {
  const { user, refreshUser, notify } = useApp()
  const { data, loading, error, reload } = useAsync(() => izApi.profile(), [])
  const [form, setForm] = useState<ProfileForm>(formFrom(null))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data) setForm(formFrom(data))
  }, [data])

  const complete = profileComplete(form)
  const save = async () => {
    if (busy) return
    setBusy(true)
    try {
      await izApi.updateProfile({
        telephone: form.telephone.trim(),
        cin: form.cin.trim(),
        fonction: form.fonction.trim(),
        matricule: form.matricule.trim(),
        photoIdentite: form.photoIdentite,
      })
      notify('Profil enregistré.', 'success')
      await Promise.all([reload(), refreshUser()])
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Enregistrement impossible.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead
        title="Mon profil agent"
        subtitle="Ces informations identifient l’auteur des scans, signalements et mises en fourrière auprès de l’administration."
      />
      {loading ? <Loading /> : error ? (
        <div className="iz-card" role="alert">
          {error} <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => void reload()}>Réessayer</button>
        </div>
      ) : (
        <>
          {!complete && (
            <div style={{ marginBottom: 16 }}>
              <Alert type="error">
                Profil incomplet : renseignez le CIN, la fonction, le matricule, le téléphone et la photo d’identité.
                Sans ces informations, le scan, les signalements et la mise en fourrière sont bloqués.
              </Alert>
            </div>
          )}
          <div className="iz-card">
            <div className="iz-profile-hero">
              <ProfileAvatar photo={form.photoIdentite} name={`${user?.prenom ?? ''} ${user?.nom ?? ''}`} size="lg" />
              <div>
                <strong className="iz-profile-name">{user?.prenom ?? data?.prenom} {user?.nom ?? data?.nom}</strong>
                <span className="iz-small iz-muted" style={{ display: 'block' }}>{data?.email ?? user?.email}</span>
                <span className={`iz-badge ${complete ? 'iz-badge-green' : 'iz-badge-amber'}`} style={{ marginTop: 6 }}>
                  {complete ? 'Profil complet' : 'Profil à compléter'}
                </span>
              </div>
            </div>
            <div className="iz-form-grid" style={{ marginTop: 18 }}>
              <Field label="Nom">
                <input className="iz-input" value={data?.nom ?? user?.nom ?? ''} readOnly />
              </Field>
              <Field label="Prénom(s)">
                <input className="iz-input" value={data?.prenom ?? user?.prenom ?? ''} readOnly />
              </Field>
              <Field label="Numéro de CIN *">
                <input className="iz-input" maxLength={40} value={form.cin} onChange={(event) => setForm({ ...form, cin: event.target.value })} />
              </Field>
              <Field label="Fonction *">
                <input className="iz-input" maxLength={120} value={form.fonction} onChange={(event) => setForm({ ...form, fonction: event.target.value })} />
              </Field>
              <Field label="Numéro matricule *">
                <input className="iz-input" maxLength={60} value={form.matricule} onChange={(event) => setForm({ ...form, matricule: event.target.value })} />
              </Field>
              <Field label="Numéro téléphone *">
                <input className="iz-input" type="tel" maxLength={30} value={form.telephone} onChange={(event) => setForm({ ...form, telephone: event.target.value })} />
              </Field>
              <Field label="Photo d’identité *" full>
                <IdentityPhotoField value={form.photoIdentite} onChange={(photo) => setForm({ ...form, photoIdentite: photo })} disabled={busy} />
              </Field>
            </div>
            <div className="iz-flex iz-wrap" style={{ marginTop: 18 }}>
              <button className="iz-btn iz-btn-primary" disabled={busy} onClick={() => void save()}>
                {busy ? 'Enregistrement…' : 'Enregistrer mon profil'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export function AgentProfileDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, loading, error, reload } = useAsync(() => izApi.agentProfile(id), [id])
  return (
    <Modal title="Profil de l’agent" onClose={onClose} wide>
      {loading ? <Loading /> : error ? (
        <p role="alert">{error} <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => void reload()}>Réessayer</button></p>
      ) : data ? (
        <>
          <div className="iz-profile-hero">
            <ProfileAvatar photo={data.photoIdentite} name={`${data.prenom ?? ''} ${data.nom ?? ''}`} size="lg" />
            <div>
              <strong className="iz-profile-name">{data.prenom} {data.nom}</strong>
              <span className="iz-small iz-muted" style={{ display: 'block' }}>{data.email}</span>
              <span className={`iz-badge ${profileComplete(data) ? 'iz-badge-green' : 'iz-badge-amber'}`} style={{ marginTop: 6 }}>
                {profileComplete(data) ? 'Profil complet' : 'Profil incomplet'}
              </span>
            </div>
          </div>
          <div className="iz-detail-grid" style={{ marginTop: 18 }}>
            <div className="iz-detail-item"><span>Numéro de CIN</span><strong>{data.cin || '—'}</strong></div>
            <div className="iz-detail-item"><span>Fonction</span><strong>{data.fonction || '—'}</strong></div>
            <div className="iz-detail-item"><span>Numéro matricule</span><strong>{data.matricule || '—'}</strong></div>
            <div className="iz-detail-item"><span>Numéro téléphone</span><strong>{data.telephone || '—'}</strong></div>
          </div>
        </>
      ) : <Empty message="Profil introuvable." />}
    </Modal>
  )
}

export function AgentIdentityButton({
  id, name, onOpen,
}: { id?: number | string | null; name?: string | null; onOpen: (id: number) => void }) {
  const numberId = Number(id)
  if (!numberId) return <>{name || '—'}</>
  return (
    <button type="button" className="iz-link-button" onClick={() => onOpen(numberId)} title="Voir le profil de l’agent">
      {name || 'Agent'} <span aria-hidden="true">🔎</span>
    </button>
  )
}

export function AdminControllerProfiles() {
  const { data, loading, error, reload } = useAsync(() => izApi.adminUsers(), [])
  const [viewing, setViewing] = useState<number | null>(null)
  const controllers = (data ?? []).filter((account) => account.role === 'controleur')
  const complete = controllers.filter((account) => account.profilComplet).length
  return (
    <>
      <PageHead
        title="Profils des contrôleurs"
        subtitle="Identité transmise par les agents lors des scans, signalements et mises en fourrière."
      />
      <p className="iz-small iz-muted" style={{ marginBottom: 14 }}>
        {controllers.length} contrôleur(s) · {complete} profil(s) complet(s) · {controllers.length - complete} à compléter.
      </p>
      {error && <div className="iz-card" role="alert">{error} <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => void reload()}>Réessayer</button></div>}
      {loading ? <Loading /> : (
        <DataTable
          rows={controllers}
          rowKey={(account) => String(account.id)}
          searchText={(account) => [account.nom, account.prenom, account.email, account.telephone, account.cin, account.fonction, account.matricule].join(' ')}
          initialSort="nom"
          empty={<Empty message="Aucun contrôleur enregistré." />}
          columns={[
            { key: 'nom', label: 'Nom et prénom(s)', sortValue: (account) => `${account.nom ?? ''} ${account.prenom ?? ''}`, render: (account) => <><strong>{account.nom} {account.prenom}</strong></> },
            { key: 'cin', label: 'CIN', sortValue: (account) => String(account.cin ?? ''), render: (account) => <span className="iz-mono iz-small">{account.cin ?? '—'}</span> },
            { key: 'fonction', label: 'Fonction', sortValue: (account) => String(account.fonction ?? ''), render: (account) => <>{account.fonction ?? '—'}</> },
            { key: 'matricule', label: 'Matricule', sortValue: (account) => String(account.matricule ?? ''), render: (account) => <span className="iz-mono iz-small">{account.matricule ?? '—'}</span> },
            { key: 'telephone', label: 'Téléphone', sortValue: (account) => String(account.telephone ?? ''), render: (account) => <>{account.telephone ?? '—'}</> },
            { key: 'profilComplet', label: 'Profil', sortValue: (account) => (account.profilComplet ? 1 : 0), render: (account) => (
              <span className={`iz-badge ${account.profilComplet ? 'iz-badge-green' : 'iz-badge-amber'}`}>
                {account.profilComplet ? 'Complet' : 'À compléter'}
              </span>
            ) },
          ]}
          actions={(account) => (
            <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setViewing(Number(account.id))}>Voir le profil</button>
          )}
        />
      )}
      {viewing && <AgentProfileDialog id={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
