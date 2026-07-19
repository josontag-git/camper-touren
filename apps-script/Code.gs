// In das Google Sheet einfuegen unter: Erweiterungen -> Apps Script
// Danach als Web App (neu) deployen ("Ausfuehren als: Ich", "Zugriff: Jeder")
// -- siehe README.md im Projekt-Root. Die angezeigte /exec-URL kommt in die
// Einstellungen der App (Zahnrad-Symbol), nicht in den Code.

const SHEET_TRIPS = "Trips";
const TRIPS_HEADERS = ["id", "name", "startDate", "endDate", "note", "createdAt", "updatedAt", "order"];

const SHEET_PLACES = "Places";
const PLACES_HEADERS = [
  "id", "tripId", "order", "name", "lat", "lng", "address",
  "category", "arrivalDate", "departureDate", "note", "placeId", "createdAt",
  "photoRef", "rating", "userRatingCount", "status",
];

const SHEET_CATEGORIES = "Categories";
const CATEGORIES_HEADERS = ["id", "label", "color", "order"];

const ENTITIES = {
  trip: [SHEET_TRIPS, TRIPS_HEADERS],
  place: [SHEET_PLACES, PLACES_HEADERS],
  category: [SHEET_CATEGORIES, CATEGORIES_HEADERS],
};

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === "park4nightSearch") {
    return jsonResponse({ results: fetchPark4nightSearch(e.parameter.lat, e.parameter.lng) });
  }
  if (action === "park4nightReviews") {
    return jsonResponse({ reviews: fetchPark4nightReviews(e.parameter.lieuId) });
  }
  return jsonResponse({
    trips: readSheet(SHEET_TRIPS, TRIPS_HEADERS),
    places: readSheet(SHEET_PLACES, PLACES_HEADERS),
    categories: readSheet(SHEET_CATEGORIES, CATEGORIES_HEADERS),
  });
}

// park4night: inoffizielle, undokumentierte Community-API für
// Stellplatzdaten (Ergänzung zur Google-Places-Suche). Die Antwort enthält
// wörtlich den Hinweis "This data is not public, STOP your parsing" -- die
// Schnittstelle kann sich jederzeit ändern oder gesperrt werden. Deshalb
// hier server-seitig (kein CORS-Problem für den Browser) UND defensiv:
// jeder Fehler (Netzwerk, Status, kaputtes JSON) liefert einfach ein leeres
// Ergebnis statt zu werfen, damit die App diese Quelle bei Ausfall still
// ausblenden kann (siehe js/park4night.js).
const PARK4NIGHT_SEARCH_FIELDS = [
  "id", "latitude", "longitude", "description_de", "ville", "code_postal",
  "pays", "note_moyenne", "nb_commentaires", "prix_stationnement",
  "prix_services", "nb_places", "hauteur_limite", "code", "distance",
  "point_eau", "eau_noire", "eau_usee", "wc_public", "poubelle", "douche",
  "electricite", "wifi", "piscine", "gaz", "gpl", "animaux", "laverie",
  "boulangerie", "moto", "rando", "escalade", "peche", "baignade",
  "jeux_enfants", "vtt", "windsurf", "point_de_vue", "donnees_mobile",
  "lavage", "caravaneige",
];

function fetchPark4nightSearch(lat, lng) {
  if (!lat || !lng) return [];
  try {
    const url = "https://guest.park4night.com/services/V4.1/lieuxGetFilter.php"
      + "?latitude=" + encodeURIComponent(lat) + "&longitude=" + encodeURIComponent(lng);
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return [];
    const data = JSON.parse(res.getContentText());
    const lieux = Array.isArray(data.lieux) ? data.lieux : [];
    return lieux.map((l) => {
      const reduced = {};
      PARK4NIGHT_SEARCH_FIELDS.forEach((key) => { reduced[key] = l[key]; });
      reduced.name = l.name || l.titre || "";
      reduced.photos = Array.isArray(l.photos)
        ? l.photos.map((p) => ({ link_large: p.link_large, link_thumb: p.link_thumb }))
        : [];
      return reduced;
    });
  } catch (err) {
    return [];
  }
}

function fetchPark4nightReviews(lieuId) {
  if (!lieuId) return [];
  try {
    const url = "https://guest.park4night.com/services/V4.1/commGet.php?lieu_id=" + encodeURIComponent(lieuId);
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return [];
    const data = JSON.parse(res.getContentText());
    const list = Array.isArray(data.commentaires) ? data.commentaires : [];
    return list.slice(0, 20).map((c) => ({
      note: c.note, commentaire: c.commentaire, uuid: c.uuid, date_creation: c.date_creation,
    }));
  } catch (err) {
    return [];
  }
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const [sheetName, headers] = ENTITIES[data.entity] || ENTITIES.trip;
  const sheet = getOrCreateSheet(sheetName, headers);

  if (data.action === "delete") {
    deleteRowById(sheet, data.data.id);
  } else {
    upsertRow(sheet, headers, data.data);
  }

  return jsonResponse({ status: "ok" });
}

function readSheet(name, headers) {
  const sheet = getOrCreateSheet(name, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return rows
    .filter((row) => row[0] !== "")
    .map((row) => {
      const obj = {};
      headers.forEach((key, i) => {
        const value = row[i];
        // Sheets wandelt Text wie "2026-08-01" automatisch in ein Datum um;
        // beim Zurücklesen als Date-Objekt normalisieren wir es wieder auf
        // "yyyy-MM-dd", statt das ISO-Datum mit Zeitzonen-Versatz durchzureichen.
        obj[key] = value instanceof Date ? Utilities.formatDate(value, tz, "yyyy-MM-dd") : value;
      });
      return obj;
    });
}

function upsertRow(sheet, headers, record) {
  const row = headers.map((key) => record[key] ?? "");
  const lastRow = sheet.getLastRow();
  let targetRow = null;
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === record.id) { targetRow = i + 2; break; }
    }
  }
  if (!targetRow) targetRow = lastRow + 1;

  const range = sheet.getRange(targetRow, 1, 1, row.length);
  // Ohne Text-Format wandelt Sheets zahlen-/datumsähnliche Werte automatisch
  // um (z. B. wird "2026-08-01" oder der Längengrad "9.9" als Datum
  // interpretiert und der eigentliche Wert geht verloren). Das Format muss
  // per flush() VOR dem Schreiben tatsächlich angewendet sein, sonst greift
  // Sheets' Auto-Erkennung trotzdem beim nachfolgenden setValues().
  range.setNumberFormat("@");
  SpreadsheetApp.flush();
  range.setValues([row]);
}

function deleteRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) {
      sheet.deleteRow(i + 2);
      return;
    }
  }
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    return sheet;
  }
  // Additive Migration: falls Code.gs seit dem Anlegen des Sheets neue Spalten
  // bekommen hat, fehlende Kopfzeilen-Zellen ergaenzen (Daten bleiben unberuehrt).
  const existingCols = sheet.getLastColumn();
  if (existingCols < headers.length) {
    sheet.getRange(1, existingCols + 1, 1, headers.length - existingCols)
      .setValues([headers.slice(existingCols)]);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
