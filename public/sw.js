const CACHE_VERSION = 'field-pro-di-v2';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const FONT_CACHE = `${CACHE_VERSION}-fonts`;

const STATIC_PRECACHE_URLS = [
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(STATIC_PRECACHE_URLS))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  const validCaches = new Set([APP_SHELL_CACHE, ASSET_CACHE, FONT_CACHE]);
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * Network-First helper: always fetches fresh bytes from the network first
 * (bypassing stale HTTP cache on HTML/bundles) and falls back to cache when offline.
 */
function networkFirst(request, cacheName, fallbackUrl) {
  const freshRequest = new Request(request, { cache: 'no-cache' });
  return fetch(freshRequest)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        const copy = networkResponse.clone();
        caches
          .open(cacheName)
          .then((cache) => {
            cache.put(request, copy);
            if (fallbackUrl) {
              cache.put(fallbackUrl, networkResponse.clone());
            }
          })
          .catch(() => {});
      }
      return networkResponse;
    })
    .catch(() =>
      caches
        .open(cacheName)
        .then((cache) =>
          cache
            .match(request)
            .then((matched) => matched || (fallbackUrl ? cache.match(fallbackUrl) : undefined))
        )
        .then((cached) => cached || caches.match('/index.html') || Response.error())
    );
}

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

  // Ignore other cross-origin requests (Firebase Auth/Firestore, Google Apps Script, YouTube)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 1. HTML / Navigation requests: Network-First so new Vercel deployments load immediately on launch
  if (
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(networkFirst(request, APP_SHELL_CACHE, '/index.html'));
    return;
  }

  // 2. JS & CSS bundles: Network-First so updated app chunks reach installed APK/PWA immediately
  const isCodeAsset =
    request.destination === 'script' ||
    request.destination === 'style' ||
    /\.(?:js|mjs|css)(?:\?.*)?$/i.test(url.pathname);

  if (isCodeAsset) {
    event.respondWith(networkFirst(request, ASSET_CACHE));
    return;
  }

  // 3. Icons & static media: Network-First with cache fallback for instant offline availability
  event.respondWith(networkFirst(request, ASSET_CACHE));
});
