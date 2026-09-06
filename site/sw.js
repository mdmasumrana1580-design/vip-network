const CACHE="vip-tv-v2";
const CORE=["./","./index.html","./style.css","./app.js","./config.js","./device-guard.js","./pwa.js","./manifest.webmanifest","./vip-network-logo.png","./vip-tv-logo-180.png","./vip-tv-logo-192.png","./vip-tv-logo-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).catch(()=>{})).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(u.origin!==location.origin)return;if(e.request.method!=="GET")return;if(u.pathname.startsWith("/api/"))return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html")))});
