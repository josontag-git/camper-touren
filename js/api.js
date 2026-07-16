// Client für die Google-Apps-Script-Web-App (an das Google Sheet gebunden).
// Kein Google-Login/OAuth nötig: die Web App läuft "als Ich" (Sheet-Besitzer)
// und ist für "Jeder" freigegeben (siehe apps-script/Code.gs + README).
//
// GET liest normal (Apps Script leitet auf eine googleusercontent.com-URL mit
// offenem CORS um). POST läuft "blind" (mode: no-cors, Content-Type text/plain),
// da Apps Script keine CORS-Preflight-Requests beantwortet – die Antwort kann
// dabei nicht gelesen werden, wir aktualisieren den lokalen State optimistisch.

const STORAGE_SCRIPT_URL = "campingAppScriptUrl";

export function getScriptUrl() {
  return localStorage.getItem(STORAGE_SCRIPT_URL) || "";
}

export function setScriptUrl(url) {
  localStorage.setItem(STORAGE_SCRIPT_URL, url.trim());
}

function requireScriptUrl() {
  const url = getScriptUrl();
  if (!url) {
    throw new Error("Keine Apps-Script-URL hinterlegt. Bitte unter Einstellungen eintragen.");
  }
  return url;
}

let cache = null;

async function fetchAll() {
  const url = requireScriptUrl();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Apps-Script-Antwort ${res.status}`);
  cache = await res.json();
  return cache;
}

async function postAction(entity, action, data) {
  const url = requireScriptUrl();
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
