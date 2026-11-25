import type { IZRecord } from './api'

const dateOnly = (value: unknown) => {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ''))
  return match ? match[1] : ''
}

const localToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function attestationState(row: IZRecord): string {
  const end = dateOnly(row.valable_jusquau ?? row.valableJusquau)
  if (!end) return String(row.statut || 'Validité inconnue')
  return end < localToday() ? 'Expirée' : 'Valable'
}
