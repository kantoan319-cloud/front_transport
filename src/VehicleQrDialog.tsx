import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { downloadBlob, stickerBlob, stickerFilename } from './qrSticker'

interface VehicleQrDialogProps {
  immatriculation: string
  onClose: () => void
}

export default function VehicleQrDialog({ immatriculation, onClose }: VehicleQrDialogProps) {
  const [image, setImage] = useState('')
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let active = true
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('public', '1')
    url.searchParams.set('m', immatriculation)
    void QRCode.toDataURL(url.toString(), { errorCorrectionLevel: 'M', margin: 3, width: 240 })
      .then((dataUrl) => {
        if (active) setImage(dataUrl)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Impossible de générer le QR code.')
      })
    return () => { active = false }
  }, [immatriculation])

  async function download() {
    if (!image) return
    setDownloading(true)
    try {
      downloadBlob(await stickerBlob(image, immatriculation), stickerFilename(immatriculation))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Téléchargement impossible.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="modal-backdrop qr-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="qr-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-title">
        <div className="qr-print-card">
          <div className="qr-dialog-heading">
            <div><span className="eyebrow">FICHE PUBLIQUE DU VÉHICULE</span><h2 id="qr-title">{immatriculation}</h2></div>
            <button className="modal-close qr-close" onClick={onClose} aria-label="Fermer">×</button>
          </div>
          {error ? <div className="alert error" role="alert">{error}</div> : image ? <img className="qr-image" src={image} alt={`QR code pour ${immatriculation}`} /> : <div className="qr-loading"><span className="spinner" /><span>Génération du QR code…</span></div>}
          <p>Scannez ce code pour vérifier les informations du véhicule.</p>
        </div>
        <div className="qr-dialog-actions">
          <button className="button secondary" onClick={onClose}>Fermer</button>
          <button className="button secondary" disabled={!image || Boolean(error) || downloading} onClick={() => void download()}>{downloading ? 'Téléchargement…' : 'Télécharger le PNG'}</button>
          <button className="button primary" disabled={!image || Boolean(error)} onClick={() => window.print()}>Imprimer le QR code</button>
        </div>
      </section>
    </div>
  )
}
