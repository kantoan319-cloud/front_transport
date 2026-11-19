import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type BajajContact } from './api'
import './BusFleetPage.css'

interface Props {
  canEdit: boolean
}

/** Conducteurs (deux par bajaj) et propriétaires de l'espace bajaj. */
export default function BajajContactsPage({ canEdit }: Props) {
  const [kind, setKind] = useState<'drivers' | 'owners'>('drivers')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<BajajContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await api.bajajContacts(kind, search))
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Impossible de charger les contacts.')
    } finally {
      setLoading(false)
    }
  }, [kind, search])

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [load, search])

  const libelle = kind === 'drivers' ? 'conducteurs' : 'propriétaires'

  return (
    <div className="bus-page">
      {error && <div className="alert error" role="alert">{error}<button onClick={() => setError('')} aria-label="Fermer">×</button></div>}

      <section className="bus-summary">
        <div className="bus-chip neutral">
          <b>{rows.length}</b><span>{libelle} affichés</span>
        </div>
        <div className="bus-chip neutral">
          <b>{rows.filter((row) => (row.rang ?? 1) === 2).length}</b><span>seconds conducteurs</span>
        </div>
      </section>

      <section className="content-card">
        <div className="list-toolbar">
          <div className="list-title">
            <div className="bus-tabs inline" role="tablist">
              <button role="tab" aria-selected={kind === 'drivers'} className={kind === 'drivers' ? 'active' : ''} onClick={() => setKind('drivers')}>Conducteurs</button>
              <button role="tab" aria-selected={kind === 'owners'} className={kind === 'owners' ? 'active' : ''} onClick={() => setKind('owners')}>Propriétaires</button>
            </div>
            <span className="record-count">{rows.length} {libelle}</span>
          </div>
          <div className="list-filters">
            <label className="search-field"><span>⌕</span><input aria-label={`Rechercher un ${kind === 'drivers' ? 'conducteur' : 'propriétaire'}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, téléphone, plaque…" /></label>
          </div>
        </div>

        {loading ? <p className="bus-empty">Chargement…</p> : rows.length === 0 ? (
          <p className="bus-empty">
            Aucun {libelle === 'conducteurs' ? 'conducteur' : 'propriétaire'} renseigné.
            {canEdit && kind === 'drivers' ? ' Ouvrez le registre bajaj pour affecter un conducteur (un titulaire et un second conducteur par véhicule).' : ''}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="bus-table">
              <thead><tr>
                <th>Nom</th><th>Téléphone</th><th>Bajaj</th>
                {kind === 'drivers' && <th>Rôle</th>}
              </tr></thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.id}-${row.rang ?? kind}-${index}`}>
                    <td><b>{row.nom || '—'}</b></td>
                    <td>{row.telephone || '—'}</td>
                    <td><span className="plate">{row.immatriculation || 'Plaque à compléter'}</span></td>
                    {kind === 'drivers' && (
                      <td>
                        <span className={`status-pill ${(row.rang ?? 1) === 1 ? 'ok' : 'warn'}`}>
                          <i />{(row.rang ?? 1) === 1 ? '1er conducteur' : '2e conducteur'}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
