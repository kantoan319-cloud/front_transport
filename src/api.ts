export type Id = string | number

export interface AdminUser {
  id?: Id
  firstName?: string
  lastName?: string
  nom?: string
  name?: string
  email: string
  role?: string
}

export interface DashboardSummary {
  totalVehicles?: number
  vehicles?: { type: string; total: number; actifs: number; fourriere: number }[]
  vehiclesByType?: { type: string; total: number; actifs: number; fourriere: number }[]
  totalDrivers?: number
  drivers?: number
  activeSignals?: number
  newSignals?: number
  pendingPayments?: number
  unpaidVignettes?: number
  expiredMedicalVisits?: number
  [key: string]: unknown
}

export interface ApiRecord {
  id?: Id
  nom?: string
  name?: string
  nomFamille?: string
  prenom?: string
  firstName?: string
  lastName?: string
  email?: string
  telephone?: string
  phone?: string
  immatriculation?: string
  registration?: string
  type?: string
  statut?: string
  status?: string
  date?: string
  dateVisite?: string
  datePaiement?: string
  dateMise?: string
  dateLiberation?: string | null
  expiration?: string
  expirationVignette?: string | null
  expirationVisiteMedicale?: string | null
  prochaine_visite?: string
  created_at?: string
  montant?: number | string
  amount?: number | string
  motif?: string
  description?: string
  observation?: string
  reference?: string
  sujet?: string
  contenu?: string
  role?: string
  lu?: boolean | number
  nomProprietaire?: string
  prenomProprietaire?: string
  telephoneProprietaire?: string
  couleurs?: string
  cooperative?: string
  sanction?: string
  dureeMois?: number
  conducteurId?: Id
  dateNaissance?: string | null
  lieuNaissance?: string
  numeroPermis?: string | null
  dateExamenPermis?: string | null
  [key: string]: unknown
}

export interface Vehicle extends ApiRecord {
  immatriculation?: string
  type?: 'Cyclo-pousse' | 'Bus' | 'Bajaj' | string
}

export interface VehicleDetails extends Vehicle {
  adresseProprietaire?: string
  cinProprietaire?: string
  expirationVignette?: string | null
  expirationVisiteMedicale?: string | null
  drivers?: { id: Id; nom: string; telephone?: string; role: string }[]
  impounds?: { date: string; motif: string; sanction?: string; dateLiberation?: string | null }[]
  signals?: { date: string; motif: string; description?: string; statut: string }[]
  inspections?: { date: string; dureeMois: number; expiration: string; observation?: string }[]
}

export interface Driver extends ApiRecord {
  nom?: string
  prenom?: string
  telephone?: string
  role?: string
}

export interface DriverProfile extends Driver {
  cin?: string
  adresse?: string
  dateNaissance?: string | null
  lieuNaissance?: string
  dateCin?: string | null
  cinDelivreeA?: string
  numeroPermis?: string | null
  dateExamenPermis?: string | null
  replacements?: { id: Id; nom: string }[]
  replacedBy?: { id: Id; nom: string }[]
  vehicleDrivers?: { id: Id; nom: string; role: string }[]
}

export interface Signal extends ApiRecord {
  statut?: string
  motif?: string
}

export interface MedicalVisit extends ApiRecord {
  driver_id?: Id
  date?: string
  resultat?: string
  prochaine_visite?: string
}

export interface VignettePayment extends ApiRecord {
  vehicle_id?: Id
  driver_id?: Id
  montant?: number | string
}

export interface VignettePaymentReport extends ApiList<VignettePayment> {
  totalAmount: number
  globalAmount: number
  byVehicle: { immatriculation: string; nomVehicule?: string; totalAmount: number; paymentCount: number }[]
}

export interface AdminStatistics {
  totalVehicles: number
  impoundedVehicles: number
  ownerCount: number
  totalSignals: number
  resolvedRate: number
  signalsThisMonth: number
  signalsByStatus: { label: string; value: number }[]
  signalsByReason: { label: string; value: number }[]
  signalsByMonth: { month: string; label: string; value: number }[]
  vehiclesAddedByMonth: { month: string; label: string; value: number }[]
  topReportedVehicles: { immatriculation: string; count: number }[]
  vignetteRevenue: { today: number; month: number; year: number; all: number }
}

export interface AdminOwner {
  id: Id
  nom: string
  prenom: string
  telephone: string
  cin: string
  adresse: string
  vehicleCount: number
  vignetteRevenue: number
}

export interface OwnerVehicle {
  ownerId: Id
  immatriculation: string
  nom: string
  statut: string
}

export interface AdminHistoryEntry {
  id: Id
  utilisateur: string
  action: string
  detail: string
  date: string
}

export interface Impound extends ApiRecord {
  vehicle_id?: Id
  driver_id?: Id
  motif?: string
}

export interface Report extends ApiRecord {
  nom?: string
  type?: string
  description?: string
}

export interface Notification extends ApiRecord {
  statut?: string
  lu?: boolean
  message?: string
  cible?: 'signalement' | 'paiement' | 'fourriere' | 'rapport' | 'conducteur' | 'vehicule' | null
  idCible?: Id | null
  immatriculationCible?: string | null
}

export interface AdminController extends ApiRecord {
  id: Id
  nom: string
  prenom?: string
  email: string
  role: 'admin' | 'controleur'
  telephone?: string
  dateCreation?: string
}

export interface PasswordResetRequest extends ApiRecord {
  id: Id
  email: string
  date: string
  statut: string
  traitePar?: string | null
  dateTraitement?: string | null
}

export interface DriverImportSummary {
  sourceCount: number
  newDrivers: number
  existingDrivers: number
  emptyRows: number
  duplicateLicenses: number
  invalidBirthDates: number
  newVisits: number
  correctedExpirations: number
  existingVisits: number
}

export interface DriverImportResult {
  sourceDatabase: string
  summary: DriverImportSummary
  simulation: boolean
}

export interface PhotoLinkResult {
  simulation: boolean
  summary: {
    files: number
    toLink: number
    alreadyLinked: number
    existingPhotoSkipped: number
    missingVehicles: number
    ambiguousVehicles: number
    duplicateFiles: number
    invalidFiles: number
  }
  details: Record<string, string[]>
}

export interface ApiList<T> {
  data?: T[]
  items?: T[]
  results?: T[]
  total?: number
  page?: number
  pageSize?: number
}

export interface LoginPayload {
  email: string
  password: string
}

interface AuthResponse {
  user: AdminUser
}

const API_BASE = '/api'

/**
 * URL d'une photo stockee en base (`PhotoCycloPousses/xxx.jpg`), servie par
 * l'API (/api/photos/...). Les fichiers ne sont pas dans le depot.
 */
export function photoUrl(path?: string | null): string {
  if (!path) return ''
  const parts = path.replace(/^\/+/, '').split('/')
  const folder = parts.shift() ?? ''
  if (!parts.length || !['PhotoCycloPousses', 'PhotoConducteurs'].includes(folder)) return ''
  return `${API_BASE}/photos/${encodeURIComponent(folder)}/${parts.map(encodeURIComponent).join('/')}`
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    let message = `Erreur ${response.status}`
    try {
      const body = (await response.json()) as { message?: string; error?: string }
      message = body.message || body.error || message
    } catch {
      // Some API errors do not include a JSON body.
    }
    throw new ApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  me: async () => (await request<AuthResponse>('/auth/me')).user,
  login: (payload: LoginPayload) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }).then((response) => response.user),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  requestPasswordReset: (email: string) =>
    request<{ ok: boolean; message: string }>('/auth/password-reset-requests', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  summary: () => request<DashboardSummary>('/dashboard/summary'),
  adminStatistics: () => request<AdminStatistics>('/admin/statistics'),
  adminOwners: (q = '') =>
    request<{ owners: AdminOwner[]; vehicles: OwnerVehicle[] }>(`/admin/owners?${new URLSearchParams({ q })}`),
  adminHistory: () => request<AdminHistoryEntry[]>('/admin/history'),
  vehicles: (type: string, q: string, page = 1, sort = 'registration', direction = 'asc') =>
    request<ApiList<Vehicle> | Vehicle[]>(`/vehicles?${new URLSearchParams({ type, q, page: String(page), sort, direction })}`),
  vehicleDetails: (immatriculation: string) =>
    request<VehicleDetails>(`/vehicles/${encodeURIComponent(immatriculation)}/details`),
  publicVehicle: (immatriculation: string) =>
    request<Vehicle & Record<string, unknown>>(`/public/vehicles/${encodeURIComponent(immatriculation)}`),
  submitPublicSignal: (data: { immatriculation: string; motif: string; description: string }) =>
    request<{ id: Id; ok: boolean }>('/public/signals', { method: 'POST', body: JSON.stringify(data) }),
  recordPublicScan: (data: { immatriculation: string; latitude?: number; longitude?: number; precision?: number }) =>
    request<{ ok: boolean }>('/public/scans', { method: 'POST', body: JSON.stringify(data) }),
  drivers: (q: string, role: string, page = 1) =>
    request<ApiList<Driver> | Driver[]>(`/drivers?${new URLSearchParams({ q, role, page: String(page) })}`),
  driverProfile: (id: Id) =>
    request<DriverProfile>(`/drivers/${encodeURIComponent(id)}/profile`),
  createVehicle: (data: Record<string, string | number>) =>
    request<Vehicle>('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
  updateVehicle: (immatriculation: string, data: Record<string, string | number | null>) =>
    request<Vehicle>(`/vehicles/${encodeURIComponent(immatriculation)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeVehicle: (immatriculation: string) =>
    request<{ ok: boolean }>(`/vehicles/${encodeURIComponent(immatriculation)}`, { method: 'DELETE' }),
  createDriver: (data: Record<string, string | number>) =>
    request<Driver>('/drivers', { method: 'POST', body: JSON.stringify(data) }),
  updateDriver: (id: Id, data: Record<string, string | number>) =>
    request<Driver>(`/drivers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  driverReplacementOptions: (query: string, excludedId: Id) =>
    request<{ id: Id; nom: string }[]>(`/drivers/replacement-options?${new URLSearchParams({ q: query, exclude: String(excludedId) })}`),
  driverReplacements: (id: Id) =>
    request<{ replacements: { id: Id; nom: string }[] }>(`/drivers/${encodeURIComponent(id)}/replacements`),
  updateDriverReplacements: (id: Id, replacementIds: Id[]) =>
    request<{ ok: boolean }>(`/drivers/${encodeURIComponent(id)}/replacements`, {
      method: 'PATCH',
      body: JSON.stringify({ replacementIds: replacementIds.map(Number) }),
    }),
  removeDriver: (id: Id) =>
    request<{ ok: boolean }>(`/drivers/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  signals: () => request<ApiList<Signal> | Signal[]>('/signals'),
  updateSignal: (id: Id, statut: string) =>
    request<ApiRecord>(`/signals/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ statut }) }),
  medicalVisits: () => request<ApiList<MedicalVisit> | MedicalVisit[]>('/medical-visits'),
  createMedicalVisit: (data: Record<string, string | number>) =>
    request<ApiRecord>('/medical-visits', { method: 'POST', body: JSON.stringify(data) }),
  vignettePayments: (filters: { period: string; start: string; end: string; registration: string }) =>
    request<VignettePaymentReport>(`/vignette-payments?${new URLSearchParams(filters)}`),
  createVignettePayment: (data: Record<string, string | number>) =>
    request<ApiRecord>('/vignette-payments', { method: 'POST', body: JSON.stringify(data) }),
  removeVignettePayment: (id: Id) =>
    request<{ ok: boolean }>(`/vignette-payments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  impounds: () => request<ApiList<Impound> | Impound[]>('/impounds'),
  createImpound: (data: Record<string, string | number>) =>
    request<ApiRecord>('/impounds', { method: 'POST', body: JSON.stringify(data) }),
  releaseImpound: (id: Id) =>
    request<ApiRecord>(`/impounds/${encodeURIComponent(id)}/release`, { method: 'PATCH' }),
  reports: () => request<ApiList<Report> | Report[]>('/reports'),
  createReport: (data: Record<string, string | number>) =>
    request<ApiRecord>('/reports', { method: 'POST', body: JSON.stringify(data) }),
  markReportRead: (id: Id) =>
    request<ApiRecord>(`/reports/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
  notifications: () => request<ApiList<Notification> | Notification[]>('/notifications'),
  readNotification: (id: Id) =>
    request<ApiRecord>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
  readAllNotifications: () => request<void>('/notifications/read-all', { method: 'PATCH' }),
  users: () => request<AdminController[]>('/users'),
  createUser: (data: { nom: string; prenom: string; email: string; motDePasse: string; telephone: string }) =>
    request<{ id: Id; ok: boolean }>('/users', { method: 'POST', body: JSON.stringify(data) }),
  removeUser: (id: Id) => request<{ ok: boolean }>(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  passwordResetRequests: () => request<PasswordResetRequest[]>('/users/password-reset-requests'),
  resolvePasswordResetRequest: (id: Id, action: 'approve' | 'reject', password?: string) =>
    request<{ ok: boolean; statut: string }>(`/users/password-reset-requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, ...(password ? { password } : {}) }),
    }),
  previewDriverImport: (sourceDatabase: string) =>
    request<DriverImportResult>('/imports/drivers/preview', {
      method: 'POST',
      body: JSON.stringify({ sourceDatabase }),
    }),
  runDriverImport: (sourceDatabase: string) =>
    request<DriverImportResult>('/imports/drivers', {
      method: 'POST',
      body: JSON.stringify({ sourceDatabase }),
    }),
  previewPhotoLinks: (force: boolean) =>
    request<PhotoLinkResult>('/imports/photos/link-preview', {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),
  runPhotoLinks: (force: boolean) =>
    request<PhotoLinkResult>('/imports/photos/link', {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),
}

export function recordsOf(value: ApiList<ApiRecord> | ApiRecord[] | undefined): ApiRecord[] {
  if (Array.isArray(value)) return value
  return value?.data ?? value?.items ?? value?.results ?? []
}

export function listMetadata(value: ApiList<ApiRecord> | ApiRecord[] | undefined, requestedPage: number) {
  if (Array.isArray(value)) return { total: value.length, page: requestedPage, pageSize: value.length }
  const data = recordsOf(value)
  return {
    total: Number(value?.total ?? data.length),
    page: Number(value?.page ?? requestedPage),
    pageSize: Number(value?.pageSize ?? data.length),
  }
}
