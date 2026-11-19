import type { ReactNode } from 'react'
import { useApp } from './components'

export interface DashLink {
  path: string
  label: string
  icon?: string
}

export function DashboardShell({
  title, links, children,
}: { title: string; links: DashLink[]; children: ReactNode }) {
  const { route, navigate } = useApp()
  return (
    <div className="iz-dashboard">
      <aside className="iz-sidebar">
        <div className="iz-sidebar-title">{title}</div>
        {links.map((link) => (
          <a
            key={link.path}
            href={`#${link.path}`}
            className={route === link.path ? 'active' : ''}
            onClick={(event) => { event.preventDefault(); navigate(link.path) }}
          >
            {link.icon && <span>{link.icon}</span>}
            {link.label}
          </a>
        ))}
      </aside>
      <div className="iz-dashboard-main">{children}</div>
    </div>
  )
}
