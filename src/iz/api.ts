export type IZRecord = Record<string, any>

export interface IZUser {
  id: string | number
  firstName?: string
  lastName?: string
  email: string
  role?: string
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

const BASE = '/api'

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
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
  login: (email: string, password: string) =>
    send<{ user: IZUser }>('/auth/login', 'POST', { email, password }).then((result) => result.user),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),

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
  parkings: () => request<IZRecord[]>('/iz/public/parkings'),
  map: () => request<IZRecord[]>('/iz/public/map'),
  incidents: () => request<IZRecord[]>('/iz/public/incidents'),
  createSignal: (data: IZRecord) => send<{ reference: string }>('/iz/public/signals', 'POST', data),
  followSignal: (reference: string) =>
    request<IZRecord>(`/iz/public/signals/${encodeURIComponent(reference)}`),

  // ---------- Contrôleurs ----------
  controlDashboard: () => request<IZRecord>('/iz/control/dashboard'),
  scan: (data: IZRecord) => send<IZRecord>('/iz/control/scans', 'POST', data),
  scans: (q = '') => request<IZRecord[]>(`/iz/control/scans${queryString({ q })}`),
  infractions: () => request<IZRecord[]>('/iz/control/infractions'),
  createInfraction: (data: IZRecord) => send<IZRecord>('/iz/control/infractions', 'POST', data),
  updateInfraction: (id: number, data: IZRecord) =>
    send<IZRecord>(`/iz/control/infractions/${id}/statut`, 'PATCH', data),
  controlSignals: (statut = '') => request<IZRecord[]>(`/iz/control/signals${queryString({ statut })}`),
  resolveSignal: (id: number, data: IZRecord) =>
    send<IZRecord>(`/iz/control/signals/${id}`, 'PATCH', data),

  // ---------- Administrateur ----------
  adminStats: () => request<IZRecord>('/iz/admin/stats'),
  adminVehicles: (query: VehicleQuery = {}) =>
    request<IZRecord[]>(`/iz/admin/vehicles${queryString(query as Record<string, unknown>)}`),
  createVehicle: (data: IZRecord) => send<IZRecord>('/iz/admin/vehicles', 'POST', data),
  updateVehicle: (id: number, data: IZRecord) => send<IZRecord>(`/iz/admin/vehicles/${id}`, 'PATCH', data),
  deleteVehicle: (id: number) => request<void>(`/iz/admin/vehicles/${id}`, { method: 'DELETE' }),

  adminCooperatives: () => request<IZRecord[]>('/iz/admin/cooperatives'),
  createCooperative: (data: IZRecord) => send<IZRecord>('/iz/admin/cooperatives', 'POST', data),
  updateCooperative: (id: number, data: IZRecord) =>
    send<IZRecord>(`/iz/admin/cooperatives/${id}`, 'PATCH', data),
  deleteCooperative: (id: number) => request<void>(`/iz/admin/cooperatives/${id}`, { method: 'DELETE' }),

  owners: () => request<IZRecord[]>('/iz/admin/owners'),
  createOwner: (data: IZRecord) => send<IZRecord>('/iz/admin/owners', 'POST', data),
  deleteOwner: (id: number) => request<void>(`/iz/admin/owners/${id}`, { method: 'DELETE' }),

  adminLines: () => request<IZRecord[]>('/iz/admin/lines'),
  createLine: (data: IZRecord) => send<IZRecord>('/iz/admin/lines', 'POST', data),
  updateLine: (id: number, data: IZRecord) => send<IZRecord>(`/iz/admin/lines/${id}`, 'PATCH', data),
  deleteLine: (id: number) => request<void>(`/iz/admin/lines/${id}`, { method: 'DELETE' }),
  adminStops: (lineId: number) => request<IZRecord[]>(`/iz/admin/lines/${lineId}/stops`),
  createStop: (data: IZRecord) => send<IZRecord>('/iz/admin/stops', 'POST', data),
  updateStop: (id: number, data: IZRecord) => send<IZRecord>(`/iz/admin/stops/${id}`, 'PATCH', data),
  deleteStop: (id: number) => request<void>(`/iz/admin/stops/${id}`, { method: 'DELETE' }),

  studies: () => request<IZRecord[]>('/iz/admin/studies'),
  createStudy: (data: IZRecord) => send<IZRecord>('/iz/admin/studies', 'POST', data),
  updateStudy: (id: number, data: IZRecord) => send<IZRecord>(`/iz/admin/studies/${id}`, 'PATCH', data),
  deleteStudy: (id: number) => request<void>(`/iz/admin/studies/${id}`, { method: 'DELETE' }),

  adminParkings: () => request<IZRecord[]>('/iz/admin/parkings'),
  createParking: (data: IZRecord) => send<IZRecord>('/iz/admin/parkings', 'POST', data),
  updateParking: (id: number, data: IZRecord) => send<IZRecord>(`/iz/admin/parkings/${id}`, 'PATCH', data),
  deleteParking: (id: number) => request<void>(`/iz/admin/parkings/${id}`, { method: 'DELETE' }),

  payments: () => request<IZRecord[]>('/iz/admin/payments'),
  createPayment: (data: IZRecord) => send<IZRecord>('/iz/admin/payments', 'POST', data),
  updatePayment: (id: number, data: IZRecord) => send<IZRecord>(`/iz/admin/payments/${id}`, 'PATCH', data),

  licenceRequests: () => request<IZRecord[]>('/iz/admin/licence-requests'),
  createLicenceRequest: (data: IZRecord) =>
    send<IZRecord>('/iz/admin/licence-requests', 'POST', data),
  updateLicenceRequest: (id: number, data: IZRecord) =>
    send<IZRecord>(`/iz/admin/licence-requests/${id}`, 'PATCH', data),

  roles: () => request<IZRecord[]>('/iz/admin/roles'),
  assignRole: (data: IZRecord) => send<IZRecord>('/iz/admin/roles/assign', 'POST', data),
  adminUsers: () => request<IZRecord[]>('/iz/admin/users'),
  activity: () => request<IZRecord[]>('/iz/admin/activity'),
}
