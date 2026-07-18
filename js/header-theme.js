// Header-Hintergrundmotiv: feste Auswahl (CSS-Gradients, keine echten Fotos –
// dafür gibt es hier keine lizenzfreie Bildquelle), wählbar in den
// Einstellungen. Auswahl wird als data-header-theme auf .app-header gesetzt,
// die eigentlichen Gradients stehen in css/style.css.

const STORAGE_HEADER_THEME = "campingAppHeaderTheme";

export const HEADER_THEMES = [
  { id: "none", label: "Kein Bild (Farbfläche)" },
  { id: "sea-turquoise", label: "Meer (Türkis/Karibik)" },
  { id: "sea-deep", label: "Meer (Tiefblau/Atlantik)" },
  { id: "sea-sunset", label: "Meer bei Sonnenuntergang" },
  { id: "mountains", label: "Berge" },
  { id: "forest", label: "Wald" },
  { id: "desert", label: "Wüste" },
  { id: "stars", label: "Sternenhimmel" },
];

const DEFAULT_HEADER_THEME = "sea-turquoise";

export function getHeaderTheme() {
  return localStorage.getItem(STORAGE_HEADER_THEME) || DEFAULT_HEADER_THEME;
}

export function setHeaderTheme(id) {
  localStorage.setItem(STORAGE_HEADER_THEME, id);
  applyHeaderTheme(id);
}

export function applyHeaderTheme(id) {
  const header = document.querySelector(".app-header");
  if (!header) return;
  header.dataset.headerTheme = id;
  header.classList.toggle("app-header--photo", id !== "none");
}
