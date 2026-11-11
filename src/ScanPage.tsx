import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, type Vehicle } from './api'
import { usePreferences } from './Preferences'

interface ScanPageProps {
  onVehicleFound: (registration: string) => void
}

interface BarcodeDetectorWindow extends Window {
  BarcodeDetector?: new (options?: { formats: string[] }) => {
    detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]>
  }
}

type QrDetector = {
  detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]>
}

function registrationFromQr(value: string): string {
  try {
    return new URL(value, window.location.href).searchParams.get('m') ?? value
  } catch {
    return value
  }
}

export default function ScanPage({ onVehicleFound }: ScanPageProps) {
  const { t } = usePreferences()
  const [registration, setRegistration] = useState('')
  const [vehicle, setVehicle] = useState<(Vehicle & Record<string, unknown>) | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  function stopCamera(updateState = true) {
    if (scanLoopRef.current !== null) cancelAnimationFrame(scanLoopRef.current)
    scanLoopRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (updateState) setCameraActive(false)
  }

  useEffect(() => () => stopCamera(false), [])

  async function lookup(value: string) {
    const clean = value.trim()
    if (!clean) return
    setBusy(true)
    setError('')
    setVehicle(null)
    setRegistration(clean)
    try {
      setVehicle(await api.publicVehicle(clean))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('Véhicule introuvable.'))
    } finally {
      setBusy(false)
    }
  }

  async function startCamera() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t('Le scan caméra n’est pas pris en charge par ce navigateur. Saisissez ou collez le numéro du véhicule.'))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        throw new Error(t('Impossible d’ouvrir l’aperçu caméra.'))
      }
      streamRef.current = stream
      video.srcObject = stream
      await video.play()
      setCameraActive(true)
      const barcodeWindow = window as BarcodeDetectorWindow
      let detector: QrDetector | null = null
      if (barcodeWindow.BarcodeDetector) {
        try {
          detector = new barcodeWindow.BarcodeDetector({ formats: ['qr_code'] })
        } catch {
          detector = null
        }
      }
      const decodeQr = detector ? null : (await import('jsqr')).default
      const scan = async () => {
        if (!videoRef.current || streamRef.current !== stream) return
        try {
          let value: string | undefined
          if (detector) {
            const codes = await detector.detect(video)
            value = codes.find((code) => code.rawValue.trim())?.rawValue
          } else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
            const canvas = canvasRef.current ?? document.createElement('canvas')
            canvasRef.current = canvas
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const context = canvas.getContext('2d', { willReadFrequently: true })
            if (!context) throw new Error(t('Impossible de lire ce code QR. Saisissez le numéro manuellement.'))
            context.drawImage(video, 0, 0, canvas.width, canvas.height)
            const image = context.getImageData(0, 0, canvas.width, canvas.height)
            value = decodeQr?.(image.data, image.width, image.height)?.data
          }
          if (value) {
            stopCamera()
            const found = registrationFromQr(value).trim()
            if (!found) {
              setError(t('Le code QR ne contient pas d’immatriculation valide.'))
              return
            }
            setRegistration(found)
            await lookup(found)
            return
          }
        } catch (reason) {
          stopCamera()
          setError(reason instanceof Error ? reason.message : t('Impossible de lire ce code QR. Saisissez le numéro manuellement.'))
          return
        }
        scanLoopRef.current = requestAnimationFrame(() => void scan())
      }
      scanLoopRef.current = requestAnimationFrame(() => void scan())
    } catch (reason) {
      stopCamera()
      setError(reason instanceof Error ? reason.message : t('Impossible d’accéder à la caméra.'))
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void lookup(registration)
  }

  return (
    <section className="content-card scan-card">
      <div className="scan-card-heading">
        <div><span className="eyebrow">{t('LECTURE DU QR CODE')}</span><h2>{t('Scanner un transport')}</h2><p>{t('Scannez le QR code du véhicule ou saisissez son immatriculation.')}</p></div>
        <span className="scan-card-icon">⌖</span>
      </div>
      <form className="scan-manual-form" onSubmit={submit}>
        <label htmlFor="scan-registration">{t('Immatriculation')}</label>
        <div><input id="scan-registration" value={registration} onChange={(event) => setRegistration(event.target.value)} placeholder="15/CP/ABE" required />
          <button type="submit" className="button primary" disabled={busy}>{busy ? t('Recherche…') : t('Rechercher')}</button>
        </div>
      </form>
      <div className="scan-camera-actions">
        <button className="button secondary" type="button" disabled={busy || cameraActive} onClick={() => void startCamera()}>{cameraActive ? t('Caméra active…') : t('Ouvrir la caméra')}</button>
        {cameraActive && <button className="button secondary" type="button" onClick={() => stopCamera()}>{t('Arrêter le scan')}</button>}
      </div>
      <div className="scan-camera-frame" hidden={!cameraActive}><video ref={videoRef} autoPlay playsInline muted /></div>
      {error && <div className="alert error" role="alert">{error}</div>}
      {vehicle && <article className="scan-result">
        <div><span className="eyebrow">{t('Transport identifié')}</span><h3>{vehicle.immatriculation}</h3>
          <p>{t(String(vehicle.type ?? ''))} · {vehicle.nom || '—'} · {t(String(vehicle.statut ?? ''))}</p>
        </div>
        <button type="button" className="button primary" onClick={() => onVehicleFound(String(vehicle.immatriculation ?? registration))}>{t('Ouvrir la fiche')}</button>
      </article>}
    </section>
  )
}
