const CACHE='admin-tv-v4';
const ASSETS=['/admin/','/admin/index.html','/admin/style.css','/admin/app.js','/admin/pwa.js','/admin/manifest.webmanifest','/admin/assets/admin-logo-180.png','/admin/assets/admin-icon-192.png','/admin/assets/admin-icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('admin-tv-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(u.origin!==location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    if(event.request.method==='GET' && response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});}
    return response;
  }).catch(()=>caches.match(event.request).then(r=>r||caches.match('/admin/'))));
});
