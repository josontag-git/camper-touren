// Lädt die Google Maps JavaScript API einmalig nach (gemeinsam genutzt von
// route.js für die Karte und plan.js für die Places-Autocomplete-Suche).

import { CONFIG } from "./config.js";

let mapsLoadPromise = null;

export function loadMapsApi() {
  if (mapsLoadPromise) return mapsLoadPromise;
  if (!CONFIG.GOOGLE_MAPS_API_KEY || CONFIG.GOOGLE_MAPS_API_KEY === "REPLACE_ME") {
    return Promise.reject(new Error("Kein Google-Maps-API-Key in js/config.js hinterlegt."));
  }
  mapsLoadPromise = new Promise((resolve, reject) => {
    window.__campingAppMapsReady = () => resolve(window.google.maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}&libraries=places&callback=__campingAppMapsReady&loading=async`;
    script.async = true;
    script.onerror = () => reject(new Error("Google-Maps-API konnte nicht geladen werden."));
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}
