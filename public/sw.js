// MathDesk service worker.
// - Page navigations always go to the network first, so an old shell can never request removed hashed bundles.
// - Only the hashed build output (/assets/) and app icons are served cache-first.
// - Everything else (legal pages, manifest, sitemap, ...) is network-first, so edits show up without a manual cache clear.
// - Cross-origin requests (Supabase, the AI endpoint, GeoGebra) and non-GET requests are never touched or cached.
// Bump CACHE_VERSION to drop every older cache on the next visit.
const CACHE_VERSION = 'mathdesk-v3';
const SHELL = ['./', './index.html', './site.webmanifest', './favicon-96x96.png'];
const CACHE_FIRST = /\/(assets\/|favicon|apple-touch-icon|web-app-manifest|desky-avatar)/;

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
        .then((response) => {
          if (response.ok && (url.pathname === '/' || url.pathname.endsWith('/index.html'))) remember(event, './index.html', response.clone());
          return response;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  if (CACHE_FIRST.test(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => remember(event, request, response))));
    return;
  }

  event.respondWith(fetch(request).then((response) => remember(event, request, response)).catch(() => caches.match(request)));
});
