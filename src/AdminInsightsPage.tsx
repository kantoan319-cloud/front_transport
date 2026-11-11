import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, type AdminHistoryEntry, type AdminOwner, type AdminStatistics, type OwnerVehicle } from './api'
import { usePreferences } from './Preferences'

type InsightsPage = 'statistics' | 'owners' | 'history'

interface Props {
  page: InsightsPage
}

const translations: Record<string, [string, string]> = {
  Statistiques: ['Statistika', 'Statistics'],
  Propriétaires: ['Tompony', 'Owners'],
  Historique: ['Tantara', 'History'],
  'Total des véhicules': ['Fitambaran’ny fiara', 'Total vehicles'],
  'En fourrière': ['Any amin’ny fourrière', 'Impounded'],
  'Propriétaires distincts': ['Tompony samihafa', 'Unique owners'],
  Signalements: ['Tatitra', 'Reports'],
  'Taux traités': ['Vita', 'Resolved rate'],
  'Ce mois': ['Amin’ity volana ity', 'This month'],
  'Signalements par statut': ['Tatitra araka ny sata', 'Reports by status'],
  'Motifs principaux': ['Antony lehibe', 'Top reasons'],
  'Signalements — 6 derniers mois': ['Tatitra — 6 volana farany', 'Reports — last 6 months'],
  'Nouveaux véhicules — 6 derniers mois': ['Fiara vaovao — 6 volana farany', 'New vehicles — last 6 months'],
  'Véhicules les plus signalés': ['Fiara be tatitra indrindra', 'Most reported vehicles'],
  'Recettes des vignettes': ['Vola azo tamin’ny vignette', 'Vignette revenue'],
  'Aujourd’hui': ['Androany', 'Today'],
  'Ce mois-ci': ['Amin’ity volana ity', 'This month'],
  'Cette année': ['Amin’ity taona ity', 'This year'],
  'Total général': ['Fitambarany', 'All time'],
  Rechercher: ['Mitady', 'Search'],
  'Nom, téléphone ou CIN': ['Anarana, finday na CIN', 'Name, phone or ID'],
  'Aucun résultat': ['Tsy misy valiny', 'No results'],
  Propriétaire: ['Tompony', 'Owner'],
  Téléphone: ['Finday', 'Phone'],
  Véhicules: ['Fiara', 'Vehicles'],
  'Somme payée': ['Vola voaloa', 'Amount paid'],
  Véhicule: ['Fiara', 'Vehicle'],
  Action: ['Asa', 'Action'],
  Détail: ['Antsipiriany', 'Details'],
  Date: ['Daty', 'Date'],
  Utilisateur: ['Mpampiasa', 'User'],
  'Réessayer': ['Andramo indray', 'Retry'],
  'Imprimer': ['Atao pirinty', 'Print'],
}

function useTranslatedText() {
  const { language, t: appTranslate } = usePreferences()
  return (text: string) => language === 'fr' ? text : translations[text]?.[language === 'mg' ? 0 : 1] ?? appTranslate(text)
}

function formatAmount(amount: number) {
  return `${new Intl.NumberFormat('fr-FR').format(amount)} Ar`
}

function BarList({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const t = useTranslatedText()
  const max = Math.max(1, ...rows.map((row) => row.value))
  return <section className="insight-card"><h2>{t(title)}</h2>{rows.length === 0 ? <p>{t('Aucun résultat')}</p> : rows.map((row) => <div className="insight-bar-row" key={row.label}><span>{t(row.label)}</span><div className="insight-bar-track"><i style={{ width: `${Math.min(100, (100 * row.value) / max)}%` }} /></div><b>{row.value}</b></div>)}</section>
}

function MonthlyBars({ title, rows }: { title: string; rows: { month: string; value: number }[] }) {
  const t = useTranslatedText()
  const max = Math.max(1, ...rows.map((row) => row.value))
  return <section className="insight-card"><h2>{t(title)}</h2><div className="insight-months">{rows.map((row) => <div key={row.month} title={`${row.month}: ${row.value}`}><b>{row.value}</b><i style={{ height: `${Math.max(3, (100 * row.value) / max)}%` }} /><span>{row.month.slice(5)}</span></div>)}</div></section>
}

export default function AdminInsightsPage({ page }: Props) {
  const t = useTranslatedText()
  const [statistics, setStatistics] = useState<AdminStatistics | null>(null)
  const [owners, setOwners] = useState<AdminOwner[]>([])
  const [vehicles, setVehicles] = useState<OwnerVehicle[]>([])
  const [history, setHistory] = useState<AdminHistoryEntry[]>([])
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      if (page === 'statistics') setStatistics(await api.adminStatistics())
      else if (page === 'owners') {
        const result = await api.adminOwners(appliedQuery)
        setOwners(result.owners)
        setVehicles(result.vehicles)
      } else setHistory(await api.adminHistory())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le chargement a échoué.')
    } finally {
      setLoading(false)
    }
  }, [page, appliedQuery])

  useEffect(() => { void load() }, [load])

  const vehiclesByOwner = useMemo(() => {
    const map = new Map<string, OwnerVehicle[]>()
    vehicles.forEach((vehicle) => map.set(String(vehicle.ownerId), [...(map.get(String(vehicle.ownerId)) ?? []), vehicle]))
    return map
  }, [vehicles])

  function searchOwners(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setAppliedQuery(query.trim())
  }

  if (loading) return <div className="content-card"><p>{t('Chargement…')}</p></div>
  if (error) return <div className="content-card"><div className="alert error" role="alert">{error}</div><button className="button secondary" onClick={() => { setLoading(true); setError(''); void load() }}>{t('Réessayer')}</button></div>

  if (page === 'statistics' && statistics) return <div className="insights-page">
    <div className="insight-toolbar"><button className="button secondary" onClick={() => window.print()}>{t('Imprimer')}</button></div>
    <div className="insight-stat-grid">
      {[
        [t('Total des véhicules'), statistics.totalVehicles],
        [t('En fourrière'), statistics.impoundedVehicles],
        [t('Propriétaires distincts'), statistics.ownerCount],
        [t('Signalements'), statistics.totalSignals],
        [t('Taux traités'), `${statistics.resolvedRate}%`],
        [t('Ce mois'), statistics.signalsThisMonth],
      ].map(([label, value]) => <article className="insight-stat" key={label}><span>{label}</span><b>{value}</b></article>)}
    </div>
    <div className="insight-grid">
      <BarList title="Signalements par statut" rows={statistics.signalsByStatus} />
      <BarList title="Motifs principaux" rows={statistics.signalsByReason} />
      <MonthlyBars title="Signalements — 6 derniers mois" rows={statistics.signalsByMonth} />
      <MonthlyBars title="Nouveaux véhicules — 6 derniers mois" rows={statistics.vehiclesAddedByMonth} />
      <section className="insight-card"><h2>{t('Véhicules les plus signalés')}</h2>{statistics.topReportedVehicles.length === 0 ? <p>{t('Aucun résultat')}</p> : statistics.topReportedVehicles.map((vehicle) => <p className="insight-top-row" key={vehicle.immatriculation}><b>{vehicle.immatriculation}</b><span>{vehicle.count}</span></p>)}</section>
      <section className="insight-card"><h2>{t('Recettes des vignettes')}</h2>{([[t('Aujourd’hui'), statistics.vignetteRevenue.today], [t('Ce mois-ci'), statistics.vignetteRevenue.month], [t('Cette année'), statistics.vignetteRevenue.year], [t('Total général'), statistics.vignetteRevenue.all]] as [string, number][]).map(([label, value]) => <p className="insight-top-row" key={label}><span>{label}</span><b>{formatAmount(value)}</b></p>)}</section>
    </div>
  </div>

  if (page === 'owners') return <section className="content-card">
    <div className="insight-owner-toolbar"><h2>{t('Propriétaires')} ({owners.length})</h2><form className="insight-search" onSubmit={searchOwners}><input aria-label={t('Rechercher')} placeholder={t('Nom, téléphone ou CIN')} value={query} onChange={(event) => setQuery(event.target.value)} /><button className="button primary">{t('Rechercher')}</button></form></div>
    {owners.length === 0 ? <p>{t('Aucun résultat')}</p> : <div className="insight-owner-list">{owners.map((owner) => <article className="insight-owner-card" key={owner.id}>
      <div className="insight-owner-heading"><div><h3>{owner.prenom} {owner.nom}</h3><span>{t('Téléphone')}: {owner.telephone || '—'} · CIN: {owner.cin || '—'}</span><small>{owner.adresse || '—'}</small></div><b>{formatAmount(Number(owner.vignetteRevenue))}</b></div>
      <div className="insight-owner-vehicles"><b>{t('Véhicules')} ({owner.vehicleCount})</b>{(vehiclesByOwner.get(String(owner.id)) ?? []).map((vehicle) => <span key={vehicle.immatriculation}><strong>{vehicle.immatriculation}</strong> · {vehicle.nom} · {t(vehicle.statut)}</span>)}</div>
    </article>)}</div>}
  </section>

  return <section className="content-card">
    <div className="list-title"><h2>{t('Historique')}</h2><span className="record-count">{history.length} / 500</span></div>
    {history.length === 0 ? <p>{t('Aucun résultat')}</p> : <div className="table-scroll"><table><thead><tr>{[t('Date'), t('Utilisateur'), t('Action'), t('Détail')].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{history.map((entry) => <tr key={entry.id}><td>{entry.date}</td><td>{entry.utilisateur}</td><td>{entry.action}</td><td>{entry.detail}</td></tr>)}</tbody></table></div>}
  </section>
}
