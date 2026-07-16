// Minimaler Google Sheets API v4 Client (fetch-basiert, kein SDK nötig).
// Milestone 3 baut hierauf die vollständigen CRUD-Funktionen für Trips/Places.
// Milestone 2: nur ein Lese-Testabruf, um Login + Sheet-Zugriff zu verifizieren.

import { CONFIG } from "./config.js";
import { getAccessToken } from "./auth.js";

const BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

async function sheetsFetch(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/${CONFIG.GOOGLE_SHEET_ID}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sheets API Fehler ${res.status}: ${body}`);
  }
  return res.json();
}

// Testabruf: liest die Kopfzeilen von "Trips" und "Places", um zu bestätigen,
// dass Login + Sheet-ID + Tab-Namen korrekt sind.
export async function testReadHeaders() {
  const [trips, places] = await Promise.all([
    sheetsFetch("/values/Trips!A1:G1"),
    sheetsFetch("/values/Places!A1:M1"),
  ]);
  return {
    tripsHeader: trips.values?.[0] || [],
    placesHeader: places.values?.[0] || [],
  };
}

export async function getTrips() {
  const data = await sheetsFetch("/values/Trips!A2:G1000");
  return data.values || [];
}

export async function getPlaces() {
  const data = await sheetsFetch("/values/Places!A2:M5000");
  return data.values || [];
}
