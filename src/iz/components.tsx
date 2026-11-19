import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
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
  t: (key: string, variables?: Record<string, string | number>) => string
  user: IZUser | null
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

function currentRoute(): string {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return '/'
  return hash.startsWith('/') ? hash : `/${hash}`
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('izotra-lang')
    return saved === 'mg' ? 'mg' : 'fr'
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme)
  const [user, setUser] = useState<IZUser | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [route, setRoute] = useState(currentRoute)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('izotra-theme', theme)
  }, [theme])
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
    izApi.me().then(setUser).catch(() => setUser(null))
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const setLang = useCallback((value: Lang) => setLangState(value), [])
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
      lang, setLang, theme, toggleTheme, t, user, setUser, refreshUser,
      toast, notify, route, navigate,
    }),
    [lang, setLang, theme, toggleTheme, t, user, refreshUser, toast, notify, route, navigate],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

const publicLinks = [
  { path: '/', key: 'nav.home' },
  { path: '/recherche', key: 'nav.search' },
  { path: '/signaler', key: 'nav.signal' },
  { path: '/suivi', key: 'nav.track' },
  { path: '/carte', key: 'nav.map' },
  { path: '/cooperatives', key: 'nav.coops' },
  { path: '/parkings', key: 'nav.parkings' },
]

export function Header() {
  const { t, theme, toggleTheme, lang, setLang, user, navigate, route } = useApp()
  const isDashboard = route.startsWith('/controle') || route.startsWith('/admin')
  const links = isDashboard
    ? [
        { path: user?.role === 'admin' ? '/admin' : '/controle', key: user?.role === 'admin' ? 'nav.admin' : 'nav.control' },
        ...publicLinks.slice(1, 4),
      ]
    : publicLinks

  return (
    <header className="iz-header">
      <div className="iz-container-wide iz-header-inner">
        <button className="iz-brand iz-btn-ghost" style={{ padding: 0, border: 0 }} onClick={() => navigate('/')}>
          <span className="iz-brand-mark">iZ</span>
          <span>
            iZOTRA
            <small>{t('app.tagline')}</small>
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
          {user ? (
            <>
              <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => navigate(user.role === 'admin' ? '/admin' : '/controle')}>
                {user.role === 'admin' ? t('nav.admin') : t('nav.control')}
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
  if (/valide|conforme|ouvert|payé|validé|acceptée|traitée/i.test(value)) className += ' iz-badge-green'
  else if (/expiré|suspendu|rejetée|非 conforme|non conforme|clôturée/i.test(value)) className += ' iz-badge-red'
  else if (/attente|nouveau|en cours|brouillon/i.test(value)) className += ' iz-badge-amber'
  else if (/enregistrée/i.test(value)) className += ' iz-badge-blue'
  return <span className={className}><span className="iz-dot" />{value}</span>
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`iz-field${full ? ' full' : ''}`}>
      <span className="iz-label">{label}</span>
      {children}
    </label>
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
      <div className={`iz-modal${wide ? ' iz-modal-wide' : ''}`} onMouseDown={(event) => event.stopPropagation()}>
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
        <strong>iZOTRA</strong>
        <span className="iz-spacer" />
        <span>© {new Date().getFullYear()} — Mobilité urbaine</span>
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

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await loader())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload, setData }
}
