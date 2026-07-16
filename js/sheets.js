// Minimaler Google Sheets API v4 Client (fetch-basiert, kein SDK nötig).
// Milestone 3: volle CRUD-Funktionen für Trips/Places. Die Sheet-Struktur
// (Tabs + Kopfzeile) wird beim ersten Zugriff automatisch angelegt, falls
// sie noch fehlt – das Sheet selbst muss also nur leer existieren.

import { CONFIG } from "./config.js";
import { getAccessToken } from "./auth.js";

const BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

const TRIPS_SHEET = "Trips";
const TRIPS_HEADERS = ["id", "name", "startDate", "endDate", "note", "createdAt", "updatedAt"];

const PLACES_SHEET = "Places";
const PLACES_HEADERS = [
  "id", "tripId", "order", "name", "lat", "lng", "address",
  "category", "arrivalDate", "departureDate", "note", "placeId", "createdAt",
];

function colLetter(index) {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

async function sheetsFetch(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/${CONFIG.GOOGLE_SHEET_ID}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sheets API Fehler ${res.status}: ${body}`);
  }
  return res.json();
}

async function getSpreadsheetMeta() {
  return sheetsFetch("");
}

async function ensureSheetExists(meta, title) {
  const existing = meta.sheets?.find((s) => s.properties?.title === title);
  if (existing) return existing.properties.sheetId;

  const result = await sheetsFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
  return result.replies[0].addSheet.properties.sheetId;
}

async function ensureHeaderRow(title, headers) {
  const lastCol = colLetter(headers.length - 1);
  const range = `${title}!A1:${lastCol}1`;
  const current = await sheetsFetch(`/values/${range}`);
  if (current.values?.[0]?.length) return;

  await sheetsFetch(`/values/${range}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [headers] }),
  });
}

let readyPromise = null;

// Legt "Trips" und "Places" (mit Kopfzeile) an, falls sie im Sheet noch
// fehlen. Muss vor jedem Schreibzugriff abgeschlossen sein; wird gecacht,
// damit sie pro Session nur einmal läuft.
export function ensureSheetsReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      const meta = await getSpreadsheetMeta();
      await ensureSheetExists(meta, TRIPS_SHEET);
      await ensureSheetExists(meta, PLACES_SHEET);
      await ensureHeaderRow(TRIPS_SHEET, TRIPS_HEADERS);
      await ensureHeaderRow(PLACES_SHEET, PLACES_HEADERS);
    })().catch((err) => {
      readyPromise = null; // bei Fehler erneuten Versuch beim nächsten Aufruf erlauben
      throw err;
    });
  }
  return readyPromise;
}

// Testabruf: liest die Kopfzeilen von "Trips" und "Places", um zu bestätigen,
// dass Login + Sheet-ID + Tab-Namen korrekt sind.
export async function testReadHeaders() {
  await ensureSheetsReady();
  const [trips, places] = await Promise.all([
    sheetsFetch(`/values/${TRIPS_SHEET}!A1:G1`),
    sheetsFetch(`/values/${PLACES_SHEET}!A1:M1`),
  ]);
  return {
    tripsHeader: trips.values?.[0] || [],
    placesHeader: places.values?.[0] || [],
  };
}

function rowsToObjects(headers, rows) {
  return rows.map((row) =>
    headers.reduce((obj, key, i) => {
      obj[key] = row[i] ?? "";
      return obj;
    }, {})
  );
}

async function findRowIndexById(title, id) {
  const data = await sheetsFetch(`/values/${title}!A2:A`);
  const ids = data.values || [];
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2; // 1-basiert, +1 wegen Kopfzeile
  }
  return null;
}

async function upsertRow(title, headers, record) {
  await ensureSheetsReady();
  const row = headers.map((key) => record[key] ?? "");
  const lastCol = colLetter(headers.length - 1);
  const rowIndex = await findRowIndexById(title, record.id);

  if (rowIndex) {
    await sheetsFetch(`/values/${title}!A${rowIndex}:${lastCol}${rowIndex}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [row] }),
    });
  } else {
    await sheetsFetch(
      `/values/${title}!A1:${lastCol}1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: [row] }) }
    );
  }
  return record;
}

async function deleteRowById(title, id) {
  await ensureSheetsReady();
  const rowIndex = await findRowIndexById(title, id);
  if (!rowIndex) return;

  const meta = await getSpreadsheetMeta();
  const sheetId = meta.sheets.find((s) => s.properties.title === title).properties.sheetId;

  await sheetsFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: rowIndex - 1, endIndex: rowIndex },
        },
      }],
    }),
  });
}

export async function getTrips() {
  await ensureSheetsReady();
  const data = await sheetsFetch(`/values/${TRIPS_SHEET}!A2:G`);
  return rowsToObjects(TRIPS_HEADERS, data.values || []);
}

export function createTrip(trip) {
  return upsertRow(TRIPS_SHEET, TRIPS_HEADERS, trip);
}

export function updateTrip(trip) {
  return upsertRow(TRIPS_SHEET, TRIPS_HEADERS, trip);
}

export function deleteTrip(id) {
  return deleteRowById(TRIPS_SHEET, id);
}

export async function getPlaces(tripId) {
  await ensureSheetsReady();
  const data = await sheetsFetch(`/values/${PLACES_SHEET}!A2:M`);
  const places = rowsToObjects(PLACES_HEADERS, data.values || []);
  return tripId ? places.filter((p) => p.tripId === tripId) : places;
}

export function createPlace(place) {
  return upsertRow(PLACES_SHEET, PLACES_HEADERS, place);
}

export function updatePlace(place) {
  return upsertRow(PLACES_SHEET, PLACES_HEADERS, place);
}

export function deletePlace(id) {
  return deleteRowById(PLACES_SHEET, id);
}
