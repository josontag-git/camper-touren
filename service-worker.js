// App-Shell (HTML/CSS/JS/Icons) cachen für Offline-Start und Installierbarkeit.
// Trip-/Places-Daten selbst werden separat in localStorage gecacht (js/api.js).

const CACHE_VERSION = "app-shell-v23";

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/main.js",
  "./js/api.js",
  "./js/state.js",
  "./js/settings.js",
  "./js/theme.js",
  "./js/header-theme.js",
  "./js/changelog.js",
  "./js/categories.js",
  "./js/drag-reorder.js",
  "./js/maps-loader.js",
  "./js/places-search.js",
  "./js/place-details.js",
  "./js/park4night.js",
  "./js/errors.js",
  "./js/trips.js",
  "./js/plan.js",
  "./js/route.js",
  "./js/inspire.js",
  "./js/pull-to-refresh.js",
  "./js/sw-register.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
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

// Cache-first für die App-Shell. Google-API-Aufrufe (Sheets/Places/Maps/Directions/
// Apps Script) werden bewusst NICHT hier abgefangen – die laufen live; Trip-/
// Places-Daten werden separat in localStorage gecacht (js/api.js).
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
