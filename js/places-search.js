// Gemeinsame Google-Places-Helper (Places API (New), Text Search) – genutzt
// von plan.js (Orte suchen) und inspire.js (Orts-Vorschau-Karten aus Gemini-
// Vorschlägen), damit beide dieselbe Suche/Foto-Logik nutzen statt sie zu
// duplizieren.

import { CONFIG } from "./config.js";

export function photoUrl(name, maxWidthPx = 400) {
  return `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidthPx}&key=${CONFIG.GOOGLE_MAPS_API_KEY}`;
}

export function starRating(rating) {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Standortbestimmung wird von diesem Browser nicht unterstützt."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("Standort konnte nicht ermittelt werden (Berechtigung erteilt?).")),
      { timeout: 8000 }
    );
  });
}

export async function searchGooglePlaces(query, radiusKm) {
  if (!CONFIG.GOOGLE_MAPS_API_KEY || CONFIG.GOOGLE_MAPS_API_KEY === "REPLACE_ME") {
    throw new Error("Kein Google-Maps-API-Key in js/config.js hinterlegt.");
  }
  const body = { textQuery: query };
  if (radiusKm) {
    const pos = await getCurrentPosition();
    body.locationBias = { circle: { center: { latitude: pos.lat, longitude: pos.lng }, radius: Number(radiusKm) * 1000 } };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": CONFIG.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": [
        "places.id", "places.displayName", "places.formattedAddress", "places.location",
        "places.rating", "places.userRatingCount", "places.photos", "places.googleMapsUri",
      ].join(","),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Places-API-Fehler ${res.status}: ${errBody}`);
  }
  const data = await res.json();
  return data.places || [];
}
