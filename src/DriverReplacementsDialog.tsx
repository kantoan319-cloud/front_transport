import { useEffect, useState } from 'react'
import { api, type Id } from './api'
import './DriverReplacementsDialog.css'

interface DriverOption {
  id: Id
  nom: string
}

interface DriverReplacementsDialogProps {
  driver: DriverOption
  onClose: () => void
  onSaved: () => void
}

export default function DriverReplacementsDialog({
  driver,
  onClose,
  onSaved,
}: DriverReplacementsDialogProps) {
  const [selected, setSelected] = useState<DriverOption[]>([])
  const [options, setOptions] = useState<DriverOption[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void api.driverReplacements(driver.id).then(({ replacements }) => {
      if (active) {
        setSelected(replacements)
        setLoading(false)
      }
    }).catch((requestError: unknown) => {
      if (active) {
        setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les remplacements.')
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [driver.id])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void api.driverReplacementOptions(query, driver.id).then((results) => {
        if (active) setOptions(results)
      }).catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Impossible de rechercher des conducteurs.')
      })
    }, 200)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [driver.id, query])

  function toggle(option: DriverOption) {
    setSelected((current) => current.some((item) => String(item.id) === String(option.id))
      ? current.filter((item) => String(item.id) !== String(option.id))
      : [...current, option])
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      await api.updateDriverReplacements(driver.id, selected.map((item) => item.id))
      onSaved()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer les remplacements.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="modal replacements-dialog" role="dialog" aria-modal="true" aria-labelledby="replacements-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">GESTION DES CONDUCTEURS</span>
            <h2 id="replacements-title">Remplacements de {driver.nom}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>

        <p className="form-note">Sélectionnez les conducteurs qui peuvent remplacer cette personne.</p>
        {error && <div className="alert error" role="alert">{error}</div>}

        <label className="replacement-search">
          Rechercher un conducteur
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, CIN ou téléphone" />
        </label>

        {loading ? <div className="inline-state">Chargement des remplacements…</div> : (
          <div className="replacement-selection">
            <div className="replacement-options" aria-label="Résultats de recherche">
              {options.length === 0 ? <p className="replacement-empty">Aucun conducteur trouvé.</p> : options.map((option) => {
                const checked = selected.some((item) => String(item.id) === String(option.id))
                return (
                  <label className="replacement-option" key={option.id}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(option)} />
                    <span>{option.nom}</span>
                  </label>
                )
              })}
            </div>
            <div className="replacement-summary">
              <b>Conducteurs sélectionnés ({selected.length})</b>
              {selected.length === 0 ? <p>Aucun remplaçant sélectionné.</p> : (
                <ul>{selected.map((item) => (
                  <li key={item.id}>
                    <span>{item.nom}</span>
                    <button type="button" onClick={() => toggle(item)} aria-label={`Retirer ${item.nom}`}>Retirer</button>
                  </li>
                ))}</ul>
              )}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Annuler</button>
          <button type="button" className="button primary" onClick={() => void save()} disabled={loading || saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </section>
    </div>
  )
}
