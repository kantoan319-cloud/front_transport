/* Shell hors ligne : apres une premiere visite, l'interface (HTML, JS, CSS,
   images) s'ouvre sans reseau. Les appels /api et les tuiles de carte ne sont
   pas mis en cache : le scan, la recherche et les donnees exigent une
   connexion ; sans reseau l'app affiche son ecran mais signale l'absence de
   serveur. Les navigations restent prioritaires au reseau (cache HTTP ignore)
   pour recevoir tout de suite le nouvel index.html apres un deploiement. */
const CACHE = 'bus-cu-abe-v10'
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/brand/favicon.png',
  '/brand/icon-192.png',
  '/brand/icon-512.png',
  '/brand/logo-bus.png',
  '/brand/logo-commune.png',
]

async function precache() {
  const cache = await caches.open(CACHE)
  await Promise.allSettled(SHELL.map((url) => cache.add(url)))
  try {
    // Les noms de /assets/ sont haches : on les releve dans l'index pour que
    // le premier passage suffise, meme sans seconde visite.
    const page = await cache.match('/', { ignoreVary: true })
    const html = page ? await page.text() : ''
    const urls = new Set(
      [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]),
    )
    await Promise.allSettled([...urls].map((url) => cache.add(url)))
    // Les images importees (photo du heros, etc.) n'apparaissent que dans le
    // JS : on les releve la pour que l'accueil reste complet hors ligne.
    for (const script of [...urls].filter((url) => url.endsWith('.js')).slice(0, 5)) {
      const entry = await cache.match(script, { ignoreVary: true })
      if (!entry) continue
      const code = await entry.text()
      for (const match of code.matchAll(
        /(?:['"`(\s]|^|\/)assets\/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp|gif|svg)/g,
      )) {
        urls.add(`/${match[0].slice(match[0].indexOf('assets/'))}`)
      }
    }
    await Promise.allSettled([...urls].map((url) => cache.add(url)))
  } catch {
    /* index illisible : le cache au fil des requetes prendra le relais */
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(precache())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

function remember(event, key, response) {
  // Clone avant de rendre la reponse au navigateur, et waitUntil pour que la
  // mise en cache survive a la mise en veille du worker.
  const copy = response.clone()
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.put(key, copy)).catch(() => undefined),
  )
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/downloads/')) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' })
        if (response.ok) remember(event, '/', response)
        return response
      } catch {
        return (await caches.match('/', { ignoreVary: true })) ?? Response.error()
      }
    })())
    return
  }

  event.respondWith((async () => {
    // ignoreVary : les reponses du serveur portent Vary: Origin et la requete de
    // prechargement n'en envoie pas ; sans cela le shell ne se resert pas.
    const cached = await caches.match(request, { ignoreVary: true })
    if (cached) {
      // Les fichiers /assets/ sont haches : un seul fetch par version suffit.
      if (!url.pathname.startsWith('/assets/')) {
        event.waitUntil(
          fetch(request)
            .then((response) => (response.ok ? caches.open(CACHE).then((cache) => cache.put(request, response)) : undefined))
            .catch(() => undefined),
        )
      }
      return cached
    }
    try {
      const response = await fetch(request)
      if (response.ok) remember(event, request, response)
      return response
    } catch {
      return Response.error()
    }
  })())
})
