import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
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
              </article>
            ))}</div>}
        <div className="qr-batch-actions">
          <button className="button secondary" onClick={onClose}>Fermer</button>
          <button className="button primary" disabled={loading || Boolean(error) || items.length === 0} onClick={() => window.print()}>Imprimer la sélection</button>
        </div>
      </section>
    </div>
  )
}
