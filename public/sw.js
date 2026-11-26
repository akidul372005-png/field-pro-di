const CACHE_VERSION = 'field-pro-di-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const FONT_CACHE = `${CACHE_VERSION}-fonts`;

const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const validCaches = new Set([APP_SHELL_CACHE, RUNTIME_CACHE, FONT_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (!validCaches.has(key)) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept backend API endpoints or Vite internal dev modules
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/@') ||
      url.pathname.startsWith('/node_modules/') ||
      url.pathname.startsWith('/src/'))
  ) {
    return;
  }

  // Cache Google Fonts with Cache-First strategy
  if (
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
                cache.put(request, networkResponse.clone()).catch(() => {});
              }
              return networkResponse;
            })
            .catch(() => cached || Response.error());
        })
      )
    );
    return;
  }

  // Ignore other cross-origin requests (e.g. Google Apps Script sync endpoints)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests: Network-First with offline fallback to cached app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches
              .open(APP_SHELL_CACHE)
              .then((cache) => cache.put('/index.html', copy))
              .catch(() => {});
          }
          return networkResponse;
        })
        .catch(() =>
          caches
            .match('/index.html')
            .then((cached) => cached || caches.match('/'))
            .then((fallback) => fallback || Response.error())
        )
    );
    return;
  }

  // Same-origin static assets (JS, CSS, images, icons, manifest): Stale-While-Revalidate
  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) =>
      cache.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              cache.put(request, networkResponse.clone()).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    )
  );
});
