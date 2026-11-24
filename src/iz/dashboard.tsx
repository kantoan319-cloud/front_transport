import { useState } from 'react'
import type { ReactNode } from 'react'
import { useApp } from './components'

export interface DashLink {
  path: string
  label: string
  icon?: string
  badge?: boolean
}

function sansAccents(valeur: string) {
  return valeur.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function DashboardShell({
  title, links, children,
}: { title: string; links: DashLink[]; children: ReactNode }) {
  const { route, navigate, unreadNotifications } = useApp()
  const [recherche, setRecherche] = useState('')
  const terme = sansAccents(recherche.trim())
  const visibles = terme
    ? links.filter((link) => sansAccents(`${link.label} ${link.path}`).includes(terme))
    : links
  return (
    <div className="iz-dashboard">
      <aside className="iz-sidebar">
        <div className="iz-sidebar-title">{title}</div>
        <input
          className="iz-input iz-sidebar-search"
          type="search"
          value={recherche}
          onChange={(event) => setRecherche(event.target.value)}
          placeholder="Rechercher un paramètre…"
          aria-label="Rechercher un paramètre"
        />
        {visibles.map((link) => (
          <a
            key={link.path}
            href={`#${link.path}`}
            className={route === link.path ? 'active' : ''}
            onClick={(event) => { event.preventDefault(); navigate(link.path) }}
          >
            {link.icon && <span>{link.icon}</span>}
            {link.label}
            {link.badge && unreadNotifications > 0 && (
              <span className="iz-side-badge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>
            )}
          </a>
        ))}
        {!visibles.length && (
          <div className="iz-small iz-muted iz-sidebar-empty">Aucun résultat.</div>
        )}
      </aside>
      <div className="iz-dashboard-main">{children}</div>
    </div>
  )
}
