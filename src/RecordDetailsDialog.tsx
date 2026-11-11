import { useEffect, useState, type ReactNode } from 'react'
import { api, type DriverProfile, type VehicleDetails } from './api'
import './RecordDetailsDialog.css'

interface RecordDetailsDialogProps {
  kind: 'vehicle' | 'driver'
  id: string | number
  onClose: () => void
}

function show(value: string | number | null | undefined): string {
  if (value === null || value === undefined || String(value).trim() === '') return '—'
  return String(value)
}

function date(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fr-FR')
}

function isVehicleDetails(record: VehicleDetails | DriverProfile): record is VehicleDetails {
  return Array.isArray(record.impounds)
}

function isDriverProfile(record: VehicleDetails | DriverProfile): record is DriverProfile {
  return Array.isArray(record.replacements)
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="detail-section"><h3>{title}</h3>{children}</section>
}

function DetailRows({ rows }: { rows: [string, string][] }) {
  return <dl className="detail-rows">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

export default function RecordDetailsDialog({ kind, id, onClose }: RecordDetailsDialogProps) {
  const [record, setRecord] = useState<VehicleDetails | DriverProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const request = kind === 'vehicle'
      ? api.vehicleDetails(String(id))
      : api.driverProfile(id)
    void request.then((result) => {
      if (active) setRecord(result)
    }).catch((requestError: unknown) => {
      if (active) setError(requestError instanceof Error ? requestError.message : 'Impossible de charger cette fiche.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [id, kind])

  const title = kind === 'vehicle'
    ? `Fiche véhicule · ${String(id)}`
    : `Fiche conducteur`

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="modal record-details" role="dialog" aria-modal="true" aria-labelledby="record-details-title">
        <div className="modal-heading">
          <div><span className="eyebrow">CONSULTATION</span><h2 id="record-details-title">{record ? show(record.nom) : title}</h2></div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        {loading ? <div className="inline-state"><span className="spinner" /><span>Chargement de la fiche…</span></div>
          : error ? <div className="alert error" role="alert">{error}</div>
            : record && isVehicleDetails(record) ? (
              <>
                <DetailSection title="Véhicule"><DetailRows rows={[
                  ['Immatriculation', show(record.immatriculation)],
                  ['Type', show(record.type)],
                  ['Nom', show(record.nom)],
                  ['Couleurs', show(record.couleurs)],
                  ['Coopérative', show(record.cooperative)],
                  ['Statut', show(record.statut)],
                  ['Date d’enregistrement', date(record.date)],
                  ['Expiration vignette', date(record.expirationVignette)],
                  ['Expiration visite médicale', date(record.expirationVisiteMedicale)],
                ]} /></DetailSection>
                <DetailSection title="Propriétaire"><DetailRows rows={[
                  ['Nom', [record.prenomProprietaire, record.nomProprietaire].filter(Boolean).join(' ') || '—'],
                  ['CIN', show(record.cinProprietaire)],
                  ['Téléphone', show(record.telephoneProprietaire)],
                  ['Adresse', show(record.adresseProprietaire)],
                ]} /></DetailSection>
                <DetailSection title="Conducteurs affectés">
                  {record.drivers?.length ? <ul className="detail-list">{record.drivers.map((driver) => <li key={driver.id}><b>{driver.nom}</b><span>{driver.role} · {show(driver.telephone)}</span></li>)}</ul> : <p className="detail-empty">Aucun conducteur associé.</p>}
                </DetailSection>
                <DetailSection title="Visites médicales">
                  {record.inspections?.length ? <ul className="detail-list">{record.inspections.map((visit, index) => <li key={`${visit.date}-${index}`}><b>{date(visit.date)} · valable jusqu’au {date(visit.expiration)}</b><span>{visit.dureeMois} mois · {show(visit.observation)}</span></li>)}</ul> : <p className="detail-empty">Aucune visite enregistrée.</p>}
                </DetailSection>
                <DetailSection title="Historique de fourrière">
                  {record.impounds?.length ? <ul className="detail-list">{record.impounds.map((item, index) => <li key={`${item.date}-${index}`}><b>{date(item.date)} · {item.motif}</b><span>{show(item.sanction)} · {item.dateLiberation ? `Libéré le ${date(item.dateLiberation)}` : 'Toujours immobilisé'}</span></li>)}</ul> : <p className="detail-empty">Aucune mise en fourrière enregistrée.</p>}
                </DetailSection>
                <DetailSection title="Signalements">
                  {record.signals?.length ? <ul className="detail-list">{record.signals.map((item, index) => <li key={`${item.date}-${index}`}><b>{date(item.date)} · {item.motif} ({item.statut})</b><span>{show(item.description)}</span></li>)}</ul> : <p className="detail-empty">Aucun signalement enregistré.</p>}
                </DetailSection>
              </>
            ) : record && isDriverProfile(record) ? (
              <>
                <DetailSection title="Identité"><DetailRows rows={[
                  ['Nom complet', show(record.nom)],
                  ['CIN', show(record.cin)],
                  ['Téléphone', show(record.telephone)],
                  ['Adresse', show(record.adresse)],
                  ['Date de naissance', date(record.dateNaissance)],
                  ['Lieu de naissance', show(record.lieuNaissance)],
                  ['CIN délivrée le', date(record.dateCin)],
                  ['CIN délivrée à', show(record.cinDelivreeA)],
                ]} /></DetailSection>
                <DetailSection title="Permis et affectation"><DetailRows rows={[
                  ['Rôle', show(record.role)],
                  ['Numéro de permis', show(record.numeroPermis)],
                  ['Date d’examen', date(record.dateExamenPermis)],
                  ['Véhicule', show(record.immatriculation)],
                  ['Autre conducteur du véhicule', record.vehicleDrivers?.map((driver) => `${driver.nom} (${driver.role})`).join(', ') || '—'],
                ]} /></DetailSection>
                <DetailSection title="Remplacements">
                  <DetailRows rows={[
                    ['Remplace', record.replacements?.map((driver) => driver.nom).join(', ') || '—'],
                    ['Remplacé par', record.replacedBy?.map((driver) => driver.nom).join(', ') || '—'],
                  ]} />
                </DetailSection>
              </>
            ) : null}
        <div className="modal-actions"><button className="button secondary" onClick={onClose}>Fermer</button></div>
      </section>
    </div>
  )
}
