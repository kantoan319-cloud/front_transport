import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError, recordsOf, type Id } from './api'

interface Props {
  driver: { id: Id; nom: string }
  vehicleType: string
  onClose: () => void
  onSaved: () => void
}

const ROLES = ['Titulaire', 'Remplaçant (2ème conducteur)'] as const

/** Affecte un conducteur à un véhicule : 1er conducteur ou 2e conducteur. */
export default function DriverVehicleDialog({ driver, vehicleType, onClose, onSaved }: Props) {
  const [plate, setPlate] = useState('')
  const [role, setRole] = useState<(typeof ROLES)[number]>(ROLES[0])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api.vehicles(vehicleType, plate, 1, 'registration', 'asc')
      .then((result) => {
        if (!alive) return
        setSuggestions(
          recordsOf(result)
            .map((record) => String(record.immatriculation ?? ''))
            .filter(Boolean)
            .slice(0, 60),
        )
      })
      .catch(() => setSuggestions([]))
    return () => { alive = false }
  }, [plate, vehicleType])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const immatriculation = plate.trim()
    if (!immatriculation) {
      setError('Saisissez l’immatriculation du véhicule.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.assignDriverVehicle(driver.id, { immatriculation, role })
      onSaved()
      onClose()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Affectation impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function detach() {
    setBusy(true)
    setError('')
    try {
      await api.detachDriverVehicle(driver.id)
      onSaved()
      onClose()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Détachement impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="driver-vehicle-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">AFFECTATION · {vehicleType || 'VÉHICULE'}</span>
            <h2 id="driver-vehicle-title">{driver.nom}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <form className="record-form" onSubmit={(event) => void submit(event)}>
          <label>
            Immatriculation du véhicule
            <input
              name="immatriculation"
              list="driver-vehicle-plates"
              value={plate}
              onChange={(event) => setPlate(event.target.value)}
              placeholder="0662 TAA"
              autoFocus
            />
            <datalist id="driver-vehicle-plates">
              {suggestions.map((item) => <option key={item} value={item} />)}
            </datalist>
          </label>
          <label>
            Rôle dans le véhicule
            <select value={role} onChange={(event) => setRole(event.target.value as (typeof ROLES)[number])}>
              {ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <p className="form-note">
            Chaque véhicule accepte deux conducteurs : le titulaire et le remplaçant.
            Affecter ce conducteur à un rôle déjà occupé libère l’ancien occupant de ce rôle.
          </p>
          {error && <div className="alert error" role="alert">{error}</div>}
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => void detach()} disabled={busy}>
              Retirer du véhicule
            </button>
            <button type="button" className="button secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? 'Affectation…' : 'Affecter'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
