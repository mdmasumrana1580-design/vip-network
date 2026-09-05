const CACHE = 'vip-tv-pwa-v9-v31-pwa-fixed';
const CORE = ['./','./index.html','./style.css','./app.js','./config.js','./manifest.webmanifest','./pwa.js','./admin-config.js','./device-guard.js','./vip-tv-logo-180.png','./vip-tv-logo-192.png','./vip-tv-logo-512.png','./vip-network-logo.png','./messenger-icon.webp','./welcome.mp4','./vip-tv-app-splash.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req=event.request;
  if (req.method !== 'GET') return;
  event.respondWith(fetch(req).then(res => {
    const copy=res.clone();
    caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
    return res;
  }).catch(()=>caches.match(req)));
});
