import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import VehicleQrDialog from '../VehicleQrDialog'
import { izApi } from './api'
import type { IZRecord } from './api'
import { Alert, ConfirmDialog, ExportButton, Field, Loading, Modal, PageHead, StatusBadge, geolocate, useApp, useAsync } from './components'
import { DataTable } from './DataTable'
import { attestationState } from './attestation-utils'

export function plateFromQr(raw: string): string {
  let value = raw.trim()
  if (/^(https?:\/\/|\/|#)/i.test(value)) {
    const url = new URL(value, window.location.href)
    const hash = new URLSearchParams(url.hash.split('?')[1] ?? '')
    value = hash.get('plaque') ?? url.searchParams.get('m') ?? url.searchParams.get('plaque') ?? ''
  }
  value = value.trim().toUpperCase()
  if (!value || value.length > 40 || !/^[\p{L}\p{N} /._-]+$/u.test(value)) {
    throw new Error('Ce QR code ne contient pas une immatriculation valide.')
  }
  return value
}

export function QrScanner({ onScan }: { onScan: (plate: string) => void }) {
  const [active, setActive] = useState(false)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const generation = useRef(0)
  const callback = useRef(onScan)
  callback.current = onScan

  const stop = () => {
    generation.current += 1
    window.clearTimeout(timer.current)
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    if (video.current) video.current.srcObject = null
    setActive(false)
    setOpening(false)
  }
  useEffect(() => () => {
    generation.current += 1
    window.clearTimeout(timer.current)
    stream.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const start = async () => {
    stop()
    setError('')
    const attempt = generation.current
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('La caméra nécessite HTTPS ou localhost. Importez une image du QR code ou saisissez la plaque.')
      return
    }
    setOpening(true)
    try {
      const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      if (generation.current !== attempt || !video.current) {
        camera.getTracks().forEach((track) => track.stop())
        return
      }
      stream.current = camera
      video.current.srcObject = camera
      await video.current.play()
      const decode = (await import('jsqr')).default
      if (generation.current !== attempt) return
      setActive(true)
      setOpening(false)
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Lecture des images indisponible.')
      const scan = () => {
        if (generation.current !== attempt || !video.current) return
        try {
          if (video.current.readyState >= 2 && video.current.videoWidth) {
            canvas.width = Math.min(960, video.current.videoWidth)
            canvas.height = Math.round(canvas.width * video.current.videoHeight / video.current.videoWidth)
            context.drawImage(video.current, 0, 0, canvas.width, canvas.height)
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
            const result = decode(pixels.data, pixels.width, pixels.height)
            if (result) {
              const plate = plateFromQr(result.data)
              stop()
              callback.current(plate)
              return
            }
          }
          timer.current = window.setTimeout(scan, 180)
        } catch (reason) {
          stop()
          setError(reason instanceof Error ? reason.message : 'QR code illisible.')
        }
      }
      scan()
    } catch (reason) {
      if (generation.current !== attempt) return
      stop()
      setError(reason instanceof DOMException && reason.name === 'NotAllowedError'
        ? 'Accès à la caméra refusé. Autorisez la caméra ou importez une image.'
        : 'Caméra indisponible. Importez une image du QR code ou saisissez la plaque.')
    }
  }

  const importImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    stop()
    setError('')
    const attempt = generation.current
    let image: ImageBitmap | undefined
    try {
      if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) throw new Error('Choisissez une image de moins de 10 Mo.')
      image = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      const ratio = Math.min(1, 1800 / Math.max(image.width, image.height))
      canvas.width = Math.max(1, Math.round(image.width * ratio))
      canvas.height = Math.max(1, Math.round(image.height * ratio))
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Lecture des images indisponible.')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
      const result = (await import('jsqr')).default(pixels.data, pixels.width, pixels.height)
      if (!result) throw new Error('Aucun QR code lisible dans cette image.')
      if (generation.current === attempt) callback.current(plateFromQr(result.data))
    } catch (reason) {
      if (generation.current === attempt) setError(reason instanceof Error ? reason.message : 'Image illisible.')
    } finally {
      image?.close()
    }
  }

  return <div style={{ marginBottom: 20 }}>
    <div className="iz-flex iz-wrap" style={{ marginBottom: 12 }}>
      <button type="button" className="iz-btn iz-btn-primary" disabled={opening || active} onClick={() => void start()}>{opening ? 'Ouverture…' : 'Scanner avec la caméra'}</button>
      {(opening || active) && <button type="button" className="iz-btn iz-btn-outline" onClick={stop}>Arrêter la caméra</button>}
      <label className="iz-btn iz-btn-outline">Importer un QR code<input type="file" accept="image/*" onChange={(event) => void importImage(event)} style={{ display: 'none' }} /></label>
    </div>
    <video ref={video} muted playsInline hidden={!active} style={{ width: '100%', maxHeight: 360, borderRadius: 12 }} />
    {error && <Alert type="error">{error}</Alert>}
  </div>
}

export function PublicScanPage() {
  const { navigate } = useApp()
  const [plate, setPlate] = useState('')
  const [error, setError] = useState('')
  const open = (value: string) => {
    try { navigate(`/bus?${new URLSearchParams({ plaque: plateFromQr(value) })}`) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Plaque invalide.') }
  }
  return <>
    <PageHead title="Scanner un bus" subtitle="Sans compte : scannez le QR code, consultez le bus et signalez un problème." />
    <div className="iz-card" style={{ maxWidth: 760 }}>
      <QrScanner onScan={open} />
      <form className="iz-form-grid" onSubmit={(event) => { event.preventDefault(); open(plate) }}>
        <Field label="Immatriculation ou lien du QR code" full><input className="iz-input" required maxLength={2048} value={plate} onChange={(event) => setPlate(event.target.value)} placeholder="Ex. 0169 TBF" /></Field>
        <button type="submit" className="iz-btn iz-btn-outline full">Consulter le bus</button>
      </form>
      {error && <Alert type="error">{error}</Alert>}
    </div>
  </>
}

export function BusInformation({ vehicle, staff = false }: { vehicle: IZRecord; staff?: boolean }) {
  const fields: [string, unknown][] = [
    ['Type', vehicle.type], ['Coopérative', vehicle.cooperativeNom ?? vehicle.cooperativeCode], ['Ligne', vehicle.ligne],
    ...(staff ? [
      ['Propriétaire', vehicle.proprietaireNom], ['Conducteur', vehicle.conducteurNom],
      ['Permis du conducteur', vehicle.conducteurPermis], ['Téléphone du conducteur', vehicle.conducteurTelephone],
      ['Receveur', vehicle.receveurNom], ['Téléphone du receveur', vehicle.receveurTelephone],
      ['Numéro de licence', vehicle.licenceNumero], ['NIF', vehicle.licenceNif], ['STAT', vehicle.licenceStat],
      ['Début de validité', vehicle.licenceDebut], ['Fin de validité', vehicle.licenceFin],
    ] as [string, unknown][] : []),
  ]
  return <>
    {(vehicle.photoUrl || (staff && vehicle.proprietairePhoto)) && (
      <div className="iz-photo-grid" style={{ marginTop: 16 }}>
        {vehicle.photoUrl && (
          <figure className="iz-photo-card">
            <img src={String(vehicle.photoUrl)} alt={`Véhicule ${vehicle.immatriculation}`} />
            <figcaption>Photo du véhicule</figcaption>
          </figure>
        )}
        {staff && vehicle.proprietairePhoto && (
          <figure className="iz-photo-card">
            <img src={String(vehicle.proprietairePhoto)} alt={`Propriétaire ${vehicle.proprietaireNom ?? ''}`} />
            <figcaption>Photo du propriétaire</figcaption>
          </figure>
        )}
      </div>
    )}
    <div className="iz-detail-grid" style={{ marginTop: 16 }}>
      {fields.map(([label, value]) => <div className="iz-detail-item" key={label}><span>{label}</span><strong>{value == null || value === '' ? 'Non renseigné' : String(value)}</strong></div>)}
      <div className="iz-detail-item"><span>État du véhicule</span><StatusBadge status={vehicle.statut} /></div>
      {staff && <div className="iz-detail-item"><span>Statut de la licence</span><StatusBadge status={vehicle.statutLicence} /></div>}
    </div>
    {staff && <p className="iz-small iz-muted" style={{ marginTop: 12 }}>Chaque nouvelle licence est valable un an, jusqu’à la veille de sa date anniversaire.</p>}
  </>
}

export function BusPage({ plate }: { plate: string }) {
  const { user, route, navigate, notify } = useApp()
  const staff = (user?.role === 'admin' || user?.role === 'superadmin') || user?.role === 'controleur'
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const { data, loading, error, reload } = useAsync(() => staff ? izApi.controlVehicle(plate) : izApi.vehicle(plate), [plate, staff])
  const attestations = useAsync(
    () => isAdmin && data?.immatriculation
      ? izApi.vehicleAttestations(String(data.immatriculation))
      : Promise.resolve(null),
    [isAdmin, data?.immatriculation],
  )
  const [qr, setQr] = useState(new URLSearchParams(route.split('?')[1]).get('qr') === '1')
  // Consultation sans compte (scan du QR) : la position du visiteur est
  // transmise aux administrateurs, une seule fois par ouverture.
  const reportedScan = useRef(false)
  useEffect(() => {
    if (staff || !data?.immatriculation || reportedScan.current) return
    reportedScan.current = true
    void geolocate(8000).then((coords) => {
      if (!coords) return
      void izApi.reportPublicScan({ immatriculation: String(data.immatriculation), ...coords }).catch(() => {})
    })
  }, [staff, data?.immatriculation])
  const [action, setAction] = useState<'impound' | 'release' | null>(null)
  const [motif, setMotif] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!data || !action || busy) return
    setBusy(true)
    try {
      if (action === 'impound') await izApi.impoundVehicle(data.id, { motif: motif.trim() })
      else await izApi.releaseVehicle(data.id)
      setAction(null)
      setMotif('')
      await reload()
      notify(action === 'impound' ? 'Mise en fourrière enregistrée.' : 'Sortie de fourrière enregistrée.', 'success')
    } catch (reason) { notify(reason instanceof Error ? reason.message : 'Action impossible.', 'error') }
    finally { setBusy(false) }
  }
  return <>
    <PageHead title={`Bus — ${plate}`} subtitle={staff ? 'Fiche de contrôle réservée aux agents habilités.' : 'À propos du bus — consultation sans compte.'} />
    {loading ? <Loading /> : error ? <Alert type="error">{error}</Alert> : data && <>
      <div className="iz-card">
        <BusInformation vehicle={data} staff={staff} />
        <div className="iz-flex iz-wrap" style={{ marginTop: 20 }}>
          <button className="iz-btn iz-btn-primary" onClick={() => navigate(`/signaler?${new URLSearchParams({ plaque: data.immatriculation })}`)}>Signaler un problème</button>
          {(user?.role === 'admin' || user?.role === 'superadmin') && <button className="iz-btn iz-btn-outline" onClick={() => setQr(true)}>Afficher le QR code</button>}
          {staff && <button className="iz-btn iz-btn-outline" onClick={() => navigate(`/controle/scan?${new URLSearchParams({ plaque: data.immatriculation })}`)}>Enregistrer un contrôle</button>}
          {staff && !data.activeImpound && data.statut !== 'En fourrière' && <button className="iz-btn iz-btn-danger" onClick={() => setAction('impound')}>Mettre en fourrière</button>}
          {(user?.role === 'admin' || user?.role === 'superadmin') && data.activeImpound && <button className="iz-btn iz-btn-outline" onClick={() => setAction('release')}>Autoriser la sortie de fourrière</button>}
          {!staff && <button className="iz-btn iz-btn-outline" onClick={() => navigate(`/connexion?${new URLSearchParams({ retour: `/bus?${new URLSearchParams({ plaque: plate })}` })}`)}>Connexion contrôleur / administrateur</button>}
        </div>
      </div>
      {isAdmin && attestations.data && (attestations.data.capacite || attestations.data.receveur) && (
        <div className="iz-card" style={{ marginTop: 16 }}>
          <div className="iz-section-head">
            <h3>Attestations liées au bus</h3>
            <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => navigate('/admin/attestations')}>Gérer</button>
          </div>
          <div className="iz-detail-grid">
            {attestations.data.capacite && (
              <div className="iz-detail-item">
                <span>Capacité — {attestations.data.capacite.nom} {attestations.data.capacite.prenoms}</span>
                <strong>{attestations.data.capacite.numero_attestation || 'N° non renseigné'}</strong>
                <StatusBadge status={attestationState(attestations.data.capacite)} />
                <div className="iz-small iz-muted">
                  Valable jusqu’au {String(attestations.data.capacite.valable_jusquau ?? '').slice(0, 10) || attestations.data.capacite.valable_texte || '—'}
                </div>
              </div>
            )}
            {attestations.data.receveur && (
              <div className="iz-detail-item">
                <span>Receveur — {attestations.data.receveur.nom} {attestations.data.receveur.prenoms}</span>
                <strong>{attestations.data.receveur.numero_attestation_receveur || attestations.data.receveur.numero_attestation || 'N° non renseigné'}</strong>
                <StatusBadge status={attestationState(attestations.data.receveur)} />
                <div className="iz-small iz-muted">
                  Valable jusqu’au {String(attestations.data.receveur.valable_jusquau ?? '').slice(0, 10) || attestations.data.receveur.valable_texte || '—'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {staff && data.activeImpound && <div style={{ marginTop: 16 }}><Alert type="error">Véhicule en fourrière : {data.activeImpound.motif}</Alert></div>}
      {staff && data.scans?.length > 0 && <div className="iz-card" style={{ marginTop: 16 }}><h3>Derniers contrôles</h3><ul>{data.scans.map((scan: IZRecord) => <li key={scan.id}>{String(scan.scanTime ?? '').slice(0, 16).replace('T', ' ')} — {scan.resultat}</li>)}</ul></div>}
      {qr && (user?.role === 'admin' || user?.role === 'superadmin') && <VehicleQrDialog immatriculation={data.immatriculation} onClose={() => setQr(false)} />}
    </>}
    {action && <Modal title={action === 'impound' ? 'Confirmer la mise en fourrière' : 'Confirmer la sortie de fourrière'} onClose={() => { if (!busy) setAction(null) }}>
      <form className="iz-form-grid" onSubmit={submit}>
        <p className="full">Véhicule : <strong>{plate}</strong>. Cette opération sera enregistrée avec votre compte.</p>
        {action === 'impound' && <Field label="Motif obligatoire" full><textarea className="iz-textarea" required minLength={3} maxLength={1000} value={motif} onChange={(event) => setMotif(event.target.value)} /></Field>}
        <button className="iz-btn iz-btn-danger full" disabled={busy || (action === 'impound' && motif.trim().length < 3)} type="submit">{busy ? 'Enregistrement…' : 'Confirmer'}</button>
      </form>
    </Modal>}
  </>
}

export function ImpoundsPage() {
  const { navigate, user, notify } = useApp()
  const { data, loading, error, reload } = useAsync(() => izApi.impounds(), [])
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const isSuper = user?.role === 'superadmin'
  const remove = async () => {
    if (!deleting) return
    try {
      await izApi.deleteImpound(Number(deleting.id))
      notify('Immobilisation supprimée.', 'success')
      setDeleting(null)
      await reload()
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Suppression impossible.', 'error')
    }
  }
  return <>
    <PageHead title="Fourrière" subtitle="Historique des immobilisations et des sorties." action={(user?.role === 'admin' || user?.role === 'superadmin') ? <ExportButton cible="fourriere" label="Excel" /> : undefined} />
    {loading ? <Loading /> : error ? <Alert type="error">{error}</Alert> : (
      <DataTable
        rows={data ?? []}
        rowKey={(row) => String(row.id)}
        rowLabel={(row) => String(row.immatriculation ?? row.id)}
        searchText={(row) => [row.immatriculation, row.motif, row.createdByName, row.releasedByName, row.statutPrecedent].join(' ')}
        initialSort="createdAt"
        empty={<p className="iz-list-empty">Aucun véhicule en fourrière.</p>}
        columns={[
          { key: 'immatriculation', label: 'Véhicule', sortValue: (row) => String(row.immatriculation ?? ''), render: (row) => <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => navigate(`/bus?${new URLSearchParams({ plaque: row.immatriculation })}`)}>{row.immatriculation}</button> },
          { key: 'motif', label: 'Motif', sortValue: (row) => String(row.motif ?? ''), render: (row) => <>{row.motif}</> },
          { key: 'createdByName', label: 'Agent', sortValue: (row) => String(row.createdByName ?? ''), render: (row) => <>{row.createdByName}</> },
          { key: 'createdAt', label: 'Entrée', sortValue: (row) => String(row.createdAt ?? ''), render: (row) => <span className="iz-small iz-nowrap">{String(row.createdAt).slice(0, 16).replace('T', ' ')}</span> },
          { key: 'releasedAt', label: 'Sortie', sortValue: (row) => String(row.releasedAt ?? ''), render: (row) => <span className="iz-small iz-nowrap">{row.releasedAt ? String(row.releasedAt).slice(0, 16).replace('T', ' ') : 'En fourrière'}</span> },
        ]}
        actions={isSuper ? (row) => (
          <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setDeleting(row)}>Supprimer</button>
        ) : undefined}
      />
    )}
    {deleting && (
      <ConfirmDialog
        message={`Supprimer définitivement l'immobilisation du ${deleting.immatriculation ?? ''} ? Si elle est encore active, le statut du bus sera restauré.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    )}
  </>
}
