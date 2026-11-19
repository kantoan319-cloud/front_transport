import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, ApiError, type BusAttestation, type BusLicenceFilters, type BusLicenceRow, type BusLicenceYear } from './api'
import RecordDetailsDialog from './RecordDetailsDialog'
import VehicleQrDialog from './VehicleQrDialog'
import VehicleQrBatchDialog from './VehicleQrBatchDialog'
import { downloadSectionsPdf, logoForPdf } from './documentPdf'
import brandLockup from './assets/logo-lockup.svg'
import './BusFleetPage.css'

interface Props {
  canEdit: boolean
}

type Tab = 'licences' | 'attestations'
type AttestationType = 'capacite' | 'receveur'

const STATUTS = ['', 'Valable', 'Expirée', 'Validité inconnue', 'Sans licence']

const statutClass = (statut: string) => {
  if (statut === 'Valable') return 'ok'
  if (statut === 'Expirée') return 'danger'
  if (statut === 'Sans licence') return 'muted'
  return 'warn'
}

function exportCsv(rows: BusLicenceRow[]) {
  const entetes = [
    'Ligne', 'Bus', 'Coopérative', 'Propriétaire', 'Année licence', 'Numéro licence',
    'Début validité', 'Fin validité', 'Statut', 'Conducteur', 'Téléphone conducteur',
    'Receveur', 'Téléphone receveur',
  ]
  const lignes = rows.map((bus) => [
    bus.ligne ?? '', bus.immatriculation, bus.cooperative ?? '', bus.proprietaire ?? '',
    bus.annee ?? '', bus.numeroLicence ?? '', bus.dateDebut ?? '', bus.dateFin ?? '',
    bus.statut, bus.conducteurNom ?? '', bus.conducteurTelephone ?? '',
    bus.receveurNom ?? '', bus.receveurTelephone ?? '',
  ])
  const csv = [entetes, ...lignes]
    .map((ligne) => ligne.map((valeur) => `"${String(valeur).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = `licences_bus_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function exportAttestationsCsv(rows: BusAttestation[], type: AttestationType) {
  const entetes = ['Numero', 'Annee', 'Nom', 'Prenoms', 'Naissance', 'Lieu de naissance',
    type === 'capacite' ? 'Permis' : 'CIN',
    type === 'capacite' ? 'Categorie' : 'N° attestation',
    'Valable jusqu au', 'Statut', 'Remarque']
  const lignes = rows.map((item) => [
    item.numeroAttestation ?? '', item.annee ?? '', item.nom ?? '', item.prenoms ?? '',
    item.dateNaissance ?? '', item.lieuNaissance ?? '',
    type === 'capacite' ? (item.permisNumero ?? '') : (item.cin ?? ''),
    type === 'capacite' ? (item.permisCategorie ?? '') : (item.numeroAttestationReceveur ?? ''),
    item.valableJusquau ?? '', item.statut ?? '', item.remarque ?? '',
  ])
  const csv = [entetes, ...lignes]
    .map((ligne) => ligne.map((valeur) => `"${String(valeur).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = `attestations_${type}_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR')
}

export default function BusFleetPage({ canEdit }: Props) {
  const [tab, setTab] = useState<Tab>('licences')
  const [filters, setFilters] = useState<BusLicenceFilters | null>(null)
  const [buses, setBuses] = useState<BusLicenceRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(60)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cooperative, setCooperative] = useState('')
  const [ligne, setLigne] = useState('')
  const [annee, setAnnee] = useState('')
  const [statut, setStatut] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<BusLicenceRow | null>(null)
  const [fiche, setFiche] = useState<string | null>(null)
  const [qrPlate, setQrPlate] = useState('')
  const [qrBatch, setQrBatch] = useState<string[]>([])
  const [selectionQr, setSelectionQr] = useState<string[]>([])
  const [busView, setBusView] = useState<'table' | 'grid'>('table')
  const [saving, setSaving] = useState(false)
  const [licences, setLicences] = useState<BusLicenceYear[]>([])
  const [licenceInitial, setLicenceInitial] = useState<BusLicenceYear | null>(null)
  const [licenceYear, setLicenceYear] = useState('')
  const [licenceNumero, setLicenceNumero] = useState('')
  const [licenceDebut, setLicenceDebut] = useState('')
  const [licenceFin, setLicenceFin] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [attestationCounts, setAttestationCounts] = useState<{ capacite: number; receveur: number } | null>(null)

  const [attestationType, setAttestationType] = useState<AttestationType>('capacite')
  const [attestations, setAttestations] = useState<BusAttestation[]>([])
  const [attestationTotal, setAttestationTotal] = useState(0)
  const [attestationPage, setAttestationPage] = useState(1)
  const [attestationSize, setAttestationSize] = useState(100)
  const [attestationSearch, setAttestationSearch] = useState('')
  const [attestationAnnee, setAttestationAnnee] = useState('')
  const [attestationStatut, setAttestationStatut] = useState('')
  const [attestationLoading, setAttestationLoading] = useState(false)
  const [attestationAnnees, setAttestationAnnees] = useState<number[]>([])
  const [attestationView, setAttestationView] = useState<'table' | 'grid'>('table')

  const chargeFilters = useCallback(async () => {
    try {
      setFilters(await api.busLicenceFilters())
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Impossible de charger les filtres.')
    }
  }, [])

  const chargeBus = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.busLicences({ cooperative, ligne, annee, statut, q: search, page })
      setBuses(response.data)
      setTotal(response.total)
      setPageSize(response.pageSize)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Impossible de charger les licences des bus.')
    } finally {
      setLoading(false)
    }
  }, [annee, cooperative, ligne, page, search, statut])

  const chargeAttestations = useCallback(async () => {
    setAttestationLoading(true)
    setError('')
    try {
      const response = await api.busAttestations({
        type: attestationType,
        q: attestationSearch,
        annee: attestationAnnee,
        statut: attestationStatut,
        page: attestationPage,
      })
      setAttestations(response.data)
      setAttestationTotal(response.total)
      setAttestationSize(response.pageSize)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Impossible de charger les attestations.')
    } finally {
      setAttestationLoading(false)
    }
  }, [attestationAnnee, attestationPage, attestationSearch, attestationStatut, attestationType])

  useEffect(() => { void chargeFilters() }, [chargeFilters])
  useEffect(() => {
    void api.busAttestationFilters()
      .then((response) => {
        const annees = [...response.capacite, ...response.receveur]
          .map((item) => item.annee)
          .filter((item): item is number => typeof item === 'number')
        setAttestationAnnees([...new Set(annees)].sort((a, b) => b - a))
        setAttestationCounts({
          capacite: response.capacite.reduce((total, item) => total + item.total, 0),
          receveur: response.receveur.reduce((total, item) => total + item.total, 0),
        })
      })
      .catch(() => {
        setAttestationAnnees([])
        setAttestationCounts(null)
      })
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => void chargeBus(), search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [chargeBus, search])
  useEffect(() => { void chargeAttestations() }, [chargeAttestations])

  const lignes = useMemo(
    () => filters?.lignes.slice().sort((a, b) => Number(a.valeur.replace(/\D/g, '')) - Number(b.valeur.replace(/\D/g, ''))) ?? [],
    [filters],
  )

  const appliquerLicence = (licence: BusLicenceYear | null, anneeParDefaut: number) => {
    setLicenceInitial(licence)
    setLicenceYear(String(licence?.annee ?? anneeParDefaut))
    setLicenceNumero(licence?.numeroLicence ?? '')
    setLicenceDebut(licence?.dateDebut ?? '')
    setLicenceFin(licence?.dateFin ?? '')
  }

  const prochaineAnnee = () => {
    const derniere = licences[0]?.annee ?? new Date().getFullYear() - 1
    return Math.max(derniere + 1, new Date().getFullYear())
  }

  async function openEdit(bus: BusLicenceRow) {
    setEditing(bus)
    setLicences([])
    setError('')
    appliquerLicence(
      bus.licenceId && bus.annee
        ? {
            licenceId: bus.licenceId,
            annee: bus.annee,
            numeroLicence: bus.numeroLicence,
            validiteTexte: bus.validiteTexte,
            dateDebut: bus.dateDebut,
            dateFin: bus.dateFin,
            statut: bus.statut,
          }
        : null,
      new Date().getFullYear(),
    )
    setDetailLoading(true)
    try {
      const detail = await api.busLicenceDetail(bus.busId)
      setLicences(detail.licences)
      const cible = detail.licences.find((item) => item.annee === bus.annee) ?? detail.licences[0] ?? null
      appliquerLicence(cible, new Date().getFullYear())
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Impossible de charger les licences du bus.')
    } finally {
      setDetailLoading(false)
    }
  }

  const changeAnnee = (valeur: string) => {
    setLicenceYear(valeur)
    const existante = licences.find((item) => item.annee === Number(valeur))
    if (existante) {
      setLicenceInitial(existante)
      setLicenceNumero(existante.numeroLicence ?? '')
      setLicenceDebut(existante.dateDebut ?? '')
      setLicenceFin(existante.dateFin ?? '')
    } else {
      // Nouvelle annee : on conserve les valeurs affichees comme base de saisie.
      setLicenceInitial(null)
    }
  }

  async function supprimerLicence() {
    if (!editing || !licenceInitial) return
    if (!window.confirm(`Supprimer la licence ${licenceInitial.annee} du bus ${editing.immatriculation} ?`)) return
    setSaving(true)
    setError('')
    try {
      await api.deleteBusLicence(editing.busId, licenceInitial.annee)
      const detail = await api.busLicenceDetail(editing.busId)
      setLicences(detail.licences)
      appliquerLicence(detail.licences[0] ?? null, new Date().getFullYear())
      await Promise.all([chargeBus(), chargeFilters()])
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Suppression impossible.')
    } finally {
      setSaving(false)
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '').trim()
    const annee = Number(licenceYear)
    const licenceModifiee = licenceInitial
      ? licenceInitial.annee !== annee ||
        (licenceInitial.numeroLicence ?? '') !== licenceNumero.trim() ||
        (licenceInitial.dateDebut ?? '') !== licenceDebut ||
        (licenceInitial.dateFin ?? '') !== licenceFin
      : Boolean(licenceNumero.trim() || licenceDebut || licenceFin)
    setSaving(true)
    setError('')
    try {
      await api.updateBus(editing.busId, {
        cooperative: value('cooperative'),
        ligne: value('ligne'),
        proprietaire: value('proprietaire'),
        conducteurNom: value('conducteurNom'),
        conducteurTelephone: value('conducteurTelephone'),
        conducteur2Nom: value('conducteur2Nom'),
        conducteur2Telephone: value('conducteur2Telephone'),
        receveurNom: value('receveurNom'),
        receveurTelephone: value('receveurTelephone'),
        ...(licenceModifiee && annee
          ? {
              annee,
              numeroLicence: licenceNumero.trim(),
              dateDebut: licenceDebut,
              dateFin: licenceFin,
              validiteTexte:
                licenceDebut && licenceFin
                  ? `${licenceDebut} au ${licenceFin}`
                  : (licenceInitial?.validiteTexte ?? ''),
            }
          : {}),
      })
      setEditing(null)
      await Promise.all([chargeBus(), chargeFilters()])
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bus-page">
      <div className="bus-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'licences'} className={tab === 'licences' ? 'active' : ''} onClick={() => setTab('licences')}>
          Bus &amp; licences <span>{filters ? filters.totalBus : '…'}</span>
        </button>
        <button role="tab" aria-selected={tab === 'attestations'} className={tab === 'attestations' ? 'active' : ''} onClick={() => setTab('attestations')}>
          Attestations <span>{attestationCounts ? attestationCounts.capacite + attestationCounts.receveur : '…'}</span>
        </button>
      </div>

      {error && <div className="alert error" role="alert">{error}<button onClick={() => setError('')} aria-label="Fermer">×</button></div>}

      {tab === 'licences' ? (
        <>
          <section className="bus-summary">
            {filters?.cooperatives.map((item) => (
              <button key={item.valeur} className={`bus-chip ${cooperative === item.valeur ? 'active' : ''}`} onClick={() => { setCooperative(cooperative === item.valeur ? '' : item.valeur); setPage(1) }}>
                <b>{item.valeur}</b><span>{item.total} bus</span>
              </button>
            ))}
            <div className="bus-chip neutral"><b>{filters?.sansLicence ?? 0}</b><span>sans licence</span></div>
          </section>

          <section className="content-card">
            <div className="list-toolbar">
              <div className="list-title"><h2>Licences des bus</h2><span className="record-count">{total} bus</span></div>
              <div className="list-filters">
                <label className="search-field"><span>⌕</span><input aria-label="Rechercher un bus" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Bus, propriétaire, licence…" /></label>
                <select aria-label="Filtrer par coopérative" value={cooperative} onChange={(event) => { setCooperative(event.target.value); setPage(1) }}>
                  <option value="">Toutes les coopératives</option>
                  {filters?.cooperatives.map((item) => <option key={item.valeur} value={item.valeur}>{item.valeur}</option>)}
                </select>
                <select aria-label="Filtrer par ligne" value={ligne} onChange={(event) => { setLigne(event.target.value); setPage(1) }}>
                  <option value="">Toutes les lignes</option>
                  {lignes.map((item) => <option key={item.valeur} value={item.valeur}>Ligne {item.valeur} ({item.total})</option>)}
                </select>
                <select aria-label="Filtrer par année de licence" value={annee} onChange={(event) => { setAnnee(event.target.value); setPage(1) }}>
                  <option value="">Toutes les années</option>
                  {filters?.annees.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select aria-label="Filtrer par statut" value={statut} onChange={(event) => { setStatut(event.target.value); setPage(1) }}>
                  {STATUTS.map((item) => <option key={item || 'all'} value={item}>{item || 'Tous les statuts'}</option>)}
                </select>
                <label className="view-toggle"><span className="sr-only">Mode d’affichage</span><button type="button" className={busView === 'table' ? 'selected' : ''} onClick={() => setBusView('table')} aria-pressed={busView === 'table'} title="Vue liste">☷</button><button type="button" className={busView === 'grid' ? 'selected' : ''} onClick={() => setBusView('grid')} aria-pressed={busView === 'grid'} title="Vue mosaïque">▦</button></label>
                <button className="button secondary" onClick={() => exportCsv(buses)} disabled={buses.length === 0}>Télécharger CSV</button>
                <button className="button secondary" onClick={() => setQrBatch(selectionQr)} disabled={selectionQr.length === 0}>QR sélection ({selectionQr.length})</button>
                <button className="button secondary" onClick={async () => {
                  try {
                    await downloadSectionsPdf({
                  filename: `licences_bus_${new Date().toISOString().slice(0, 10)}.pdf`,
                  title: 'Licences des bus',
                  subtitle: `Transport de commune urbaine Antsirabe · ${new Date().toLocaleString('fr-FR')}`,
                  summary: [
                    `${total} bus affichés`,
                    cooperative ? `Coopérative : ${cooperative}` : 'Toutes les coopératives',
                    ligne ? `Ligne : ${ligne}` : 'Toutes les lignes',
                    statut ? `Statut : ${statut}` : 'Tous les statuts',
                  ],
                  sections: [{
                    heading: 'Bus et licences',
                    headers: ['Ligne', 'Bus', 'Coopérative', 'Licence', 'Validité', 'Conducteur', 'Receveur'],
                    rows: buses.map((bus) => [
                      bus.ligne || '—',
                      bus.immatriculation,
                      bus.cooperative || '—',
                      `${bus.numeroLicence || '—'}${bus.annee ? ` (${bus.annee})` : ''}`,
                      bus.dateFin ? `${formatDate(bus.dateDebut)} → ${formatDate(bus.dateFin)}` : '—',
                      bus.conducteurNom || '—',
                      bus.receveurNom || '—',
                    ]),
                  }],
                      logo: await logoForPdf(brandLockup),
                    })
                  } catch {
                    setError('Téléchargement du PDF impossible.')
                  }
                }} disabled={buses.length === 0}>Télécharger PDF</button>
              </div>
            </div>

            {loading ? <p className="bus-empty">Chargement des bus…</p> : buses.length === 0 ? <p className="bus-empty">Aucun bus pour ces filtres.</p> : busView === 'grid' ? (
              <div className="record-mosaic bus-mosaic">
                {buses.map((bus) => (
                  <article className="record-card bus-card" key={bus.busId}>
                    <div className="record-card-head">
                      <span className="record-card-avatar" aria-hidden="true">▤</span>
                      <div className="record-card-title"><small>Ligne {bus.ligne || '—'}</small><b className="plate">{bus.immatriculation}</b></div>
                      <span className={`status-pill ${statutClass(bus.statut)}`}><i />{bus.statut}</span>
                    </div>
                    <dl className="record-card-facts">
                      <div><dt>Coopérative</dt><dd>{bus.cooperative || '—'}</dd></div>
                      <div><dt>Propriétaire</dt><dd>{bus.proprietaire || '—'}</dd></div>
                      <div><dt>Licence</dt><dd>{bus.numeroLicence || '—'}{bus.annee ? ` · ${bus.annee}` : ''}</dd></div>
                      <div><dt>Validité</dt><dd>{bus.dateFin ? `${formatDate(bus.dateDebut)} → ${formatDate(bus.dateFin)}` : '—'}</dd></div>
                      <div><dt>Conducteur</dt><dd>{bus.conducteurNom || '—'}</dd></div>
                      <div><dt>Receveur</dt><dd>{bus.receveurNom || '—'}</dd></div>
                    </dl>
                    <div className="record-card-actions">
                      <button className="table-action" onClick={() => setFiche(bus.immatriculation)}>Fiche</button>
                      <button className="table-action" onClick={() => setQrPlate(bus.immatriculation)}>QR</button>
                      {canEdit && <button className="table-action" onClick={() => void openEdit(bus)}>Modifier</button>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="table-scroll">
                <table className="bus-table">
                  <thead><tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Sélectionner tous les bus de la page"
                        checked={buses.length > 0 && buses.every((bus) => selectionQr.includes(bus.immatriculation))}
                        onChange={(event) => setSelectionQr(event.target.checked ? buses.map((bus) => bus.immatriculation) : [])}
                      />
                    </th>
                    <th>Ligne</th><th>Bus</th><th>Coopérative</th><th>Propriétaire</th>
                    <th>Licence</th><th>Validité</th><th>Statut</th>
                    <th>Conducteur</th><th>Receveur</th>
                    <th>Action</th>
                  </tr></thead>
                  <tbody>
                    {buses.map((bus) => (
                      <tr key={bus.busId}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Sélectionner ${bus.immatriculation}`}
                            checked={selectionQr.includes(bus.immatriculation)}
                            onChange={(event) => setSelectionQr((actuel) => event.target.checked ? [...new Set([...actuel, bus.immatriculation])] : actuel.filter((item) => item !== bus.immatriculation))}
                          />
                        </td>
                        <td><span className="bus-line">Ligne {bus.ligne || '—'}</span></td>
                        <td><span className="plate">{bus.immatriculation}</span></td>
                        <td>{bus.cooperative || '—'}</td>
                        <td>{bus.proprietaire || '—'}</td>
                        <td>{bus.numeroLicence || '—'}{bus.annee ? <small className="bus-year">{bus.annee}</small> : null}</td>
                        <td>{bus.dateFin ? `${formatDate(bus.dateDebut)} → ${formatDate(bus.dateFin)}` : (bus.validiteTexte || '—')}</td>
                        <td><span className={`status-pill ${statutClass(bus.statut)}`}><i />{bus.statut}</span></td>
                        <td>{bus.conducteurNom || '—'}{bus.conducteurTelephone ? <small className="bus-sub">{bus.conducteurTelephone}</small> : null}{bus.conducteur2Nom ? <small className="bus-sub">2e : {bus.conducteur2Nom}</small> : null}</td>
                        <td>{bus.receveurNom || '—'}{bus.receveurTelephone ? <small className="bus-sub">{bus.receveurTelephone}</small> : null}</td>
                        <td>
                          <button className="table-action" onClick={() => setFiche(bus.immatriculation)}>Fiche</button>
                          <button className="table-action" onClick={() => setQrPlate(bus.immatriculation)}>QR</button>
                          {canEdit && <button className="table-action" onClick={() => void openEdit(bus)}>Modifier</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pagination">
              <span>Page {page} · {total} bus</span>
              <div>
                <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Précédent</button>
                <button disabled={page * pageSize >= total} onClick={() => setPage((value) => value + 1)}>Suivant →</button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="content-card">
          <div className="list-toolbar">
            <div className="list-title">
              <h2>Attestations {attestationType === 'capacite' ? 'de capacité' : 'de receveur'}</h2>
              <span className="record-count">{attestationTotal} résultats</span>
            </div>
            <div className="list-filters">
              <div className="bus-tabs inline" role="tablist">
                <button role="tab" aria-selected={attestationType === 'capacite'} className={attestationType === 'capacite' ? 'active' : ''} onClick={() => { setAttestationType('capacite'); setAttestationPage(1) }}>Capacité</button>
                <button role="tab" aria-selected={attestationType === 'receveur'} className={attestationType === 'receveur' ? 'active' : ''} onClick={() => { setAttestationType('receveur'); setAttestationPage(1) }}>Receveur</button>
              </div>
              <label className="search-field"><span>⌕</span><input aria-label="Rechercher une attestation" value={attestationSearch} onChange={(event) => { setAttestationSearch(event.target.value); setAttestationPage(1) }} placeholder="Nom, numéro, CIN…" /></label>
              <select aria-label="Filtrer par année" value={attestationAnnee} onChange={(event) => { setAttestationAnnee(event.target.value); setAttestationPage(1) }}>
                <option value="">Toutes les années</option>
                {attestationAnnees.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select aria-label="Filtrer par statut" value={attestationStatut} onChange={(event) => { setAttestationStatut(event.target.value); setAttestationPage(1) }}>
                <option value="">Tous les statuts</option>
                <option value="Valable">Valable</option>
                <option value="Expirée">Expirée</option>
                <option value="Validité inconnue">Validité inconnue</option>
              </select>
              <label className="view-toggle"><span className="sr-only">Mode d’affichage</span><button type="button" className={attestationView === 'table' ? 'selected' : ''} onClick={() => setAttestationView('table')} aria-pressed={attestationView === 'table'} title="Vue liste">☷</button><button type="button" className={attestationView === 'grid' ? 'selected' : ''} onClick={() => setAttestationView('grid')} aria-pressed={attestationView === 'grid'} title="Vue mosaïque">▦</button></label>
              <button className="button secondary" disabled={attestations.length === 0} onClick={() => exportAttestationsCsv(attestations, attestationType)}>Télécharger CSV</button>
            </div>
          </div>

          {attestationLoading ? <p className="bus-empty">Chargement…</p> : attestations.length === 0 ? <p className="bus-empty">Aucune attestation pour ces filtres.</p> : attestationView === 'grid' ? (
            <div className="record-mosaic bus-mosaic">
              {attestations.map((item) => (
                <article className="record-card bus-card" key={item.id}>
                  <div className="record-card-head">
                    <span className="record-card-avatar" aria-hidden="true">{(item.nom || '?').slice(0, 1).toUpperCase()}</span>
                    <div className="record-card-title"><small>{item.numeroAttestation || 'Attestation'}</small><b>{item.nom || '—'} {item.prenoms || ''}</b></div>
                    <span className={`status-pill ${statutClass(item.statut || '')}`}><i />{item.statut || '—'}</span>
                  </div>
                  <dl className="record-card-facts">
                    <div><dt>Naissance</dt><dd>{formatDate(item.dateNaissance)}</dd></div>
                    <div><dt>Lieu</dt><dd>{item.lieuNaissance || '—'}</dd></div>
                    <div><dt>{attestationType === 'capacite' ? 'Permis' : 'CIN'}</dt><dd>{attestationType === 'capacite' ? (item.permisNumero || '—') : (item.cin || '—')}</dd></div>
                    <div><dt>{attestationType === 'capacite' ? 'Catégorie' : 'N° attestation'}</dt><dd>{attestationType === 'capacite' ? (item.permisCategorie || '—') : (item.numeroAttestationReceveur || '—')}</dd></div>
                    <div><dt>Valable jusqu’au</dt><dd>{formatDate(item.valableJusquau)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="bus-table">
                <thead><tr>
                  <th>Numéro</th><th>Nom</th><th>Naissance</th><th>Lieu de naissance</th>
                  <th>{attestationType === 'capacite' ? 'Permis' : 'CIN'}</th>
                  <th>{attestationType === 'capacite' ? 'Catégorie' : 'N° attestation'}</th>
                  <th>Valable jusqu’au</th><th>Statut</th>
                </tr></thead>
                <tbody>
                  {attestations.map((item) => (
                    <tr key={item.id}>
                      <td>{item.numeroAttestation || '—'}</td>
                      <td><b>{item.nom || '—'}</b>{item.prenoms ? ` ${item.prenoms}` : ''}</td>
                      <td>{formatDate(item.dateNaissance)}</td>
                      <td>{item.lieuNaissance || '—'}</td>
                      <td>{attestationType === 'capacite' ? (item.permisNumero || '—') : (item.cin || '—')}</td>
                      <td>{attestationType === 'capacite' ? (item.permisCategorie || '—') : (item.numeroAttestationReceveur || '—')}</td>
                      <td>{formatDate(item.valableJusquau)}</td>
                      <td><span className={`status-pill ${statutClass(item.statut || '')}`}><i />{item.statut || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pagination">
            <span>Page {attestationPage} · {attestationTotal} attestations</span>
            <div>
              <button disabled={attestationPage <= 1} onClick={() => setAttestationPage((value) => Math.max(1, value - 1))}>← Précédent</button>
              <button disabled={attestationPage * attestationSize >= attestationTotal} onClick={() => setAttestationPage((value) => value + 1)}>Suivant →</button>
            </div>
          </div>
        </section>
      )}

      {editing && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null) }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="bus-edit-title">
            <div className="modal-heading">
              <div><span className="eyebrow">BUS · LIGNE {editing.ligne || '—'}</span><h2 id="bus-edit-title">{editing.immatriculation}</h2></div>
              <button className="modal-close" onClick={() => setEditing(null)} aria-label="Fermer">×</button>
            </div>
            <form className="record-form bus-form" onSubmit={(event) => void submitEdit(event)}>
              <fieldset>
                <legend>Licences par année</legend>
                <div className="bus-licence-list">
                  {detailLoading ? (
                    <span className="bus-licence-empty">Chargement des licences…</span>
                  ) : licences.length === 0 ? (
                    <span className="bus-licence-empty">Aucune licence enregistrée pour ce bus.</span>
                  ) : (
                    licences.map((item) => (
                      <button
                        type="button"
                        key={item.annee}
                        className={`bus-licence-pill ${licenceYear === String(item.annee) ? 'active' : ''}`}
                        onClick={() => appliquerLicence(item, item.annee)}
                      >
                        <b>{item.annee}</b>
                        <span>{item.numeroLicence || 'Sans numéro'}</span>
                        <span className={`status-pill ${statutClass(item.statut)}`}><i />{item.statut}</span>
                      </button>
                    ))
                  )}
                  <button type="button" className="bus-licence-pill add" onClick={() => appliquerLicence(null, prochaineAnnee())}>
                    <b>+</b>
                    <span>Ajouter une année</span>
                  </button>
                </div>
              </fieldset>
              <fieldset>
                <legend>Licence {licenceYear || '—'}</legend>
                <label>Année<input name="annee" type="number" min="1990" max="2100" value={licenceYear} onChange={(event) => changeAnnee(event.target.value)} required /></label>
                <label>Numéro de licence<input name="numeroLicence" value={licenceNumero} onChange={(event) => setLicenceNumero(event.target.value)} placeholder="000/2025/CU/ABE/SG/DT/STU" /></label>
                <label>Début de validité<input name="dateDebut" type="date" value={licenceDebut} onChange={(event) => setLicenceDebut(event.target.value)} /></label>
                <label>Fin de validité<input name="dateFin" type="date" value={licenceFin} onChange={(event) => setLicenceFin(event.target.value)} /></label>
                <p className="form-note">La licence couvre la vignette et la visite médicale du bus : leurs échéances suivent la fin de validité.</p>
              </fieldset>
              <fieldset>
                <legend>Conducteurs (2 maximum)</legend>
                <label>1er conducteur<input name="conducteurNom" defaultValue={editing.conducteurNom ?? ''} /></label>
                <label>Téléphone<input name="conducteurTelephone" defaultValue={editing.conducteurTelephone ?? ''} /></label>
                <label>2e conducteur<input name="conducteur2Nom" defaultValue={editing.conducteur2Nom ?? ''} /></label>
                <label>Téléphone<input name="conducteur2Telephone" defaultValue={editing.conducteur2Telephone ?? ''} /></label>
              </fieldset>
              <fieldset>
                <legend>Receveur</legend>
                <label>Nom du receveur<input name="receveurNom" defaultValue={editing.receveurNom ?? ''} /></label>
                <label>Téléphone<input name="receveurTelephone" defaultValue={editing.receveurTelephone ?? ''} /></label>
              </fieldset>
              <fieldset>
                <legend>Affectation</legend>
                <label>Coopérative<input name="cooperative" defaultValue={editing.cooperative ?? ''} /></label>
                <label>Ligne<input name="ligne" defaultValue={editing.ligne ?? ''} /></label>
                <label>Propriétaire<input name="proprietaire" defaultValue={editing.proprietaire ?? ''} /></label>
              </fieldset>
              <div className="form-actions">
                {licenceInitial && (
                  <button type="button" className="button secondary bus-licence-delete" onClick={() => void supprimerLicence()} disabled={saving}>
                    Supprimer {licenceInitial.annee}
                  </button>
                )}
                <button type="button" className="button secondary" onClick={() => setEditing(null)}>Annuler</button>
                <button type="submit" className="button primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {fiche && <RecordDetailsDialog kind="vehicle" id={fiche} onClose={() => setFiche(null)} />}
      {qrPlate && <VehicleQrDialog immatriculation={qrPlate} onClose={() => setQrPlate('')} />}
      {qrBatch.length > 0 && <VehicleQrBatchDialog registrations={qrBatch} onClose={() => setQrBatch([])} />}
    </div>
  )
}
