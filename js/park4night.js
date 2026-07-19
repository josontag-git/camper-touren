// park4night-Hilfsfunktionen: inoffizielle Community-Stellplatzdaten als
// Ergänzung zur Google-Places-Suche (js/places-search.js). Läuft über den
// Server-Proxy in apps-script/Code.gs (kein CORS für Direktzugriff aus dem
// Browser). Diese Quelle ist optional/ergänzend -- bei jedem Fehler wird
// hier still ein leeres Ergebnis zurückgegeben statt eine Fehlermeldung zu
// zeigen; Google Places bleibt die verlässliche Hauptquelle.
//
// Ergebnisse werden auf dieselbe Objekt-Form normalisiert, die
// searchGooglePlaces() liefert (displayName.text, formattedAddress,
// location, rating, userRatingCount, photos[].name, id, googleMapsUri) --
// dadurch können plan.js/inspire.js dieselben Render-/Speicherfunktionen
// für beide Quellen weiterverwenden, siehe README.

import { searchPark4night, getPark4nightReviews } from "./api.js";
import { getPark4nightRequiredAmenities } from "./settings.js";

const AMENITY_LABELS = {
  point_eau: "Frischwasser",
  eau_noire: "Schwarzwasser-Entsorgung",
  eau_usee: "Grauwasser-Entsorgung",
  wc_public: "öffentliches WC",
  poubelle: "Müllentsorgung",
  douche: "Dusche",
  electricite: "Strom",
  wifi: "WLAN",
  piscine: "Pool",
  gaz: "Gas",
  gpl: "Autogas (GPL)",
  animaux: "Haustiere erlaubt",
  laverie: "Waschmaschine",
  boulangerie: "Bäcker in der Nähe",
  moto: "motorradfreundlich",
  rando: "Wandern",
  escalade: "Klettern",
  peche: "Angeln",
  baignade: "Baden",
  jeux_enfants: "Spielplatz",
  vtt: "Mountainbike",
  windsurf: "Windsurfen",
  point_de_vue: "Aussichtspunkt",
  donnees_mobile: "Mobilfunkempfang",
  lavage: "Waschanlage",
  caravaneige: "Winterstellplatz (Caravaneige)",
};

// Alltagsrelevante Teilmenge der Ausstattungsmerkmale, im Admin-Bereich als
// Filter-Checkboxen wählbar (siehe js/main.js initPark4nightAdminUI()) --
// bewusst nicht alle 25 Flags, um die Auswahl überschaubar zu halten.
export const ADMIN_AMENITY_OPTIONS = [
  "wc_public", "douche", "electricite", "point_eau", "wifi", "animaux",
].map((key) => ({ key, label: AMENITY_LABELS[key] }));

// Nur Flags mit Wert "1" als lesbare, kommaseparierte Liste, z. B.
// "Frischwasser, Strom, Dusche, WLAN" -- wird als Notiz vorbefüllt.
function amenityNote(p4n) {
  return Object.entries(AMENITY_LABELS)
    .filter(([key]) => p4n[key] === "1")
    .map(([, label]) => label)
    .join(", ");
}

function toPlaceShape(p4n) {
  return {
    source: "park4night",
    id: `p4n:${p4n.id}`,
    displayName: { text: p4n.name || "" },
    formattedAddress: [p4n.ville, p4n.pays].filter(Boolean).join(", "),
    location: { latitude: Number(p4n.latitude), longitude: Number(p4n.longitude) },
    rating: p4n.note_moyenne ? Number(p4n.note_moyenne) : null,
    userRatingCount: p4n.nb_commentaires ? Number(p4n.nb_commentaires) : 0,
    photos: (p4n.photos || []).map((photo) => ({ name: photo.link_large, thumb: photo.link_thumb })),
    // Öffentliche Detailseite bei park4night -- unter demselben Feldnamen
    // wie Googles googleMapsUri, damit der bestehende Link-Render-Code in
    // buildResultDetailPanel() ihn ohne Sonderfall anzeigt.
    googleMapsUri: `https://park4night.com/en/place/${p4n.id}`,
    note: amenityNote(p4n),
    distance: p4n.distance != null ? Number(p4n.distance) : null,
  };
}

// campingOnly: nur Treffer mit code "C" (echte Campingplätze, per Live-Test
// gegen die API bestätigt -- siehe README). Ausstattungsfilter kommt aus den
// Admin-Einstellungen und gilt unabhängig von campingOnly für jeden Aufruf
// (Plan und Inspire) -- die API unterstützt keine Server-seitige Filterung
// (mehrere Query-Parameter-Varianten getestet, wirkungslos), daher hier auf
// den bereits vorhandenen Ausstattungs-Flags der Antwort.
export async function searchPark4nightNear(lat, lng, { campingOnly = false } = {}) {
  try {
    let results = await searchPark4night(lat, lng);
    if (campingOnly) results = results.filter((p) => p.code === "C");
    const required = getPark4nightRequiredAmenities();
    if (required.length) {
      results = results.filter((p) => required.every((key) => p[key] === "1"));
    }
    return results.map(toPlaceShape);
  } catch {
    return [];
  }
}

export async function fetchPark4nightReviewsFor(placeId) {
  try {
    return await getPark4nightReviews(placeId);
  } catch {
    return [];
  }
}
