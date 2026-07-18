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
  return jsonResponse({
    trips: readSheet(SHEET_TRIPS, TRIPS_HEADERS),
    places: readSheet(SHEET_PLACES, PLACES_HEADERS),
    categories: readSheet(SHEET_CATEGORIES, CATEGORIES_HEADERS),
  });
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
