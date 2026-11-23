import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react'
import { translate } from './i18n'
import type { Lang } from './i18n'
import type { IZUser } from './api'
import { izApi } from './api'

type Toast = { message: string; type: 'success' | 'error' | 'info' } | null

interface AppContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
  fontScale: number
  setFontScale: (scale: number) => void
  t: (key: string, variables?: Record<string, string | number>) => string
  user: IZUser | null
  userLoading: boolean
  setUser: (user: IZUser | null) => void
  refreshUser: () => Promise<void>
  toast: Toast
  notify: (message: string, type?: 'success' | 'error' | 'info') => void
  route: string
  navigate: (route: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp doit être utilisé dans AppProvider')
  return context
}

function initialTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem('izotra-theme')
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function initialFontScale(): number {
  const saved = Number(localStorage.getItem('izotra-font-scale'))
  return saved >= 0.9 && saved <= 1.4 ? saved : 1
}

function currentRoute(): string {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) {
    const plate = new URLSearchParams(window.location.search).get('m')
    return plate ? `/bus?${new URLSearchParams({ plaque: plate })}` : '/'
  }
  return hash.startsWith('/') ? hash : `/${hash}`
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('izotra-lang')
    return saved === 'mg' ? 'mg' : 'fr'
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme)
  const [fontScale, setFontScaleState] = useState(initialFontScale)
  const [user, setUser] = useState<IZUser | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [toast, setToast] = useState<Toast>(null)
  const [route, setRoute] = useState(currentRoute)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('izotra-theme', theme)
  }, [theme])
  useEffect(() => {
    // Échelle typographique globale : toutes les tailles en rem suivent.
    document.documentElement.style.fontSize = `${16 * fontScale}px`
    localStorage.setItem('izotra-font-scale', String(fontScale))
  }, [fontScale])
  useEffect(() => {
    localStorage.setItem('izotra-lang', lang)
    document.documentElement.lang = lang
  }, [lang])
  useEffect(() => {
    const onHash = () => setRoute(currentRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    izApi.me().then(setUser).catch(() => setUser(null)).finally(() => setUserLoading(false))
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const setLang = useCallback((value: Lang) => setLangState(value), [])
  const setFontScale = useCallback((value: number) => {
    setFontScaleState(Math.min(1.4, Math.max(0.9, value)))
  }, [])
  const toggleTheme = useCallback(
    () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')),
    [],
  )
  const t = useCallback(
    (key: string, variables?: Record<string, string | number>) => translate(lang, key, variables),
    [lang],
  )
  const notify = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => setToast({ message, type }),
    [],
  )
  const refreshUser = useCallback(async () => {
    try {
      setUser(await izApi.me())
    } catch {
      setUser(null)
    }
  }, [])
  const navigate = useCallback((path: string) => {
    window.location.hash = path.startsWith('/') ? path : `/${path}`
    setRoute(path.startsWith('/') ? path : `/${path}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      lang, setLang, theme, toggleTheme, fontScale, setFontScale, t, user, userLoading,
      setUser, refreshUser, toast, notify, route, navigate,
    }),
    [
      lang, setLang, theme, toggleTheme, fontScale, setFontScale, t, user, userLoading,
      refreshUser, toast, notify, route, navigate,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

const publicLinks = [
  { path: '/', key: 'nav.home' },
  { path: '/scan', key: 'nav.scan' },
  { path: '/signaler', key: 'nav.signal' },
  { path: '/suivi', key: 'nav.track' },
  { path: '/carte', key: 'nav.map' },
  { path: '/cooperatives', key: 'nav.coops' },
]

export function Header() {
  const { t, theme, toggleTheme, lang, setLang, user, navigate, route } = useApp()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [fontOpen, setFontOpen] = useState(false)
  const isDashboard = route.startsWith('/controle') || route.startsWith('/admin')
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  // Application Android : scan et signalement pour tous, suivi pour les agents connectés.
  const appMode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('app') === '1'
  const baseLinks = appMode
    ? publicLinks.filter((link) => ['/', '/scan', '/signaler', '/suivi'].includes(link.path))
    : publicLinks
  const links = isDashboard
    ? [
        publicLinks[0],
        { path: isAdmin ? '/admin' : '/controle', key: isAdmin ? 'nav.admin' : 'nav.control' },
        ...publicLinks.slice(1, 4),
      ]
    : user ? baseLinks : baseLinks.filter((link) => !['/cooperatives', '/suivi'].includes(link.path))

  return (
    <>
    <header className="iz-header">
      <div className="iz-container-wide iz-header-inner">
        <button className="iz-brand iz-btn-ghost" style={{ padding: 0, border: 0 }} onClick={() => navigate('/')}>
          <img className="iz-brand-logo" src="/brand/logo-bus.png" alt="Logo bus" />
          <span>
            Gestion de Bus
            <small>CU/ABE · Commune Urbaine d’Antsirabe</small>
          </span>
        </button>
        <nav className="iz-nav">
          {links.map((link) => (
            <a
              key={link.path}
              href={`#${link.path}`}
              className={route === link.path ? 'active' : ''}
              onClick={(event) => {
                event.preventDefault()
                navigate(link.path)
              }}
            >
              {link.path === '/scan' ? 'Scanner un bus' : t(link.key)}
            </a>
          ))}
        </nav>
        <div className="iz-header-actions">
          <button
            className="iz-icon-btn"
            title={t('nav.language')}
            onClick={() => setLang(lang === 'fr' ? 'mg' : 'fr')}
          >
            {lang === 'fr' ? 'FR' : 'MG'}
          </button>
          <button className="iz-icon-btn" title={t('nav.theme')} onClick={toggleTheme}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            className="iz-icon-btn"
            title="Taille du texte"
            aria-label="Modifier la taille du texte"
            onClick={() => setFontOpen(true)}
          >
            Aa
          </button>
          {user ? (
            <>
              <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => navigate(isAdmin ? '/admin' : '/controle')}>
                {isAdmin ? t('nav.admin') : t('nav.control')}
              </button>
              <button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => setPasswordOpen(true)}>
                {user.role === 'superadmin' ? 'Mon compte' : 'Mot de passe'}
              </button>
              <button
                className="iz-btn iz-btn-ghost iz-btn-sm"
                onClick={async () => {
                  await izApi.logout().catch(() => undefined)
                  window.location.reload()
                }}
              >
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => navigate('/connexion')}>
              {t('nav.login')}
            </button>
          )}
        </div>
      </div>
    </header>
    {/* Hors du <header> : son backdrop-filter capturerait le fixed de l'overlay. */}
    {passwordOpen && <PasswordDialog onClose={() => setPasswordOpen(false)} />}
    {fontOpen && <FontSizeDialog onClose={() => setFontOpen(false)} />}
    </>
  )
}

const FONT_SCALES = [
  { value: 0.9, label: 'Petit', sample: 'Aa' },
  { value: 1, label: 'Normal', sample: 'Aa' },
  { value: 1.15, label: 'Grand', sample: 'Aa' },
  { value: 1.3, label: 'Très grand', sample: 'Aa' },
]

function FontSizeDialog({ onClose }: { onClose: () => void }) {
  const { fontScale, setFontScale } = useApp()
  return (
    <Modal title="Taille du texte" onClose={onClose}>
      <p className="iz-muted" style={{ marginBottom: 14 }}>
        Choisissez la taille de police de l’application. Le réglage est conservé sur cet appareil.
      </p>
      <div className="iz-font-options">
        {FONT_SCALES.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`iz-font-option${fontScale === option.value ? ' active' : ''}`}
            onClick={() => setFontScale(option.value)}
          >
            <span style={{ fontSize: `${option.value}em` }}>{option.sample}</span>
            <small>{option.label}</small>
          </button>
        ))}
      </div>
      <div className="iz-flex" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
        <button className="iz-btn iz-btn-primary" onClick={onClose}>Terminé</button>
      </div>
    </Modal>
  )
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const { notify, user, refreshUser } = useApp()
  const canChangeEmail = user?.role === 'superadmin'
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const emailChanged = canChangeEmail && Boolean(user) && email.trim().toLowerCase() !== user.email.toLowerCase()
    const passwordFilled = Boolean(currentPassword || newPassword || confirmation)
    if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      notify('Adresse e-mail invalide.', 'error')
      return
    }
    if (passwordFilled) {
      if (!currentPassword || !newPassword || !confirmation) {
        notify('Complétez tous les champs du mot de passe pour le modifier.', 'error')
        return
      }
      if (newPassword !== confirmation) {
        notify('La confirmation ne correspond pas au nouveau mot de passe.', 'error')
        return
      }
    }
    if (!emailChanged && !passwordFilled) {
      notify('Aucune modification à enregistrer.', 'info')
      return
    }
    setBusy(true)
    try {
      if (emailChanged) {
        await izApi.changeEmail(email.trim())
        await refreshUser()
      }
      if (passwordFilled) {
        const result = await izApi.changePassword(currentPassword, newPassword)
        notify(result.message, 'success')
      } else {
        notify('Adresse e-mail mise à jour.', 'success')
      }
      onClose()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Modification impossible.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={canChangeEmail ? 'Mon compte' : 'Modifier mon mot de passe'}
      onClose={() => { if (!busy) onClose() }}
      footer={<>
        <button className="iz-btn iz-btn-outline" disabled={busy} onClick={onClose}>Annuler</button>
        <button className="iz-btn iz-btn-primary" disabled={busy} onClick={() => formRef.current?.requestSubmit()}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </>}
    >
      <form ref={formRef} className="iz-form-grid" onSubmit={submit} aria-busy={busy}>
        {canChangeEmail && (
          <Field label="Mon adresse e-mail" full>
            <input className="iz-input" type="email" required maxLength={190} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
        )}
        <Field label={canChangeEmail ? 'Mot de passe actuel (facultatif)' : 'Mot de passe actuel'} full>
          <PasswordInput required={!canChangeEmail} autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
        </Field>
        <Field label={canChangeEmail ? 'Nouveau mot de passe (facultatif, 8 caractères minimum)' : 'Nouveau mot de passe (8 caractères minimum, lettres et chiffres)'} full>
          <PasswordInput required={!canChangeEmail} minLength={8} maxLength={100} autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
        </Field>
        <Field label="Confirmer le nouveau mot de passe" full>
          <PasswordInput required={!canChangeEmail} minLength={8} maxLength={100} autoComplete="new-password" value={confirmation} onChange={setConfirmation} />
        </Field>
        {canChangeEmail && (
          <p className="iz-small iz-muted full" style={{ margin: 0 }}>
            Laissez les champs du mot de passe vides pour modifier uniquement l’adresse e-mail.
          </p>
        )}
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Shared UI                                                           */
/* ------------------------------------------------------------------ */

export function PageHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="iz-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ value, label, icon }: { value: ReactNode; label: string; icon?: string }) {
  return (
    <div className="iz-card iz-stat iz-card-hover">
      {icon && <div className="iz-stat-icon">{icon}</div>}
      <div className="iz-stat-value">{value}</div>
      <div className="iz-stat-label">{label}</div>
    </div>
  )
}

/** Position actuelle du visiteur, ou null si refusée/indisponible. */
export function geolocate(timeout = 8000): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: { latitude: number; longitude: number } | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), timeout)
    navigator.geolocation.getCurrentPosition(
      (result) => finish({ latitude: result.coords.latitude, longitude: result.coords.longitude }),
      () => finish(null),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 },
    )
  })
}

export function Loading() {
  const { t } = useApp()
  return <div className="iz-loading"><span className="iz-spinner" />{t('common.loading')}</div>
}

export function Empty({ message }: { message?: string }) {
  const { t } = useApp()
  return (
    <div className="iz-empty">
      <div className="iz-empty-icon">◇</div>
      {message ?? t('common.empty')}
    </div>
  )
}

export function Alert({ type = 'info', children }: { type?: 'success' | 'error' | 'info'; children: ReactNode }) {
  return <div className={`iz-alert iz-alert-${type}`}>{children}</div>
}

export function StatusBadge({ status }: { status?: string | null }) {
  const value = status ?? '—'
  let className = 'iz-badge'
  if (/expiré|suspendu|fourrière|rejetée|non conforme|non encore valide|clôturée/i.test(value)) className += ' iz-badge-red'
  else if (/attente|nouveau|en cours|brouillon|à venir|non renseign/i.test(value)) className += ' iz-badge-amber'
  else if (/valide|conforme|normal|ouvert|payé|validé|acceptée|traitée/i.test(value)) className += ' iz-badge-green'
  else if (/enregistrée/i.test(value)) className += ' iz-badge-blue'
  return <span className={className}><span className="iz-dot" />{value}</span>
}

export function ExportButton({ cible, label = 'Excel' }: { cible: string; label?: string }) {
  const { notify } = useApp()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      className="iz-btn iz-btn-outline iz-btn-sm"
      disabled={busy}
      title={`Télécharger ${cible} au format Excel`}
      onClick={async () => {
        setBusy(true)
        try {
          await izApi.exportXlsx(cible)
          notify('Export Excel téléchargé.', 'success')
        } catch (error) {
          notify(error instanceof Error ? error.message : 'Export impossible.', 'error')
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? 'Export…' : `⬇ ${label}`}
    </button>
  )
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {  return (
    <label className={`iz-field${full ? ' full' : ''}`}>
      <span className="iz-label">{label}</span>
      {children}
    </label>
  )
}

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

/** Champ mot de passe avec bouton « voir le mot de passe ». */
export function PasswordInput({ value, onChange, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const label = visible ? 'Masquer le mot de passe' : 'Voir le mot de passe'
  return (
    <span className="iz-password">
      <input
        {...props}
        className={`iz-input${className ? ` ${className}` : ''}`}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="iz-password-toggle"
        aria-label={label}
        title={label}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? '🙈' : '👁'}
      </button>
    </span>
  )
}

export function Modal({
  title, onClose, children, footer, wide,
}: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const { t } = useApp()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="iz-overlay" onMouseDown={onClose}>
      <div className={`iz-modal${wide ? ' iz-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="iz-modal-head">
          <h3>{title}</h3>
          <button className="iz-icon-btn" onClick={onClose} title={t('common.close')}>×</button>
        </div>
        <div className="iz-modal-body">{children}</div>
        {footer && <div className="iz-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  message, onConfirm, onCancel,
}: { message: string; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useApp()
  return (
    <Modal
      title={t('common.confirmDelete')}
      onClose={onCancel}
      footer={
        <>
          <button className="iz-btn iz-btn-outline" onClick={onCancel}>{t('common.cancel')}</button>
          <button className="iz-btn iz-btn-danger" onClick={onConfirm}>{t('common.delete')}</button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  )
}

export function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  return <div className={`iz-toast ${toast.type}`}>{toast.message}</div>
}

export function Footer() {
  return (
    <footer className="iz-footer">
      <div className="iz-container iz-flex iz-wrap">
        <img className="iz-footer-logo" src="/brand/logo-commune.png" alt="Armoiries de la commune urbaine d’Antsirabe" />
        <strong>Gestion de Bus CU/ABE</strong>
        <span className="iz-spacer" />
        <span>© {new Date().getFullYear()} — Commune Urbaine d’Antsirabe</span>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/* Data hook                                                           */
/* ------------------------------------------------------------------ */

export function useAsync<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)

  const reload = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true)
    setError(null)
    try {
      const result = await loader()
      if (request === sequence.current) setData(result)
    } catch (err) {
      if (request === sequence.current) setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (request === sequence.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  useEffect(() => {
    void reload()
    return () => { sequence.current += 1 }
  }, [reload])

  return { data, loading, error, reload, setData }
}
