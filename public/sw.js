/* Installability + offline fallback for the Android/iOS home-screen app.
   Les navigations passent toujours par le réseau (cache HTTP ignoré) : après un
   déploiement, l'utilisateur reçoit immédiatement le nouvel index.html. Le shell
   en cache ne sert qu'en cas de coupure réseau. */
const CACHE = 'bus-cu-abe-v6'
const PRECACHE = ['/manifest.webmanifest', '/brand/favicon.png', '/brand/icon-192.png', '/brand/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

function remember(event, key, response) {
  // Clone symétrique avant de rendre la réponse au navigateur, et waitUntil
  // pour que la mise en cache survive à la mise en veille du worker.
  const copy = response.clone()
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.put(key, copy)).catch(() => undefined),
  )
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' })
        if (response.ok) remember(event, '/', response)
        return response
      } catch {
        return (await caches.match('/')) ?? Response.error()
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) {
      // Les fichiers /assets/ sont hachés : un seul fetch par version suffit.
      if (!url.pathname.startsWith('/assets/')) {
        event.waitUntil(
          fetch(request)
            .then((response) => (response.ok ? caches.open(CACHE).then((cache) => cache.put(request, response)) : undefined))
            .catch(() => undefined),
        )
      }
      return cached
    }
    const response = await fetch(request)
    if (response.ok) remember(event, request, response)
    return response
  })().catch(() => Response.error()))
})