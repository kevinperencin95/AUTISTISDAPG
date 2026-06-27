// ================================================================
//  C.A.M. Srl — Service Worker PWA
//  Gestisce cache offline e aggiornamenti in background
// ================================================================

const CACHE_NAME  = 'cam-registro-v10';
const CACHE_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
];

// ── Install: pre-cacha i file dell'app ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_FILES);
    }).then(() => {
      // Attiva immediatamente senza aspettare che le vecchie tab si chiudano
      return self.skipWaiting();
    })
  );
});

// ── Activate: rimuovi cache vecchie ─────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: strategia Network-first per GAS, Cache-first per app ─
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Richieste al GAS (script.google.com): sempre rete, mai cache
  // Il SW non può intercettare cross-origin con credenziali,
  // ma lo gestiamo esplicitamente per chiarezza
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Richieste all'app: Cache-first con fallback rete
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cacha solo risposte valide e dello stesso dominio
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic'
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Offline e non in cache: serve index.html (SPA fallback)
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── Push Notifications ───────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'C.A.M. Srl', {
      body:    data.body   || '',
      icon:    '/icon.png',
      badge:   '/icon.png',
      tag:     data.tag    || 'cam-notifica',
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
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
