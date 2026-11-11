import { useCallback, useEffect, useState, type FormEvent } from 'react'
import cityLogo from '../../logo.png'
import busPhoto from '../../bus.jpg'
import bajajPhoto from '../../bajaj.jpg'
import { api, ApiError, listMetadata, recordsOf, type AdminUser, type ApiList, type ApiRecord, type DashboardSummary, type Id, type VignettePaymentReport } from './api'
import PublicApp from './PublicApp'
import DriverReplacementsDialog from './DriverReplacementsDialog'
import VehicleQrDialog from './VehicleQrDialog'
import VehicleQrBatchDialog from './VehicleQrBatchDialog'
import RecordDetailsDialog from './RecordDetailsDialog'
import MapPage from './MapPage'
import AccessManagementPage from './AccessManagementPage'
import AdminInsightsPage from './AdminInsightsPage'
import ScanPage from './ScanPage'
import { usePreferences } from './Preferences'
import './App.css'

type PageId = 'dashboard' | 'vehicles' | 'scan' | 'drivers' | 'signals' | 'medical' | 'payments' | 'impounds' | 'map' | 'reports' | 'notifications' | 'users' | 'passwordRequests' | 'imports' | 'statistics' | 'owners' | 'history'
type LoadState = 'loading' | 'ready' | 'error'

const navigation: { id: PageId; label: string; icon: string; group: string; vehicleType?: string }[] = [
  { id: 'dashboard', label: 'Vue d’ensemble', icon: '⌂', group: 'ESPACE DE TRAVAIL' },
  { id: 'vehicles', label: 'Tous les transports', icon: '▰', group: 'GESTION' },
  { id: 'vehicles', label: 'Cyclo-pousse', icon: '◉', group: 'GESTION', vehicleType: 'Cyclo-pousse' },
  { id: 'vehicles', label: 'Bus', icon: '▣', group: 'GESTION', vehicleType: 'Bus' },
  { id: 'vehicles', label: 'Bajaj', icon: '▱', group: 'GESTION', vehicleType: 'Bajaj' },
  { id: 'scan', label: 'Scanner QR', icon: '⌖', group: 'GESTION' },
  { id: 'drivers', label: 'Conducteurs', icon: '♙', group: 'GESTION' },
  { id: 'signals', label: 'Signalements', icon: '⚑', group: 'GESTION' },
  { id: 'medical', label: 'Visites médicales', icon: '＋', group: 'GESTION' },
  { id: 'payments', label: 'Paiements vignette', icon: '▤', group: 'GESTION' },
  { id: 'impounds', label: 'Fourrière', icon: '⌑', group: 'GESTION' },
  { id: 'map', label: 'Carte', icon: '⌖', group: 'GESTION' },
  { id: 'reports', label: 'Rapports', icon: '▥', group: 'SUIVI' },
  { id: 'notifications', label: 'Notifications', icon: '♧', group: 'SUIVI' },
  { id: 'users', label: 'Comptes contrôleurs', icon: '♙', group: 'ADMINISTRATION' },
  { id: 'passwordRequests', label: 'Demandes mot de passe', icon: '⌑', group: 'ADMINISTRATION' },
  { id: 'imports', label: 'Imports', icon: '⇧', group: 'ADMINISTRATION' },
  { id: 'statistics', label: 'Statistiques', icon: '▥', group: 'ADMINISTRATION' },
  { id: 'owners', label: 'Propriétaires', icon: '♙', group: 'ADMINISTRATION' },
  { id: 'history', label: 'Historique', icon: '◷', group: 'ADMINISTRATION' },
]

const pageMeta: Record<PageId, { title: string; subtitle: string; add?: string }> = {
  dashboard: { title: 'Vue d’ensemble', subtitle: 'Suivez l’activité du réseau de transport à Antsirabe.' },
  vehicles: { title: 'Véhicules', subtitle: 'Gérez et consultez les véhicules enregistrés.', add: 'Ajouter un véhicule' },
  scan: { title: 'Scanner un transport', subtitle: 'Identifiez un véhicule en scannant son QR code ou en saisissant son immatriculation.' },
  drivers: { title: 'Conducteurs', subtitle: 'Retrouvez les profils et les informations des conducteurs.', add: 'Ajouter un conducteur' },
  signals: { title: 'Signalements', subtitle: 'Consultez et traitez les signalements reçus.' },
  medical: { title: 'Visites médicales', subtitle: 'Suivez l’aptitude médicale des conducteurs.', add: 'Enregistrer une visite' },
  payments: { title: 'Paiements vignette', subtitle: 'Consultez les paiements et enregistrez une vignette.', add: 'Nouveau paiement' },
  impounds: { title: 'Fourrière', subtitle: 'Suivez les véhicules immobilisés et leur restitution.', add: 'Nouvelle mise en fourrière' },
  map: { title: 'Carte des véhicules', subtitle: 'Visualisez les positions des véhicules et les derniers scans enregistrés.' },
  reports: { title: 'Rapports', subtitle: 'Consultez et créez les rapports de votre administration.', add: 'Créer un rapport' },
  notifications: { title: 'Notifications', subtitle: 'Restez informé des événements récents.' },
  users: { title: 'Gestion des accès', subtitle: 'Créez et gérez les comptes contrôleurs.' },
  passwordRequests: { title: 'Gestion des accès', subtitle: 'Traitez les demandes de réinitialisation de mot de passe.' },
  imports: { title: 'Imports', subtitle: 'Importez les conducteurs et leurs visites depuis la base source.' },
  statistics: { title: 'Statistiques', subtitle: 'Indicateurs, activité et recettes de vignettes.' },
  owners: { title: 'Propriétaires', subtitle: 'Consultez les propriétaires, leurs véhicules et leurs paiements.' },
  history: { title: 'Historique', subtitle: 'Les 500 dernières opérations enregistrées.' },
}

const columns: Record<Exclude<PageId, 'dashboard' | 'scan' | 'map' | 'users' | 'passwordRequests' | 'imports' | 'statistics' | 'owners' | 'history'>, { key: string; label: string }[]> = {
  vehicles: [
    { key: 'immatriculation', label: 'Immatriculation' }, { key: 'type', label: 'Type' },
    { key: 'nom', label: 'Véhicule' }, { key: 'nomProprietaire', label: 'Propriétaire' }, { key: 'statut', label: 'Statut' },
  ],
  drivers: [
    { key: 'nom', label: 'Conducteur' }, { key: 'telephone', label: 'Téléphone' },
    { key: 'immatriculation', label: 'Véhicule' }, { key: 'role', label: 'Rôle' }, { key: 'date', label: 'Inscrit le' },
  ],
  signals: [
    { key: 'motif', label: 'Signalement' }, { key: 'description', label: 'Description' },
    { key: 'immatriculation', label: 'Véhicule' }, { key: 'date', label: 'Date' }, { key: 'statut', label: 'Statut' },
  ],
  medical: [
    { key: 'nom', label: 'Conducteur' }, { key: 'immatriculation', label: 'Véhicule' },
    { key: 'dateVisite', label: 'Date de visite' }, { key: 'expiration', label: 'Expiration' }, { key: 'observation', label: 'Observation' },
  ],
  payments: [
    { key: 'immatriculation', label: 'Véhicule' }, { key: 'montant', label: 'Montant' },
    { key: 'datePaiement', label: 'Date de paiement' }, { key: 'reference', label: 'Référence' }, { key: 'observation', label: 'Observation' },
  ],
  impounds: [
    { key: 'immatriculation', label: 'Véhicule' }, { key: 'motif', label: 'Motif' },
    { key: 'sanction', label: 'Sanction' }, { key: 'dateMise', label: 'Date d’entrée' }, { key: 'statut', label: 'Statut' },
  ],
  reports: [
    { key: 'sujet', label: 'Sujet' }, { key: 'contenu', label: 'Contenu' },
    { key: 'auteur', label: 'Auteur' }, { key: 'date', label: 'Créé le' }, { key: 'lu', label: 'État' },
  ],
  notifications: [
    { key: 'motif', label: 'Catégorie' }, { key: 'description', label: 'Notification' },
    { key: 'date', label: 'Date' }, { key: 'lu', label: 'État' },
  ],
}

interface FormField {
  name: string
  label: string
  type?: string
  options?: string[]
  optional?: boolean
  multiline?: boolean
  readOnly?: boolean
}

const fieldSets: Partial<Record<PageId, FormField[]>> = {
  vehicles: [
    { name: 'immatriculation', label: 'Immatriculation', readOnly: true },
    { name: 'type', label: 'Type', options: ['Cyclo-pousse', 'Bus', 'Bajaj'] },
    { name: 'nom', label: 'Nom du véhicule' },
    { name: 'couleurs', label: 'Couleurs', optional: true },
    { name: 'cooperative', label: 'Coopérative', optional: true },
    { name: 'statut', label: 'Statut', options: ['Normal', 'En fourrière'] },
    { name: 'expirationVignette', label: 'Expiration de la vignette', type: 'date', optional: true },
    { name: 'expirationVisiteMedicale', label: 'Expiration de la visite médicale', type: 'date', optional: true },
    { name: 'nomProprietaire', label: 'Nom du propriétaire' },
    { name: 'prenomProprietaire', label: 'Prénom du propriétaire', optional: true },
    { name: 'cinProprietaire', label: 'CIN du propriétaire', optional: true },
    { name: 'telephoneProprietaire', label: 'Téléphone du propriétaire' },
    { name: 'adresseProprietaire', label: 'Adresse du propriétaire', optional: true },
  ],
  drivers: [
    { name: 'lastName', label: 'Nom' },
    { name: 'firstName', label: 'Prénom' },
    { name: 'cin', label: 'CIN', optional: true },
    { name: 'phone', label: 'Téléphone', optional: true },
    { name: 'birthDate', label: 'Date de naissance', type: 'date', optional: true },
    { name: 'birthPlace', label: 'Lieu de naissance', optional: true },
    { name: 'cinDate', label: 'Date de délivrance CIN', type: 'date', optional: true },
    { name: 'cinPlace', label: 'CIN délivrée à', optional: true },
    { name: 'address', label: 'Adresse', optional: true },
    { name: 'role', label: 'Rôle', options: ['Titulaire', 'Remplaçant (2ème conducteur)'] },
    { name: 'licenseNumber', label: 'Numéro de permis', optional: true },
    { name: 'licenseExamDate', label: 'Date d’examen du permis', type: 'date', optional: true },
    { name: 'immatriculation', label: 'Immatriculation du véhicule', optional: true },
  ],
  medical: [
    { name: 'conducteurId', label: 'Identifiant du conducteur', type: 'number' },
    { name: 'dateVisite', label: 'Date de visite', type: 'date' },
    { name: 'dureeMois', label: 'Validité (mois)', type: 'number', options: ['1', '3', '6', '12'] },
    { name: 'observation', label: 'Observation', optional: true, multiline: true },
  ],
  payments: [
    { name: 'immatriculation', label: 'Immatriculation du véhicule' },
    { name: 'montant', label: 'Montant (Ar)', type: 'number' },
    { name: 'date', label: 'Date du paiement', type: 'date' },
    { name: 'reference', label: 'Référence', optional: true },
    { name: 'observation', label: 'Observation', optional: true, multiline: true },
  ],
  impounds: [
    { name: 'immatriculation', label: 'Immatriculation du véhicule' },
    { name: 'motif', label: 'Motif' },
    { name: 'sanction', label: 'Sanction', optional: true },
    { name: 'observation', label: 'Observation', optional: true, multiline: true },
  ],
  reports: [
    { name: 'sujet', label: 'Sujet' },
    { name: 'contenu', label: 'Contenu', multiline: true },
  ],
}

function firstString(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value)
  }
  return '—'
}

function readableDate(value: string): string {
  if (value === '—') return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR')
}

function displayValue(record: ApiRecord, key: string): string {
  const aliases: Record<string, string[]> = {
    nom: ['nom', 'name', 'prenom', 'conducteur', 'driver_name', 'title', 'sujet'],
    telephone: ['telephone', 'phone', 'tel', 'telephoneProprietaire'],
    email: ['email', 'courriel'],
    immatriculation: ['immatriculation', 'registration', 'plate', 'vehicle'],
    statut: ['statut', 'status', 'state'],
    date: ['date', 'dateVisite', 'datePaiement', 'dateMise', 'dateSignalement', 'created_at', 'createdAt'],
    montant: ['montant', 'amount'],
    motif: ['motif', 'description', 'reason', 'titre'],
    description: ['description', 'message', 'contenu', 'observation'],
    nomProprietaire: ['nomProprietaire', 'proprietaire'],
    dateVisite: ['dateVisite'],
    datePaiement: ['datePaiement'],
    dateMise: ['dateMise'],
    expiration: ['expiration'],
    sujet: ['sujet'],
    contenu: ['contenu'],
    auteur: ['prenom', 'nom'],
    sanction: ['sanction'],
    reference: ['reference'],
    observation: ['observation'],
    lu: ['lu'],
  }
  const value = firstString(record, aliases[key] ?? [key])
  if (key === 'lu') {
    if (record.lu === true || Number(record.lu) === 1) return 'Lu'
    if (record.lu === false || (record.lu !== undefined && Number(record.lu) === 0)) return 'Non lu'
  }
  if (['date', 'dateVisite', 'datePaiement', 'dateMise', 'expiration', 'prochaine_visite'].includes(key)) return readableDate(value)
  if (key === 'montant' && value !== '—') return `${Number(value).toLocaleString('fr-FR')} Ar`
  if (key === 'nomProprietaire' && value !== '—' && record.prenomProprietaire) return `${record.prenomProprietaire} ${value}`
  if (key === 'auteur' && value !== '—') return `${record.prenom ?? ''} ${record.nom ?? ''}`.trim()
  return value
}

function statusClass(value: string): string {
  const normalized = value.toLowerCase()
  if (/actif|payé|payée|validé|validée|terminé|terminée|lu|libéré/.test(normalized)) return 'success'
  if (/attente|nouveau|en cours|non lu/.test(normalized)) return 'warning'
  if (/refus|annul|expir|bloqué|immobilisé|fourrière/.test(normalized)) return 'danger'
  return 'neutral'
}

function userDisplayName(user: AdminUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.nom || user.name || user.email
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

function openPrintableDocument(title: string, content: string, width?: 58 | 80): boolean {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return false
  printWindow.opener = null
  printWindow.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      @page { size: ${width ? `${width}mm auto` : 'A4'}; margin: ${width ? '3mm' : '14mm'}; }
      * { box-sizing: border-box; } body { margin: 0; color: #17231d; font: ${width ? '12px' : '14px'} Arial, sans-serif; }
      ${width ? `body { width: ${width - 6}mm; }` : ''}
      h1 { font-size: ${width ? '17px' : '22px'}; margin: 0 0 8px; text-align: center; }
      h2 { font-size: 15px; margin: 20px 0 8px; } p { margin: 5px 0; line-height: 1.4; }
      .center { text-align: center; } .muted { color: #59665f; } .rule { border-top: 1px dashed #65716a; margin: 12px 0; }
      table { width: 100%; border-collapse: collapse; } th, td { padding: 7px; border-bottom: 1px solid #d5ddd8; text-align: left; vertical-align: top; }
      .receipt-logo { display:block; height:${width ? (width === 58 ? 34 : 46) : 46}px; width:auto; max-width:80%; margin:0 auto 4px; filter:grayscale(1) contrast(1.4); }
      .ticket-line { display:flex; justify-content:space-between; gap:6px; align-items:baseline; margin:4px 0; }
      .ticket-line b { text-align:right; overflow-wrap:anywhere; }
      .ticket-total { font-size:1.35em; font-weight:700; }
      @media print { .no-print { display: none; } }
    </style></head><body>${content}<script>window.addEventListener('load', () => setTimeout(() => window.print(), 400));</script></body></html>`)
  printWindow.document.close()
  return true
}

function formatReceiptDate(value: string, locale: string, includeTime = false): string {
  if (value === '—') return value
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(locale, includeTime
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function printPaymentReceipt(record: ApiRecord, width: 58 | 80, translate: (key: string) => string, locale: string): boolean {
  const registration = escapeHtml(firstString(record, ['immatriculation']))
  const amount = Number(record.montant ?? 0).toLocaleString(locale)
  const paymentDate = firstString(record, ['datePaiement', 'date'])
  const date = escapeHtml(formatReceiptDate(paymentDate, locale, true))
  const expiration = escapeHtml(formatReceiptDate(firstString(record, ['expirationVignette']), locale))
  const reference = escapeHtml(firstString(record, ['reference']))
  const cashier = escapeHtml(firstString(record, ['creePar']))
  const vehicleName = escapeHtml(firstString(record, ['nomVehicule']))
  const owner = escapeHtml([firstString(record, ['prenomProprietaire']), firstString(record, ['nomProprietaire'])].filter((part) => part !== '—').join(' '))
  const phone = escapeHtml(firstString(record, ['telephoneProprietaire']))
  const ticketNumber = `V-${String(record.id ?? '').padStart(6, '0')}`
  const line = (label: string, value: string) => `<div class="ticket-line"><span>${escapeHtml(label)}</span><b>${value}</b></div>`
  const content = `<main class="ticket"><header class="center"><img class="receipt-logo" src="${escapeHtml(cityLogo)}" alt="">
    <h1>${escapeHtml(translate('Commune urbaine d’Antsirabe'))}</h1><p class="muted">${escapeHtml(translate('Cyclo-pousse · Vignette'))}</p></header>
    <div class="rule"></div><p class="center"><b>${escapeHtml(translate('Reçu de paiement'))}</b></p>
    ${line(translate('Ticket N°'), escapeHtml(ticketNumber))}${line(translate('Date'), date)}<div class="rule"></div>
    ${line(translate('Cyclo'), registration)}${vehicleName !== '—' ? line(translate('Nom'), vehicleName) : ''}
    ${owner ? line(translate('Propriétaire'), owner) : ''}${phone !== '—' ? line(translate('Téléphone'), phone) : ''}
    <div class="rule"></div>${line(translate('Vignette 1 an'), '')}
    ${line(translate('TOTAL'), `${amount} Ar`)}${reference !== '—' ? line(translate('Référence'), reference) : ''}
    <div class="rule"></div><p class="center">${escapeHtml(translate('Valable du'))} ${escapeHtml(formatReceiptDate(paymentDate, locale))}</p>
    <p class="center ticket-total">${escapeHtml(translate('Au'))} ${expiration}</p><div class="rule"></div>
    <p class="center">${escapeHtml(translate('Encaissé par'))} : ${cashier === '—' ? '' : cashier}</p>
    <p class="center muted">${escapeHtml(translate('Merci · Conservez ce ticket'))}</p>
    <p class="center muted">${escapeHtml(translate('Tanàna madio, tanàna milamina'))}</p>
    <p class="center muted">${escapeHtml(translate('Imprimé le'))} ${escapeHtml(new Date().toLocaleString(locale))}</p></main>`
  return openPrintableDocument(`${translate('Reçu de paiement de vignette')} ${registration}`, content, width)
}

function formFieldValue(record: ApiRecord | null, field: FormField): string {
  if (!record) {
    if (field.name === 'type') return 'Cyclo-pousse'
    if (field.name === 'statut') return 'Normal'
    if (field.name === 'role') return 'Titulaire'
    if (field.name === 'date' && field.type === 'date') return new Date().toISOString().slice(0, 10)
    return ''
  }
  const aliases: Record<string, string> = {
    lastName: 'nomFamille',
    firstName: 'prenom',
    phone: 'telephone',
    birthDate: 'dateNaissance',
    birthPlace: 'lieuNaissance',
    cinDate: 'dateCin',
    cinPlace: 'cinDelivreeA',
    address: 'adresse',
    licenseNumber: 'numeroPermis',
    licenseExamDate: 'dateExamenPermis',
  }
  const value = record[aliases[field.name] ?? field.name]
  if (value === undefined || value === null) return ''
  const text = String(value)
  return field.type === 'date' ? text.slice(0, 10) : text
}

function countValue(summary: DashboardSummary | null, keys: string[]): number {
  if (!summary) return 0
  for (const key of keys) {
    const value = summary[key]
    if (Array.isArray(value)) {
      const total = value.reduce((sum, item) => {
        if (typeof item === 'object' && item !== null && 'total' in item) return sum + Number(item.total ?? 0)
        return sum
      }, 0)
      if (Number.isFinite(total)) return total
    }
    if (typeof value === 'number' || typeof value === 'string') {
      const count = Number(value)
      if (Number.isFinite(count)) return count
    }
  }
  return 0
}

function AdminApp() {
  const { language, setLanguage, theme, toggleTheme, t } = usePreferences()
  const requestedType = new URLSearchParams(window.location.search).get('type') ?? ''
  const initialVehicleType = ['Cyclo-pousse', 'Bus', 'Bajaj'].includes(requestedType) ? requestedType : ''
  const initialPage: PageId = initialVehicleType ? 'vehicles' : 'dashboard'
  const [currentDate] = useState(() => new Date())
  const [user, setUser] = useState<AdminUser | null>(null)
  const [authState, setAuthState] = useState<LoadState>('loading')
  const [authError, setAuthError] = useState('')
  const [passwordResetMode, setPasswordResetMode] = useState(false)
  const [passwordResetMessage, setPasswordResetMessage] = useState('')
  const [page, setPage] = useState<PageId>(initialPage)
  const [records, setRecords] = useState<ApiRecord[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState('')
  const [vehicleType, setVehicleType] = useState(initialVehicleType)
  const [driverRole, setDriverRole] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ApiRecord | null>(null)
  const [replacementDriver, setReplacementDriver] = useState<{ id: Id; nom: string } | null>(null)
  const [qrImmatriculation, setQrImmatriculation] = useState('')
  const [qrBatchRegistrations, setQrBatchRegistrations] = useState<string[]>([])
  const [detailTarget, setDetailTarget] = useState<{ kind: 'vehicle' | 'driver'; id: Id } | null>(null)
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([])
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([])
  const [listView, setListView] = useState<'table' | 'grid'>('table')
  const [vehicleSort, setVehicleSort] = useState('registration')
  const [vehicleSortDirection, setVehicleSortDirection] = useState<'asc' | 'desc'>('asc')
  const [paymentFilters, setPaymentFilters] = useState({ period: 'month', start: '', end: '', registration: '' })
  const [paymentFilterDraft, setPaymentFilterDraft] = useState(paymentFilters)
  const [paymentReport, setPaymentReport] = useState<VignettePaymentReport | null>(null)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [notificationCount, setNotificationCount] = useState(0)
  const [focusRecord, setFocusRecord] = useState<{ page: PageId; id: string } | null>(null)

  const refreshNotificationCount = useCallback(async () => {
    try {
      const notifications = recordsOf(await api.notifications())
      setNotificationCount(notifications.filter((record) => {
        return !(record.lu === true || Number(record.lu) === 1 || record.read === true || Boolean(record.read_at))
      }).length)
    } catch {
      // The notifications page reports its own loading errors.
    }
  }, [])

  const checkSession = useCallback(async () => {
    setAuthState('loading')
    setAuthError('')
    try {
      setUser(await api.me())
      setAuthState('ready')
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setUser(null)
        setAuthState('ready')
      } else {
        setAuthError(error instanceof Error ? error.message : 'Le service est momentanément indisponible.')
        setAuthState('error')
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    void api.me().then((currentUser) => {
      if (active) { setUser(currentUser); setAuthState('ready') }
    }).catch((error: unknown) => {
      if (!active) return
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setUser(null)
        setAuthState('ready')
      } else {
        setAuthError(error instanceof Error ? error.message : 'Le service est momentanément indisponible.')
        setAuthState('error')
      }
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (user?.role === 'admin') void refreshNotificationCount()
  }, [user, refreshNotificationCount])

  const loadPage = useCallback(async () => {
    if (!user) return
    setLoadState('loading')
    setLoadError('')
    if (page === 'map' || page === 'scan') {
      setRecords([])
      setLoadState('ready')
      return
    }
    try {
      if (page === 'dashboard') {
        setSummary(await api.summary())
        setRecords([])
      } else {
        let response: ApiList<ApiRecord> | ApiRecord[] | VignettePaymentReport
        switch (page) {
          case 'vehicles': response = await api.vehicles(vehicleType, filter, pageNumber, vehicleSort, vehicleSortDirection); break
          case 'drivers': response = await api.drivers(filter, driverRole, pageNumber); break
          case 'signals': response = await api.signals(); break
          case 'medical': response = await api.medicalVisits(); break
          case 'payments': {
            const report = await api.vignettePayments(paymentFilters)
            setPaymentReport(report)
            response = report
            break
          }
          case 'impounds': response = await api.impounds(); break
          case 'reports': response = await api.reports(); break
          case 'notifications': response = await api.notifications(); break
          case 'users':
          case 'passwordRequests':
          case 'imports':
          case 'statistics':
          case 'owners':
          case 'history':
            setRecords([])
            setLoadState('ready')
            return
        }
        const metadata = listMetadata(response, pageNumber)
        setRecords(recordsOf(response))
        setTotalRecords(metadata.total)
        setPageSize(metadata.pageSize || 50)
        setPageNumber(metadata.page)
      }
      setLoadState('ready')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Une erreur est survenue.')
      setLoadState('error')
    }
  }, [user, page, vehicleType, driverRole, filter, pageNumber, vehicleSort, vehicleSortDirection, paymentFilters])

  useEffect(() => { void loadPage() }, [loadPage])

  useEffect(() => {
    if (!focusRecord) return
    const row = document.querySelector(`[data-record-id="${focusRecord.id}"]`)
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const timer = window.setTimeout(() => setFocusRecord(null), 4000)
    return () => window.clearTimeout(timer)
  }, [focusRecord, records])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setAuthError('')
    const form = new FormData(event.currentTarget)
    try {
      const currentUser = await api.login({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      })
      setUser(currentUser)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Connexion impossible. Vérifiez vos identifiants.')
    } finally { setBusy(false) }
  }

  async function handlePasswordResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setAuthError('')
    setPasswordResetMessage('')
    const form = new FormData(event.currentTarget)
    try {
      const response = await api.requestPasswordReset(String(form.get('email') ?? ''))
      setPasswordResetMessage(response.message)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'La demande n’a pas pu être envoyée.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    setBusy(true)
    try {
      await api.logout()
      setUser(null)
      setPage('dashboard')
      setRecords([])
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'La déconnexion a échoué.')
    } finally { setBusy(false) }
  }

  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setActionError('')
    const form = new FormData(event.currentTarget)
    const data: Record<string, string | number> = {}
    for (const field of fieldSets[page] ?? []) {
      const value = String(form.get(field.name) ?? '')
      data[field.name] = ['montant', 'conducteurId', 'dureeMois'].includes(field.name) ? Number(value) : value
    }
    try {
      if (editingRecord && page === 'vehicles') {
        const immatriculation = String(editingRecord.immatriculation ?? '')
        const updateData: Record<string, string | number | null> = { ...data }
        delete updateData.immatriculation
        for (const name of ['expirationVignette', 'expirationVisiteMedicale']) {
          if (updateData[name] === '') updateData[name] = null
        }
        await api.updateVehicle(immatriculation, updateData)
      } else if (editingRecord && page === 'drivers') {
        if (editingRecord.id === undefined) throw new Error('Ce conducteur ne possède pas d’identifiant.')
        const driverData = { ...data }
        for (const name of ['birthDate', 'cinDate', 'licenseExamDate']) {
          if (!driverData[name]) delete driverData[name]
        }
        await api.updateDriver(editingRecord.id, driverData)
      } else if (page === 'vehicles') {
        const vehicleData = { ...data }
        for (const name of ['expirationVignette', 'expirationVisiteMedicale']) {
          if (!vehicleData[name]) delete vehicleData[name]
        }
        await api.createVehicle(vehicleData)
      }
      else if (page === 'drivers') {
        const driverData = { ...data }
        for (const name of ['birthDate', 'cinDate', 'licenseExamDate']) {
          if (!driverData[name]) delete driverData[name]
        }
        await api.createDriver(driverData)
      }
      else if (page === 'medical') await api.createMedicalVisit(data)
      else if (page === 'payments') await api.createVignettePayment(data)
      else if (page === 'impounds') await api.createImpound(data)
      else if (page === 'reports') await api.createReport(data)
      else throw new Error('Cette action n’est pas disponible pour cette rubrique.')
      setModalOpen(false)
      setEditingRecord(null)
      await loadPage()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Enregistrement impossible.')
    } finally { setBusy(false) }
  }

  function startEditing(record: ApiRecord) {
    setEditingRecord(record)
    setActionError('')
    setModalOpen(true)
  }

  async function removeRecord(record: ApiRecord) {
    const label = page === 'vehicles' ? String(record.immatriculation ?? 'ce véhicule') : String(record.nom ?? 'ce conducteur')
    if (!window.confirm(`Supprimer définitivement ${label} ?`)) return
    try {
      if (page === 'vehicles') {
        if (!record.immatriculation) throw new Error('Ce véhicule ne possède pas d’immatriculation.')
        await api.removeVehicle(record.immatriculation)
      } else {
        if (record.id === undefined) throw new Error('Ce conducteur ne possède pas d’identifiant.')
        await api.removeDriver(record.id)
      }
      setActionError('')
      await loadPage()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'La suppression a échoué.')
    }
  }

  async function runRowAction(record: ApiRecord, action: 'signal' | 'release' | 'read' | 'report-read') {
    if (record.id === undefined) {
      setActionError('Cette entrée ne possède pas d’identifiant pour effectuer cette action.')
      return
    }
    setActionError('')
    try {
      if (action === 'signal') {
        const status = firstString(record, ['statut', 'status']) === 'Nouveau' ? 'En cours' : 'Traité'
        await api.updateSignal(record.id, status)
      } else if (action === 'release') await api.releaseImpound(record.id)
      else if (action === 'report-read') await api.markReportRead(record.id)
      else await api.readNotification(record.id)
      await loadPage()
      if (action === 'read') await refreshNotificationCount()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'La mise à jour a échoué.')
    }
  }

  async function removePayment(record: ApiRecord) {
    if (record.id === undefined || !window.confirm(`Supprimer le paiement ${String(record.id)} pour ${String(record.immatriculation ?? '')} ?`)) return
    setActionError('')
    try {
      await api.removeVignettePayment(record.id)
      await loadPage()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'La suppression du paiement a échoué.')
    }
  }

  function applyPaymentFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPaymentFilters({ ...paymentFilterDraft })
    setPageNumber(1)
  }

  function exportPaymentCsv() {
    const headers = ['Date', 'Immatriculation', 'Véhicule', 'Montant (Ar)', 'Référence', 'Observation']
    const rows = records.map((record) => [
      firstString(record, ['datePaiement']),
      firstString(record, ['immatriculation']),
      firstString(record, ['nomVehicule']),
      String(record.montant ?? ''),
      firstString(record, ['reference']),
      firstString(record, ['observation']),
    ])
    const csvValue = (value: string) => {
      const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value
      return `"${safeValue.replace(/"/g, '""')}"`
    }
    const contents = `\uFEFF${[headers, ...rows].map((row) => row.map(csvValue).join(';')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'rapport_paiements_vignettes.csv'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function printPaymentReport() {
    const rows = records.map((record) => `<tr><td>${escapeHtml(readableDate(firstString(record, ['datePaiement'])))}</td>
      <td>${escapeHtml(firstString(record, ['immatriculation']))}</td><td>${escapeHtml(firstString(record, ['nomVehicule']))}</td>
      <td>${escapeHtml(Number(record.montant ?? 0).toLocaleString('fr-FR'))} Ar</td>
      <td>${escapeHtml(firstString(record, ['reference']))}</td></tr>`).join('')
    const content = `<h1>Rapports des paiements de vignette</h1>
      <p>Total de la période : <b>${Number(paymentReport?.totalAmount ?? 0).toLocaleString('fr-FR')} Ar</b></p>
      <p>Total de toute la flotte : <b>${Number(paymentReport?.globalAmount ?? 0).toLocaleString('fr-FR')} Ar</b></p>
      <p>Paiements affichés : ${records.length}</p>
      <table><thead><tr><th>Date</th><th>Immatriculation</th><th>Nom</th><th>Montant</th><th>Référence</th></tr></thead><tbody>${rows}</tbody></table>`
    if (!openPrintableDocument('Rapports des paiements vignette', content)) {
      setActionError('La fenêtre d’impression a été bloquée. Autorisez les fenêtres contextuelles puis réessayez.')
    }
  }

  async function markAllRead() {
    setActionError('')
    try {
      await api.readAllNotifications()
      await loadPage()
      await refreshNotificationCount()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Impossible de marquer les notifications comme lues.')
    }
  }

  async function openNotification(record: ApiRecord) {
    const plate = String(record.immatriculationCible ?? '')
    const cible = String(record.cible ?? '')
    const targetId = record.idCible === undefined || record.idCible === null ? '' : String(record.idCible)
    if (record.id !== undefined && record.lu !== true && Number(record.lu) !== 1) {
      try {
        await api.readNotification(record.id)
        await refreshNotificationCount()
      } catch {
        // La navigation reste possible même si le marquage « lu » échoue.
      }
    }
    if (!cible) {
      if (plate) setDetailTarget({ kind: 'vehicle', id: plate })
      return
    }
    if (cible === 'vehicule') {
      if (plate) setDetailTarget({ kind: 'vehicle', id: plate })
      return
    }
    if (cible === 'conducteur' && targetId) {
      setDetailTarget({ kind: 'driver', id: targetId })
      return
    }
    if (cible === 'paiement' && plate) {
      const filters = { period: 'all', start: '', end: '', registration: plate }
      setPaymentFilters(filters)
      setPaymentFilterDraft(filters)
    }
    const targets: Record<string, PageId> = {
      signalement: 'signals',
      paiement: 'payments',
      fourriere: 'impounds',
      rapport: 'reports',
    }
    const target = targets[cible]
    if (!target) return
    setFilter('')
    setPageNumber(1)
    setPage(target)
    if (targetId) setFocusRecord({ page: target, id: targetId })
  }

  function printSelectedReports() {
    const selected = records.filter((record) => selectedReportIds.includes(String(record.id ?? '')))
    if (!selected.length) return
    const rows = selected.map((record) => `<tr><td>${escapeHtml(firstString(record, ['sujet']))}</td><td>${escapeHtml(firstString(record, ['contenu']))}</td><td>${escapeHtml(`${firstString(record, ['prenom'])} ${firstString(record, ['nom'])}`.trim())}</td><td>${escapeHtml(readableDate(firstString(record, ['date'])))}</td></tr>`).join('')
    const reportTitle = t('Rapport de synthèse — Antsirabe')
    const content = `<h1>${escapeHtml(reportTitle)}</h1><p class="muted">${escapeHtml(t('Généré le'))} ${escapeHtml(new Date().toLocaleString('fr-FR'))} · ${selected.length} rapport(s)</p>
      <table><thead><tr><th>${escapeHtml(t('Sujet'))}</th><th>${escapeHtml(t('Contenu'))}</th><th>${escapeHtml(t('Auteur'))}</th><th>${escapeHtml(t('Date'))}</th></tr></thead><tbody>${rows}</tbody></table>`
    if (!openPrintableDocument(reportTitle, content)) {
      setActionError('La fenêtre d’impression a été bloquée. Autorisez les fenêtres contextuelles puis réessayez.')
    }
  }

  function printReceipt(record: ApiRecord, width: 58 | 80) {
    const locale = language === 'mg' ? 'mg-MG' : language === 'en' ? 'en-GB' : 'fr-FR'
    if (!printPaymentReceipt(record, width, t, locale)) {
      setActionError('La fenêtre du reçu a été bloquée. Autorisez les fenêtres contextuelles puis réessayez.')
    }
  }

  if (authState === 'loading') {
    return <div className="screen-state"><span className="spinner" /><p>{t('Vérification de votre session…')}</p></div>
  }

  if (authState === 'error') {
    return <div className="screen-state auth-error"><div><span className="state-icon">!</span><h2>{t('Service indisponible')}</h2><p>{authError}</p><button className="button primary" onClick={() => void checkSession()}>{t('Réessayer')}</button></div></div>
  }

  if (!user) {
    return (
      <main className="login-screen">
        <section className="login-art" aria-label="Administration Cyclo-pousse Antsirabe">
          <div className="login-brand"><span className="brand-mark">C</span><span>Cyclo-pousse<strong>Antsirabe</strong></span></div>
          <div className="login-art-content">
            <span className="eyebrow light">{t('PORTAIL ADMINISTRATEUR')}</span>
            <h1>{t('Une ville en mouvement,')}<br />{t('une gestion simplifiée.')}</h1>
            <p>{t('La plateforme de gestion du réseau de transport urbain d’Antsirabe.')}</p>
            <div className="art-stat"><span className="art-stat-icon">↗</span><span><b>{t('Mobilité locale')}</b><small>{t('Au service de tous les habitants')}</small></span></div>
          </div>
          <span className="login-art-footer">ANTSIRABE · MADAGASCAR</span>
        </section>
        <section className="login-panel">
          <div className="login-preferences">
            <label><span className="sr-only">{t('Langue')}</span><select aria-label={t('Langue')} value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}><option value="mg">MG</option><option value="fr">FR</option><option value="en">EN</option></select></label>
            <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? t('Mode jour') : t('Mode nuit')}>{theme === 'dark' ? '☀' : '☾'}</button>
          </div>
          <div className="login-mobile-brand"><span className="brand-mark">C</span><span>Cyclo-pousse<strong>Antsirabe</strong></span></div>
          <div className="login-form-wrap">
            <span className="eyebrow">{passwordResetMode ? 'RÉCUPÉRATION DU COMPTE' : t('BON RETOUR')}</span>
            <h2>{passwordResetMode ? t('Mot de passe oublié ?') : t('Connexion')}</h2>
            <p className="muted login-intro">{passwordResetMode ? 'Saisissez votre adresse e-mail. Une demande sera transmise à l’administration.' : t('Connectez-vous à votre espace d’administration.')}</p>
            {authError && <div className="alert error" role="alert">{authError}</div>}
            {passwordResetMessage && <div className="alert success" role="status">{passwordResetMessage}</div>}
            {passwordResetMode ? (
              <>
                <form onSubmit={(event) => void handlePasswordResetRequest(event)} className="login-form">
                  <label htmlFor="reset-email">{t('Adresse e-mail')}</label>
                  <input id="reset-email" name="email" type="email" autoComplete="email" placeholder="nom@exemple.mg" required />
                  <button className="button primary login-button" type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer la demande'} <span>→</span></button>
                </form>
                <button className="forgot-link" onClick={() => { setPasswordResetMode(false); setPasswordResetMessage(''); setAuthError('') }}>← {t('Connexion')}</button>
              </>
            ) : (
              <>
                <form onSubmit={handleLogin} className="login-form">
                  <label htmlFor="email">{t('Adresse e-mail')}</label>
                  <input id="email" name="email" type="email" autoComplete="username" placeholder="nom@exemple.mg" required />
                  <label htmlFor="password">{t('Mot de passe')}</label>
                  <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Saisissez votre mot de passe" required />
                  <button className="button primary login-button" type="submit" disabled={busy}>{busy ? 'Connexion…' : t('Se connecter')} <span>→</span></button>
                </form>
                <button className="forgot-link" onClick={() => { setPasswordResetMode(true); setPasswordResetMessage(''); setAuthError('') }}>{t('Mot de passe oublié ?')}</button>
                <p className="login-security"><span>▣</span> {t('Connexion sécurisée par session')}</p>
              </>
            )}
          </div>
          <div className="login-copyright">© 2026 Cyclo-pousse Antsirabe <span>·</span> Administration</div>
        </section>
      </main>
    )
  }

  const meta = pageMeta[page]
  const headingTitle = page === 'vehicles' ? vehicleType || 'Tous les transports' : meta.title
  const activeNav = page === 'vehicles'
    ? navigation.find((item) => item.id === page && item.vehicleType === vehicleType) ?? navigation.find((item) => item.id === page && !item.vehicleType)
    : navigation.find((item) => item.id === page)
  const listColumns = page === 'dashboard' || page === 'scan' || page === 'map' || page === 'users' || page === 'passwordRequests' || page === 'imports' || page === 'statistics' || page === 'owners' || page === 'history' ? [] : columns[page]
  const displayedRecords = records

  return (
    <div className="app-shell">
      {mobileMenu && <button className="sidebar-backdrop" aria-label={t('Fermer')} onClick={() => setMobileMenu(false)} />}
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">C</span>
          <span className="brand-copy">Cyclo-pousse<strong>Antsirabe</strong></span>
          <button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label={t('Fermer')}>×</button>
        </div>
        <div className="workspace-switch"><span className="workspace-symbol">A</span><span><b>{t('Administration')}</b><small>Antsirabe, Madagascar</small></span><span className="chevron">⌄</span></div>
        <nav className="side-nav" aria-label="Navigation principale">
          {['ESPACE DE TRAVAIL', 'GESTION', 'SUIVI', 'ADMINISTRATION'].map((group) => (
            <div className="nav-group" key={group}>
              <p className="nav-heading">{t(group)}</p>
              {navigation.filter((item) => item.group === group && (user.role === 'admin' || !['drivers', 'medical', 'payments', 'impounds', 'map', 'notifications', 'users', 'passwordRequests', 'imports', 'statistics', 'owners', 'history'].includes(item.id))).map((item) => (
                <button key={`${item.id}-${item.vehicleType ?? item.label}`} className={`nav-item ${page === item.id && (item.id !== 'vehicles' || item.vehicleType === vehicleType) ? 'active' : ''}`} onClick={() => { setPage(item.id); if (item.id === 'vehicles') setVehicleType(item.vehicleType ?? ''); setFilter(''); setPageNumber(1); setMobileMenu(false) }}>
                  <span className="nav-icon">{item.icon}</span><span>{t(item.label)}</span>
                  {item.id === 'notifications' && notificationCount > 0 && <span className="nav-badge">{notificationCount}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon">?</span><b>Besoin d’aide ?</b><p>Notre équipe est là pour vous accompagner.</p><button onClick={() => setActionError('Contactez votre administrateur système pour obtenir de l’aide.')}>Contacter le support <span>→</span></button></div>
          <div className="user-card"><span className="avatar">{userDisplayName(user).slice(0, 1).toUpperCase()}</span><span className="user-details"><b>{userDisplayName(user)}</b><small>{user.role || 'Administrateur'}</small></span><button className="logout-button" onClick={() => void handleLogout()} title="Se déconnecter" disabled={busy}>↪</button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setMobileMenu(true)} aria-label="Ouvrir le menu">☰</button>
          <div className="breadcrumb"><span>{t('Administration')}</span><span className="crumb-slash">/</span><b>{activeNav ? t(activeNav.label) : ''}</b></div>
          <div className="topbar-actions">
            <label className="preference-select"><span className="sr-only">{t('Langue')}</span><select aria-label={t('Langue')} value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}><option value="mg">MG</option><option value="fr">FR</option><option value="en">EN</option></select></label>
            <button className="theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? t('Mode jour') : t('Mode nuit')} title={theme === 'dark' ? t('Mode jour') : t('Mode nuit')}>{theme === 'dark' ? '☀' : '☾'}</button>
            <span className="today-date">{currentDate.toLocaleDateString(language === 'mg' ? 'mg-MG' : language === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>{user.role === 'admin' && <button className="topbar-icon" aria-label={t('Notifications')} onClick={() => setPage('notifications')}>♧{notificationCount > 0 && <i />}</button>}<span className="top-avatar">{userDisplayName(user).slice(0, 1).toUpperCase()}</span></div>
        </header>
        <div className="page-content">
          {page !== 'map' && <div className="page-heading">
            <div><span className="eyebrow">{page === 'vehicles' ? `${vehicleType || 'TRANSPORT'} · ANTSIRABE`.toUpperCase() : ['statistics', 'owners', 'history'].includes(page) ? 'ADMINISTRATION · ANTSIRABE' : 'CYCLO-POUSSE · ANTSIRABE'}</span><h1>{t(headingTitle)}</h1><p>{t(meta.subtitle)}</p></div>
            {meta.add && fieldSets[page] && (user.role === 'admin' || page === 'reports') && <button className="button primary add-button" onClick={() => { setEditingRecord(null); setModalOpen(true); setActionError('') }}><span>＋</span> {t(meta.add)}</button>}
          </div>}

          {actionError && <div className="alert error action-alert" role="alert">{actionError}<button onClick={() => setActionError('')} aria-label="Fermer">×</button></div>}

          {page === 'scan' ? <ScanPage onVehicleFound={(registration) => { setPage('vehicles'); setVehicleType(''); setFilter(registration); setPageNumber(1) }} /> : page === 'map' ? <MapPage /> : page === 'users' || page === 'passwordRequests' || page === 'imports' ? <AccessManagementPage key={page} initialTab={page} /> : page === 'statistics' || page === 'owners' || page === 'history' ? <AdminInsightsPage key={page} page={page} /> : page === 'dashboard' ? (
            loadState === 'loading' ? <LoadingState /> : loadState === 'error' ? <ErrorState message={loadError} retry={() => void loadPage()} /> : (
              <Dashboard summary={summary} onNavigate={setPage} currentDate={currentDate} />
            )
          ) : (
            <section className="content-card">
              <div className="list-toolbar">
                <div className="list-title"><h2>{t(headingTitle)}</h2><span className="record-count">{totalRecords} {t(totalRecords === 1 ? 'résultat' : 'résultats')}</span></div>
                <div className="list-filters">
                  {page === 'vehicles' && user.role === 'admin' && selectedVehicleIds.length > 0 && <button className="button secondary" onClick={() => setQrBatchRegistrations(selectedVehicleIds)}>Imprimer QR ({selectedVehicleIds.length})</button>}
                  {page === 'reports' && selectedReportIds.length > 0 && <button className="button secondary" onClick={printSelectedReports}>{t('Générer le rapport de sélection')} ({selectedReportIds.length})</button>}
                  {page === 'vehicles' && <><label className="view-toggle"><span className="sr-only">{t('Mode d’affichage')}</span><button type="button" className={listView === 'table' ? 'selected' : ''} onClick={() => setListView('table')} aria-pressed={listView === 'table'} title={t('Vue liste')}>☷</button><button type="button" className={listView === 'grid' ? 'selected' : ''} onClick={() => setListView('grid')} aria-pressed={listView === 'grid'} title={t('Vue mosaïque')}>▦</button></label><select aria-label={t('Trier les véhicules')} value={vehicleSort} onChange={(event) => setVehicleSort(event.target.value)}><option value="registration">{t('Trier : immatriculation')}</option><option value="date">{t('Trier : date d’ajout')}</option><option value="owner">{t('Trier : propriétaire')}</option><option value="address">{t('Trier : adresse')}</option><option value="type">{t('Trier : type')}</option></select><button className="button secondary sort-direction" onClick={() => setVehicleSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')} aria-label={t('Inverser le sens du tri')}>{vehicleSortDirection === 'asc' ? '↑' : '↓'}</button></>}
                  {(page === 'vehicles' || page === 'drivers') && <label className="search-field"><span>⌕</span><input aria-label={t('Rechercher')} value={filter} onChange={(event) => { setFilter(event.target.value); setPageNumber(1) }} placeholder={page === 'vehicles' ? `${t('Rechercher')} ${t('Véhicules').toLocaleLowerCase()}…` : `${t('Rechercher')} ${t('Conducteurs').toLocaleLowerCase()}…`} /><kbd>⌘ K</kbd></label>}
                  {page === 'vehicles' && <select aria-label="Filtrer par type" value={vehicleType} onChange={(event) => setVehicleType(event.target.value)}><option value="">{t('Tous les types')}</option><option value="Cyclo-pousse">{t('Cyclo-pousse')}</option><option value="Bus">{t('Bus')}</option><option value="Bajaj">{t('Bajaj')}</option></select>}
                  {page === 'drivers' && <select aria-label={t('Filtrer par rôle')} value={driverRole} onChange={(event) => setDriverRole(event.target.value)}><option value="">{t('Tous les rôles')}</option><option value="Titulaire">{t('Titulaire')}</option><option value="Remplaçant (2ème conducteur)">{t('Remplaçant')}</option></select>}
                  {page === 'notifications' && <button className="button secondary" onClick={() => void markAllRead()}>{t('Tout marquer comme lu')}</button>}
                </div>
              </div>
              {page === 'payments' && <>
                <form className="payment-report-filters" onSubmit={(event) => applyPaymentFilters(event)}>
                  <label>{t('Période')}<select value={paymentFilterDraft.period} onChange={(event) => setPaymentFilterDraft((current) => ({ ...current, period: event.target.value }))}>
                    <option value="day">{t('Journalier (aujourd’hui)')}</option><option value="month">{t('Mensuel (ce mois)')}</option><option value="year">{t('Annuel (cette année)')}</option><option value="all">{t('Toute la période')}</option>
                  </select></label>
                  <label>{t('Immatriculation')}<input value={paymentFilterDraft.registration} onChange={(event) => setPaymentFilterDraft((current) => ({ ...current, registration: event.target.value }))} placeholder={t('Toutes les immatriculations')} /></label>
                  <label>{t('Du')}<input type="date" value={paymentFilterDraft.start} onChange={(event) => setPaymentFilterDraft((current) => ({ ...current, start: event.target.value }))} /></label>
                  <label>{t('Au')}<input type="date" value={paymentFilterDraft.end} onChange={(event) => setPaymentFilterDraft((current) => ({ ...current, end: event.target.value }))} /></label>
                  <button className="button primary" type="submit">{t('Appliquer')}</button>
                </form>
                <div className="payment-report-actions">
                  <button className="button secondary" onClick={exportPaymentCsv} disabled={records.length === 0}>{t('Télécharger CSV')}</button>
                  <button className="button secondary" onClick={printPaymentReport} disabled={records.length === 0}>{t('Imprimer le rapport')}</button>
                </div>
                <div className="payment-report-summary">
                  <article><b>{Number(paymentReport?.totalAmount ?? 0).toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR')} Ar</b><span>{t('Total de la période')}</span></article>
                  <article><b>{Number(paymentReport?.globalAmount ?? 0).toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR')} Ar</b><span>{t('Total de toute la flotte')}</span></article>
                  <article><b>{paymentReport?.total ?? 0}</b><span>{t('Paiements affichés')}</span></article>
                </div>
                <section className="payment-report-by-vehicle"><h3>{t('Somme par cyclo-pousse')}</h3>
                  {paymentReport?.byVehicle.length ? <div className="table-scroll"><table><thead><tr><th>{t('Immatriculation')}</th><th>{t('Nom du véhicule')}</th><th>{t('Nombre de paiements')}</th><th>{t('Total payé')}</th></tr></thead><tbody>{paymentReport.byVehicle.map((item) => <tr key={item.immatriculation}><td><span className="plate">{item.immatriculation}</span></td><td>{item.nomVehicule || '—'}</td><td>{item.paymentCount}</td><td><b>{Number(item.totalAmount).toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR')} Ar</b></td></tr>)}</tbody></table></div> : <p>{t('Aucun paiement pour cette période.')}</p>}
                </section>
              </>}
              {loadState === 'loading' ? <LoadingState /> : loadState === 'error' ? <ErrorState message={loadError} retry={() => void loadPage()} /> : records.length === 0 ? <EmptyState title="Aucun résultat" message="Aucune donnée n’est disponible pour le moment." /> : (
                <>
                  {page === 'vehicles' && listView === 'grid' ? <div className="vehicle-grid">{displayedRecords.map((record, index) => {
                    const registration = String(record.immatriculation ?? '')
                    return <article className="vehicle-card" key={record.id ?? registration ?? index}>
                      {user.role === 'admin' && <label className="vehicle-card-select"><input type="checkbox" aria-label={`${t('Sélectionner')} ${registration || 'ce véhicule'}`} checked={selectedVehicleIds.includes(registration)} onChange={(event) => setSelectedVehicleIds((current) => event.target.checked ? [...new Set([...current, registration])] : current.filter((item) => item !== registration))} /> {t('Sélectionner')}</label>}
                      <span className="vehicle-card-type">{t(String(record.type ?? 'Véhicule'))}</span><h3 className="plate">{registration || '—'}</h3>
                      <p><b>{String(record.nom ?? '—')}</b></p><p>{String(record.prenomProprietaire ? `${record.prenomProprietaire} ${record.nomProprietaire ?? ''}` : record.nomProprietaire ?? '—')}</p>
                      <span className={`status-pill ${statusClass(firstString(record, ['statut', 'status']))}`}><i />{t(firstString(record, ['statut', 'status']))}</span>
                      <div className="vehicle-card-actions">{registration && <><button className="table-action" onClick={() => setDetailTarget({ kind: 'vehicle', id: registration })}>{t('Voir')}</button>{user.role === 'admin' && <button className="table-action" onClick={() => setQrImmatriculation(registration)}>QR</button>}</>}{user.role === 'admin' && <><button className="table-action" onClick={() => startEditing(record)}>{t('Modifier')}</button><button className="table-action danger-action" onClick={() => void removeRecord(record)}>{t('Supprimer')}</button></>}</div>
                    </article>
                  })}</div> : <div className="table-scroll"><table><thead><tr>{user.role === 'admin' && page === 'vehicles' && <th><input type="checkbox" aria-label="Sélectionner tous les véhicules de cette page" checked={records.length > 0 && records.every((record) => selectedVehicleIds.includes(String(record.immatriculation ?? '')))} onChange={(event) => setSelectedVehicleIds((current) => event.target.checked ? [...new Set([...current, ...records.map((record) => String(record.immatriculation ?? '')).filter(Boolean)])] : current.filter((registration) => !records.some((record) => String(record.immatriculation ?? '') === registration)))} /></th>}{page === 'reports' && <th><input type="checkbox" aria-label="Sélectionner tous les rapports de cette page" checked={records.length > 0 && records.every((record) => selectedReportIds.includes(String(record.id ?? '')))} onChange={(event) => setSelectedReportIds((current) => event.target.checked ? [...new Set([...current, ...records.map((record) => String(record.id ?? '')).filter(Boolean)])] : current.filter((id) => !records.some((record) => String(record.id ?? '') === id)))} /></th>}{listColumns.map((column) => <th key={column.key}>{t(column.label)}</th>)}{['vehicles', 'drivers', 'payments'].includes(page) || user.role === 'admin' && ['signals', 'impounds', 'reports', 'notifications'].includes(page) ? <th>Action</th> : null}</tr></thead>
                    <tbody>{displayedRecords.map((record, index) => {
                      const status = firstString(record, ['statut', 'status'])
                      return <tr key={record.id ?? index} data-record-id={record.id !== undefined ? String(record.id) : undefined} className={focusRecord && focusRecord.page === page && String(record.id) === focusRecord.id ? 'row-focused' : undefined}>
                        {user.role === 'admin' && page === 'vehicles' && <td><input type="checkbox" aria-label={`Sélectionner ${record.immatriculation ?? 'ce véhicule'}`} checked={selectedVehicleIds.includes(String(record.immatriculation ?? ''))} onChange={(event) => { const registration = String(record.immatriculation ?? ''); setSelectedVehicleIds((current) => event.target.checked ? [...new Set([...current, registration])] : current.filter((item) => item !== registration)) }} /></td>}
                        {page === 'reports' && <td><input type="checkbox" aria-label={`Sélectionner le rapport ${record.sujet ?? ''}`} checked={selectedReportIds.includes(String(record.id ?? ''))} onChange={(event) => { const id = String(record.id ?? ''); setSelectedReportIds((current) => event.target.checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)) }} /></td>}
                        {listColumns.map((column) => {
                          const text = displayValue(record, column.key)
                          return <td key={column.key}>{page === 'notifications' && column.key === 'description' && (record.cible || record.immatriculationCible) ? <button type="button" className="notification-link" onClick={() => void openNotification(record)}>{text}<span aria-hidden="true">→</span></button> : column.key === 'statut' || column.key === 'lu' ? <span className={`status-pill ${statusClass(text)}`}><i />{t(text)}</span> : column.key === 'nom' ? <span className="table-person"><span className="mini-avatar">{text === '—' ? '•' : text.slice(0, 1).toUpperCase()}</span><b>{text}</b></span> : <span className={column.key === 'immatriculation' ? 'plate' : ''}>{column.key === 'type' ? t(text) : text}</span>}</td>
                        })}
                        {user.role === 'admin' && page === 'payments' && <td><button className="table-action" onClick={() => printReceipt(record, 58)}>{t('Reçu 58 mm')}</button><button className="table-action" onClick={() => printReceipt(record, 80)}>{t('Reçu 80 mm')}</button><button className="table-action danger-action" onClick={() => void removePayment(record)}>{t('Supprimer')}</button></td>}
                        {(page === 'vehicles' || page === 'drivers') && <td>{page === 'vehicles' && record.immatriculation && <><button className="table-action" onClick={() => setDetailTarget({ kind: 'vehicle', id: record.immatriculation ?? '' })}>{t('Voir')}</button>{user.role === 'admin' && <button className="table-action" onClick={() => setQrImmatriculation(record.immatriculation ?? '')}>QR</button>}</>}{page === 'drivers' && record.id !== undefined && <><button className="table-action" onClick={() => { if (record.id !== undefined) setDetailTarget({ kind: 'driver', id: record.id }) }}>{t('Voir')}</button>{user.role === 'admin' && <button className="table-action" onClick={() => { if (record.id !== undefined) setReplacementDriver({ id: record.id, nom: String(record.nom ?? 'ce conducteur') }) }}>{t('Remplacements')}</button>}</>}{user.role === 'admin' && <><button className="table-action" onClick={() => startEditing(record)}>{t('Modifier')}</button><button className="table-action danger-action" onClick={() => void removeRecord(record)}>{t('Supprimer')}</button></>}</td>}
                        {user.role === 'admin' && ['signals', 'impounds', 'reports', 'notifications'].includes(page) && <td>{page === 'signals' ? <button className="table-action" disabled={status === 'Traité'} onClick={() => void runRowAction(record, 'signal')}>{status === 'Nouveau' ? 'Prendre en charge' : status === 'Traité' ? 'Traité' : 'Traiter'} →</button> : page === 'impounds' ? <button className="table-action" disabled={status === 'Libéré'} onClick={() => void runRowAction(record, 'release')}>{status === 'Libéré' ? 'Restitué' : 'Libérer'} →</button> : <button className="table-action" disabled={record.lu === true || Number(record.lu) === 1} onClick={() => void runRowAction(record, page === 'reports' ? 'report-read' : 'read')}>{record.lu === true || Number(record.lu) === 1 ? 'Déjà lu' : 'Marquer lu →'}</button>}</td>}
                      </tr>
                    })}</tbody>
                  </table></div>}
                  {(page === 'vehicles' || page === 'drivers') && <div className="pagination"><span>{t('Page')} {pageNumber} · {totalRecords} {t(totalRecords === 1 ? 'résultat' : 'résultats')}</span><div><button disabled={pageNumber <= 1} onClick={() => setPageNumber((value) => Math.max(1, value - 1))}>← {t('Précédent')}</button><button disabled={pageNumber * pageSize >= totalRecords} onClick={() => setPageNumber((value) => value + 1)}>{t('Suivant')} →</button></div></div>}
                </>
              )}
            </section>
          )}
          <footer className="page-footer"><span>© 2026 Cyclo-pousse Antsirabe</span><span>Administration <i>·</i> Madagascar</span></footer>
        </div>
      </main>

      {modalOpen && fieldSets[page] && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false) }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading"><div><span className="eyebrow">{editingRecord ? 'MODIFICATION' : 'NOUVELLE ENTRÉE'}</span><h2 id="modal-title">{editingRecord ? `${t('Modifier')} ${page === 'vehicles' ? editingRecord.immatriculation : editingRecord.nom}` : meta.add && t(meta.add)}</h2></div><button className="modal-close" onClick={() => { setModalOpen(false); setEditingRecord(null) }} aria-label={t('Fermer')}>×</button></div>
            <form className="record-form" onSubmit={(event) => void submitRecord(event)}>
              {editingRecord && page === 'vehicles' && <p className="form-note">Les informations du propriétaire sont partagées avec ses autres véhicules.</p>}
              {fieldSets[page]?.map((field) => <label key={field.name}>{t(field.label)}{field.optional && <span className="optional-label">· facultatif</span>}
                {field.options ? <select name={field.name} required={!field.optional} defaultValue={formFieldValue(editingRecord, field)}><option value="">Sélectionner</option>{field.options.map((option) => <option key={option} value={option}>{t(option)}</option>)}</select>
                  : field.multiline ? <textarea name={field.name} required={!field.optional} defaultValue={formFieldValue(editingRecord, field)} maxLength={field.name === 'contenu' ? 5000 : 500} rows={field.name === 'contenu' ? 5 : 3} />
                    : <input name={field.name} type={field.type || 'text'} required={!field.optional} readOnly={field.readOnly && Boolean(editingRecord)} defaultValue={formFieldValue(editingRecord, field)} min={field.type === 'number' ? (field.name === 'montant' ? 0 : 1) : undefined} max={field.name === 'montant' ? 1000000000 : undefined} />}</label>)}
              {actionError && <div className="alert error" role="alert">{actionError}</div>}
              <div className="modal-actions"><button type="button" className="button secondary" onClick={() => { setModalOpen(false); setEditingRecord(null) }}>Annuler</button><button type="submit" className="button primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div>
            </form>
          </section>
        </div>
      )}
      {qrImmatriculation && <VehicleQrDialog immatriculation={qrImmatriculation} onClose={() => setQrImmatriculation('')} />}
      {qrBatchRegistrations.length > 0 && <VehicleQrBatchDialog registrations={qrBatchRegistrations} onClose={() => setQrBatchRegistrations([])} />}
      {detailTarget && <RecordDetailsDialog key={`${detailTarget.kind}:${detailTarget.id}`} kind={detailTarget.kind} id={detailTarget.id} onClose={() => setDetailTarget(null)} />}
      {replacementDriver && <DriverReplacementsDialog driver={replacementDriver} onClose={() => setReplacementDriver(null)} onSaved={() => { setReplacementDriver(null); void loadPage() }} />}
    </div>
  )
}

function LoadingState() {
  const { t } = usePreferences()
  return <div className="inline-state"><span className="spinner" /><span>{t('Chargement…')}</span></div>
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  const { t } = usePreferences()
  return <div className="inline-state error-state"><span className="state-icon">!</span><div><b>Impossible de charger les données</b><p>{message}</p><button className="table-action" onClick={retry}>{t('Réessayer')} →</button></div></div>
}

function EmptyState({ title, message }: { title: string; message: string }) {
  const { t } = usePreferences()
  return <div className="empty-state"><span>⌕</span><b>{t(title)}</b><p>{t(message)}</p></div>
}

function Dashboard({ summary, onNavigate, currentDate }: { summary: DashboardSummary | null; onNavigate: (page: PageId) => void; currentDate: Date }) {
  const { language, t } = usePreferences()
  const vehicleBreakdown = summary?.vehiclesByType ?? summary?.vehicles ?? []
  const maxVehicles = Math.max(1, ...vehicleBreakdown.map((vehicle) => Number(vehicle.total) || 0))
  const cards = [
    { label: 'Véhicules enregistrés', count: countValue(summary, ['totalVehicles', 'vehicles', 'vehiclesByType']), icon: '▰', tone: 'blue', note: 'Dans le réseau', page: 'vehicles' as PageId },
    { label: 'Conducteurs inscrits', count: countValue(summary, ['drivers', 'totalDrivers']), icon: '♙', tone: 'green', note: 'Profils enregistrés', page: 'drivers' as PageId },
    { label: 'Nouveaux signalements', count: countValue(summary, ['newSignals', 'activeSignals']), icon: '⚑', tone: 'orange', note: 'À examiner', page: 'signals' as PageId },
    { label: 'Vignettes impayées', count: countValue(summary, ['unpaidVignettes', 'pendingPayments']), icon: '▤', tone: 'purple', note: 'À régulariser', page: 'payments' as PageId },
  ]
  const locale = language === 'mg' ? 'mg-MG' : language === 'en' ? 'en-GB' : 'fr-FR'
  return <>
    <div className="welcome-banner"><div><span className="banner-label">{currentDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</span><h2>{t('Bienvenue dans votre espace.')}</h2><p>{t('Voici le résumé de l’activité de votre réseau aujourd’hui.')}</p></div><div className="banner-decoration"><span>✳</span><i /><i /><i /></div></div>
    <div className="stats-grid">{cards.map((card) => <button className="stat-card" key={card.label} onClick={() => onNavigate(card.page)}><div className="stat-card-top"><span>{t(card.label)}</span><i className={`stat-icon ${card.tone}`}>{card.icon}</i></div><b className="stat-number">{card.count.toLocaleString(locale)}</b><div className="stat-foot"><span className="stat-dot" />{t(card.note)}<span className="stat-arrow">↗</span></div></button>)}</div>
    <div className="dashboard-lower">
      <section className="panel activity-panel"><div className="panel-heading"><div><h2>{t('Véhicules par type')}</h2><p>{t('Répartition actuelle du parc')}</p></div></div>
        {vehicleBreakdown.length ? <div className="vehicle-breakdown">{vehicleBreakdown.map((vehicle) => <div className="breakdown-row" key={vehicle.type}><div className="breakdown-heading"><b>{t(vehicle.type)}</b><span>{Number(vehicle.total).toLocaleString(locale)} {t('Véhicules').toLocaleLowerCase()}</span></div><div className="breakdown-track"><i style={{ width: `${Math.min(100, (Number(vehicle.total) / maxVehicles) * 100)}%` }} /></div><div className="breakdown-meta"><span>{Number(vehicle.actifs || 0).toLocaleString(locale)} {t('actifs')}</span><span>{Number(vehicle.fourriere || 0).toLocaleString(locale)} {t('en fourrière')}</span></div></div>)}</div> : <EmptyState title="Aucune donnée véhicule" message="La répartition par type n’est pas encore disponible." />}
      </section>
      <section className="panel quick-panel"><div className="panel-heading"><div><h2>Accès rapides</h2><p>Actions courantes</p></div></div><div className="quick-links">
        {[
          { page: 'vehicles' as PageId, icon: '▰', label: 'Gérer les véhicules', description: 'Consulter le parc enregistré' },
          { page: 'medical' as PageId, icon: '＋', label: 'Visites médicales', description: 'Suivre l’aptitude des conducteurs' },
          { page: 'impounds' as PageId, icon: '⌑', label: 'Gérer la fourrière', description: 'Suivre les mises en fourrière' },
        ].map((item) => <button className="quick-link" key={item.page} onClick={() => onNavigate(item.page)}><span className="quick-icon">{item.icon}</span><span><b>{t(item.label)}</b><small>{t(item.description)}</small></span><span className="quick-arrow">→</span></button>)}
      </div></section>
    </div>
    <div className="dashboard-note"><span>✦</span><p><b>{t('Votre espace de gestion')}</b> — {t('les données affichées sont synchronisées avec le service d’administration.')}</p><button onClick={() => onNavigate('reports')}>{t('Consulter les rapports')} →</button></div>
  </>
}

function App() {
  const params = new URLSearchParams(window.location.search)
  const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem('antsirabe-intro-seen'))
  const { t } = usePreferences()
  useEffect(() => {
    if (!showIntro) return
    const timer = window.setTimeout(() => {
      sessionStorage.setItem('antsirabe-intro-seen', '1')
      setShowIntro(false)
    }, 3200)
    return () => window.clearTimeout(timer)
  }, [showIntro])
  const dismissIntro = () => {
    sessionStorage.setItem('antsirabe-intro-seen', '1')
    setShowIntro(false)
  }
  const application = params.has('admin') ? <AdminApp /> : <PublicApp />
  return <>
    {application}
    {showIntro && <IntroSplash t={t} onContinue={dismissIntro} />}
  </>
}

function IntroSplash({ t, onContinue }: { t: (key: string) => string; onContinue: () => void }) {
  return <div className="intro-splash" role="dialog" aria-modal="true" aria-label={t('Antsirabe en mouvement')}>
    <div className="intro-splash-images" aria-hidden="true">
      <img className="intro-city" src={cityLogo} alt="" />
      <img className="intro-transport intro-bus" src={busPhoto} alt="" />
      <img className="intro-transport intro-bajaj" src={bajajPhoto} alt="" />
    </div>
    <div className="intro-splash-copy"><span>ANTSIRABE · MADAGASCAR</span><h1>{t('Une ville en mouvement')}</h1><p>{t('Cyclo-pousse, bus et bajaj')}</p></div>
    <button className="intro-continue" onClick={onContinue}>{t('Continuer')}</button>
  </div>
}

export default App
