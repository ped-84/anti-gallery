const CACHE_NAME = 'artgasht-pwa-v1.110';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json?v=1.110',
  './favicon.ico?v=1.110',
  './favicon.svg?v=1.110',
  './favicon.png',
  './favicon-32x32.png',
  './favicon-48x48.png',
  './favicon-96x96.png',
  './favicon-144x144.png',
  './favicon-16x16.png',
  './icons/brand-logo-icon.png',
  './icons/brand-logo-icon-dark.png',
  './icons/brand-logo-orange.png',
  './icons/brand-wordmark-light.png',
  './icons/brand-wordmark-dark.png',
  './icons/icon-192.png?v=1.110',
  './icons/icon-512.png?v=1.110',
  './icons/icon-maskable-192.png?v=1.110',
  './icons/icon-maskable-512.png?v=1.110',
  './icons/apple-touch-icon.png?v=1.110',
  './fonts/shabnam/Shabnam-FD.woff2',
  './fonts/shabnam/Shabnam-Bold-FD.woff2',
  './fonts/shabnam/Shabnam-Medium-FD.woff2',
  './fonts/ubuntu/Ubuntu-Regular.woff2',
  './fonts/ubuntu/Ubuntu-Medium.woff2',
  './fonts/ubuntu/Ubuntu-Bold.woff2'
];

// Install: Cache essential assets safely with Promise.allSettled so no single asset aborts installation
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`PWA Pre-cache skipped for ${url}:`, err);
          })
        )
      );
    })
  );
});

// Activate: Remove stale caches & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-First for navigation & HTML, Cache-First for static fonts/images
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Never cache dynamic API, health check, or upload endpoints
  if (url.pathname.startsWith('/api') || url.pathname === '/health') return;

  // Always Network-First for HTML navigation so updates are instant
  if (request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('./index.html') || caches.match('./');
        })
    );
    return;
  }

  // Bypass cross-origin telemetry/analytics/APIs (Neshan tiles, Google maps, etc.)
  if (url.origin !== self.location.origin) {
    // Cache Iranian Neshan SDK if requested
    if (url.hostname.includes('static.neshan.org')) {
      event.respondWith(
        caches.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res && res.status === 200) {
              const resClone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, resClone));
            }
            return res;
          }).catch(() => cached);
        })
      );
    }
    return;
  }

  // Stale-While-Revalidate for local assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch((err) => {
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
