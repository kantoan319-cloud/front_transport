import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './iz/iz.css'
import { AppProvider } from './iz/components'
import { IzApp } from './iz/App'
import { translate } from './iz/i18n'
import type { Lang } from './iz/i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <IzApp />
    </AppProvider>
  </StrictMode>,
)

const UPDATE_CHECK_MS = 5 * 60 * 1000
const BANNER_ID = 'iz-update-banner'

function currentLang(): Lang {
  return localStorage.getItem('izotra-lang') === 'mg' ? 'mg' : 'fr'
}

function showUpdateBanner() {
  if (document.getElementById(BANNER_ID)) return
  const lang = currentLang()
  const banner = document.createElement('div')
  banner.id = BANNER_ID
  banner.setAttribute('role', 'status')
  banner.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);padding:10px 16px;border-radius:12px;background:#173a2e;color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgb(0 0 0 / 25%)'
  const message = document.createElement('span')
  message.textContent = translate(lang, 'pwa.updateAvailable')
  const reload = document.createElement('button')
  reload.type = 'button'
  reload.textContent = translate(lang, 'pwa.reload')
  reload.style.cssText = 'flex-shrink:0;padding:6px 14px;border:0;border-radius:999px;cursor:pointer;font:inherit;font-weight:600;background:#fff;color:#173a2e'
  reload.addEventListener('click', () => window.location.reload())
  banner.append(message, reload)
  document.body.appendChild(banner)
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Sans contrôleur, c'est la première installation : rien à rafraîchir.
    const hadController = Boolean(navigator.serviceWorker.controller)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) showUpdateBanner()
    })
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        const check = () => { registration.update().catch(() => undefined) }
        if (registration.waiting && hadController) showUpdateBanner()
        check()
        window.setInterval(check, UPDATE_CHECK_MS)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check()
        })
        window.addEventListener('online', check)
      })
      .catch(() => undefined)
  })
}