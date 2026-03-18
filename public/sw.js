const STATIC_CACHE = "scriptorium-static-v1";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Offline</title><body style=\"font-family: Charter, Georgia, serif; margin: 0; padding: 24px; background: #fff; color: #000;\"><main style=\"max-width: 40rem; margin: 0 auto;\"><h1 style=\"font-size: 2rem; margin-bottom: 1rem;\">You are offline</h1><p>Scriptorium needs a network connection for live workspace data. Reconnect and reopen the app to continue.</p></main></body></html>",
            {
              headers: {
                "Content-Type": "text/html; charset=utf-8",
              },
            },
          ),
      ),
    );
    return;
  }

  const destination = request.destination;
  const isStaticAsset = ["font", "image", "manifest", "script", "style"].includes(destination);

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkResponse = fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            void caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
          }

          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkResponse;
    }),
  );
});
