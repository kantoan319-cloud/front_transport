import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useApp } from './components'

export interface DashLink {
  path: string
  label: string
  icon?: ReactNode
  badge?: boolean
}

function sansAccents(valeur: string) {
  return valeur.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function DashboardShell({
  title, links, children,
}: { title: string; links: DashLink[]; children: ReactNode }) {
  const { t, route, navigate, unreadNotifications } = useApp()
  const [recherche, setRecherche] = useState('')
  /* Sur telephone et dans l'APK, le menu du tableau de bord est replie par
     defaut : il ne prend la place de la page que lorsqu'on l'ouvre. */
  const [menuOuvert, setMenuOuvert] = useState(false)
  const terme = sansAccents(recherche.trim())
  const visibles = terme
    ? links.filter((link) => sansAccents(`${link.label} ${link.path}`).includes(terme))
    : links
  return (
    <div className="iz-dashboard">
      <button
        type="button"
        className="iz-menu-toggle"
        aria-expanded={menuOuvert}
        onClick={() => setMenuOuvert((ouvert) => !ouvert)}
      >
        <span>{t('sidebar.menu')} — {title}</span>
        {menuOuvert ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      <aside className={menuOuvert ? 'iz-sidebar open' : 'iz-sidebar'}>
        <div className="iz-sidebar-title">{title}</div>
        <input
          className="iz-input iz-sidebar-search"
          type="search"
          value={recherche}
          onChange={(event) => setRecherche(event.target.value)}
          placeholder={t('sidebar.search')}
          aria-label={t('sidebar.searchLabel')}
        />
        {visibles.map((link) => (
          <a
            key={link.path}
            href={`#${link.path}`}
            className={route === link.path ? 'active' : ''}
            onClick={(event) => { event.preventDefault(); navigate(link.path); setMenuOuvert(false) }}
          >
            {link.icon && <span className="iz-side-icon">{link.icon}</span>}
            {link.label}
            {link.badge && unreadNotifications > 0 && (
              <span className="iz-side-badge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>
            )}
          </a>
        ))}
        {!visibles.length && (
          <div className="iz-small iz-muted iz-sidebar-empty">{t('sidebar.empty')}</div>
        )}
      </aside>
      <div className="iz-dashboard-main">{children}</div>
    </div>
  )
}
