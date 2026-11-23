import { useMemo, useState } from 'react'
import { izApi } from './api'
import type { IZRecord } from './api'
import {
  Alert, Field, Loading, Modal, PageHead, StatusBadge, useApp, useAsync,
} from './components'
import { DataTable } from './DataTable'
import { attestationState } from './attestation-utils'

type AttestationType = 'capacite' | 'receveur'

const TYPE_LABEL: Record<AttestationType, string> = {
  capacite: 'attestation de capacité',
  receveur: 'attestation de receveur',
}

const dateOnly = (value: unknown) => {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ''))
  return match ? match[1] : ''
}

const holder = (row: IZRecord) =>
  [row.nom, row.prenoms].filter(Boolean).join(' ') || 'Titulaire non renseigné'

const number = (row: IZRecord) =>
  String(row.numero_attestation || row.numero_attestation_receveur || '—')

function detailFields(type: AttestationType, row: IZRecord): [string, unknown][] {
  const common: [string, unknown][] = [
    ['Numéro d’attestation', number(row)],
    ['Nom', row.nom],
    ['Prénoms', row.prenoms],
    ['Naissance', dateOnly(row.date_naissance) || row.naissance_texte],
    ['Lieu de naissance', row.lieu_naissance],
  ]
  if (type === 'capacite') {
    return [
      ...common,
      ['Permis', row.permis_numero],
      ['Catégorie du permis', row.permis_categorie],
      ['Permis délivré le', dateOnly(row.permis_delivre_le) || row.permis_delivre_texte],
      ['Permis délivré à', row.permis_delivre_lieu],
      ['Date d’examen', dateOnly(row.date_examen) || row.date_examen_texte],
      ['N° du certificat', row.numero_certificat],
      ['Valable jusqu’au', dateOnly(row.valable_jusquau) || row.valable_texte],
      ['Statut', attestationState(row)],
      ['Fichier source', row.fichier_source],
      ['Remarque', row.remarque],
    ]
  }
  return [
    ...common,
    ['CIN', row.cin],
    ['CIN délivrée le', dateOnly(row.cin_delivree_le) || row.cin_texte],
    ['CIN délivrée à', row.cin_delivree_lieu],
    ['Date d’examen', dateOnly(row.date_examen) || row.date_examen_texte],
    ['N° d’attestation de receveur', row.numero_attestation_receveur],
    ['Valable jusqu’au', dateOnly(row.valable_jusquau) || row.valable_texte],
    ['Statut', attestationState(row)],
    ['Fichier source', row.fichier_source],
    ['Remarque', row.remarque],
  ]
}

export function AdminAttestations() {
  const { notify, navigate } = useApp()
  const [type, setType] = useState<AttestationType>('capacite')
  const [unlinkedOnly, setUnlinkedOnly] = useState(false)
  const [status, setStatus] = useState('')
  const [target, setTarget] = useState<IZRecord | null>(null)
  const [detail, setDetail] = useState<IZRecord | null>(null)
  const [selectedBus, setSelectedBus] = useState<number | null>(null)
  const [busQuery, setBusQuery] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, loading, error, reload, setData } = useAsync(
    () => izApi.adminAttestations(type),
    [type],
  )
  const vehicles = useAsync(() => izApi.adminVehicles({ limit: 500 }), [])

  const switchType = (next: AttestationType) => {
    if (next === type) return
    setData(null)
    setUnlinkedOnly(false)
    setStatus('')
    setType(next)
  }

  const rows = useMemo(() => {
    const source = data ?? []
    return source.filter((row) => {
      if (unlinkedOnly && row.vehicle_id != null) return false
      if (status && attestationState(row) !== status) return false
      return true
    })
  }, [data, status, unlinkedOnly])

  const buses = useMemo(() => {
    const needle = busQuery.trim().toLocaleLowerCase()
    const list = (vehicles.data ?? []).filter((vehicle) => {
      if (!needle) return true
      return [vehicle.immatriculation, vehicle.ligne, vehicle.proprietaireNom, vehicle.cooperativeCode]
        .join(' ')
        .toLocaleLowerCase()
        .includes(needle)
    })
    return list.slice(0, 40)
  }, [busQuery, vehicles.data])

  const openLink = (row: IZRecord) => {
    setTarget(row)
    setSelectedBus(row.vehicle_id == null ? null : Number(row.vehicle_id))
    setBusQuery('')
  }

  const submitLink = async (vehicleId: number | null) => {
    if (!target || busy) return
    setBusy(true)
    try {
      await izApi.linkAttestation(type, Number(target.id), vehicleId)
      notify(vehicleId === null ? 'Attestation détachée du bus.' : 'Attestation liée au bus.', 'success')
      setTarget(null)
      await reload()
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Liaison impossible.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const unlink = async (row: IZRecord) => {
    if (busy) return
    setBusy(true)
    try {
      await izApi.linkAttestation(type, Number(row.id), null)
      notify('Attestation détachée du bus.', 'success')
      await reload()
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Liaison impossible.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const replacement = target && selectedBus != null
    ? (data ?? []).find((row) => row.vehicle_id != null
      && Number(row.vehicle_id) === selectedBus
      && Number(row.id) !== Number(target.id))
    : undefined
  const selectedVehicle = (vehicles.data ?? []).find((vehicle) => Number(vehicle.id) === selectedBus)

  return (
    <>
      <PageHead
        title="Capacité & receveur"
        subtitle="Attestations importées : consultez-les et liez chaque attestation de capacité ou de receveur à son bus."
      />

      <div className="iz-card" style={{ marginBottom: 16 }}>
        <div className="iz-flex iz-wrap" style={{ gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className={`iz-btn ${type === 'capacite' ? 'iz-btn-primary' : 'iz-btn-outline'}`}
            onClick={() => switchType('capacite')}
          >
            Attestations de capacité
          </button>
          <button
            type="button"
            className={`iz-btn ${type === 'receveur' ? 'iz-btn-primary' : 'iz-btn-outline'}`}
            onClick={() => switchType('receveur')}
          >
            Attestations de receveur
          </button>
          <label className="iz-flex iz-small" style={{ gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={unlinkedOnly}
              onChange={(event) => setUnlinkedOnly(event.target.checked)}
            />
            Seulement les non liées
          </label>
          <label className="iz-flex iz-small" style={{ gap: 6, alignItems: 'center' }}>
            Statut
            <select className="iz-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tous</option>
              <option value="Valable">Valable</option>
              <option value="Expirée">Expirée</option>
              <option value="Validité inconnue">Validité inconnue</option>
            </select>
          </label>
          {data && (
            <span className="iz-small iz-muted">
              {rows.length} sur {data.length} attestations
            </span>
          )}
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {loading ? <Loading /> : (
        <DataTable
          key={type}
          rows={rows}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => holder(row)}
          searchText={(row) => [
            row.nom, row.prenoms, row.numero_attestation, row.numero_attestation_receveur,
            row.cin, row.permis_numero, row.busImmatriculation, row.busLigne,
            row.fichier_source, row.remarque,
          ].join(' ')}
          searchPlaceholder="Rechercher un nom, un numéro, un CIN ou un bus…"
          initialSort="validite"
          empty={<p className="iz-list-empty">Aucune attestation ne correspond aux filtres.</p>}
          columns={[
            {
              key: 'titulaire', label: 'Titulaire',
              sortValue: (row) => holder(row),
              render: (row) => <div>
                <strong>{holder(row)}</strong>
                <div className="iz-small iz-muted">
                  {type === 'capacite'
                    ? `Permis ${row.permis_categorie || '—'} · ${row.permis_numero || '—'}`
                    : `CIN ${row.cin || '—'}`}
                </div>
              </div>,
            },
            {
              key: 'numero', label: 'N° attestation',
              sortValue: (row) => number(row),
              render: (row) => <div>
                <span className="iz-mono iz-small">{number(row)}</span>
                {row.doublon === true && <div><span className="iz-badge">Doublon</span></div>}
              </div>,
            },
            {
              key: 'validite', label: 'Validité',
              sortValue: (row) => dateOnly(row.valable_jusquau) || String(row.statut ?? ''),
              render: (row) => <div className="iz-small iz-nowrap">
                <div>{dateOnly(row.valable_jusquau) || row.valable_texte || '—'}</div>
                <StatusBadge status={attestationState(row)} />
              </div>,
            },
            {
              key: 'bus', label: 'Bus lié',
              sortValue: (row) => String(row.busImmatriculation ?? ''),
              render: (row) => row.busImmatriculation
                ? <button
                    type="button"
                    className="iz-btn iz-btn-outline iz-btn-sm"
                    onClick={() => navigate(`/bus?${new URLSearchParams({ plaque: String(row.busImmatriculation) })}`)}
                  >
                    {row.busImmatriculation}
                  </button>
                : <span className="iz-small iz-muted">Non liée</span>,
            },
          ]}
          actions={(row) => (
            <div className="iz-flex iz-wrap" style={{ gap: 6 }}>
              <button className="iz-btn iz-btn-primary iz-btn-sm" onClick={() => openLink(row)}>
                {row.vehicle_id == null ? 'Lier à un bus' : 'Changer de bus'}
              </button>
              {row.vehicle_id != null && (
                <button
                  className="iz-btn iz-btn-outline iz-btn-sm"
                  disabled={busy}
                  onClick={() => void unlink(row)}
                >
                  Délier
                </button>
              )}
              <button className="iz-btn iz-btn-ghost iz-btn-sm" onClick={() => setDetail(row)}>
                Détails
              </button>
            </div>
          )}
        />
      )}

      {target && (
        <Modal
          title={`${target.vehicle_id == null ? 'Lier' : 'Changer la liaison'} — ${TYPE_LABEL[type]}`}
          onClose={() => { if (!busy) setTarget(null) }}
          footer={
            <>
              <button className="iz-btn iz-btn-outline" disabled={busy} onClick={() => setTarget(null)}>Annuler</button>
              <button
                className="iz-btn iz-btn-primary"
                disabled={busy || selectedBus == null}
                onClick={() => void submitLink(selectedBus)}
              >
                {busy ? 'Enregistrement…' : 'Enregistrer la liaison'}
              </button>
            </>
          }
        >
          <p className="iz-small iz-muted" style={{ marginTop: 0 }}>
            {holder(target)} — {number(target)}
          </p>
          {target.busImmatriculation && (
            <p className="iz-small">
              Bus actuellement lié : <strong>{target.busImmatriculation}</strong>
            </p>
          )}
          <Field label="Rechercher un bus" full>
            <input
              className="iz-input"
              value={busQuery}
              onChange={(event) => setBusQuery(event.target.value)}
              placeholder="Immatriculation, ligne, propriétaire…"
              autoFocus
            />
          </Field>
          {vehicles.loading && <Loading />}
          {vehicles.error && <Alert type="error">{vehicles.error}</Alert>}
          {!vehicles.loading && (
            <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #d8d8d8', borderRadius: 10, marginTop: 10 }}>
              {buses.length === 0 ? (
                <p className="iz-small iz-muted" style={{ padding: 12, margin: 0 }}>Aucun bus ne correspond.</p>
              ) : buses.map((vehicle) => {
                const active = Number(vehicle.id) === selectedBus
                return (
                  <button
                    type="button"
                    key={String(vehicle.id)}
                    className="iz-btn iz-btn-ghost"
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', borderRadius: 0,
                      background: active ? '#e7f3ec' : 'transparent',
                      padding: '10px 12px', borderBottom: '1px solid #eee',
                    }}
                    onClick={() => setSelectedBus(Number(vehicle.id))}
                  >
                    <strong className="iz-mono">{vehicle.immatriculation}</strong>
                    <span className="iz-small iz-muted">
                      {' '}· Ligne {vehicle.ligne || '—'} · {vehicle.cooperativeCode || '—'}
                      {vehicle.proprietaireNom ? ` · ${vehicle.proprietaireNom}` : ''}
                    </span>
                    {active && <span className="iz-chip" style={{ marginLeft: 8 }}>Sélectionné</span>}
                  </button>
                )
              })}
            </div>
          )}
          {selectedVehicle && (
            <p className="iz-small" style={{ marginBottom: 0 }}>
              Bus sélectionné : <strong>{selectedVehicle.immatriculation}</strong>
            </p>
          )}
          {replacement && (
            <Alert type="error">
              {selectedVehicle?.immatriculation ?? 'Ce bus'} possède déjà une attestation de {TYPE_LABEL[type].replace('attestation de ', '')}
              {' '}({holder(replacement)}). Enregistrer remplacera cette liaison.
            </Alert>
          )}
          {target.vehicle_id != null && (
            <button
              type="button"
              className="iz-btn iz-btn-danger iz-btn-sm"
              disabled={busy}
              onClick={() => void submitLink(null)}
            >
              Détacher du bus
            </button>
          )}
        </Modal>
      )}

      {detail && (
        <Modal
          title={`${TYPE_LABEL[type]} — détails`}
          onClose={() => setDetail(null)}
          footer={<button className="iz-btn iz-btn-outline" onClick={() => setDetail(null)}>Fermer</button>}
        >
          <div className="iz-detail-grid">
            {detailFields(type, detail).map(([label, value]) => (
              <div className="iz-detail-item" key={label}>
                <span>{label}</span>
                <strong>{value === true ? 'Oui' : value === false ? 'Non' : value == null || value === '' ? 'Non renseigné' : String(value)}</strong>
              </div>
            ))}
            <div className="iz-detail-item">
              <span>Bus lié</span>
              <strong>{detail.busImmatriculation || 'Non liée'}</strong>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
