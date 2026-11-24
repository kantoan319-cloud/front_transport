import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { izApi } from './api'
import type { IZAgentProfile, IZRecord } from './api'
import {
  Alert, Empty, Field, Loading, Modal, PageHead, useApp, useAsync,
} from './components'
import { DataTable } from './DataTable'
import { translateError } from './i18n'
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
  const { t, lang } = useApp()
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
      setError(translateError(lang, cause, 'profile.photoUnreadable'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="iz-photo-field">
      {value
        ? <img className="iz-photo-preview" src={value} alt={t('profile.photoAlt')} />
        : (
          <span className="iz-photo-empty">
            {existing ? t('profile.photoSaved') : t('profile.noPhoto')}
          </span>
        )}
      <div className="iz-flex iz-wrap">
        <label className={`iz-btn iz-btn-outline iz-btn-sm${disabled || busy ? ' iz-disabled' : ''}`}>
          {busy ? t('profile.reading') : value || existing ? t('profile.changePhoto') : t('profile.addPhoto')}
          <input type="file" accept="image/*" hidden disabled={disabled || busy} onChange={(event) => void pick(event)} />
        </label>
        {value && (
          <button type="button" className="iz-btn iz-btn-ghost iz-btn-sm" disabled={disabled || busy} onClick={() => onChange(null)}>
            {t('common.remove')}
          </button>
        )}
      </div>
      {error && <span className="iz-small" role="alert">{error}</span>}
    </div>
  )
}

function ProfileAvatar({ photo, name, size }: { photo?: string | null; name?: string; size?: 'lg' }) {
  const { t } = useApp()
  return photo
    ? <img className={`iz-profile-avatar${size ? ` ${size}` : ''}`} src={photo} alt={t('profile.photoOf', { name: name || t('profile.agent') })} />
    : <span className={`iz-profile-avatar placeholder${size ? ` ${size}` : ''}`} aria-hidden="true">{(name || '?').slice(0, 1).toUpperCase()}</span>
}

export function ControllerProfilePage() {
  const { t, lang, user, refreshUser, notify } = useApp()
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
      notify(t('profile.saved'), 'success')
      await Promise.all([reload(), refreshUser()])
    } catch (cause) {
      notify(translateError(lang, cause, 'profile.saveFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
      />
      {loading ? <Loading /> : error ? (
        <div className="iz-card" role="alert">
          {error} <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => void reload()}>{t('common.retry')}</button>
        </div>
      ) : (
        <>
          {!complete && (
            <div style={{ marginBottom: 16 }}>
              <Alert type="error">
                {t('profile.incompleteAlert')}
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
                  {complete ? t('profile.complete') : t('profile.toComplete')}
                </span>
              </div>
            </div>
            <div className="iz-form-grid" style={{ marginTop: 18 }}>
              <Field label={t('profile.lastName')}>
                <input className="iz-input" value={data?.nom ?? user?.nom ?? ''} readOnly />
              </Field>
              <Field label={t('profile.firstName')}>
                <input className="iz-input" value={data?.prenom ?? user?.prenom ?? ''} readOnly />
              </Field>
              <Field label={t('profile.cin')}>
                <input className="iz-input" maxLength={40} value={form.cin} onChange={(event) => setForm({ ...form, cin: event.target.value })} />
              </Field>
              <Field label={t('profile.fonction')}>
                <input className="iz-input" maxLength={120} value={form.fonction} onChange={(event) => setForm({ ...form, fonction: event.target.value })} />
              </Field>
              <Field label={t('profile.matricule')}>
                <input className="iz-input" maxLength={60} value={form.matricule} onChange={(event) => setForm({ ...form, matricule: event.target.value })} />
              </Field>
              <Field label={t('profile.phone')}>
                <input className="iz-input" type="tel" maxLength={30} value={form.telephone} onChange={(event) => setForm({ ...form, telephone: event.target.value })} />
              </Field>
              <Field label={t('profile.photo')} full>
                <IdentityPhotoField value={form.photoIdentite} onChange={(photo) => setForm({ ...form, photoIdentite: photo })} disabled={busy} />
              </Field>
            </div>
            <div className="iz-flex iz-wrap" style={{ marginTop: 18 }}>
              <button className="iz-btn iz-btn-primary" disabled={busy} onClick={() => void save()}>
                {busy ? t('common.saving') : t('profile.save')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export function AgentProfileDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { t } = useApp()
  const { data, loading, error, reload } = useAsync(() => izApi.agentProfile(id), [id])
  return (
    <Modal title={t('profile.agentDialogTitle')} onClose={onClose} wide>
      {loading ? <Loading /> : error ? (
        <p role="alert">{error} <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => void reload()}>{t('common.retry')}</button></p>
      ) : data ? (
        <>
          <div className="iz-profile-hero">
            <ProfileAvatar photo={data.photoIdentite} name={`${data.prenom ?? ''} ${data.nom ?? ''}`} size="lg" />
            <div>
              <strong className="iz-profile-name">{data.prenom} {data.nom}</strong>
              <span className="iz-small iz-muted" style={{ display: 'block' }}>{data.email}</span>
              <span className={`iz-badge ${profileComplete(data) ? 'iz-badge-green' : 'iz-badge-amber'}`} style={{ marginTop: 6 }}>
                {profileComplete(data) ? t('profile.complete') : t('profile.incompleteBadge')}
              </span>
            </div>
          </div>
          <div className="iz-detail-grid" style={{ marginTop: 18 }}>
            <div className="iz-detail-item"><span>{t('profile.cinShort')}</span><strong>{data.cin || '—'}</strong></div>
            <div className="iz-detail-item"><span>{t('profile.fonctionShort')}</span><strong>{data.fonction || '—'}</strong></div>
            <div className="iz-detail-item"><span>{t('profile.matriculeShort')}</span><strong>{data.matricule || '—'}</strong></div>
            <div className="iz-detail-item"><span>{t('profile.phoneShort')}</span><strong>{data.telephone || '—'}</strong></div>
          </div>
        </>
      ) : <Empty message={t('profile.notFound')} />}
    </Modal>
  )
}

export function AgentIdentityButton({
  id, name, onOpen,
}: { id?: number | string | null; name?: string | null; onOpen: (id: number) => void }) {
  const { t } = useApp()
  const numberId = Number(id)
  if (!numberId) return <>{name || '—'}</>
  return (
    <button type="button" className="iz-link-button" onClick={() => onOpen(numberId)} title={t('profile.viewAgent')}>
      {name || t('profile.agent')} <span aria-hidden="true">🔎</span>
    </button>
  )
}

export function AdminControllerProfiles() {
  const { t } = useApp()
  const { data, loading, error, reload } = useAsync(() => izApi.adminUsers(), [])
  const [viewing, setViewing] = useState<number | null>(null)
  const controllers = (data ?? []).filter((account) => account.role === 'controleur')
  const complete = controllers.filter((account) => account.profilComplet).length
  return (
    <>
      <PageHead
        title={t('profile.adminTitle')}
        subtitle={t('profile.adminSubtitle')}
      />
      <p className="iz-small iz-muted" style={{ marginBottom: 14 }}>
        {t('profile.counts', { total: controllers.length, complete, todo: controllers.length - complete })}
      </p>
      {error && <div className="iz-card" role="alert">{error} <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => void reload()}>{t('common.retry')}</button></div>}
      {loading ? <Loading /> : (
        <DataTable
          rows={controllers}
          rowKey={(account) => String(account.id)}
          searchText={(account) => [account.nom, account.prenom, account.email, account.telephone, account.cin, account.fonction, account.matricule].join(' ')}
          initialSort="nom"
          empty={<Empty message={t('profile.emptyControllers')} />}
          columns={[
            { key: 'nom', label: t('profile.names'), sortValue: (account) => `${account.nom ?? ''} ${account.prenom ?? ''}`, render: (account) => <><strong>{account.nom} {account.prenom}</strong></> },
            { key: 'cin', label: t('profile.cinShort'), sortValue: (account) => String(account.cin ?? ''), render: (account) => <span className="iz-mono iz-small">{account.cin ?? '—'}</span> },
            { key: 'fonction', label: t('profile.fonctionShort'), sortValue: (account) => String(account.fonction ?? ''), render: (account) => <>{account.fonction ?? '—'}</> },
            { key: 'matricule', label: t('profile.matriculeShort'), sortValue: (account) => String(account.matricule ?? ''), render: (account) => <span className="iz-mono iz-small">{account.matricule ?? '—'}</span> },
            { key: 'telephone', label: t('profile.phoneShort'), sortValue: (account) => String(account.telephone ?? ''), render: (account) => <>{account.telephone ?? '—'}</> },
            { key: 'profilComplet', label: t('profile.profileColumn'), sortValue: (account) => (account.profilComplet ? 1 : 0), render: (account) => (
              <span className={`iz-badge ${account.profilComplet ? 'iz-badge-green' : 'iz-badge-amber'}`}>
                {account.profilComplet ? t('profile.completeShort') : t('profile.todoShort')}
              </span>
            ) },
          ]}
          actions={(account) => (
            <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => setViewing(Number(account.id))}>{t('profile.viewProfile')}</button>
          )}
        />
      )}
      {viewing && <AgentProfileDialog id={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
