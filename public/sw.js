self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("ferienplan-v2").then((cache) => cache.addAll(["/", "/styles.css", "/app.js", "/manifest.webmanifest"]))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== "ferienplan-v2").map((key) => caches.delete(key))))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
