import { useState, type FormEvent } from 'react'
import { api } from './api'

const REASONS = [
  'Stationnement gênant',
  'Conduite dangereuse',
  'Véhicule en mauvais état',
  'Tarif abusif',
  'Comportement du conducteur',
  'Autre',
]

interface SignalDialogProps {
  defaultRegistration?: string
  onClose: () => void
  onCreated?: () => void
}

/** Formulaire de signalement commun aux utilisateurs publics, contrôleurs et administrateurs. */
export default function SignalDialog({ defaultRegistration = '', onClose, onCreated }: SignalDialogProps) {
  const [registration, setRegistration] = useState(defaultRegistration)
  const [motif, setMotif] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.submitPublicSignal({
        immatriculation: registration.trim(),
        motif,
        description: description.trim(),
      })
      setSent(true)
      onCreated?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Envoi du signalement impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop signal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal signal-dialog" role="dialog" aria-modal="true" aria-labelledby="signal-title">
        <div className="modal-heading">
          <div><span className="eyebrow">SIGNALEMENT</span><h2 id="signal-title">Signaler un véhicule</h2></div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        {sent ? (
          <div className="signal-success">
            <span className="state-icon">✓</span>
            <h3>Signalement transmis</h3>
            <p>Merci, votre signalement a été enregistré et sera traité par l’administration.</p>
            <div className="modal-actions"><button type="button" className="button primary" onClick={onClose}>Fermer</button></div>
          </div>
        ) : (
          <form className="record-form" onSubmit={(event) => void submit(event)}>
            {error && <div className="alert error" role="alert">{error}</div>}
            <label>Immatriculation du véhicule
              <input value={registration} onChange={(event) => setRegistration(event.target.value)} placeholder="Ex. : 15/CP/ABE" required />
            </label>
            <label>Motif
              <select value={motif} onChange={(event) => setMotif(event.target.value)} required>
                <option value="">Choisir un motif</option>
                {REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </label>
            <label>Détails (facultatif)
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={1000} placeholder="Décrivez brièvement le problème" />
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={onClose}>Annuler</button>
              <button type="submit" className="button primary" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer le signalement'}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
