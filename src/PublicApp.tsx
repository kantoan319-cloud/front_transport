import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import cityLogo from '../../logo.png'
import busPhoto from '../../bus.jpg'
import bajajPhoto from '../../bajaj.jpg'
import { api, type Vehicle } from './api'
import { usePreferences } from './Preferences'

const publicFields: { key: string; label: string }[] = [
  { key: 'type', label: 'Type de transport' },
  { key: 'nom', label: 'Nom du véhicule' },
  { key: 'couleurs', label: 'Couleurs' },
  { key: 'statut', label: 'Statut' },
  { key: 'nomProprietaire', label: 'Propriétaire' },
  { key: 'telephoneProprietaire', label: 'Téléphone' },
  { key: 'adresseProprietaire', label: 'Adresse' },
  { key: 'professionProprietaire', label: 'Profession' },
  { key: 'cooperative', label: 'Coopérative' },
]

function valueOf(vehicle: Vehicle, key: string): string {
  const value = vehicle[key]
  return value === undefined || value === null || String(value).trim() === ''
    ? '—'
    : String(value)
}

export default function PublicApp() {
  const { language, setLanguage, theme, toggleTheme, t } = usePreferences()
  const [registration, setRegistration] = useState(() => new URLSearchParams(window.location.search).get('m') ?? '')
  const [vehicle, setVehicle] = useState<(Vehicle & Record<string, unknown>) | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const initialLookupRef = useRef(false)

  const lookupVehicle = useCallback(async (value: string) => {
    setBusy(true)
    setError('')
    setFeedback('')
    setVehicle(null)
    try {
      const result = await api.publicVehicle(value.trim())
      setVehicle(result)
      const position = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null)
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
          maximumAge: 60_000,
          timeout: 5000,
        })
      })
      try {
        await api.recordPublicScan({
          immatriculation: result.immatriculation ?? value.trim(),
          ...(position
            ? {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                precision: Math.round(position.coords.accuracy),
              }
            : {}),
        })
      } catch {
        setFeedback('La fiche est affichée, mais cette consultation n’a pas pu être enregistrée.')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Recherche impossible.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => {
    const scannedRegistration = new URLSearchParams(window.location.search).get('m')?.trim()
    if (scannedRegistration && !initialLookupRef.current) {
      initialLookupRef.current = true
      void lookupVehicle(scannedRegistration)
    }
  }, [lookupVehicle])

  async function scanWithCamera() {
    setError('')
    const barcodeWindow = window as Window & {
      BarcodeDetector?: new (options?: { formats: string[] }) => {
        detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]>
      }
    }
    if (!navigator.mediaDevices?.getUserMedia || !barcodeWindow.BarcodeDetector) {
      setError('Le scan par caméra n’est pas pris en charge sur ce navigateur. Saisissez l’immatriculation.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setCameraOpen(true)
      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setCameraOpen(false)
        setError('Impossible d’ouvrir l’aperçu caméra.')
        return
      }
      video.srcObject = stream
      await video.play()
      const detector = new barcodeWindow.BarcodeDetector({ formats: ['qr_code'] })
      const inspect = async () => {
        if (!videoRef.current || streamRef.current !== stream) return
        try {
          const codes = await detector.detect(video)
          const code = codes.find(({ rawValue }) => rawValue.trim())
          if (code) {
            const scannedValue = code.rawValue.trim()
            const match = new URL(scannedValue, window.location.href).searchParams.get('m')
              ?? scannedValue
            setRegistration(match)
            stream.getTracks().forEach((track) => track.stop())
            streamRef.current = null
            setCameraOpen(false)
            window.setTimeout(
              () => document.querySelector<HTMLFormElement>('#public-search')?.requestSubmit(),
              0,
            )
            return
          }
        } catch {
          setError('Le code QR ne peut pas être lu. Saisissez l’immatriculation manuellement.')
          stream.getTracks().forEach((track) => track.stop())
          streamRef.current = null
          setCameraOpen(false)
          return
        }
        window.requestAnimationFrame(() => void inspect())
      }
      window.requestAnimationFrame(() => void inspect())
    } catch (reason) {
      setCameraOpen(false)
      setError(reason instanceof Error ? reason.message : 'Impossible d’accéder à la caméra.')
    }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await lookupVehicle(registration)
  }

  async function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!vehicle?.immatriculation) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setBusy(true)
    setError('')
    setFeedback('')
    try {
      await api.submitPublicSignal({
        immatriculation: vehicle.immatriculation,
        motif: String(form.get('motif') ?? ''),
        description: String(form.get('description') ?? ''),
      })
      formElement.reset()
      setFeedback('Merci, votre signalement a été transmis à l’administration.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Envoi du signalement impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="public-screen">
      <header className="public-header">
        <a className="public-brand" href="/?public=1"><span className="brand-mark">C</span><span>Cyclo-pousse<strong>Antsirabe</strong></span></a>
        <div className="public-settings"><label><span className="sr-only">{t('Langue')}</span><select aria-label={t('Langue')} value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}><option value="mg">MG</option><option value="fr">FR</option><option value="en">EN</option></select></label><button className="theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? t('Mode jour') : t('Mode nuit')}>{theme === 'dark' ? '☀' : '☾'}</button>
        <a className="button secondary" href="/?admin=1">{t('Espace agents')} <span>→</span></a></div>
      </header>
      <nav className="public-transport-picker" aria-label={t('Choisir un espace de transport')}>
        {[
          { type: 'Bus', image: busPhoto },
          { type: 'Cyclo-pousse', image: cityLogo },
          { type: 'Bajaj', image: bajajPhoto },
        ].map(({ type, image }) => (
          <a className={`public-transport-card transport-${type.toLowerCase().replace(/[^a-z]+/g, '-')}`} href={`/?admin=1&type=${encodeURIComponent(type)}`} key={type}>
            <img src={image} alt="" /><span>{t(type)}</span>
          </a>
        ))}
      </nav>
      <section className="public-hero">
        <span className="eyebrow">{t('COMMUNE URBAINE D’ANTSIRABE')}</span>
        <h1>{t('Vérifiez votre transport')}<br />{t('en toute confiance.')}</h1>
        <p>{t('Scannez un QR code ou saisissez son immatriculation pour consulter les informations du véhicule.')}</p>
        <form id="public-search" className="public-search" onSubmit={(event) => void search(event)}>
          <label htmlFor="public-registration">{t('Immatriculation')}</label>
          <div><input id="public-registration" value={registration} onChange={(event) => setRegistration(event.target.value)} placeholder="Ex. : 15/CP/ABE" required /><button className="button primary" disabled={busy}>{busy ? t('Recherche…') : t('Vérifier')} <span>→</span></button></div>
          <button type="button" className="button secondary camera-button" disabled={busy || cameraOpen} onClick={() => void scanWithCamera()}>{cameraOpen ? t('Caméra active…') : t('Scanner un QR code')}</button>
          <div className="camera-preview" hidden={!cameraOpen}><video ref={videoRef} autoPlay playsInline muted /><button type="button" className="button secondary" onClick={() => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraOpen(false) }}>{t('Fermer la caméra')}</button></div>
        </form>
        {error && <div className="alert error" role="alert">{error}</div>}
        {feedback && <div className="alert success" role="status">{feedback}</div>}
      </section>
      {vehicle && (
        <section className="public-result">
          <div className="public-result-heading"><div><span className="eyebrow">{t('FICHE DU VÉHICULE')}</span><h2>{vehicle.immatriculation}</h2></div><span className={`status-pill ${String(vehicle.statut).toLowerCase() === 'normal' ? 'success' : 'warning'}`}><i />{t(String(vehicle.statut))}</span></div>
          <div className="public-detail-grid">
            {publicFields.map(({ key, label }) => <div className="public-detail" key={key}><small>{t(label)}</small><b>{t(valueOf(vehicle, key))}</b></div>)}
          </div>
          {typeof vehicle.photo === 'string' && vehicle.photo.length > 0 && <img className="public-vehicle-photo" src={`/${vehicle.photo.split('/').map(encodeURIComponent).join('/')}`} alt={`Véhicule ${vehicle.immatriculation}`} />}
          <form className="public-report" onSubmit={(event) => void report(event)}>
            <h3>{t('Signaler un problème')}</h3>
            <label>{t('Motif')}<select name="motif" required><option value="">{t('Choisir un motif')}</option>{['Stationnement gênant', 'Conduite dangereuse', 'Véhicule en mauvais état', 'Tarif abusif', 'Comportement du conducteur', 'Autre'].map((reason) => <option key={reason} value={reason}>{t(reason)}</option>)}</select></label>
            <label>{t('Détails (facultatif)')}<textarea name="description" rows={3} maxLength={1000} placeholder={t('Décrivez brièvement le problème')} /></label>
            <button className="button primary" disabled={busy}>{busy ? t('Envoi…') : t('Envoyer le signalement')}</button>
          </form>
        </section>
      )}
      <footer className="public-footer">Antsirabe tanàna madio, Antsirabe tanàna milamina · Commune Urbaine d’Antsirabe</footer>
    </main>
  )
}
