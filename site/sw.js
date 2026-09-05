const CACHE="vip-network-v1";
self.addEventListener("install",e=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{
  const u=new URL(event.request.url);
  if(u.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});