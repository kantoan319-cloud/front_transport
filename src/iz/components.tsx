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
import { translate, translateError, translateValue } from './i18n'
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
  unreadNotifications: number
  refreshUnread: () => Promise<void>
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
  const [unreadNotifications, setUnreadNotifications] = useState(0)

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
    document.title = translate(lang, 'app.title')
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
  const refreshUnread = useCallback(async () => {
    try {
      const result = await izApi.notifications('non-lu', 1)
      setUnreadNotifications(Number(result.nonLues ?? 0))
    } catch {
      /* compteur best-effort */
    }
  }, [])
  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0)
      return
    }
    void refreshUnread()
    const timer = window.setInterval(() => { void refreshUnread() }, 60_000)
    return () => window.clearInterval(timer)
  }, [user, refreshUnread])
  const navigate = useCallback((path: string) => {
    window.location.hash = path.startsWith('/') ? path : `/${path}`
    setRoute(path.startsWith('/') ? path : `/${path}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      lang, setLang, theme, toggleTheme, fontScale, setFontScale, t, user, userLoading,
      setUser, refreshUser, toast, notify, route, navigate, unreadNotifications, refreshUnread,
    }),
    [
      lang, setLang, theme, toggleTheme, fontScale, setFontScale, t, user, userLoading,
      refreshUser, toast, notify, route, navigate, unreadNotifications, refreshUnread,
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
          <img className="iz-brand-logo" src="/brand/logo-bus.png" alt={t('auth.logoAlt')} />
          <span>
            {t('nav.brand')}
            <small>{t('nav.brandSub')}</small>
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
              {t(link.key)}
            </a>
          ))}
        </nav>
        <div className="iz-header-actions">
          {user && <NotificationsBell />}
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
            title={t('nav.fontSize')}
            aria-label={t('nav.fontAria')}
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
                {user.role === 'superadmin' ? t('nav.account') : t('nav.password')}
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

/** Cloche avec compteur des notifications non lues. */
export function NotificationsBell() {
  const { t, navigate, unreadNotifications } = useApp()
  return (
    <button
      type="button"
      className="iz-icon-btn iz-bell"
      title={t('nav.notifications')}
      aria-label={t('nav.notifications')}
      onClick={() => navigate('/notifications')}
    >
      <span aria-hidden="true">🔔</span>
      {unreadNotifications > 0 && (
        <span className="iz-bell-badge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>
      )}
    </button>
  )
}

const FONT_SCALES = [
  { value: 0.9, key: 'font.small', sample: 'Aa' },
  { value: 1, key: 'font.normal', sample: 'Aa' },
  { value: 1.15, key: 'font.large', sample: 'Aa' },
  { value: 1.3, key: 'font.xlarge', sample: 'Aa' },
]

function FontSizeDialog({ onClose }: { onClose: () => void }) {
  const { t, fontScale, setFontScale } = useApp()
  return (
    <Modal title={t('font.title')} onClose={onClose}>
      <p className="iz-muted" style={{ marginBottom: 14 }}>
        {t('font.help')}
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
            <small>{t(option.key)}</small>
          </button>
        ))}
      </div>
      <div className="iz-flex" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
        <button className="iz-btn iz-btn-primary" onClick={onClose}>{t('font.done')}</button>
      </div>
    </Modal>
  )
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const { t, lang, notify, user, refreshUser } = useApp()
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
      notify(t('password.invalidEmail'), 'error')
      return
    }
    if (passwordFilled) {
      if (!currentPassword || !newPassword || !confirmation) {
        notify(t('password.fillAll'), 'error')
        return
      }
      if (newPassword !== confirmation) {
        notify(t('password.mismatch'), 'error')
        return
      }
    }
    if (!emailChanged && !passwordFilled) {
      notify(t('password.noChange'), 'info')
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
        notify(translate(lang, result.message), 'success')
      } else {
        notify(t('password.emailUpdated'), 'success')
      }
      onClose()
    } catch (error) {
      notify(translateError(lang, error, 'password.updateFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={canChangeEmail ? t('password.titleAccount') : t('password.titleChange')}
      onClose={() => { if (!busy) onClose() }}
      footer={<>
        <button className="iz-btn iz-btn-outline" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
        <button className="iz-btn iz-btn-primary" disabled={busy} onClick={() => formRef.current?.requestSubmit()}>{busy ? t('common.saving') : t('common.save')}</button>
      </>}
    >
      <form ref={formRef} className="iz-form-grid" onSubmit={submit} aria-busy={busy}>
        {canChangeEmail && (
          <Field label={t('password.emailLabel')} full>
            <input className="iz-input" type="email" required maxLength={190} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
        )}
        <Field label={canChangeEmail ? t('password.currentOptional') : t('password.current')} full>
          <PasswordInput required={!canChangeEmail} autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
        </Field>
        <Field label={canChangeEmail ? t('password.newOptional') : t('password.new')} full>
          <PasswordInput required={!canChangeEmail} minLength={8} maxLength={100} autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
        </Field>
        <Field label={t('password.confirm')} full>
          <PasswordInput required={!canChangeEmail} minLength={8} maxLength={100} autoComplete="new-password" value={confirmation} onChange={setConfirmation} />
        </Field>
        {canChangeEmail && (
          <p className="iz-small iz-muted full" style={{ margin: 0 }}>
            {t('password.hint')}
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
  const { lang } = useApp()
  const value = status ?? '—'
  let className = 'iz-badge'
  if (/expiré|suspendu|fourrière|rejetée|non conforme|non encore valide|clôturée/i.test(value)) className += ' iz-badge-red'
  else if (/attente|nouveau|en cours|brouillon|à venir|non renseign/i.test(value)) className += ' iz-badge-amber'
  else if (/valide|conforme|normal|ouvert|payé|validé|acceptée|traitée/i.test(value)) className += ' iz-badge-green'
  else if (/enregistrée/i.test(value)) className += ' iz-badge-blue'
  return <span className={className}><span className="iz-dot" />{translateValue(lang, value)}</span>
}

export function ExportButton({ cible, label = 'Excel' }: { cible: string; label?: string }) {
  const { t, lang, notify } = useApp()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      className="iz-btn iz-btn-outline iz-btn-sm"
      disabled={busy}
      title={t('export.download', { cible })}
      onClick={async () => {
        setBusy(true)
        try {
          await izApi.exportXlsx(cible)
          notify(t('export.done'), 'success')
        } catch (error) {
          notify(translateError(lang, error, 'export.failed'), 'error')
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? t('export.busy') : `⬇ ${label}`}
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
  const { t } = useApp()
  const [visible, setVisible] = useState(false)
  const label = visible ? t('password.hide') : t('password.show')
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
  const { t } = useApp()
  return (
    <footer className="iz-footer">
      <div className="iz-container iz-flex iz-wrap">
        <img className="iz-footer-logo" src="/brand/logo-commune.png" alt={t('footer.logoAlt')} />
        <strong>{t('nav.brand')} CU/ABE</strong>
        <span className="iz-spacer" />
        <span>© {new Date().getFullYear()} — {t('footer.city')}</span>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/* Data hook                                                           */
/* ------------------------------------------------------------------ */

export function useAsync<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const { lang } = useApp()
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
      if (request === sequence.current) setError(translateError(lang, err, 'common.error'))
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
