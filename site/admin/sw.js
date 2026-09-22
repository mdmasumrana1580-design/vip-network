const CACHE='vip-admin-safe-v5';
const A=[
  './', './index.html', './style.css', './app.js', './pwa.js',
  './manifest.json', './manifest.webmanifest', './favicon-48.png',
  './assets/admin-icon-180.png', './assets/admin-logo.png',
  './assets/admin-icon-192.png', './assets/admin-icon-512.png',
  './assets/super-admin.jpg'
];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(A)));
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('vip-admin-safe-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).pathname.includes('/api/'))return;
  e.respondWith(fetch(e.request).then(r=>{
    const x=r.clone();
    caches.open(CACHE).then(c=>c.put(e.request,x)).catch(()=>{});
    return r;
  }).catch(()=>caches.match(e.request)));
});
