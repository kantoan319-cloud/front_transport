import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Alert, Modal, useApp } from './iz/components'
import { downloadBlob, stickerBlob, stickerFilename } from './qrSticker'
import { downloadQrSheetPdf } from './documentPdf'

interface VehicleQrDialogProps {
  immatriculation: string
  onClose: () => void
}

export default function VehicleQrDialog({ immatriculation, onClose }: VehicleQrDialogProps) {
  const { t, lang } = useApp()
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
        if (active) setError(reason instanceof Error ? reason.message : t('qrDialog.generateFailed'))
      })
    return () => { active = false }
  }, [immatriculation, t])

  async function download() {
    if (!image) return
    setDownloading(true)
    try {
      downloadBlob(await stickerBlob(image, immatriculation, lang), stickerFilename(immatriculation))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : t('qrDialog.downloadFailed'))
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
      setError(reason instanceof Error ? reason.message : t('qrDialog.pdfFailed'))
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <Modal title={`QR code — ${immatriculation}`} onClose={onClose} footer={<>
      <button className="iz-btn iz-btn-outline" onClick={onClose}>{t('common.close')}</button>
      <button className="iz-btn iz-btn-outline" disabled={!image || Boolean(error) || downloading} onClick={() => void download()}>{downloading ? t('qrDialog.downloading') : t('qrDialog.downloadPng')}</button>
      <button className="iz-btn iz-btn-primary" disabled={!image || Boolean(error) || downloadingPdf} onClick={() => void downloadPdf()}>{downloadingPdf ? t('qrDialog.preparing') : t('qrDialog.pdfA4')}</button>
    </>}>
      <div style={{ textAlign: 'center' }}>
        {error ? <Alert type="error">{error}</Alert> : image ? <img width={240} height={240} src={image} alt={t('qrDialog.alt', { plate: immatriculation })} /> : <p>{t('qrDialog.generating')}</p>}
        <h3>{immatriculation}</h3>
        <p>{t('qrDialog.help')}</p>
        {['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) && <Alert>{t('qrDialog.localWarning')}</Alert>}
      </div>
    </Modal>
  )
}
