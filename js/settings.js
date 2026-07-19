// Lokal gespeicherte Einstellungen (localStorage) – nichts davon wird committed.

const STORAGE_SCRIPT_URL = "campingAppScriptUrl";
const STORAGE_GEMINI_KEY = "campingAppGeminiKey";

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
