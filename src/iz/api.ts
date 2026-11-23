export type IZRecord = Record<string, any>

export interface IZUser {
  id: string | number
  firstName?: string
  lastName?: string
  nom?: string
  prenom?: string
  email: string
  role?: string
  telephone?: string | null
  cin?: string | null
  fonction?: string | null
  matricule?: string | null
  photoIdentite?: string | null
  profilComplet?: boolean
}

export interface IZAgentProfile {
  nom?: string | null
  prenom?: string | null
  email?: string | null
  telephone?: string | null
  cin?: string | null
  fonction?: string | null
  matricule?: string | null
  photoIdentite?: string | null
}

export type IZAccountRole = 'admin' | 'controleur' | 'superadmin'

export interface IZCreateUser {
  nom: string
  prenom?: string
  email: string
  motDePasse: string
  telephone?: string
  role: IZAccountRole
  cin?: string
  fonction?: string
  matricule?: string
  photoIdentite?: string | null
}

export interface VehicleQuery {
  q?: string
  cooperative?: string
  ligne?: string
  statut?: string
  page?: number
  limit?: number
}

export class IZApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'IZApiError'
    this.status = status
  }
}

const BASE = `${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')}/api`

function queryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

// Une requete qui n'aboutit pas doit le dire : sans ce garde-fou, un signalement
// reste bloque sur un bouton desactive quand la base repond en plusieurs dizaines
// de secondes (Neon en HTTPS, avec ses reprises).
// 60 s : la base HTTPS repond parfois en plusieurs dizaines de secondes ;
// au-dela, mieux vaut un message qu'un bouton bloque indefiniment.
const TIMEOUT_MS = 60_000

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'include',
      signal: init.signal ?? AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new IZApiError('Le serveur met trop de temps à répondre. Réessayez.', 0)
    }
    throw new IZApiError('Impossible de contacter le serveur.', 0)
  }
  if (!response.ok) {
    let message = `Erreur ${response.status}`
    try {
      const body = (await response.json()) as { message?: string | string[]; error?: string }
      const text = Array.isArray(body.message) ? body.message.join(', ') : body.message
      message = text || body.error || message
    } catch {
      /* réponse non JSON */
    }
    throw new IZApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

const body = (data: unknown) => JSON.stringify(data)
const send = <T>(path: string, method: string, data: unknown) =>
  request<T>(path, { method, body: body(data) })

export const izApi = {
  // ---------- Authentification ----------
  me: () => request<{ user: IZUser }>('/auth/me').then((result) => result.user),
  profile: () => request<IZUser>('/auth/profile'),
  updateProfile: (data: IZAgentProfile) => send<IZUser>('/auth/profile', 'PATCH', data),
  login: (email: string, password: string) =>
    send<{ user: IZUser }>('/auth/login', 'POST', { email, password }).then((result) => result.user),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  requestPasswordReset: (email: string) =>
    send<{ ok: boolean; message: string }>('/auth/password-reset-requests', 'POST', { email }),
  changePassword: (currentPassword: string, newPassword: string) =>
    send<{ ok: boolean; message: string }>('/auth/change-password', 'POST', { currentPassword, newPassword }),
  changeEmail: (email: string) =>
    send<{ ok: boolean; user: IZUser }>('/auth/change-email', 'POST', { email }),

  // ---------- Espace public ----------
  publicStats: () => request<IZRecord>('/iz/public/stats'),
  vehicles: (query: VehicleQuery = {}) =>
    request<{ data: IZRecord[]; total: number; page: number; limit: number }>(
      `/iz/public/vehicles${queryString(query as Record<string, unknown>)}`,
    ),
  vehicle: (plate: string) => request<IZRecord>(`/iz/public/vehicles/${encodeURIComponent(plate)}`),
  cooperatives: () => request<IZRecord[]>('/iz/public/cooperatives'),
  lines: () => request<IZRecord[]>('/iz/public/lines'),
  stops: (lineId: string | number) => request<IZRecord[]>(`/iz/public/lines/${lineId}/stops`),
  map: () => request<IZRecord[]>('/iz/public/map'),
  incidents: () => request<IZRecord[]>('/iz/public/incidents'),
  createSignal: (data: IZRecord) => send<{ reference: string }>('/iz/public/signals', 'POST', data),
  reportPublicScan: (data: IZRecord) => send<{ ok: boolean }>('/iz/public/scans', 'POST', data),
  followSignal: (reference: string) =>
    request<IZRecord>(`/iz/public/signals/${encodeURIComponent(reference)}`),

  // ---------- Contrôleurs ----------
  controlDashboard: () => request<IZRecord>('/iz/control/dashboard'),
  controlVehicle: (plate: string) => request<IZRecord>(`/iz/control/vehicles/${encodeURIComponent(plate)}`),
  setVehiclePhoto: (id: number, photo: string | null) =>
    send<{ photoUrl: string | null }>(`/iz/control/vehicles/${id}/photo`, 'PUT', { photo }),
  impounds: () => request<IZRecord[]>('/iz/control/impounds'),
  deleteImpound: (id: number) => request<void>(`/iz/control/impounds/${id}`, { method: 'DELETE' }),
  impoundVehicle: (id: number, data: { motif: string }) =>
    send<IZRecord>(`/iz/control/vehicles/${id}/impound`, 'POST', data),
  releaseVehicle: (id: number) =>
    request<IZRecord>(`/iz/control/vehicles/${id}/release`, { method: 'POST' }),
  scan: (data: IZRecord) => send<IZRecord>('/iz/control/scans', 'POST', data),
  scans: (q = '') => request<IZRecord[]>(`/iz/control/scans${queryString({ q })}`),
  infractions: () => request<IZRecord[]>('/iz/control/infractions'),
  createInfraction: (data: IZRecord) => send<IZRecord>('/iz/control/infractions', 'POST', data),
  updateInfraction: (id: number, data: IZRecord) =>
    send<IZRecord>(`/iz/control/infractions/${id}/statut`, 'PATCH', data),
  controlSignals: (statut = '') => request<IZRecord[]>(`/iz/control/signals${queryString({ statut })}`),
  createControlSignal: (data: IZRecord) =>
    send<{ id: number; reference: string; statut: string }>('/iz/control/signals', 'POST', data),
  resolveSignal: (id: number, data: IZRecord) =>
    send<IZRecord>(`/iz/control/signals/${id}`, 'PATCH', data),
  deleteScan: (id: number) => request<void>(`/iz/control/scans/${id}`, { method: 'DELETE' }),
  deleteInfraction: (id: number) => request<void>(`/iz/control/infractions/${id}`, { method: 'DELETE' }),
  deleteSignal: (id: number) => request<void>(`/iz/control/signals/${id}`, { method: 'DELETE' }),

  // ---------- Administrateur ----------
  adminStats: () => request<IZRecord>('/iz/admin/stats'),
  adminAnalytics: () => request<IZRecord>('/iz/admin/analytics'),
  adminPublicScans: () => request<IZRecord[]>('/iz/admin/public-scans'),
  deletePublicScan: (id: number) => request<void>(`/iz/admin/public-scans/${id}`, { method: 'DELETE' }),
  adminVehicles: (query: VehicleQuery = {}) =>
    request<IZRecord[]>(`/iz/admin/vehicles${queryString(query as Record<string, unknown>)}`),
  createVehicle: (data: IZRecord) => send<IZRecord>('/iz/admin/vehicles', 'POST', data),
  updateVehicle: (id: number, data: IZRecord) => send<IZRecord>(`/iz/admin/vehicles/${id}`, 'PATCH', data),
  deleteVehicle: (id: number) => request<void>(`/iz/admin/vehicles/${id}`, { method: 'DELETE' }),
  expiredLicences: (q = '') =>
    request<IZRecord[]>(`/iz/admin/expired-licences${queryString({ q })}`),
  deliverLicence: (id: number, data: IZRecord) =>
    send<IZRecord>(`/iz/admin/vehicles/${id}/licence`, 'POST', data),

  adminCooperatives: () => request<IZRecord[]>('/iz/admin/cooperatives'),
  createCooperative: (data: IZRecord) => send<IZRecord>('/iz/admin/cooperatives', 'POST', data),
  updateCooperative: (id: number, data: IZRecord) =>
    send<IZRecord>(`/iz/admin/cooperatives/${id}`, 'PATCH', data),
  deleteCooperative: (id: number) => request<void>(`/iz/admin/cooperatives/${id}`, { method: 'DELETE' }),

  owners: () => request<IZRecord[]>('/iz/admin/owners'),
  createOwner: (data: IZRecord) => send<IZRecord>('/iz/admin/owners', 'POST', data),
  updateOwner: (id: number, data: IZRecord) =>
    send<IZRecord>(`/iz/admin/owners/${id}`, 'PATCH', data),
  deleteOwner: (id: number) => request<void>(`/iz/admin/owners/${id}`, { method: 'DELETE' }),

  adminAttestations: (type: 'capacite' | 'receveur', includeHistory = false) =>
    request<IZRecord[]>(
      `/iz/admin/attestations/${type}${includeHistory ? '?all=1' : ''}`,
    ),
  linkAttestation: (type: 'capacite' | 'receveur', id: number, vehicleId: number | null) =>
    send<IZRecord>(`/iz/admin/attestations/${type}/${id}/link`, 'PATCH', { vehicleId }),
  vehicleAttestations: (plate: string) =>
    request<{ capacite: IZRecord | null; receveur: IZRecord | null }>(
      `/iz/admin/attestations/vehicle/${encodeURIComponent(plate)}`,
    ),

  adminLines: () => request<IZRecord[]>('/iz/admin/lines'),
  createLine: (data: IZRecord) => send<IZRecord>('/iz/admin/lines', 'POST', data),
  updateLine: (id: number, data: IZRecord) => send<IZRecord>(`/iz/admin/lines/${id}`, 'PATCH', data),
  deleteLine: (id: number) => request<void>(`/iz/admin/lines/${id}`, { method: 'DELETE' }),
  adminStops: (lineId: number) => request<IZRecord[]>(`/iz/admin/lines/${lineId}/stops`),
  createStop: (data: IZRecord) => send<IZRecord>('/iz/admin/stops', 'POST', data),
  updateStop: (id: number, data: IZRecord) => send<IZRecord>(`/iz/admin/stops/${id}`, 'PATCH', data),
  deleteStop: (id: number) => request<void>(`/iz/admin/stops/${id}`, { method: 'DELETE' }),

  payments: () => request<IZRecord[]>('/iz/admin/payments'),
  createPayment: (data: IZRecord) => send<IZRecord>('/iz/admin/payments', 'POST', data),
  updatePayment: (id: number, data: IZRecord) => send<IZRecord>(`/iz/admin/payments/${id}`, 'PATCH', data),
  deletePayment: (id: number) => request<void>(`/iz/admin/payments/${id}`, { method: 'DELETE' }),
  paymentRegister: (period: 'day' | 'month' | 'year', date: string) =>
    request<IZRecord>(`/iz/admin/payments/register${queryString({ period, date })}`),

  licenceRequests: () => request<IZRecord[]>('/iz/admin/licence-requests'),
  createLicenceRequest: (data: IZRecord) =>
    send<IZRecord>('/iz/admin/licence-requests', 'POST', data),
  updateLicenceRequest: (id: number, data: IZRecord) =>
    send<IZRecord>(`/iz/admin/licence-requests/${id}`, 'PATCH', data),
  deleteLicenceRequest: (id: number) =>
    request<void>(`/iz/admin/licence-requests/${id}`, { method: 'DELETE' }),

  roles: () => request<IZRecord[]>('/iz/admin/roles'),
  assignRole: (data: IZRecord) => send<IZRecord>('/iz/admin/roles/assign', 'POST', data),
  adminUsers: () => request<IZRecord[]>('/iz/admin/users'),
  createUser: (data: IZCreateUser) => send<IZRecord>('/users', 'POST', data),
  updateUserRole: (id: number, role: IZAccountRole) =>
    send<IZRecord>(`/users/${id}`, 'PATCH', { role }),
  deleteUser: (id: number) => request<void>(`/users/${id}`, { method: 'DELETE' }),
  updateUserDetails: (id: number, data: IZRecord) =>
    send<IZRecord>(`/users/${id}/details`, 'PATCH', data),
  agentProfile: (id: number | string) => request<IZAgentProfile>(`/users/${id}/profile`),
  passwordResetRequests: () => request<IZRecord[]>('/users/password-reset-requests'),
  resolvePasswordResetRequest: (id: number, data: IZRecord) =>
    send<IZRecord>(`/users/password-reset-requests/${id}`, 'PATCH', data),
  activity: () => request<IZRecord[]>('/iz/admin/activity'),
  history: (scope: 'admins' | 'controleurs' | 'all', limit = 300) =>
    request<{ scope: string; rows: IZRecord[] }>(`/iz/admin/history${queryString({ scope, limit })}`),

  exportXlsx: async (cible: string) => {
    const response = await fetch(`${BASE}/iz/admin/export/${encodeURIComponent(cible)}`, {
      credentials: 'include',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) {
      let message = `Erreur ${response.status}`
      try {
        const body = (await response.json()) as { message?: string | string[] }
        message = (Array.isArray(body.message) ? body.message.join(', ') : body.message) || message
      } catch {
        /* réponse non JSON */
      }
      throw new IZApiError(message, response.status)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${cible}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  },
}
