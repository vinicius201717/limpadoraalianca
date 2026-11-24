const VERSION = "alianca-campo-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(["/campo-offline.html", "/campo-icon-192.png"])));
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
