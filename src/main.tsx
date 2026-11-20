import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './iz/iz.css'
import { AppProvider } from './iz/components'
import { IzApp } from './iz/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <IzApp />
    </AppProvider>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
