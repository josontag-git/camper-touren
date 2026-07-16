// Service-Worker-Skelett – Milestone 1.
// Caching-Strategie für Trip-/Places-Daten (IndexedDB) folgt in Milestone 7.
// Hier zunächst nur: App-Shell (HTML/CSS/JS/Icons) cachen für Offline-Start
// und Installierbarkeit.

const CACHE_VERSION = "app-shell-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/main.js",
  "./js/sw-register.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Cache-first für die App-Shell. Google-API-Aufrufe (Sheets/Places/Maps/Directions)
// werden bewusst NICHT hier abgefangen – die laufen live bzw. werden ab Milestone 7
// über IndexedDB im Anwendungscode gecacht, nicht über den Service Worker.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isGoogleApi =
    url.hostname.endsWith("googleapis.com") ||
    url.hostname.endsWith("google.com");

  if (event.request.method !== "GET" || isGoogleApi) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
