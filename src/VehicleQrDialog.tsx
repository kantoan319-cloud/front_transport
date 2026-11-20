import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Alert, Modal } from './iz/components'
import { downloadBlob, stickerBlob, stickerFilename } from './qrSticker'
import { downloadQrSheetPdf } from './documentPdf'

interface VehicleQrDialogProps {
  immatriculation: string
  onClose: () => void
}

export default function VehicleQrDialog({ immatriculation, onClose }: VehicleQrDialogProps) {
  const [image, setImage] = useState('')
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  useEffect(() => {
    let active = true
    const url = new URL(window.location.href)
    url.search = ''
    url.hash = `/bus?${new URLSearchParams({ plaque: immatriculation })}`
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

  async function downloadPdf() {
    if (!image) return
    setDownloadingPdf(true)
    try {
      await downloadQrSheetPdf([{ registration: immatriculation, image }], `QR_${immatriculation.replace(/[^\w-]+/g, '_')}_A4.pdf`)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Téléchargement du PDF impossible.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <Modal title={`QR code — ${immatriculation}`} onClose={onClose} footer={<>
      <button className="iz-btn iz-btn-outline" onClick={onClose}>Fermer</button>
      <button className="iz-btn iz-btn-outline" disabled={!image || Boolean(error) || downloading} onClick={() => void download()}>{downloading ? 'Téléchargement…' : 'Télécharger le PNG'}</button>
      <button className="iz-btn iz-btn-primary" disabled={!image || Boolean(error) || downloadingPdf} onClick={() => void downloadPdf()}>{downloadingPdf ? 'Préparation…' : 'PDF A4 à imprimer'}</button>
    </>}>
      <div style={{ textAlign: 'center' }}>
        {error ? <Alert type="error">{error}</Alert> : image ? <img width={240} height={240} src={image} alt={`QR code pour ${immatriculation}`} /> : <p>Génération du QR code…</p>}
        <h3>{immatriculation}</h3>
        <p>Scannez ce code pour consulter la fiche du bus. Les informations réservées nécessitent une connexion.</p>
        {['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) && <Alert>Ce code utilise une adresse locale. Ouvrez l’application depuis son adresse accessible aux téléphones avant de télécharger les étiquettes définitives.</Alert>}
      </div>
    </Modal>
  )
}
