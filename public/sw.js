/* Shell hors ligne : apres une premiere visite, l'interface (HTML, JS, CSS,
   images) s'ouvre sans reseau. Les appels /api et les tuiles de carte ne sont
   pas mis en cache : le scan, la recherche et les donnees exigent une
   connexion ; sans reseau l'app affiche son ecran mais signale l'absence de
   serveur. Les navigations restent prioritaires au reseau (cache HTTP ignore)
   pour recevoir tout de suite le nouvel index.html apres un deploiement. */
const CACHE = 'bus-cu-abe-v11'
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/brand/favicon.png',
  '/brand/icon-192.png',
  '/brand/icon-512.png',
  '/brand/logo-bus.png',
  '/brand/logo-commune.png',
]

/* Fichiers /assets/ cites par un index HTML encore absents du cache. */
async function fichiersAbsents(html) {
  const cache = await caches.open(CACHE)
  const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
  const absents = []
  for (const url of refs) {
    if (!(await cache.match(url, { ignoreVary: true }))) absents.push(url)
  }
  return absents
}

async function precache() {
  const cache = await caches.open(CACHE)
  await Promise.allSettled(SHELL.map((url) => cache.add(url)))
  // Les noms de /assets/ sont haches : on les releve dans l'index pour que
  // le premier passage suffise, meme sans seconde visite.
  const page = await cache.match('/', { ignoreVary: true })
  if (!page) throw new Error('shell : index introuvable')
  const html = await page.text()
  const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
  await Promise.allSettled(refs.map((url) => cache.add(url)))
  // Les images importees (photo du heros, etc.) n'apparaissent que dans le
  // JS : on les releve la pour que l'accueil reste complet hors ligne.
  try {
    for (const script of refs.filter((url) => url.endsWith('.js')).slice(0, 5)) {
      const entry = await cache.match(script, { ignoreVary: true })
      if (!entry) continue
      const code = await entry.text()
      const images = new Set(
        [...code.matchAll(
          /(?:['"`(\s]|^|\/)assets\/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp|gif|svg)/g,
        )].map((match) => `/${match[0].slice(match[0].indexOf('assets/'))}`),
      )
      await Promise.allSettled([...images].map((url) => cache.add(url)))
    }
  } catch {
    /* images optionnelles : l'app s'affiche sans elles */
  }
  // Un index sans ses scripts afficherait une page blanche hors ligne : dans ce
  // cas l'installation echoue et l'ancien worker (coherent) reste actif.
  const manquants = await fichiersAbsents(html)
  if (manquants.length > 0) throw new Error(`shell incomplet : ${manquants.join(', ')}`)
}

/* Page de secours : le cache local ne correspond plus au deploiement et le
   reseau ne repond pas. Elle nettoie une seule fois puis recharge : au pire le
   navigateur affiche sa propre page hors ligne, jamais une page blanche. */
function pageSecours() {
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mise à jour…</title></head>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0f1f18;color:#fff;font:16px/1.5 system-ui,sans-serif">
<div style="text-align:center;padding:24px;max-width:420px">
<p style="font-size:18px;font-weight:600;margin:0 0 8px">Mise à jour de l’application…</p>
<p id="msg" style="color:#b9c9c0;margin:0">Fanavaozana ny fampiharana…</p>
</div>
<script>
(async function () {
  try {
    if (!sessionStorage.getItem('iz-secours')) {
      sessionStorage.setItem('iz-secours', '1');
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function (r) { return r.unregister(); }));
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      location.replace(location.pathname + '?secours=' + Date.now() + location.hash);
      return;
    }
  } catch (e) {}
  document.getElementById('msg').textContent = 'Le serveur ne répond pas. Vérifiez votre connexion puis rouvrez la page. / Tsy mamaly ny serveur. Hamarino ny fifandraisana dia sokafy indray ny pejy.';
})();
</script>
</body></html>`
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
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
        const cached = await caches.match('/', { ignoreVary: true })
        if (cached && (await fichiersAbsents(await cached.clone().text())).length === 0) return cached
        return pageSecours()
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
