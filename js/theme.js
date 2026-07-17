// Farbschemata: Auswahl wird als data-color-theme auf <html> gesetzt,
// die eigentlichen Farbwerte stehen als CSS-Variablen in css/style.css.

const STORAGE_COLOR_THEME = "campingAppColorTheme";

export const THEMES = [
  { id: "mono", label: "Mono (Standard)" },
  { id: "seaview", label: "Seaview" },
  { id: "sunset", label: "Sunset" },
  { id: "beach", label: "Beach" },
  { id: "citylights", label: "Citylights" },
  { id: "mountainview", label: "Mountain View" },
  { id: "party", label: "Party" },
  { id: "relax", label: "Relax" },
  { id: "crazy", label: "Crazy" },
];

const DEFAULT_THEME = "mono";

export function getColorTheme() {
  return localStorage.getItem(STORAGE_COLOR_THEME) || DEFAULT_THEME;
}

export function setColorTheme(id) {
  localStorage.setItem(STORAGE_COLOR_THEME, id);
  applyColorTheme(id);
}

export function applyColorTheme(id) {
  document.documentElement.dataset.colorTheme = id;
}
