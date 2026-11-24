const VERSION = "alianca-campo-v3";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(["/campo-offline.html", "/campo-notification-round.png", "/campo-notification-badge.png"])));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("alianca-campo-") && name !== VERSION).map((name) => caches.delete(name)))));
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.mode === "navigate" && url.origin === self.location.origin && (url.pathname === "/campo" || url.pathname === "/campo/")) {
    event.respondWith(fetch(event.request).catch(() => caches.match("/campo-offline.html")));
  }
  // Never cache private API responses, audio, images, videos or authenticated diaries.
});

self.addEventListener("push", event => {
  let payload={};try{payload=event.data?.json()||{};}catch{}
  event.waitUntil(self.registration.showNotification("Aliança Campo",{
    body:typeof payload.body==="string"?payload.body.slice(0,180):"Você tem um novo aviso. Abra o aplicativo.",
    icon:"/campo-notification-round.png",badge:"/campo-notification-badge.png",
    tag:typeof payload.tag==="string"?payload.tag.slice(0,100):"campo-aviso",
    data:{url:"/campo?avisos=1"}
  }));
});
self.addEventListener("notificationclick", event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of windows){const u=new URL(client.url);if(u.origin===self.location.origin&&u.pathname==="/campo"){await client.focus();client.postMessage({type:"CAMPO_OPEN_NOTICES"});return;}}
    await self.clients.openWindow("/campo?avisos=1");
  })());
});
