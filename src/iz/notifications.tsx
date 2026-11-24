import { useState } from 'react'
import { izApi } from './api'
import type { IZRecord } from './api'
import { translateError, translateValue } from './i18n'
import { Empty, Loading, PageHead, StatusBadge, useApp, useAsync } from './components'

const when = (value?: string | null) => (value ? String(value).slice(0, 16).replace('T', ' ') : '—')

const ICONES: Record<string, string> = {
  'Nouveau signalement': '📣',
  'Signalement traité': '📣',
  'Mise en fourrière': 'P',
  'Licence expirée': '⚠️',
  'Licence délivrée': '✅',
  'Paiement en attente': '💳',
  'Paiement validé': '💳',
  'Demande de licence': '📝',
}

export function NotificationsPage() {
  const { t, lang, navigate, notify, refreshUnread } = useApp()
  const [filtre, setFiltre] = useState<'tout' | 'non-lu'>('tout')
  const { data, loading, reload } = useAsync(
    () => izApi.notifications(filtre, 150),
    [filtre],
  )
  const items: IZRecord[] = data?.items ?? []
  const nonLues = Number(data?.nonLues ?? 0)

  const open = async (item: IZRecord) => {
    try {
      if (!item.lu) {
        await izApi.readNotification(Number(item.id))
        await reload()
        await refreshUnread()
      }
    } catch {
      /* l'ouverture du lien reste possible */
    }
    if (item.lien) navigate(String(item.lien))
  }

  const markAll = async () => {
    try {
      await izApi.readAllNotifications()
      await reload()
      await refreshUnread()
      notify(t('notif.markAllDone'), 'success')
    } catch (error) {
      notify(translateError(lang, error, 'common.error'), 'error')
    }
  }

  return (
    <>
      <PageHead
        title={t('notif.title')}
        subtitle={t('notif.subtitle')}
        action={
          <div className="iz-flex iz-wrap" style={{ gap: 8 }}>
            <button
              type="button"
              className={`iz-btn iz-btn-sm ${filtre === 'tout' ? 'iz-btn-primary' : 'iz-btn-outline'}`}
              onClick={() => setFiltre('tout')}
            >
              {t('notif.all')}
            </button>
            <button
              type="button"
              className={`iz-btn iz-btn-sm ${filtre === 'non-lu' ? 'iz-btn-primary' : 'iz-btn-outline'}`}
              onClick={() => setFiltre('non-lu')}
            >
              {t('notif.unreadOnly')}{nonLues ? ` (${nonLues})` : ''}
            </button>
            <button
              type="button"
              className="iz-btn iz-btn-outline iz-btn-sm"
              disabled={!nonLues}
              onClick={() => void markAll()}
            >
              {t('notif.markAll')}
            </button>
          </div>
        }
      />
      {loading ? <Loading /> : items.length === 0 ? (
        <Empty message={filtre === 'non-lu' ? t('notif.emptyUnread') : t('notif.empty')} />
      ) : (
        <div className="iz-notif-list">
          {items.map((item) => {
            const motif = String(item.motif ?? '')
            const lu = Boolean(item.lu)
            return (
              <button
                key={String(item.id)}
                type="button"
                className={`iz-notif-item${lu ? '' : ' unread'}`}
                onClick={() => void open(item)}
              >
                <span className="iz-notif-icone" aria-hidden="true">{ICONES[motif] ?? '🔔'}</span>
                <span className="iz-notif-corps">
                  <span className="iz-notif-titre">
                    {translateValue(lang, item.titre)}
                    {!lu && <span className="iz-notif-dot" aria-label={t('notif.new')} />}
                  </span>
                  <span className="iz-notif-message">{String(item.message ?? '')}</span>
                  <span className="iz-notif-meta">
                    {motif && <StatusBadge status={motif} />}
                    <span>{when(item.createdAt)}</span>
                  </span>
                </span>
                {item.lien ? <span className="iz-notif-go" aria-hidden="true">→</span> : null}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
