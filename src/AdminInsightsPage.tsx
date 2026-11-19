import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, photoFileToDataUrl, photoUrl, type AdminHistoryEntry, type AdminOwner, type AdminStatistics, type OwnerVehicle } from './api'
import { usePreferences } from './Preferences'
import { downloadSectionsPdf, logoForPdf } from './documentPdf'
import brandLockup from './assets/logo-lockup.svg'

type InsightsPage = 'statistics' | 'owners' | 'history'

interface Props {
  page: InsightsPage
  /** Espace par type : limite les propriétaires aux véhicules de ce type. */
  vehicleType?: string
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
  'Impôt synthétique': ['Hetra synthétique', 'Synthetic tax'],
  'Suivi de l’impôt synthétique': ['Fanarahana ny hetra synthétique', 'Synthetic tax tracking'],
  'Impôt à jour': ['Hetra milamina', 'Tax up to date'],
  'Impôts en retard': ['Hetra tara', 'Late taxes'],
  'Propriétaires avec NIF': ['Tompony manana NIF', 'Owners with NIF'],
  'Taux de conformité': ['Tahan’ny fanajana', 'Compliance rate'],
  NIF: ['NIF', 'NIF'],
  'NIF non renseigné': ['NIF tsy voafaritra', 'NIF not set'],
  'Statut fiscal': ['Sata hetra', 'Tax status'],
  Année: ['Taona', 'Year'],
  'Date de paiement': ['Daty fandoavana', 'Payment date'],
  Renouvellement: ['Fanavaozana', 'Renewal'],
  Échéance: ['Fe-potoana', 'Deadline'],
  'À jour': ['Milamina', 'Up to date'],
  'En retard': ['Tara', 'Late'],
  'À payer': ['Tokony haloavina', 'To pay'],
  'Non renseigné': ['Tsy voafaritra', 'Not set'],
  Payé: ['Voaloa', 'Paid'],
  'Véhicules par type': ['Fiara araka ny karazany', 'Vehicles by type'],
  'Propriétaires par type': ['Tompony araka ny karazany', 'Owners by type'],
  'Répartition des propriétaires': ['Fizarana ny tompony', 'Owner breakdown'],
  'Modifier l’impôt': ['Hanova ny hetra', 'Edit tax'],
  'Enregistrer l’impôt': ['Hitahiry ny hetra', 'Save tax'],
  'Modifier les informations': ['Hanova ny mombamomba', 'Edit information'],
  'Informations du propriétaire': ['Mombamomba ny tompony', 'Owner information'],
  'Enregistrer les informations': ['Hitahiry ny mombamomba', 'Save information'],
  Prénom: ['Anarana', 'First name'],
  Nom: ['Anarana farany', 'Last name'],
  Profession: ['Asa', 'Profession'],
  'Date de naissance': ['Daty nahaterahana', 'Date of birth'],
  'Lieu de naissance': ['Toerana nahaterahana', 'Place of birth'],
  'Date de délivrance CIN': ['Daty namoahana CIN', 'ID issue date'],
  CIN: ['CIN', 'ID number'],
  Adresse: ['Adiresy', 'Address'],
  'Annuler': ['Hanafoana', 'Cancel'],
  'Fermer': ['Hidio', 'Close'],
  'Photo du propriétaire': ['Sary ny tompony', 'Owner photo'],
  'Changer la photo': ['Hanova ny sary', 'Change photo'],
  'Supprimer la photo': ['Hamafa ny sary', 'Remove photo'],
  'Photo mise à jour.': ['Nohavaozina ny sary.', 'Photo updated.'],
  'Informations du propriétaire mises à jour.': ['Nohavaozina ny mombamomba ny tompony.', 'Owner information updated.'],
  'Impôt synthétique mis à jour.': ['Nohavaozina ny hetra synthétique.', 'Synthetic tax updated.'],
  'Aucun impôt enregistré': ['Tsy misy hetra voarakitra', 'No tax recorded'],
  'Par année': ['Isan-taona', 'By year'],
  'Renouvellement chaque année le 30 mars.': ['Fanavaozana isan-taona ny 30 Martsa.', 'Renewed every year on March 30.'],
  'Total propriétaires': ['Fitambaran’ny tompony', 'Total owners'],
  'Impôt payé cette année': ['Hetra voaloa ity taona ity', 'Tax paid this year'],
  'Impôt de l’année': ['Hetra amin’ity taona ity', 'Tax for this year'],
  'Véhicules liés': ['Fiara mifandraika', 'Linked vehicles'],
  'Évolution sur 6 mois': ['Fivoarana 6 volana', 'Six-month trend'],
  'Nouveaux véhicules': ['Fiara vaovao', 'New vehicles'],
  'Répartition des véhicules': ['Fizarana ny fiara', 'Vehicle breakdown'],
  'Total': ['Fitambarany', 'Total'],
  'Chargement…': ['Eo am-pakana…', 'Loading…'],
}

function useTranslatedText() {
  const { language, t: appTranslate } = usePreferences()
  return (text: string) => language === 'fr' ? text : translations[text]?.[language === 'mg' ? 0 : 1] ?? appTranslate(text)
}

function formatAmount(amount: number) {
  return `${new Intl.NumberFormat('fr-FR').format(amount)} Ar`
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return String(value).slice(0, 10)
}

function monthLabel(value: string): string {
  const parsed = new Date(`${value.slice(0, 7)}-01T12:00:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('fr-FR', { month: 'short' })
}

/** Arrondit un maximum d'axe a une valeur lisible (ex. 5025 -> 6000). */
function niceCeiling(value: number): number {
  if (value <= 5) return Math.max(1, Math.ceil(value))
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 2 ? 0.5 : normalized <= 5 ? 1 : 2
  return Math.ceil(value / (step * magnitude)) * step * magnitude
}

function typeClass(type?: string | null) {
  const normalized = (type ?? '').toLocaleLowerCase()
  if (normalized.includes('bus')) return 'bus'
  if (normalized.includes('bajaj')) return 'bajaj'
  return 'cyclo'
}

function statusClass(value?: string | null) {
  if (value === 'Payé' || value === 'Normal' || value === 'À jour') return 'success'
  if (value === 'En retard' || value === 'En fourrière') return 'danger'
  if (value === 'À payer') return 'warning'
  return 'neutral'
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

/** Courbe lissée passant par une serie de points (SVG). */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const middleX = (current.x + next.x) / 2
    path += ` C ${middleX} ${current.y}, ${middleX} ${next.y}, ${next.x} ${next.y}`
  }
  return path
}

function TrendChart({ title, labels, series }: {
  title: string
  labels: string[]
  series: { name: string; color: string; values: number[] }[]
}) {
  const t = useTranslatedText()
  const width = 680
  const height = 260
  const paddingX = 46
  const paddingTop = 22
  const paddingBottom = 34
  const max = niceCeiling(Math.max(1, ...series.flatMap((item) => item.values)))
  const usableWidth = width - paddingX * 2
  const usableHeight = height - paddingTop - paddingBottom
  const step = labels.length > 1 ? usableWidth / (labels.length - 1) : 0
  const pointFor = (value: number, index: number) => ({
    x: paddingX + step * index,
    y: paddingTop + usableHeight - (Math.max(0, value) / max) * usableHeight,
  })
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
  return <section className="insight-card insight-card--wide chart-card">
    <div className="chart-heading">
      <h2>{t(title)}</h2>
      <div className="chart-legend">
        {series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{t(item.name)}</span>)}
      </div>
    </div>
    {labels.length === 0 ? <p>{t('Aucun résultat')}</p> : <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t(title)}>
      {gridLines.map((ratio) => {
        const y = paddingTop + usableHeight * ratio
        return <g key={ratio}>
          <line className="trend-grid" x1={paddingX} x2={width - paddingX} y1={y} y2={y} />
          <text className="trend-axis" x={paddingX - 10} y={y + 4} textAnchor="end">{Math.round(max * (1 - ratio))}</text>
        </g>
      })}
      {series.map((item) => {
        const points = labels.map((_, index) => pointFor(item.values[index] ?? 0, index))
        const line = smoothPath(points)
        const first = points[0]
        const last = points[points.length - 1]
        const area = `${line} L ${last.x} ${paddingTop + usableHeight} L ${first.x} ${paddingTop + usableHeight} Z`
        return <g key={item.name}>
          <path d={area} fill={item.color} opacity="0.1" />
          <path d={line} fill="none" stroke={item.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => <circle key={`${item.name}-${index}`} cx={point.x} cy={point.y} r="4" fill="#ffffff" stroke={item.color} strokeWidth="2.4">
            <title>{`${t(item.name)} · ${labels[index]} : ${item.values[index] ?? 0}`}</title>
          </circle>)}
        </g>
      })}
      {labels.map((label, index) => <text key={`${label}-${index}`} className="trend-axis" x={paddingX + step * index} y={height - 10} textAnchor="middle">{label}</text>)}
    </svg>}
  </section>
}

function DonutChart({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const t = useTranslatedText()
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  const colors = ['#2f6b57', '#e8a33d', '#7f9c8b', '#c0653b', '#7b6aa8', '#b9a26a']
  const radius = 66
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return <section className="insight-card donut-card">
    <h2>{t(title)}</h2>
    {total === 0 ? <p>{t('Aucun résultat')}</p> : <div className="donut-layout">
      <svg className="donut-chart" viewBox="0 0 200 200" role="img" aria-label={t(title)}>
        <circle cx="100" cy="100" r={radius} fill="none" stroke="var(--line, #e4e0d4)" strokeWidth="24" />
        {rows.map((row, index) => {
          const length = (row.value / total) * circumference
          const visible = Math.max(0, length - 2)
          const circle = <circle
            key={row.label}
            cx="100" cy="100" r={radius} fill="none"
            stroke={colors[index % colors.length]}
            strokeWidth="24"
            strokeDasharray={`${visible} ${circumference - visible}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 100 100)"
          >
            <title>{`${t(row.label)} : ${row.value} (${Math.round((100 * row.value) / total)}%)`}</title>
          </circle>
          offset += length
          return circle
        })}
        <text className="donut-total" x="100" y="96" textAnchor="middle">{total.toLocaleString('fr-FR')}</text>
        <text className="donut-caption" x="100" y="116" textAnchor="middle">{t('Total')}</text>
      </svg>
      <ul className="donut-legend">
        {rows.map((row, index) => <li key={row.label}>
          <i style={{ background: colors[index % colors.length] }} />
          <span>{t(row.label)}</span>
          <b>{row.value}</b>
          <small>{Math.round((100 * row.value) / total)}%</small>
        </li>)}
      </ul>
    </div>}
  </section>
}

function OwnerPhoto({ src, name }: { src: string; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!src || failedSrc === src) return <span className="owner-avatar-fallback">{name.slice(0, 1).toUpperCase() || '•'}</span>
  return <img src={src} alt={name ? `Propriétaire ${name}` : 'Propriétaire'} loading="lazy" onError={() => setFailedSrc(src)} />
}

function VehicleMiniPhoto({ src, type, alt }: { src: string; type?: string | null; alt: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!src || failedSrc === src) return <span aria-hidden="true">{typeClass(type) === 'bus' ? '▣' : typeClass(type) === 'bajaj' ? '▱' : '◉'}</span>
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailedSrc(src)} />
}

export default function AdminInsightsPage({ page, vehicleType = '' }: Props) {
  const t = useTranslatedText()
  const [statistics, setStatistics] = useState<AdminStatistics | null>(null)
  const [owners, setOwners] = useState<AdminOwner[]>([])
  const [vehicles, setVehicles] = useState<OwnerVehicle[]>([])
  const [history, setHistory] = useState<AdminHistoryEntry[]>([])
  const [historyView, setHistoryView] = useState<'table' | 'grid'>('table')
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingOwnerId, setEditingOwnerId] = useState<string | number | null>(null)
  const [savingOwner, setSavingOwner] = useState(false)
  const [photoBusyId, setPhotoBusyId] = useState<string | number | null>(null)
  const [ownerDraft, setOwnerDraft] = useState({
    prenom: '', nom: '', telephone: '', cin: '', adresse: '', profession: '',
    dateNaissance: '', lieuNaissance: '', dateCin: '',
    nif: '', statut: 'À payer', annee: String(new Date().getFullYear()), paiement: '',
  })

  const load = useCallback(async () => {
    try {
      if (page === 'statistics') setStatistics(await api.adminStatistics())
      else if (page === 'owners') {
        const result = await api.adminOwners(appliedQuery, vehicleType)
        setOwners(result.owners)
        setVehicles(result.vehicles)
      } else setHistory(await api.adminHistory())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le chargement a échoué.')
    } finally {
      setLoading(false)
    }
  }, [page, appliedQuery, vehicleType])

  useEffect(() => { void load() }, [load])

  const vehiclesByOwner = useMemo(() => {
    const map = new Map<string, OwnerVehicle[]>()
    vehicles.forEach((vehicle) => map.set(String(vehicle.ownerId), [...(map.get(String(vehicle.ownerId)) ?? []), vehicle]))
    return map
  }, [vehicles])

  const ownerStats = useMemo(() => ({
    total: owners.length,
    withNif: owners.filter((owner) => (owner.nif ?? '').trim()).length,
    paid: owners.filter((owner) => owner.statutImpotSynthetique === 'Payé').length,
    late: owners.filter((owner) => owner.statutImpotSynthetique === 'En retard').length,
  }), [owners])

  function searchOwners(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    setAppliedQuery(query.trim())
  }

  function startOwnerEdit(owner: AdminOwner) {
    setError('')
    setNotice('')
    setEditingOwnerId(owner.id)
    setOwnerDraft({
      prenom: owner.prenom ?? '',
      nom: owner.nom ?? '',
      telephone: owner.telephone ?? '',
      cin: owner.cin ?? '',
      adresse: owner.adresse ?? '',
      profession: owner.profession ?? '',
      dateNaissance: owner.dateNaissance ? String(owner.dateNaissance).slice(0, 10) : '',
      lieuNaissance: owner.lieuNaissance ?? '',
      dateCin: owner.dateCin ? String(owner.dateCin).slice(0, 10) : '',
      nif: owner.nif ?? '',
      statut: owner.statutImpotSynthetique ?? 'À payer',
      annee: owner.anneeImpotSynthetique ? String(owner.anneeImpotSynthetique) : String(new Date().getFullYear()),
      paiement: owner.datePaiementImpotSynthetique ? String(owner.datePaiementImpotSynthetique).slice(0, 10) : '',
    })
  }

  async function saveOwner(owner: AdminOwner, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingOwner(true)
    setError('')
    setNotice('')
    try {
      await api.updateOwner(owner.id, {
        prenom: ownerDraft.prenom.trim() || null,
        nom: ownerDraft.nom.trim() || null,
        telephone: ownerDraft.telephone.trim() || null,
        cin: ownerDraft.cin.trim() || null,
        adresse: ownerDraft.adresse.trim() || null,
        profession: ownerDraft.profession.trim() || null,
        dateNaissance: ownerDraft.dateNaissance || null,
        lieuNaissance: ownerDraft.lieuNaissance.trim() || null,
        dateCin: ownerDraft.dateCin || null,
        nif: ownerDraft.nif.trim() || null,
        statutImpotSynthetique: ownerDraft.paiement ? 'Payé' : ownerDraft.statut,
        anneeImpotSynthetique: ownerDraft.annee ? Number(ownerDraft.annee) : null,
        datePaiementImpotSynthetique: ownerDraft.paiement || null,
      })
      setEditingOwnerId(null)
      setNotice(t('Informations du propriétaire mises à jour.'))
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.')
    } finally {
      setSavingOwner(false)
    }
  }

  async function changeOwnerPhoto(owner: AdminOwner, file: File) {
    setPhotoBusyId(owner.id)
    setError('')
    setNotice('')
    try {
      const data = await photoFileToDataUrl(file)
      const result = await api.uploadPhoto('owner', String(owner.id), data)
      if (owner.photo && owner.photo !== result.path) await api.deletePhoto(owner.photo).catch(() => undefined)
      setOwners((current) => current.map((item) => item.id === owner.id ? { ...item, photo: result.path } : item))
      setNotice(t('Photo mise à jour.'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Envoi de la photo impossible.')
    } finally {
      setPhotoBusyId(null)
    }
  }

  async function removeOwnerPhoto(owner: AdminOwner) {
    setPhotoBusyId(owner.id)
    setError('')
    setNotice('')
    try {
      await api.updateOwner(owner.id, { photoProprietaire: null })
      if (owner.photo) await api.deletePhoto(owner.photo)
      setOwners((current) => current.map((item) => item.id === owner.id ? { ...item, photo: null } : item))
      setNotice(t('Photo mise à jour.'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Suppression impossible.')
    } finally {
      setPhotoBusyId(null)
    }
  }

  if (loading) return <div className="content-card"><p>{t('Chargement…')}</p></div>
  if (error && !owners.length && !statistics && !history.length) return <div className="content-card"><div className="alert error" role="alert">{error}</div><button className="button secondary" onClick={() => { setLoading(true); setError(''); void load() }}>{t('Réessayer')}</button></div>

  if (page === 'statistics' && statistics) {
    const tax = statistics.taxStatistics
    const compliance = tax.totalOwners ? Math.round((100 * tax.paid) / tax.totalOwners) : 0

    async function downloadStatisticsPdf() {
      if (!statistics) return
      setError('')
      try {
        await downloadSectionsPdf({
          filename: `statistiques_antsirabe_${new Date().toISOString().slice(0, 10)}.pdf`,
          title: t('Statistiques'),
          subtitle: `Commune urbaine d’Antsirabe · ${new Date().toLocaleString('fr-FR')}`,
          summary: [
            `${t('Total des véhicules')} : ${statistics.totalVehicles.toLocaleString('fr-FR')}`,
            `${t('Propriétaires distincts')} : ${statistics.ownerCount.toLocaleString('fr-FR')}`,
            `${t('Signalements')} : ${statistics.totalSignals.toLocaleString('fr-FR')} · ${t('Taux traités')} : ${statistics.resolvedRate}%`,
          ],
          sections: [
            {
              heading: t('Indicateurs clés'),
              headers: [t('Indicateur'), t('Valeur')],
              rows: [
                [t('Total des véhicules'), statistics.totalVehicles.toLocaleString('fr-FR')],
                [t('En fourrière'), statistics.impoundedVehicles.toLocaleString('fr-FR')],
                [t('Propriétaires distincts'), statistics.ownerCount.toLocaleString('fr-FR')],
                [t('Signalements'), statistics.totalSignals.toLocaleString('fr-FR')],
                [t('Taux traités'), `${statistics.resolvedRate}%`],
                [t('Ce mois'), statistics.signalsThisMonth.toLocaleString('fr-FR')],
              ],
            },
            {
              heading: t('Suivi de l’impôt synthétique'),
              headers: [t('Indicateur'), t('Valeur')],
              rows: [
                [t('Total propriétaires'), String(tax.totalOwners)],
                [t('Impôt à jour'), String(tax.paid)],
                [t('Impôts en retard'), String(tax.late)],
                [t('Taux de conformité'), `${compliance}%`],
                [t('Propriétaires avec NIF'), String(tax.withNif)],
                [t('Impôt payé cette année'), `${tax.paidThisYear} / ${tax.currentYear}`],
                ['Renouvellement', t('Chaque année le 30 mars')],
              ],
            },
            {
              heading: t('Répartition des véhicules'),
              headers: [t('Type'), t('Total'), t('Actifs'), t('En fourrière')],
              rows: statistics.vehiclesByType.map((row) => [t(row.type), String(row.total), String(row.actifs), String(row.fourriere)]),
            },
            {
              heading: t('Évolution sur 6 mois'),
              headers: [t('Mois'), t('Signalements'), t('Nouveaux véhicules')],
              rows: statistics.signalsByMonth.map((row, index) => [
                monthLabel(row.month),
                String(row.value),
                String(statistics.vehiclesAddedByMonth[index]?.value ?? 0),
              ]),
            },
            {
              heading: t('Signalements par statut'),
              headers: [t('Statut'), t('Nombre')],
              rows: statistics.signalsByStatus.map((row) => [t(row.label), String(row.value)]),
            },
            {
              heading: t('Motifs principaux'),
              headers: [t('Motif'), t('Nombre')],
              rows: statistics.signalsByReason.map((row) => [t(row.label), String(row.value)]),
            },
            {
              heading: t('Propriétaires par type'),
              headers: [t('Type'), t('Nombre')],
              rows: statistics.ownersByType.map((row) => [t(row.type), String(row.value)]),
            },
            {
              heading: t('Recettes des vignettes'),
              headers: [t('Période'), t('Montant')],
              rows: [
                [t('Aujourd’hui'), formatAmount(statistics.vignetteRevenue.today)],
                [t('Ce mois-ci'), formatAmount(statistics.vignetteRevenue.month)],
                [t('Cette année'), formatAmount(statistics.vignetteRevenue.year)],
                [t('Total général'), formatAmount(statistics.vignetteRevenue.all)],
              ],
            },
            {
              heading: t('Véhicules les plus signalés'),
              headers: [t('Immatriculation'), t('Signalements')],
              rows: statistics.topReportedVehicles.map((row) => [row.immatriculation, String(row.count)]),
            },
          ],
          logo: await logoForPdf(brandLockup),
        })
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Téléchargement du PDF impossible.')
      }
    }

    return <div className="insights-page">
      <div className="insight-toolbar"><button className="button secondary" onClick={() => window.print()}>{t('Imprimer')}</button><button className="button primary" onClick={() => void downloadStatisticsPdf()}>{t('Télécharger le PDF')}</button></div>
      <div className="insight-stat-grid">
        {[
          [t('Total des véhicules'), statistics.totalVehicles],
          [t('En fourrière'), statistics.impoundedVehicles],
          [t('Propriétaires distincts'), statistics.ownerCount],
          [t('Signalements'), statistics.totalSignals],
          [t('Taux traités'), `${statistics.resolvedRate}%`],
          [t('Ce mois'), statistics.signalsThisMonth],
          [t('Impôt à jour'), tax.paid],
          [t('Impôts en retard'), tax.late],
          [t('Propriétaires avec NIF'), tax.withNif],
        ].map(([label, value]) => <article className="insight-stat" key={String(label)}><span>{label}</span><b>{value}</b></article>)}
      </div>
      <div className="insight-grid">
        <TrendChart
          title="Évolution sur 6 mois"
          labels={statistics.signalsByMonth.map((row) => monthLabel(row.month))}
          series={[
            { name: 'Signalements', color: '#2f6b57', values: statistics.signalsByMonth.map((row) => row.value) },
            { name: 'Nouveaux véhicules', color: '#e8a33d', values: statistics.vehiclesAddedByMonth.map((row) => row.value) },
          ]}
        />
        <DonutChart title="Répartition des véhicules" rows={statistics.vehiclesByType.map((row) => ({ label: row.type, value: row.total }))} />
        <BarList title="Signalements par statut" rows={statistics.signalsByStatus} />
        <BarList title="Motifs principaux" rows={statistics.signalsByReason} />
        <BarList title="Propriétaires par type" rows={statistics.ownersByType.map((row) => ({ label: row.type, value: row.value }))} />
        <MonthlyBars title="Signalements — 6 derniers mois" rows={statistics.signalsByMonth} />
        <MonthlyBars title="Nouveaux véhicules — 6 derniers mois" rows={statistics.vehiclesAddedByMonth} />
        <section className="insight-card tax-summary-card">
          <h2>{t('Suivi de l’impôt synthétique')}</h2>
          <p className="tax-deadline">{t('Renouvellement chaque année le 30 mars.')}</p>
          <div className="tax-summary-grid">
            <article><span>{t('Total propriétaires')}</span><b>{tax.totalOwners}</b></article>
            <article><span>{t('Impôt à jour')}</span><b>{tax.paid}</b></article>
            <article><span>{t('Impôts en retard')}</span><b>{tax.late}</b></article>
            <article><span>{t('Taux de conformité')}</span><b>{compliance}%</b></article>
            <article><span>{t('Propriétaires avec NIF')}</span><b>{tax.withNif}</b></article>
            <article><span>{t('Impôt payé cette année')}</span><b>{tax.paidThisYear} / {tax.currentYear}</b></article>
          </div>
          <h3>{t('Par année')}</h3>
          {tax.byYear.length === 0 ? <p>{t('Aucun impôt enregistré')}</p> : tax.byYear.map((row) => <p className="insight-top-row" key={`${row.year}-${row.statut}`}><span>{row.year} · {t(row.statut)}</span><b>{row.value}</b></p>)}
        </section>
        <section className="insight-card"><h2>{t('Véhicules les plus signalés')}</h2>{statistics.topReportedVehicles.length === 0 ? <p>{t('Aucun résultat')}</p> : statistics.topReportedVehicles.map((vehicle) => <p className="insight-top-row" key={vehicle.immatriculation}><b>{vehicle.immatriculation}</b><span>{vehicle.count}</span></p>)}</section>
        <section className="insight-card"><h2>{t('Recettes des vignettes')}</h2>{([[t('Aujourd’hui'), statistics.vignetteRevenue.today], [t('Ce mois-ci'), statistics.vignetteRevenue.month], [t('Cette année'), statistics.vignetteRevenue.year], [t('Total général'), statistics.vignetteRevenue.all]] as [string, number][]).map(([label, value]) => <p className="insight-top-row" key={label}><span>{label}</span><b>{formatAmount(value)}</b></p>)}</section>
      </div>
    </div>
  }

  if (page === 'owners') return <section className="content-card owners-page">
    <div className="insight-owner-toolbar"><h2>{t('Propriétaires')} ({owners.length})</h2><form className="insight-search" onSubmit={searchOwners}><input aria-label={t('Rechercher')} placeholder={t('Nom, téléphone ou CIN')} value={query} onChange={(event) => setQuery(event.target.value)} /><button className="button primary">{t('Rechercher')}</button></form></div>
    <div className="owner-summary">
      <article><span>{t('Total propriétaires')}</span><b>{ownerStats.total}</b></article>
      <article><span>{t('Propriétaires avec NIF')}</span><b>{ownerStats.withNif}</b></article>
      <article><span>{t('Impôt à jour')}</span><b>{ownerStats.paid}</b></article>
      <article><span>{t('Impôts en retard')}</span><b>{ownerStats.late}</b></article>
    </div>
    {notice && <p className="alert success" role="status">{notice}</p>}
    {error && <p className="alert error" role="alert">{error}</p>}
    {owners.length === 0 ? <p>{t('Aucun résultat')}</p> : <div className="insight-owner-list">{owners.map((owner) => {
      const ownerVehicles = vehiclesByOwner.get(String(owner.id)) ?? []
      const typeCounts = ownerVehicles.reduce<Record<string, number>>((counts, vehicle) => {
        const label = vehicle.type || 'Véhicule'
        counts[label] = (counts[label] ?? 0) + 1
        return counts
      }, {})
      const taxStatus = owner.statutImpotSynthetique || 'Non renseigné'
      return <article className="insight-owner-card" key={owner.id}>
        <div className="owner-card-top">
          <div className={`owner-avatar type-${ownerVehicles[0] ? typeClass(ownerVehicles[0].type) : 'cyclo'}`}>
            <OwnerPhoto src={photoUrl(owner.photo)} name={`${owner.prenom} ${owner.nom}`} />
            <label className="owner-avatar-edit" title={t('Changer la photo')}>{photoBusyId === owner.id ? '…' : '＋'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusyId === owner.id} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void changeOwnerPhoto(owner, file) }} /></label>
          </div>
          <div className="owner-identity">
            <h3>{owner.prenom} {owner.nom}</h3>
            <span>{t('Téléphone')}: {owner.telephone || '—'} · CIN: {owner.cin || '—'}</span>
            <small>{owner.adresse || '—'}</small>
            <div className="owner-chips">{Object.entries(typeCounts).map(([type, count]) => <span className={`owner-chip type-${typeClass(type)}`} key={type}>{t(type)} · {count}</span>)}</div>
          </div>
          <div className="owner-money"><b>{formatAmount(Number(owner.vignetteRevenue))}</b><span>{t('Somme payée')}</span></div>
        </div>

        <div className={`owner-tax type-${taxStatus === 'Payé' ? 'paid' : taxStatus === 'En retard' ? 'late' : 'pending'}`}>
          <div className="owner-tax-heading">
            <div><span className="tax-eyebrow">{t('Impôt synthétique')}</span><strong>{owner.nif ? `NIF ${owner.nif}` : t('NIF non renseigné')}</strong></div>
            <span className={`status-pill ${statusClass(taxStatus)}`}><i />{t(taxStatus)}</span>
          </div>
          <div className="owner-tax-facts">
            <span><small>{t('Année')}</small><b>{owner.anneeImpotSynthetique ?? '—'}</b></span>
            <span><small>{t('Échéance')}</small><b>{formatDate(owner.dateRenouvellementImpotSynthetique) || '30/03'}</b></span>
            <span><small>{t('Date de paiement')}</small><b>{formatDate(owner.datePaiementImpotSynthetique)}</b></span>
          </div>
          <div className="owner-tax-actions">
            <button type="button" className="button secondary" onClick={() => editingOwnerId === owner.id ? setEditingOwnerId(null) : startOwnerEdit(owner)}>{editingOwnerId === owner.id ? t('Fermer') : t('Modifier les informations')}</button>
            {owner.photo && <button type="button" className="table-action danger-action" onClick={() => void removeOwnerPhoto(owner)}>{t('Supprimer la photo')}</button>}
          </div>
          {editingOwnerId === owner.id && <form className="owner-edit-form" onSubmit={(event) => void saveOwner(owner, event)}>
            <div className="owner-edit-section">
              <h4>{t('Informations du propriétaire')}</h4>
              <div className="owner-edit-grid">
                <label>{t('Prénom')}<input value={ownerDraft.prenom} onChange={(event) => setOwnerDraft((current) => ({ ...current, prenom: event.target.value }))} maxLength={150} /></label>
                <label>{t('Nom')}<input value={ownerDraft.nom} onChange={(event) => setOwnerDraft((current) => ({ ...current, nom: event.target.value }))} maxLength={150} /></label>
                <label>{t('Téléphone')}<input value={ownerDraft.telephone} onChange={(event) => setOwnerDraft((current) => ({ ...current, telephone: event.target.value }))} maxLength={40} /></label>
                <label>{t('CIN')}<input value={ownerDraft.cin} onChange={(event) => setOwnerDraft((current) => ({ ...current, cin: event.target.value }))} maxLength={40} /></label>
                <label className="owner-edit-wide">{t('Adresse')}<input value={ownerDraft.adresse} onChange={(event) => setOwnerDraft((current) => ({ ...current, adresse: event.target.value }))} maxLength={255} /></label>
                <label>{t('Profession')}<input value={ownerDraft.profession} onChange={(event) => setOwnerDraft((current) => ({ ...current, profession: event.target.value }))} maxLength={150} /></label>
                <label>{t('Lieu de naissance')}<input value={ownerDraft.lieuNaissance} onChange={(event) => setOwnerDraft((current) => ({ ...current, lieuNaissance: event.target.value }))} maxLength={150} /></label>
                <label>{t('Date de naissance')}<input type="date" value={ownerDraft.dateNaissance} onChange={(event) => setOwnerDraft((current) => ({ ...current, dateNaissance: event.target.value }))} /></label>
                <label>{t('Date de délivrance CIN')}<input type="date" value={ownerDraft.dateCin} onChange={(event) => setOwnerDraft((current) => ({ ...current, dateCin: event.target.value }))} /></label>
              </div>
            </div>
            <div className="owner-edit-section">
              <h4>{t('Impôt synthétique')}</h4>
              <div className="owner-edit-grid">
                <label>{t('NIF')}<input value={ownerDraft.nif} onChange={(event) => setOwnerDraft((current) => ({ ...current, nif: event.target.value }))} placeholder="NIF du propriétaire" maxLength={40} /></label>
                <label>{t('Statut fiscal')}<select value={ownerDraft.statut} onChange={(event) => setOwnerDraft((current) => ({ ...current, statut: event.target.value }))}><option value="Payé">{t('Payé')}</option><option value="À payer">{t('À payer')}</option><option value="En retard">{t('En retard')}</option><option value="Non renseigné">{t('Non renseigné')}</option></select></label>
                <label>{t('Année')}<input type="number" min={2000} max={2100} value={ownerDraft.annee} onChange={(event) => setOwnerDraft((current) => ({ ...current, annee: event.target.value }))} /></label>
                <label>{t('Date de paiement')}<input type="date" value={ownerDraft.paiement} onChange={(event) => setOwnerDraft((current) => ({ ...current, paiement: event.target.value }))} /></label>
              </div>
            </div>
            <div className="owner-edit-actions"><button type="button" className="button secondary" onClick={() => setEditingOwnerId(null)}>{t('Annuler')}</button><button type="submit" className="button primary" disabled={savingOwner}>{savingOwner ? '…' : t('Enregistrer les informations')}</button></div>
            <p className="tax-note">{t('Renouvellement chaque année le 30 mars.')}</p>
          </form>}
        </div>

        <div className="insight-owner-vehicles">
          <div className="owner-vehicles-heading"><b>{t('Véhicules liés')} ({owner.vehicleCount})</b><span>{Object.entries(typeCounts).map(([type, count]) => `${t(type)} ${count}`).join(' · ') || '—'}</span></div>
          <div className="owner-vehicle-list">
            {ownerVehicles.map((vehicle) => <div className={`owner-vehicle type-${typeClass(vehicle.type)}`} key={vehicle.immatriculation}>
              <span className="owner-vehicle-photo"><VehicleMiniPhoto src={photoUrl(vehicle.photo)} type={vehicle.type} alt={`Véhicule ${vehicle.immatriculation}`} /></span>
              <span className="owner-vehicle-text"><strong>{vehicle.immatriculation}</strong><small>{vehicle.nom || '—'}</small></span>
              <span className={`owner-type-badge type-${typeClass(vehicle.type)}`}>{t(vehicle.type || 'Véhicule')}</span>
              <span className={`status-pill ${statusClass(vehicle.statut)}`}><i />{t(vehicle.statut)}</span>
            </div>)}
            {ownerVehicles.length === 0 && <p>{t('Aucun résultat')}</p>}
          </div>
        </div>
      </article>
    })}</div>}
  </section>

  return <section className="content-card">
    <div className="list-title history-title">
      <h2>{t('Historique')}</h2>
      <div className="history-title-side">
        <span className="record-count">{history.length} / 500</span>
        <label className="view-toggle">
          <span className="sr-only">{t('Mode d’affichage')}</span>
          <button type="button" className={historyView === 'table' ? 'selected' : ''} onClick={() => setHistoryView('table')} aria-pressed={historyView === 'table'} title={t('Vue liste')}>☷</button>
          <button type="button" className={historyView === 'grid' ? 'selected' : ''} onClick={() => setHistoryView('grid')} aria-pressed={historyView === 'grid'} title={t('Vue mosaïque')}>▦</button>
        </label>
      </div>
    </div>
    {history.length === 0
      ? <p>{t('Aucun résultat')}</p>
      : historyView === 'grid'
        ? <div className="record-mosaic history-mosaic">{history.map((entry) => (
          <article className="record-card record-card--history" key={entry.id}>
            <div className="record-card-head">
              <span className="record-card-avatar" aria-hidden="true">{String(entry.utilisateur ?? '?').slice(0, 1).toUpperCase() || '•'}</span>
              <div className="record-card-title">
                <small>{t('Action')}</small>
                <b>{entry.action}</b>
              </div>
            </div>
            <dl className="record-card-facts">
              <div><dt>{t('Date')}</dt><dd>{entry.date}</dd></div>
              <div><dt>{t('Utilisateur')}</dt><dd>{entry.utilisateur}</dd></div>
            </dl>
            {entry.detail && <p className="history-card-detail">{entry.detail}</p>}
          </article>
        ))}</div>
        : <div className="table-scroll"><table><thead><tr>{[t('Date'), t('Utilisateur'), t('Action'), t('Détail')].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{history.map((entry) => <tr key={entry.id}><td>{entry.date}</td><td>{entry.utilisateur}</td><td>{entry.action}</td><td>{entry.detail}</td></tr>)}</tbody></table></div>}
  </section>
}
