import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useApp } from './components'

export interface DataColumn<T> {
  key?: string
  label: string
  sortValue?: (row: T) => string | number | null | undefined
  render: (row: T) => ReactNode
}

export interface TableSelection<T> {
  isSelected: (row: T) => boolean
  toggle: (row: T) => void
  toggleAll: (rows: T[]) => void
  allSelected: boolean
  label?: (count: number) => string
}

interface DataTableProps<T> {
  rows: T[]
  columns: DataColumn<T>[]
  rowKey: (row: T) => string | number
  rowLabel?: (row: T) => string
  searchText?: (row: T) => string
  searchPlaceholder?: string
  actions?: (row: T) => ReactNode
  selection?: TableSelection<T>
  toolbar?: ReactNode
  pageSize?: number
  initialSort?: string
  empty?: ReactNode
  busy?: boolean
  showSearch?: boolean
}

const PAGE_SIZE = 60

function fallbackText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value)
}

function compareValues(a: unknown, b: unknown): number {
  const left = a == null ? '' : a
  const right = b == null ? '' : b
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right), 'fr', { numeric: true, sensitivity: 'base' })
}

/**
 * Liste de donnees commune : recherche, tri, bascule liste/mosaique,
 * pagination par 60 et selection facultative.
 */
export function DataTable<T>({
  rows, columns, rowKey, rowLabel, searchText, searchPlaceholder, actions, selection,
  toolbar, pageSize = PAGE_SIZE, initialSort = '', empty, busy, showSearch = true,
}: DataTableProps<T>) {
  const { t } = useApp()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(initialSort)
  const [ascending, setAscending] = useState(true)
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [page, setPage] = useState(1)

  const sortable = columns.filter((column) => column.sortValue)
  const sortColumn = sortable.find((column) => (column.key ?? column.label) === sort)

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    const list = needle
      ? rows.filter((row) => {
          const text = searchText
            ? searchText(row)
            : Object.values(row as Record<string, unknown>).map(fallbackText).join(' ')
          return text.toLocaleLowerCase().includes(needle)
        })
      : rows
    if (!sortColumn?.sortValue) return list
    const direction = ascending ? 1 : -1
    return [...list].sort((a, b) => direction * compareValues(sortColumn.sortValue!(a), sortColumn.sortValue!(b)))
  }, [rows, query, sortColumn, ascending, searchText])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages)
  const start = (current - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)

  useEffect(() => { setPage(1) }, [query, sort, ascending, rows])

  const pageRowsSelectable = selection && visible.length > 0

  return (
    <>
      <div className="iz-list-tools">
        {showSearch && (
          <input
            className="iz-input iz-list-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder ?? t('common.search')}
            aria-label={t('common.search')}
          />
        )}
        {sortable.length > 0 && (
          <div className="iz-flex iz-list-sort">
            <select className="iz-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Trier par">
              <option value="">{t('common.sort')}</option>
              {sortable.map((column) => (
                <option key={column.key ?? column.label} value={column.key ?? column.label}>{column.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="iz-btn iz-btn-outline iz-btn-sm"
              disabled={!sort}
              onClick={() => setAscending((value) => !value)}
              aria-label={ascending ? 'Tri croissant' : 'Tri décroissant'}
              title={ascending ? 'Croissant' : 'Décroissant'}
            >
              {ascending ? '↑' : '↓'}
            </button>
          </div>
        )}
        <div className="iz-view-toggle" role="group" aria-label="Affichage">
          <button type="button" className={`iz-btn iz-btn-sm ${view === 'list' ? 'iz-btn-primary' : 'iz-btn-outline'}`} onClick={() => setView('list')} aria-pressed={view === 'list'}>Liste</button>
          <button type="button" className={`iz-btn iz-btn-sm ${view === 'grid' ? 'iz-btn-primary' : 'iz-btn-outline'}`} onClick={() => setView('grid')} aria-pressed={view === 'grid'}>Mosaïque</button>
        </div>
        {toolbar}
      </div>

      {!filtered.length ? (empty ?? <div className="iz-list-empty">{query ? 'Aucun résultat pour cette recherche.' : t('common.noData')}</div>) : view === 'list' ? (
        <div className="iz-table-wrap" aria-busy={busy}>
          <table className="iz-table">
            <thead>
              <tr>
                {selection && (
                  <th className="iz-select-cell">
                    <input
                      type="checkbox"
                      checked={selection.allSelected}
                      disabled={!pageRowsSelectable}
                      onChange={() => selection.toggleAll(visible)}
                      aria-label="Tout sélectionner sur la page"
                    />
                  </th>
                )}
                {columns.map((column) => <th key={column.key ?? column.label}>{column.label}</th>)}
                {actions && <th>{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const key = rowKey(row)
                return (
                  <tr key={key} className={selection?.isSelected(row) ? 'iz-row-selected' : undefined}>
                    {selection && (
                      <td className="iz-select-cell">
                        <input
                          type="checkbox"
                          checked={selection.isSelected(row)}
                          onChange={() => selection.toggle(row)}
                          aria-label={`Sélectionner ${rowLabel?.(row) ?? key}`}
                        />
                      </td>
                    )}
                    {columns.map((column) => <td key={column.key ?? column.label}>{column.render(row)}</td>)}
                    {actions && <td className="iz-nowrap">{actions(row)}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="iz-mosaic" aria-busy={busy}>
          {visible.map((row) => {
            const key = rowKey(row)
            return (
              <article key={key} className={`iz-mosaic-card ${selection?.isSelected(row) ? 'iz-row-selected' : ''}`}>
                {selection && (
                  <label className="iz-mosaic-select">
                    <input type="checkbox" checked={selection.isSelected(row)} onChange={() => selection.toggle(row)} aria-label={`Sélectionner ${rowLabel?.(row) ?? key}`} />
                    Sélectionner
                  </label>
                )}
                <dl>
                  {columns.map((column) => (
                    <div key={column.key ?? column.label}>
                      <dt>{column.label}</dt>
                      <dd>{column.render(row)}</dd>
                    </div>
                  ))}
                </dl>
                {actions && <div className="iz-mosaic-actions">{actions(row)}</div>}
              </article>
            )
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="iz-pagination">
          <span className="iz-small iz-muted">
            {start + 1}–{Math.min(start + pageSize, filtered.length)} sur {filtered.length}
            {selection?.label && ` · ${selection.label(visible.filter(selection.isSelected).length)}`}
          </span>
          <div className="iz-flex">
            <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" disabled={current <= 1} onClick={() => setPage(1)} aria-label="Première page">«</button>
            <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Page précédente">‹</button>
            <span className="iz-small">{current} / {pages}</span>
            <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label="Page suivante">›</button>
            <button type="button" className="iz-btn iz-btn-outline iz-btn-sm" disabled={current >= pages} onClick={() => setPage(pages)} aria-label="Dernière page">»</button>
          </div>
        </div>
      )}
    </>
  )
}
