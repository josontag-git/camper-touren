// App-Shell (HTML/CSS/JS/Icons) cachen für Offline-Start und Installierbarkeit.
// Trip-/Places-Daten selbst werden separat in localStorage gecacht (js/api.js).

const CACHE_VERSION = "app-shell-v38";

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
  "./js/sections.js",
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

// cache.addAll() würde die App-Shell-Dateien mit dem normalen HTTP-Cache-
// Verhalten des Browsers anfragen -- bei einem frischen Deploy (neue
// CACHE_VERSION) sollen die Dateien aber garantiert vom Netz kommen, nicht
// aus einer evtl. noch gültigen HTTP-Cache-Kopie. Deshalb hier jede Datei
// einzeln mit cache:"reload" (erzwingt Revalidierung/Neuabruf) fetchen.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) => fetch(url, { cache: "reload" }).then((res) => cache.put(url, res)))
      )
    )
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

// Cache-first für die App-Shell. Google-API-Datenaufrufe (Sheets/Places-
// Suche&Details/Maps/Directions/Apps Script) werden bewusst NICHT hier
// abgefangen – die laufen live; Trip-/Places-Daten werden separat in
// localStorage gecacht (js/api.js). AUSNAHME: Places-Fotos
// (places.googleapis.com/.../media) sind reine, praktisch unveränderliche
// Bild-Downloads (nicht "live" wie eine Suche) und werden bisher bei jedem
// Rendern/Reload erneut kostenpflichtig abgerufen, obwohl sich das Bild
// nicht ändert – deshalb hier gezielt vom Google-API-Ausschluss
// ausgenommen und ganz normal cache-first behandelt wie App-Shell-Assets.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isPlacesPhoto = url.hostname === "places.googleapis.com" && url.pathname.includes("/media");
  const isGoogleApi =
    !isPlacesPhoto &&
    (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("google.com"));

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
