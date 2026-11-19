import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, ApiError, type BajajFilters, type BajajRow } from './api'
import { downloadSectionsPdf, logoForPdf } from './documentPdf'
import brandLockup from './assets/logo-lockup.svg'
import './BusFleetPage.css'

interface Props {
  canEdit: boolean
}

const statutClass = (statut: string) => {
  if (statut === 'Actif' || statut === 'Valable') return 'ok'
  if (statut === 'Radié' || statut === 'Expirée') return 'danger'
  if (statut === 'Sans licence') return 'muted'
  return 'warn'
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR')
}

const plaque = (row: BajajRow) => row.immatriculation || 'Plaque à compléter'
const proprietaire = (row: BajajRow) => row.proprietaire || '—'
const telephone = (row: BajajRow) => row.telephone || '—'

function exportCsv(rows: BajajRow[]) {
  const entetes = ['N°', 'Plaque', 'Propriétaire', 'Téléphone', 'Statut']
  const lignes = rows.map((row) => [
    row.numero ?? '', row.immatriculation ?? '', row.proprietaire ?? '',
    row.telephone ?? '', row.statut ?? '',
  ])
  const csv = [entetes, ...lignes]
    .map((ligne) => ligne.map((valeur) => `"${String(valeur).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = `bajaj_antsirabe_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Registre des bajaj : meme fonctionnement que la flotte de bus. */
export default function BajajPage({ canEdit }: Props) {
  const [filters, setFilters] = useState<BajajFilters | null>(null)
  const [rows, setRows] = useState<BajajRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState('')
  const [statutLicence, setStatutLicence] = useState('')
  const [annee, setAnnee] = useState('')
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<BajajRow | null>(null)
  const [creating, setCreating] = useState(false)

  const chargeFilters = useCallback(async () => {
    try {
      setFilters(await api.bajajFilters())
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Impossible de charger les filtres.')
    }
  }, [])

  const chargeListe = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.bajajList({ q: search, statut, licence: statutLicence, annee, page })
      setRows(response.data)
      setTotal(response.total)
      setPageSize(response.pageSize)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Impossible de charger les bajaj.')
    } finally {
      setLoading(false)
    }
  }, [annee, page, search, statut, statutLicence])

  useEffect(() => { void chargeFilters() }, [chargeFilters])
  useEffect(() => {
    const timer = setTimeout(() => void chargeListe(), search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [chargeListe, search])

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '').trim()
    setSaving(true)
    setError('')
    try {
      await api.createBajaj({
        numero: value('numero') ? Number(value('numero')) : undefined,
        immatriculation: value('immatriculation'),
        proprietaire: value('proprietaire'),
        telephone: value('telephone'),
        cooperative: value('cooperative'),
        conducteurNom: value('conducteurNom'),
        conducteurTelephone: value('conducteurTelephone'),
        conducteur2Nom: value('conducteur2Nom'),
        conducteur2Telephone: value('conducteur2Telephone'),
        statut: value('statut') || 'Actif',
        ...licencePayload(value),
      })
      setCreating(false)
      await Promise.all([chargeListe(), chargeFilters()])
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '').trim()
    setSaving(true)
    setError('')
    try {
      await api.updateBajaj(editing.id, {
        numero: value('numero') ? Number(value('numero')) : undefined,
        immatriculation: value('immatriculation'),
        proprietaire: value('proprietaire'),
        telephone: value('telephone'),
        cooperative: value('cooperative'),
        conducteurNom: value('conducteurNom'),
        conducteurTelephone: value('conducteurTelephone'),
        conducteur2Nom: value('conducteur2Nom'),
        conducteur2Telephone: value('conducteur2Telephone'),
        statut: value('statut') || 'Actif',
        ...licencePayload(value),
      })
      setEditing(null)
      await Promise.all([chargeListe(), chargeFilters()])
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  /** Champs de licence envoyés uniquement quand une année est saisie. */
  function licencePayload(value: (name: string) => string) {
    const year = Number(value('anneeLicence'))
    if (!year) return {}
    return {
      annee: year,
      numeroLicence: value('numeroLicence'),
      dateDebut: value('dateDebut') || undefined,
      dateFin: value('dateFin') || undefined,
      validiteTexte:
        value('dateDebut') && value('dateFin')
          ? `${value('dateDebut')} au ${value('dateFin')}`
          : '',
    }
  }

  async function supprimerLicence(row: BajajRow) {
    if (!row.annee) return
    if (!window.confirm(`Supprimer la licence ${row.annee} du bajaj ${plaque(row)} ?`)) return
    setSaving(true)
    setError('')
    try {
      await api.deleteBajajLicence(row.id, row.annee)
      await Promise.all([chargeListe(), chargeFilters()])
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Suppression impossible.')
    } finally {
      setSaving(false)
    }
  }

  async function supprimer(row: BajajRow) {
    if (!window.confirm(`Supprimer le bajaj ${plaque(row)} ?`)) return
    setSaving(true)
    setError('')
    try {
      await api.deleteBajaj(row.id)
      await Promise.all([chargeListe(), chargeFilters()])
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Suppression impossible.')
    } finally {
      setSaving(false)
    }
  }

  async function downloadPdf() {
    try {
      await downloadSectionsPdf({
        filename: `bajaj_antsirabe_${new Date().toISOString().slice(0, 10)}.pdf`,
        title: 'Registre des bajaj',
        subtitle: `Transport de commune urbaine Antsirabe · ${new Date().toLocaleString('fr-FR')}`,
        summary: [
          `${total} bajaj au registre`,
          statut ? `Statut : ${statut}` : 'Tous les statuts',
          search ? `Recherche : ${search}` : 'Liste complète',
        ],
        sections: [{
          heading: 'Bajaj en activité',
          headers: ['N°', 'Plaque', 'Propriétaire', 'Téléphone', 'Statut'],
          rows: rows.map((row) => [
            row.numero ? String(row.numero) : '—',
            plaque(row),
            proprietaire(row),
            telephone(row),
            row.statut || '—',
          ]),
        }],
        logo: await logoForPdf(brandLockup),
      })
    } catch {
      setError('Téléchargement du PDF impossible.')
    }
  }

  return (
    <div className="bus-page">
      {error && <div className="alert error" role="alert">{error}<button onClick={() => setError('')} aria-label="Fermer">×</button></div>}

      <section className="bus-summary">
        {filters?.statuts.map((item) => (
          <button key={item.valeur} className={`bus-chip ${statut === item.valeur ? 'active' : ''}`} onClick={() => { setStatut(statut === item.valeur ? '' : item.valeur); setPage(1) }}>
            <b>{item.valeur}</b><span>{item.total} bajaj</span>
          </button>
        ))}
        <div className="bus-chip neutral"><b>{filters?.sansTelephone ?? 0}</b><span>sans contact</span></div>
        <div className="bus-chip neutral"><b>{filters?.total ?? 0}</b><span>au registre</span></div>
      </section>

      <section className="content-card">
        <div className="list-toolbar">
          <div className="list-title"><h2>Bajaj en activité</h2><span className="record-count">{total} bajaj</span></div>
          <div className="list-filters">
            <label className="search-field"><span>⌕</span><input aria-label="Rechercher un bajaj" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Plaque, propriétaire, téléphone…" /></label>
            <select aria-label="Filtrer par statut" value={statut} onChange={(event) => { setStatut(event.target.value); setPage(1) }}>
              <option value="">Tous les statuts</option>
              {(filters?.statutListe ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select aria-label="Filtrer par licence" value={statutLicence} onChange={(event) => { setStatutLicence(event.target.value); setPage(1) }}>
              <option value="">Toutes les licences</option>
              {['Valable', 'Expirée', 'Validité inconnue', 'Sans licence'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select aria-label="Filtrer par année de licence" value={annee} onChange={(event) => { setAnnee(event.target.value); setPage(1) }}>
              <option value="">Toutes les années</option>
              {(filters?.annees ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <label className="view-toggle"><span className="sr-only">Mode d’affichage</span><button type="button" className={view === 'table' ? 'selected' : ''} onClick={() => setView('table')} aria-pressed={view === 'table'} title="Vue liste">☷</button><button type="button" className={view === 'grid' ? 'selected' : ''} onClick={() => setView('grid')} aria-pressed={view === 'grid'} title="Vue mosaïque">▦</button></label>
            <button className="button secondary" onClick={() => exportCsv(rows)} disabled={rows.length === 0}>Télécharger CSV</button>
            <button className="button secondary" onClick={() => void downloadPdf()} disabled={rows.length === 0}>Télécharger PDF</button>
            {canEdit && <button className="button primary" onClick={() => { setEditing(null); setCreating(true) }}>＋ Ajouter un bajaj</button>}
          </div>
        </div>

        {loading ? <p className="bus-empty">Chargement des bajaj…</p> : rows.length === 0 ? <p className="bus-empty">Aucun bajaj pour ces filtres.</p> : view === 'grid' ? (
          <div className="record-mosaic bus-mosaic">
            {rows.map((row) => (
              <article className="record-card bus-card" key={row.id}>
                <div className="record-card-head">
                  <span className="record-card-avatar" aria-hidden="true">▱</span>
                  <div className="record-card-title"><small>N° {row.numero ?? '—'}</small><b className="plate">{plaque(row)}</b></div>
                  <span className={`status-pill ${statutClass(row.statut || '')}`}><i />{row.statut || '—'}</span>
                </div>
                <dl className="record-card-facts">
                  <div><dt>Propriétaire</dt><dd>{proprietaire(row)}</dd></div>
                  <div><dt>Téléphone</dt><dd>{telephone(row)}</dd></div>
                  <div><dt>1er conducteur</dt><dd>{row.conducteurNom || '—'}</dd></div>
                  <div><dt>2e conducteur</dt><dd>{row.conducteur2Nom || '—'}</dd></div>
                  <div><dt>Licence</dt><dd>{row.numeroLicence || '—'}{row.annee ? ` · ${row.annee}` : ''}</dd></div>
                  <div><dt>Validité</dt><dd>{row.dateFin ? `${formatDate(row.dateDebut)} → ${formatDate(row.dateFin)}` : (row.validiteTexte || '—')}</dd></div>
                </dl>
                {canEdit && (
                  <div className="record-card-actions">
                    <button className="table-action" onClick={() => { setCreating(false); setEditing(row) }}>Modifier</button>
                    <button className="table-action danger-action" onClick={() => void supprimer(row)} disabled={saving}>Supprimer</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="bus-table">
              <thead><tr>
                <th>N°</th><th>Plaque</th><th>Propriétaire</th><th>Téléphone</th><th>Conducteurs</th><th>Licence</th><th>Statut</th>
                {canEdit && <th>Action</th>}
              </tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.numero ?? '—'}</td>
                    <td><span className="plate">{plaque(row)}</span></td>
                    <td>{proprietaire(row)}</td>
                    <td>{telephone(row)}</td>
                    <td>
                      {row.conducteurNom || '—'}
                      {row.conducteur2Nom ? <small className="bus-sub">2e : {row.conducteur2Nom}</small> : null}
                    </td>
                    <td>
                      {row.numeroLicence || (row.annee ? `Année ${row.annee}` : '—')}
                      {row.annee ? <small className="bus-year">{row.annee}</small> : null}
                      <span className={`status-pill ${statutClass(row.statutLicence || '')}`}><i />{row.statutLicence || 'Sans licence'}</span>
                    </td>
                    <td><span className={`status-pill ${statutClass(row.statut || '')}`}><i />{row.statut || '—'}</span></td>
                    {canEdit && (
                      <td>
                        <button className="table-action" onClick={() => { setCreating(false); setEditing(row) }}>Modifier</button>
                        <button className="table-action danger-action" onClick={() => void supprimer(row)} disabled={saving}>Supprimer</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <span>Page {page} · {total} bajaj</span>
          <div>
            <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Précédent</button>
            <button disabled={page * pageSize >= total} onClick={() => setPage((value) => value + 1)}>Suivant →</button>
          </div>
        </div>
      </section>

      {(creating || editing) && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setCreating(false); setEditing(null) } }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="bajaj-form-title">
            <div className="modal-heading">
              <div><span className="eyebrow">BAJAJ · ANTSIRABE</span><h2 id="bajaj-form-title">{editing ? plaque(editing) : 'Nouveau bajaj'}</h2></div>
              <button className="modal-close" onClick={() => { setCreating(false); setEditing(null) }} aria-label="Fermer">×</button>
            </div>
            <form className="record-form bus-form" onSubmit={(event) => void (editing ? submitEdit(event) : submitCreate(event))}>
              <fieldset>
                <legend>Identité</legend>
                <label>N° d’ordre<input name="numero" type="number" min="1" max="99999" defaultValue={editing?.numero ?? ''} /></label>
                <label>Plaque (N° bajaj)<input name="immatriculation" defaultValue={editing?.immatriculation ?? ''} required placeholder="8171TBU" /></label>
                <label>Statut
                  <select name="statut" defaultValue={editing?.statut ?? 'Actif'}>
                    {(filters?.statutListe ?? ['Actif', 'Suspendu', 'Radié']).map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </fieldset>
              <fieldset>
                <legend>Propriétaire</legend>
                <label>Nom du propriétaire<input name="proprietaire" defaultValue={editing?.proprietaire ?? ''} placeholder="Nom et prénoms" /></label>
                <label>Téléphone<input name="telephone" defaultValue={editing?.telephone ?? ''} placeholder="034 00 000 00" /></label>
              </fieldset>
              <fieldset>
                <legend>Conducteurs (2 maximum)</legend>
                <label>1er conducteur<input name="conducteurNom" defaultValue={editing?.conducteurNom ?? ''} placeholder="Nom du conducteur titulaire" /></label>
                <label>Téléphone<input name="conducteurTelephone" defaultValue={editing?.conducteurTelephone ?? ''} /></label>
                <label>2e conducteur<input name="conducteur2Nom" defaultValue={editing?.conducteur2Nom ?? ''} placeholder="Conducteur remplaçant" /></label>
                <label>Téléphone<input name="conducteur2Telephone" defaultValue={editing?.conducteur2Telephone ?? ''} /></label>
              </fieldset>
              <fieldset>
                <legend>Licence annuelle</legend>
                <label>Année<input name="anneeLicence" type="number" min="1990" max="2100" defaultValue={editing?.annee ?? new Date().getFullYear()} /></label>
                <label>Numéro de licence<input name="numeroLicence" defaultValue={editing?.numeroLicence ?? ''} placeholder="000/2026/CU/ABE/SG/DT/STU" /></label>
                <label>Début de validité<input name="dateDebut" type="date" defaultValue={editing?.dateDebut ?? ''} /></label>
                <label>Fin de validité<input name="dateFin" type="date" defaultValue={editing?.dateFin ?? ''} /></label>
                {editing?.licenceId && (
                  <button type="button" className="button secondary bus-licence-delete" onClick={() => void supprimerLicence(editing)} disabled={saving}>
                    Supprimer la licence {editing.annee}
                  </button>
                )}
              </fieldset>
              <div className="form-actions">
                <button type="button" className="button secondary" onClick={() => { setCreating(false); setEditing(null) }}>Annuler</button>
                <button type="submit" className="button primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
