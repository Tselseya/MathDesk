// MathDesk service worker.
// - Page navigations always go to the network first, so an old shell can never request removed hashed bundles.
// - Only the hashed build output (/assets/) is served cache-first.
// - Everything else, including the HTML shell, legal pages, manifest, and public data, is network-first and not cached.
// - Cross-origin requests (Supabase, the AI endpoint, GeoGebra) and non-GET requests are never touched or cached.
// Bump CACHE_VERSION to drop every older cache on the next visit.
const CACHE_VERSION = 'mathdesk-v4';
const SHELL = [];
const CACHE_FIRST = /\/assets\//;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function remember(event, request, response) {
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => Response.error()),
    );
    return;
  }

  if (CACHE_FIRST.test(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => remember(event, request, response))));
    return;
  }

  event.respondWith(fetch(request).catch(() => Response.error()));
});
