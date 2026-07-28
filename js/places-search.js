// Gemeinsame Google-Places-Helper (Places API (New), Text Search) – genutzt
// von plan.js (Orte suchen) und inspire.js (Orts-Vorschau-Karten aus Gemini-
// Vorschlägen), damit beide dieselbe Suche/Foto-Logik nutzen statt sie zu
// duplizieren.

import { CONFIG } from "./config.js";

export function photoUrl(name, maxWidthPx = 400) {
  if (!name) return "";
  // park4night liefert bereits fertige CDN-Foto-URLs (kein Google-
  // Resource-Pfad) -- die einfach durchreichen statt in die
  // Google-Places-Media-URL einzubauen. Dadurch funktionieren dieselben
  // photoUrl(place.photos[0].name)-Aufrufe für beide Quellen.
  if (/^https?:\/\//.test(name)) return name;
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

// Field-Mask bewusst auf die günstigste Places-API-(New)-Stufe beschränkt
// (Abrechnung richtet sich nach der teuersten angefragten Feld-Kategorie --
// rating/userRatingCount/photos sind "Atmosphere"-Felder, die teuerste
// Stufe). Für eine Ergebnisliste reichen Name/Adresse/Koordinate; Fotos und
// Rezensionen werden bewusst NICHT hier mitgeladen, sondern erst einmalig
// bei Bedarf über fetchPlaceDetails() (js/place-details.js), wenn der
// Nutzer tatsächlich "Details" antippt. googleMapsUri wird deshalb auch
// nicht mehr mitbezahlt, sondern unten clientseitig aus der Place-ID gebaut
// (kostenloses, öffentlich dokumentiertes URL-Schema) -- bestehender Code,
// der place.googleMapsUri liest, funktioniert dadurch unverändert weiter.
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
      ].join(","),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Places-API-Fehler ${res.status}: ${errBody}`);
  }
  const data = await res.json();
  const places = data.places || [];
  return places.map((p) => ({
    ...p,
    googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName?.text || "Ort")}&query_place_id=${p.id}`,
  }));
}

// Holt NUR das erste Foto eines Orts (kein rating/reviews/etc.) -- genutzt,
// wenn ein Google-Suchergebnis tatsächlich zum Plan hinzugefügt wird, damit
// die Listenansicht (Plan/Route) ein Vorschaubild zeigen kann. Die
// Ergebnisliste selbst fragt bewusst keine Fotos ab (siehe oben), aber ein
// einmaliger, günstiger Zusatz-Call beim Speichern eines einzelnen Orts ist
// unkritisch – anders als ein "Atmosphere"-Feld in jeder Listensuche.
export async function fetchFirstPhotoRef(placeId) {
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": CONFIG.GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "photos",
      },
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.photos?.[0]?.name || "";
  } catch {
    return "";
  }
}
