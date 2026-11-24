import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import VehicleQrDialog from '../VehicleQrDialog'
import { izApi } from './api'
import type { IZRecord } from './api'
import { translateError, translateValue } from './i18n'
import { Alert, ConfirmDialog, ExportButton, Field, Loading, Modal, PageHead, StatusBadge, geolocate, useApp, useAsync } from './components'
import { DataTable } from './DataTable'
import { attestationState } from './attestation-utils'
import { photoDataUrl } from './photo'
import { AgentIdentityButton, AgentProfileDialog } from './profiles'

export function plateFromQr(raw: string): string {
  let value = raw.trim()
  if (/^(https?:\/\/|\/|#)/i.test(value)) {
    const url = new URL(value, window.location.href)
    const hash = new URLSearchParams(url.hash.split('?')[1] ?? '')
    value = hash.get('plaque') ?? url.searchParams.get('m') ?? url.searchParams.get('plaque') ?? ''
  }
  value = value.trim().toUpperCase()
  if (!value || value.length > 40 || !/^[\p{L}\p{N} /._-]+$/u.test(value)) {
    throw new Error('scan.invalidQr')
  }
  return value
}

export function QrScanner({ onScan }: { onScan: (plate: string) => void }) {
  const { t } = useApp()
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

  const fail = (reason: unknown, fallbackKey: string) => {
    const message = reason instanceof Error && reason.message ? reason.message : fallbackKey
    setError(t(message))
  }

  const start = async () => {
    stop()
    setError('')
    const attempt = generation.current
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t('scan.cameraHttps'))
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
      if (!context) throw new Error('scan.readError')
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
          fail(reason, 'scan.unreadableQr')
        }
      }
      scan()
    } catch (reason) {
      if (generation.current !== attempt) return
      stop()
      setError(reason instanceof DOMException && reason.name === 'NotAllowedError'
        ? t('scan.cameraDenied')
        : t('scan.cameraUnavailable'))
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
      if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) throw new Error('scan.imageTooLarge')
      image = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      const ratio = Math.min(1, 1800 / Math.max(image.width, image.height))
      canvas.width = Math.max(1, Math.round(image.width * ratio))
      canvas.height = Math.max(1, Math.round(image.height * ratio))
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('scan.readError')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
      const result = (await import('jsqr')).default(pixels.data, pixels.width, pixels.height)
      if (!result) throw new Error('scan.noQr')
      if (generation.current === attempt) callback.current(plateFromQr(result.data))
    } catch (reason) {
      if (generation.current === attempt) fail(reason, 'scan.imageUnreadable')
    } finally {
      image?.close()
    }
  }

  return <div style={{ marginBottom: 20 }}>
    <div className="iz-flex iz-wrap" style={{ marginBottom: 12 }}>
      <button type="button" className="iz-btn iz-btn-primary" disabled={opening || active} onClick={() => void start()}>{opening ? t('scan.opening') : t('scan.start')}</button>
      {(opening || active) && <button type="button" className="iz-btn iz-btn-outline" onClick={stop}>{t('scan.stop')}</button>}
      <label className="iz-btn iz-btn-outline">{t('scan.import')}<input type="file" accept="image/*" onChange={(event) => void importImage(event)} style={{ display: 'none' }} /></label>
    </div>
    <video ref={video} muted playsInline hidden={!active} style={{ width: '100%', maxHeight: 360, borderRadius: 12 }} />
    {error && <Alert type="error">{error}</Alert>}
  </div>
}

export function PublicScanPage() {
  const { t, lang, navigate } = useApp()
  const [plate, setPlate] = useState('')
  const [error, setError] = useState('')
  const open = (value: string) => {
    try { navigate(`/bus?${new URLSearchParams({ plaque: plateFromQr(value) })}`) }
    catch (reason) { setError(translateError(lang, reason, 'scan.invalidPlate')) }
  }
  return <>
    <PageHead title={t('scan.title')} subtitle={t('scan.subtitle')} />
    <div className="iz-card" style={{ maxWidth: 760 }}>
      <QrScanner onScan={open} />
      <form className="iz-form-grid" onSubmit={(event) => { event.preventDefault(); open(plate) }}>
        <Field label={t('scan.fieldLabel')} full><input className="iz-input" required maxLength={2048} value={plate} onChange={(event) => setPlate(event.target.value)} placeholder={t('scan.platePlaceholder')} /></Field>
        <button type="submit" className="iz-btn iz-btn-outline full">{t('scan.consult')}</button>
      </form>
      {error && <Alert type="error">{error}</Alert>}
    </div>
  </>
}

export function BusInformation({ vehicle, staff = false, canEditPhoto = false, onPhotoChanged }: {
  vehicle: IZRecord
  staff?: boolean
  canEditPhoto?: boolean
  onPhotoChanged?: (photoUrl: string | null) => void
}) {
  const { t, lang, notify } = useApp()
  const [photoBusy, setPhotoBusy] = useState(false)
  const changePhoto = async (file?: File) => {
    if (!file || photoBusy) return
    setPhotoBusy(true)
    try {
      const photo = await photoDataUrl(file)
      const saved = await izApi.setVehiclePhoto(Number(vehicle.id), photo)
      notify(t('bus.photoSaved'), 'success')
      onPhotoChanged?.(saved.photoUrl ?? photo)
    } catch (reason) {
      notify(translateError(lang, reason, 'bus.photoFail'), 'error')
    } finally {
      setPhotoBusy(false)
    }
  }
  const fields: [string, unknown][] = [
    ['bus.type', vehicle.type], ['bus.coop', vehicle.cooperativeNom ?? vehicle.cooperativeCode], ['bus.line', vehicle.ligne],
    ...(staff ? [
      ['bus.owner', vehicle.proprietaireNom],
      ['bus.ownerCin', vehicle.proprietaireCin],
      ['bus.ownerAddress', vehicle.proprietaireAdresse],
      ['bus.ownerPhone', vehicle.proprietaireTelephone],
      ['bus.driver', vehicle.conducteurNom],
      ['bus.driverPermit', vehicle.conducteurPermis], ['bus.driverPhone', vehicle.conducteurTelephone],
      ['bus.receveur', vehicle.receveurNom], ['bus.receveurPhone', vehicle.receveurTelephone],
      ['bus.licenceNumber', vehicle.licenceNumero], ['admin.licenceNif', vehicle.licenceNif], ['admin.licenceStat', vehicle.licenceStat],
      ['bus.licenceStart', vehicle.licenceDebut], ['bus.licenceEnd', vehicle.licenceFin],
    ] as [string, unknown][] : []),
  ]
  return <>
    {(vehicle.photoUrl || (staff && vehicle.proprietairePhoto) || canEditPhoto) && (
      <div className="iz-photo-grid" style={{ marginTop: 16 }}>
        {(vehicle.photoUrl || canEditPhoto) && (
          <figure className="iz-photo-card">
            {vehicle.photoUrl
              ? <img src={String(vehicle.photoUrl)} alt={t('bus.vehiclePhotoAlt', { plate: String(vehicle.immatriculation ?? '') })} />
              : <div className="iz-photo-card-empty">{t('bus.noPhoto')}</div>}
            <figcaption>
              {t('bus.photoCaption')}
              {canEditPhoto && (
                <label className="iz-btn iz-btn-outline iz-btn-sm" style={{ marginLeft: 8, cursor: 'pointer' }}>
                  {photoBusy ? t('bus.sending') : vehicle.photoUrl ? t('bus.changePhoto') : t('bus.addPhoto')}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={photoBusy}
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      void changePhoto(file)
                    }}
                  />
                </label>
              )}
            </figcaption>
          </figure>
        )}
        {staff && vehicle.proprietairePhoto && (
          <figure className="iz-photo-card">
            <img src={String(vehicle.proprietairePhoto)} alt={t('bus.ownerPhotoAlt', { name: String(vehicle.proprietaireNom ?? '') })} />
            <figcaption>{t('bus.ownerPhotoCaption')}</figcaption>
          </figure>
        )}
      </div>
    )}
    <div className="iz-detail-grid" style={{ marginTop: 16 }}>
      {fields.map(([label, value]) => <div className="iz-detail-item" key={label}><span>{t(label)}</span><strong>{value == null || value === '' ? t('common.notProvided') : translateValue(lang, value)}</strong></div>)}
      <div className="iz-detail-item"><span>{t('bus.vehicleState')}</span><StatusBadge status={vehicle.statut} /></div>
      {staff && <div className="iz-detail-item"><span>{t('bus.licenceState')}</span><StatusBadge status={vehicle.statutLicence} /></div>}
    </div>
    {staff && <p className="iz-small iz-muted" style={{ marginTop: 12 }}>{t('bus.sixMonths')}</p>}
  </>
}

export function BusPage({ plate }: { plate: string }) {
  const { t, lang, user, route, navigate, notify } = useApp()
  const staff = (user?.role === 'admin' || user?.role === 'superadmin') || user?.role === 'controleur'
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const profilBloque = user?.role === 'controleur' && !user.profilComplet
  const { data, loading, error, reload, setData } = useAsync(() => staff ? izApi.controlVehicle(plate) : izApi.vehicle(plate), [plate, staff])
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
      notify(t(action === 'impound' ? 'bus.impoundSaved' : 'bus.releaseSaved'), 'success')
    } catch (reason) { notify(translateError(lang, reason, 'bus.actionFailed'), 'error') }
    finally { setBusy(false) }
  }
  return <>
    <PageHead title={t('bus.title', { plate })} subtitle={staff ? t('bus.staffSubtitle') : t('bus.publicSubtitle')} />
    {loading ? <Loading /> : error ? <Alert type="error">{error}</Alert> : data && <>
      <div className="iz-card">
        <BusInformation
          vehicle={data}
          staff={staff}
          canEditPhoto={staff}
          onPhotoChanged={(photoUrl) => setData({ ...data, photoUrl })}
        />
        {profilBloque && (
          <div style={{ marginTop: 14 }}>
            <Alert type="error">
              {t('bus.profileRequired')}{' '}
              <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => navigate('/controle/profil')}>{t('signal.myProfile')}</button>
            </Alert>
          </div>
        )}
        <div className="iz-flex iz-wrap" style={{ marginTop: 20 }}>
          <button className="iz-btn iz-btn-primary" onClick={() => navigate(`/signaler?${new URLSearchParams({ plaque: data.immatriculation })}`)}>{t('bus.report')}</button>
          {(user?.role === 'admin' || user?.role === 'superadmin') && <button className="iz-btn iz-btn-outline" onClick={() => setQr(true)}>{t('bus.showQr')}</button>}
          {staff && <button className="iz-btn iz-btn-outline" onClick={() => navigate(`/controle/scan?${new URLSearchParams({ plaque: data.immatriculation })}`)}>{t('bus.saveControl')}</button>}
          {staff && !data.activeImpound && data.statut !== 'En fourrière' && <button className="iz-btn iz-btn-danger" disabled={profilBloque} onClick={() => setAction('impound')}>{t('bus.impound')}</button>}
          {(user?.role === 'admin' || user?.role === 'superadmin') && data.activeImpound && <button className="iz-btn iz-btn-outline" onClick={() => setAction('release')}>{t('bus.release')}</button>}
          {!staff && <button className="iz-btn iz-btn-outline" onClick={() => navigate(`/connexion?${new URLSearchParams({ retour: `/bus?${new URLSearchParams({ plaque: plate })}` })}`)}>{t('bus.loginAgent')}</button>}
        </div>
      </div>
      {isAdmin && attestations.data && (attestations.data.capacite || attestations.data.receveur) && (
        <div className="iz-card" style={{ marginTop: 16 }}>
          <div className="iz-section-head">
            <h3>{t('bus.attestationsTitle')}</h3>
            <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => navigate('/admin/attestations')}>{t('bus.manage')}</button>
          </div>
          <div className="iz-detail-grid">
            {attestations.data.capacite && (
              <div className="iz-detail-item">
                <span>{t('bus.capacity')} — {attestations.data.capacite.nom} {attestations.data.capacite.prenoms}</span>
                <strong>{attestations.data.capacite.numero_attestation || t('bus.noNumber')}</strong>
                <StatusBadge status={attestationState(attestations.data.capacite)} />
                <div className="iz-small iz-muted">
                  {t('bus.validUntil', { date: String(attestations.data.capacite.valable_jusquau ?? '').slice(0, 10) || attestations.data.capacite.valable_texte || '—' })}
                </div>
              </div>
            )}
            {attestations.data.receveur && (
              <div className="iz-detail-item">
                <span>{t('bus.receveur')} — {attestations.data.receveur.nom} {attestations.data.receveur.prenoms}</span>
                <strong>{attestations.data.receveur.numero_attestation_receveur || attestations.data.receveur.numero_attestation || t('bus.noNumber')}</strong>
                <StatusBadge status={attestationState(attestations.data.receveur)} />
                <div className="iz-small iz-muted">
                  {t('bus.validUntil', { date: String(attestations.data.receveur.valable_jusquau ?? '').slice(0, 10) || attestations.data.receveur.valable_texte || '—' })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {staff && data.activeImpound && <div style={{ marginTop: 16 }}><Alert type="error">{t('bus.impoundAlert', { motif: String(data.activeImpound.motif ?? '') })}</Alert></div>}
      {staff && data.scans?.length > 0 && <div className="iz-card" style={{ marginTop: 16 }}><h3>{t('bus.lastScans')}</h3><ul>{data.scans.map((scan: IZRecord) => <li key={scan.id}>{String(scan.scanTime ?? '').slice(0, 16).replace('T', ' ')} — {translateValue(lang, scan.resultat)}</li>)}</ul></div>}
      {qr && (user?.role === 'admin' || user?.role === 'superadmin') && <VehicleQrDialog immatriculation={data.immatriculation} onClose={() => setQr(false)} />}
    </>}
    {action && <Modal title={action === 'impound' ? t('bus.confirmImpoundTitle') : t('bus.confirmReleaseTitle')} onClose={() => { if (!busy) setAction(null) }}>
      <form className="iz-form-grid" onSubmit={submit}>
        <p className="full">{t('bus.confirmVehicle', { plate })}</p>
        {action === 'impound' && <Field label={t('bus.motifRequired')} full><textarea className="iz-textarea" required minLength={3} maxLength={1000} value={motif} onChange={(event) => setMotif(event.target.value)} /></Field>}
        <button className="iz-btn iz-btn-danger full" disabled={busy || (action === 'impound' && motif.trim().length < 3)} type="submit">{busy ? t('common.saving') : t('bus.confirm')}</button>
      </form>
    </Modal>}
  </>
}

export function ImpoundsPage() {
  const { t, lang, navigate, user, notify } = useApp()
  const { data, loading, error, reload } = useAsync(() => izApi.impounds(), [])
  const [deleting, setDeleting] = useState<IZRecord | null>(null)
  const [viewingAgent, setViewingAgent] = useState<number | null>(null)
  const isSuper = user?.role === 'superadmin'
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const remove = async () => {
    if (!deleting) return
    try {
      await izApi.deleteImpound(Number(deleting.id))
      notify(t('impound.deleted'), 'success')
      setDeleting(null)
      await reload()
    } catch (cause) {
      notify(translateError(lang, cause, 'impound.deleteFailed'), 'error')
    }
  }
  return <>
    <PageHead title={t('impound.title')} subtitle={t('impound.subtitle')} action={(user?.role === 'admin' || user?.role === 'superadmin') ? <ExportButton cible="fourriere" label="Excel" /> : undefined} />
    {loading ? <Loading /> : error ? <Alert type="error">{error}</Alert> : (
      <DataTable
        rows={data ?? []}
        rowKey={(row) => String(row.id)}
        rowLabel={(row) => String(row.immatriculation ?? row.id)}
        searchText={(row) => [row.immatriculation, row.motif, row.createdByName, row.agentNom, row.agentPrenom, row.agentCin, row.agentFonction, row.agentMatricule, row.agentTelephone, row.releasedByName, row.statutPrecedent].join(' ')}
        initialSort="createdAt"
        empty={<p className="iz-list-empty">{t('impound.empty')}</p>}
        columns={[
          { key: 'immatriculation', label: t('impound.vehicle'), sortValue: (row) => String(row.immatriculation ?? ''), render: (row) => <button className="iz-btn iz-btn-outline iz-btn-sm" onClick={() => navigate(`/bus?${new URLSearchParams({ plaque: row.immatriculation })}`)}>{row.immatriculation}</button> },
          { key: 'motif', label: t('impound.motif'), sortValue: (row) => String(row.motif ?? ''), render: (row) => <>{row.motif}</> },
          {
            key: 'createdByName', label: t('impound.agent'),
            sortValue: (row) => String(row.agentNom ?? row.createdByName ?? ''),
            render: (row) => (
              <AgentIdentityButton
                id={isAdmin ? row.agentId : null}
                name={[row.agentPrenom, row.agentNom].filter(Boolean).join(' ') || row.createdByName}
                onOpen={setViewingAgent}
              />
            ),
          },
          ...(isAdmin ? [
            { key: 'agentCin', label: t('control.cin'), sortValue: (row: IZRecord) => String(row.agentCin ?? ''), render: (row: IZRecord) => <span className="iz-small iz-mono">{row.agentCin ?? '—'}</span> },
            { key: 'agentFonction', label: t('control.fonction'), sortValue: (row: IZRecord) => String(row.agentFonction ?? ''), render: (row: IZRecord) => <span className="iz-small">{row.agentFonction ?? '—'}</span> },
            { key: 'agentMatricule', label: t('control.matricule'), sortValue: (row: IZRecord) => String(row.agentMatricule ?? ''), render: (row: IZRecord) => <span className="iz-small iz-mono">{row.agentMatricule ?? '—'}</span> },
            { key: 'agentTelephone', label: t('control.phone'), sortValue: (row: IZRecord) => String(row.agentTelephone ?? ''), render: (row: IZRecord) => <span className="iz-small">{row.agentTelephone ?? '—'}</span> },
          ] : []),
          { key: 'createdAt', label: t('impound.entry'), sortValue: (row) => String(row.createdAt ?? ''), render: (row) => <span className="iz-small iz-nowrap">{String(row.createdAt).slice(0, 16).replace('T', ' ')}</span> },
          { key: 'releasedAt', label: t('impound.exit'), sortValue: (row) => String(row.releasedAt ?? ''), render: (row) => <span className="iz-small iz-nowrap">{row.releasedAt ? String(row.releasedAt).slice(0, 16).replace('T', ' ') : translateValue(lang, 'En fourrière')}</span> },
        ]}
        actions={isSuper ? (row) => (
          <button className="iz-btn iz-btn-danger iz-btn-sm" onClick={() => setDeleting(row)}>{t('common.delete')}</button>
        ) : undefined}
      />
    )}
    {deleting && (
      <ConfirmDialog
        message={t('impound.deleteConfirm', { plate: String(deleting.immatriculation ?? '') })}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    )}
    {viewingAgent && <AgentProfileDialog id={viewingAgent} onClose={() => setViewingAgent(null)} />}
  </>
}
