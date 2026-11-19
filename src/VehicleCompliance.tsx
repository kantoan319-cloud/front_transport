import type { Vehicle } from './api'
import { usePreferences } from './Preferences'

function formattedDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value.length <= 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fr-FR')
}

function formattedMoney(value: number | null | undefined): string {
  if (value === undefined || value === null) return '—'
  const amount = Number(value)
  return Number.isNaN(amount) ? '—' : `${amount.toLocaleString('fr-FR')} Ar`
}

function isExpired(value: string | null | undefined): boolean {
  if (!value) return false
  const parsed = new Date(value.length <= 10 ? `${value}T23:59:59` : value)
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now()
}

function vignetteTone(value: string | null | undefined): 'ok' | 'late' | 'unknown' {
  if (!value) return 'unknown'
  return isExpired(value) ? 'late' : 'ok'
}

function taxTone(statut: string | null | undefined): 'ok' | 'late' | 'warn' | 'unknown' {
  const value = (statut ?? '').toLowerCase()
  if (!value) return 'unknown'
  if (value.includes('retard')) return 'late'
  if (value.includes('payer') && !value.includes('payé')) return 'warn'
  if (value.includes('payé') || value.includes('jour')) return 'ok'
  if (value.includes('renseign')) return 'unknown'
  return 'warn'
}

const toneLabels: Record<string, string> = {
  ok: 'À jour',
  late: 'En retard',
  warn: 'À payer',
  unknown: 'Non renseigné',
}

/**
 * Bloc « Vignette » + « Impôt synthétique » affiché dans le résultat
 * de la recherche ou du scan d'un véhicule.
 */
export default function VehicleCompliance({ vehicle }: { vehicle: Vehicle }) {
  const { t } = usePreferences()
  const expiration = vehicle.dateExpirationVignette ?? vehicle.expirationVignette ?? null
  const vignetteState = vignetteTone(expiration)
  const taxState = taxTone(vehicle.statutImpotSynthetique)

  return (
    <section className="scan-compliance" aria-label={t('Vignette et impôt synthétique')}>
      <article className={`compliance-card is-${vignetteState}`}>
        <header>
          <span className="compliance-icon" aria-hidden="true">◈</span>
          <h4>{t('Vignette')}</h4>
          <span className={`compliance-badge tone-${vignetteState}`}>{t(toneLabels[vignetteState])}</span>
        </header>
        <dl className="compliance-facts">
          <div><dt>{t('Expiration')}</dt><dd>{formattedDate(expiration)}</dd></div>
          <div><dt>{t('Dernier paiement')}</dt><dd>{formattedDate(vehicle.dateDernierPaiementVignette)}</dd></div>
          <div><dt>{t('Montant')}</dt><dd>{formattedMoney(vehicle.montantDerniereVignette)}</dd></div>
          <div><dt>{t('Référence')}</dt><dd>{vehicle.referenceDernierPaiementVignette || '—'}</dd></div>
        </dl>
      </article>

      <article className={`compliance-card is-${taxState}`}>
        <header>
          <span className="compliance-icon" aria-hidden="true">▤</span>
          <h4>{t('Impôt synthétique')}</h4>
          <span className={`compliance-badge tone-${taxState}`}>{t(vehicle.statutImpotSynthetique || toneLabels[taxState])}</span>
        </header>
        <dl className="compliance-facts">
          <div><dt>{t('NIF')}</dt><dd>{vehicle.nifProprietaire || '—'}</dd></div>
          <div><dt>{t('Année')}</dt><dd>{vehicle.anneeImpotSynthetique ? String(vehicle.anneeImpotSynthetique) : '—'}</dd></div>
          <div><dt>{t('Date de paiement')}</dt><dd>{formattedDate(vehicle.datePaiementImpotSynthetique)}</dd></div>
          <div><dt>{t('Renouvellement')}</dt><dd>{formattedDate(vehicle.dateRenouvellementImpotSynthetique)}</dd></div>
        </dl>
        <p className="compliance-note">{t('Renouvellement chaque année le 30 mars.')}</p>
      </article>
    </section>
  )
}
