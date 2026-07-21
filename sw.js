// ================================================================
//  C.A.M. Srl — Service Worker PWA v2
//  Strategia: Network-first con fallback cache
//  Aggiornamento: automatico al riavvio dell'app
// ================================================================

const CACHE_VERSION = 'cam-registro-v85';
const CACHE_FILES   = [
  '/AUTISTISDAPG/',
  '/AUTISTISDAPG/index.html',
  '/AUTISTISDAPG/manifest.json',
  '/AUTISTISDAPG/icon.png',
];

// ── Install ──────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(CACHE_FILES))
      .then(() => self.skipWaiting()) // attiva subito, senza aspettare
  );
});

// ── Activate: pulisci cache vecchie e prendi controllo ───────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // prende controllo di tutte le tab aperte
  );
});

// ── Fetch: Network-first per i file dell'app ─────────────────────
// Tenta sempre la rete → aggiornamento automatico ad ogni apertura.
// Se la rete non risponde, serve la cache → funziona offline.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // GAS: sempre rete diretta, mai cache
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Solo richieste GET verso la nostra app
  if (event.request.method !== 'GET') return;
  if (!url.pathname.startsWith('/AUTISTISDAPG')) return;

  event.respondWith(
    // Network-first: prova la rete con timeout 3s
    Promise.race([
      fetch(event.request.clone()).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]).catch(() => {
      // Rete non disponibile o lenta → fallback cache
      return caches.match(event.request)
        .then(cached => cached || caches.match('/AUTISTISDAPG/index.html'));
    })
  );
});

// ── Messaggi dall'app ─────────────────────────────────────────────
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Reset di mezzanotte: svuota tutta la cache runtime
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys =>
        Promise.all(keys.map(k => caches.delete(k)))
      )
    );
  }
});

// ── Push Notifications ───────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'C.A.M. Srl', {
      body:     data.body  || '',
      icon:     '/AUTISTISDAPG/icon.png',
      badge:    '/AUTISTISDAPG/icon.png',
      tag:      data.tag   || 'cam-notifica',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('/AUTISTISDAPG/');
    })
  );
});
