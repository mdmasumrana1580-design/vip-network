const CACHE='admin-tv-v2';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/admin/','/admin/index.html','/admin/style.css','/admin/app.js','/admin/manifest.webmanifest','/admin/assets/admin-icon-192.png','/admin/assets/admin-icon-512.png']))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin)return; e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||caches.match('/admin/'))));});
