// Lokal gespeicherte Einstellungen (localStorage) – nichts davon wird committed.

const STORAGE_SCRIPT_URL = "campingAppScriptUrl";
const STORAGE_GEMINI_KEY = "campingAppGeminiKey";
const STORAGE_PARK4NIGHT_AMENITIES = "campingAppPark4nightAmenities";

// Vorbelegt mit der Apps-Script-Web-App-URL des Camper-Sheets, damit die App
// ohne manuelle Einrichtung sofort nutzbar ist. In den Einstellungen änderbar
// (z. B. bei einem Sheet-Wechsel) – die Änderung überschreibt diesen Default
// nur lokal im Browser, nicht im Code.
const DEFAULT_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbz3CJhgP58AuFibSDL9_7Q_O5q7euqWNQTZwI6ARJ94kwGv6H7dG0HS2cSJMloWLyia6g/exec";

export function getScriptUrl() {
  return localStorage.getItem(STORAGE_SCRIPT_URL) || DEFAULT_SCRIPT_URL;
}

export function setScriptUrl(url) {
  const trimmed = url.trim();
  if (trimmed) localStorage.setItem(STORAGE_SCRIPT_URL, trimmed);
  else localStorage.removeItem(STORAGE_SCRIPT_URL);
}

export function getGeminiKey() {
  return localStorage.getItem(STORAGE_GEMINI_KEY) || "";
}

export function setGeminiKey(key) {
  const trimmed = key.trim();
  if (trimmed) localStorage.setItem(STORAGE_GEMINI_KEY, trimmed);
  else localStorage.removeItem(STORAGE_GEMINI_KEY);
}

// Pflicht-Ausstattungsmerkmale für park4night-Suchen (Plan + Inspire, siehe
// js/park4night.js). Leere Liste = kein Filter, alle Treffer sichtbar.
export function getPark4nightRequiredAmenities() {
  try {
    const raw = localStorage.getItem(STORAGE_PARK4NIGHT_AMENITIES);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setPark4nightRequiredAmenities(keys) {
  localStorage.setItem(STORAGE_PARK4NIGHT_AMENITIES, JSON.stringify(keys));
}
