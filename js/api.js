// Client für die Google-Apps-Script-Web-App (an das Google Sheet gebunden).
// Kein Google-Login/OAuth nötig: die Web App läuft "als Ich" (Sheet-Besitzer)
// und ist für "Jeder" freigegeben (siehe apps-script/Code.gs + README).
//
// GET liest normal (Apps Script leitet auf eine googleusercontent.com-URL mit
// offenem CORS um). POST läuft "blind" (mode: no-cors, Content-Type text/plain),
// da Apps Script keine CORS-Preflight-Requests beantwortet – die Antwort kann
// dabei nicht gelesen werden, wir aktualisieren den lokalen State optimistisch.

import { getScriptUrl } from "./settings.js";

const STORAGE_DATA_CACHE = "campingAppDataCache";

let cache = null;
let lastLoadWasOffline = false;

export function wasLastLoadOffline() {
  return lastLoadWasOffline;
}

async function fetchAll() {
  const url = getScriptUrl();
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Apps-Script-Antwort ${res.status}`);
    cache = await res.json();
    lastLoadWasOffline = false;
    localStorage.setItem(STORAGE_DATA_CACHE, JSON.stringify(cache));
    return cache;
  } catch (err) {
    const cached = localStorage.getItem(STORAGE_DATA_CACHE);
    if (!cached) throw err;
    cache = JSON.parse(cached);
    lastLoadWasOffline = true;
    return cache;
  }
}

async function postAction(entity, action, data) {
  const url = getScriptUrl();
  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ entity, action, data }),
  });
}

export async function getTrips() {
  const data = await fetchAll();
  return data.trips || [];
}

export async function getPlaces(tripId) {
  const data = cache || (await fetchAll());
  const places = data.places || [];
  return tripId ? places.filter((p) => p.tripId === tripId) : places;
}

// null = Apps-Script-Bereitstellung kennt "categories" noch nicht (Code.gs
// wurde noch nicht neu bereitgestellt) -> categories.js darf dann NICHT
// versuchen, Kategorien ins Sheet zu schreiben (der alte doPost würde einen
// "category"-Upsert sonst fälschlich als Trip/Place-Zeile ablegen).
export async function getCategoriesData() {
  const data = cache || (await fetchAll());
  return Array.isArray(data.categories) ? data.categories : null;
}

export function createTrip(trip) {
  return postAction("trip", "upsert", trip);
}

export function updateTrip(trip) {
  return postAction("trip", "upsert", trip);
}

export function deleteTrip(id) {
  return postAction("trip", "delete", { id });
}

export function createPlace(place) {
  return postAction("place", "upsert", place);
}

export function updatePlace(place) {
  return postAction("place", "upsert", place);
}

export function deletePlace(id) {
  return postAction("place", "delete", { id });
}

export function createCategory(category) {
  return postAction("category", "upsert", category);
}

export function updateCategory(category) {
  return postAction("category", "upsert", category);
}

export function deleteCategory(id) {
  return postAction("category", "delete", { id });
}
