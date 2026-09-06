const CACHE = 'vip-tv-pwa-v2';
const CORE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/config.js',
  '/device-guard.js',
  '/pwa.js',
  '/manifest.webmanifest',
  '/vip-network-logo.png',
  '/vip-tv-logo-192.png',
  '/vip-tv-logo-512.png',
  '/messenger-icon.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html')))
  );
});
