import { useEffect, useState } from 'react'
import { api, ApiError } from './api'
import './ExportsPage.css'

interface Cible {
  id: string
  label: string
  description: string
}

type Format = 'xlsx' | 'sql'

export default function ExportsPage() {
  const [cibles, setCibles] = useState<Cible[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    void api.exportsCibles()
      .then((response) => setCibles(response.cibles))
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : 'Impossible de charger la liste des exports.'))
      .finally(() => setLoading(false))
  }, [])

  async function telecharger(cible: Cible, format: Format) {
    setBusy(`${cible.id}-${format}`)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/exports/${cible.id}?format=${format}`, { credentials: 'same-origin' })
      if (!response.ok) {
        throw new Error(`Export impossible (HTTP ${response.status}).`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = `${cible.id}.${format}`
      document.body.appendChild(lien)
      lien.click()
      lien.remove()
      URL.revokeObjectURL(url)
      setMessage(`Export ${format.toUpperCase()} de « ${cible.label} » téléchargé (${(blob.size / 1024).toFixed(0)} Ko).`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Téléchargement impossible.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="exports-page">
      <header className="exports-page__header">
        <span className="eyebrow">ADMINISTRATION</span>
        <h1>Exports de données</h1>
        <p>Téléchargez la base complète par domaine, au format Excel (.xlsx) ou SQL (.sql). Réservé aux administrateurs.</p>
      </header>

      {error && <div className="alert error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Fermer">×</button></div>}
      {message && <div className="exports-page__message" role="status">{message}</div>}

      {loading ? (
        <p className="exports-page__empty">Chargement des exports…</p>
      ) : (
        <div className="exports-grid">
          {cibles.map((cible) => (
            <article className="export-card" key={cible.id}>
              <div className="export-card__head">
                <span className="export-card__icon" aria-hidden="true">⇩</span>
                <h2>{cible.label}</h2>
              </div>
              <p>{cible.description}</p>
              <div className="export-card__actions">
                <button
                  type="button"
                  className="button primary"
                  disabled={Boolean(busy)}
                  onClick={() => void telecharger(cible, 'xlsx')}
                >
                  {busy === `${cible.id}-xlsx` ? 'Préparation…' : 'Excel (.xlsx)'}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={Boolean(busy)}
                  onClick={() => void telecharger(cible, 'sql')}
                >
                  {busy === `${cible.id}-sql` ? 'Préparation…' : 'SQL (.sql)'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="exports-page__note">
        Le fichier Excel contient une feuille par domaine avec des en-têtes lisibles ; le fichier SQL contient
        les instructions <code>INSERT INTO</code> prêtes à rejouer sur PostgreSQL.
      </p>
    </div>
  )
}
