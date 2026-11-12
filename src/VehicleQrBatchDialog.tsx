import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import JSZip from 'jszip'
import { downloadBlob, stickerBlob, stickerFilename } from './qrSticker'
import './VehicleQrBatchDialog.css'

interface VehicleQrBatchDialogProps {
  registrations: string[]
  onClose: () => void
}

interface QrItem {
  registration: string
  image: string
}

export default function VehicleQrBatchDialog({ registrations, onClose }: VehicleQrBatchDialogProps) {
  const [items, setItems] = useState<QrItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let active = true
    const base = new URL(window.location.href)
    base.search = ''
    base.pathname = base.pathname.replace(/\/+$/, '') || '/'
    base.searchParams.set('public', '1')

    void Promise.all(registrations.map(async (registration) => {
      const url = new URL(base)
      url.searchParams.set('m', registration)
      const image = await QRCode.toDataURL(url.toString(), { errorCorrectionLevel: 'M', margin: 2, width: 180 })
      return { registration, image }
    })).then((result) => {
      if (active) setItems(result)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Impossible de générer les QR codes sélectionnés.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [registrations])

  async function downloadOne(item: QrItem) {
    try {
      downloadBlob(await stickerBlob(item.image, item.registration), stickerFilename(item.registration))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Téléchargement impossible.')
    }
  }

  async function downloadAll() {
    setDownloading(true)
    try {
      if (items.length === 1) {
        await downloadOne(items[0])
        return
      }
      const zip = new JSZip()
      const used = new Set<string>()
      for (const item of items) {
        let name = stickerFilename(item.registration)
        if (used.has(name)) name = `${used.size}_${name}`
        used.add(name)
        zip.file(name, await stickerBlob(item.image, item.registration))
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `QR_codes_${items.length}.zip`)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Téléchargement impossible.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="modal-backdrop qr-batch-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="qr-batch-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-batch-title">
        <div className="qr-batch-heading">
          <div><span className="eyebrow">IMPRESSION GROUPÉE</span><h2 id="qr-batch-title">{registrations.length} QR code{registrations.length === 1 ? '' : 's'} sélectionné{registrations.length === 1 ? '' : 's'}</h2></div>
          <button className="modal-close qr-batch-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        {error ? <div className="alert error" role="alert">{error}</div>
          : loading ? <div className="qr-batch-loading"><span className="spinner" /> Génération des QR codes…</div>
            : <div className="qr-batch-grid">{items.map((item) => (
              <article className="qr-batch-card" key={item.registration}>
                <img src={item.image} alt={`QR code pour ${item.registration}`} />
                <b>{item.registration}</b>
                <small>Scannez pour consulter la fiche</small>
                <button type="button" className="table-action qr-batch-download" onClick={() => void downloadOne(item)}>Télécharger</button>
              </article>
            ))}</div>}
        <div className="qr-batch-actions">
          <button className="button secondary" onClick={onClose}>Fermer</button>
          <button className="button secondary" disabled={loading || Boolean(error) || items.length === 0 || downloading} onClick={() => void downloadAll()}>{downloading ? 'Préparation…' : items.length > 1 ? 'Télécharger (.zip)' : 'Télécharger le PNG'}</button>
          <button className="button primary" disabled={loading || Boolean(error) || items.length === 0} onClick={() => window.print()}>Imprimer la sélection</button>
        </div>
      </section>
    </div>
  )
}
