// Header-Hintergrundmotiv: feste Auswahl lizenzfreier Fotos (vom Nutzer
// bereitgestellt, zugeschnitten unter headers/<id>.jpg), wählbar in den
// Einstellungen. Auswahl wird als data-header-theme auf .app-header gesetzt,
// die eigentlichen Bild-URLs + Abdunklung stehen in css/style.css.

const STORAGE_HEADER_THEME = "campingAppHeaderTheme";

export const HEADER_THEMES = [
  { id: "none", label: "Kein Bild (Farbfläche)" },
  { id: "beach", label: "Strand (Karibik)" },
  { id: "desert", label: "Wüste" },
  { id: "lake", label: "Bergsee" },
  { id: "mountains", label: "Berge" },
  { id: "skyline", label: "Skyline bei Nacht" },
  { id: "sunset", label: "Sonnenuntergang" },
  { id: "underwater", label: "Unterwasserwelt" },
];

const DEFAULT_HEADER_THEME = "beach";

export function getHeaderTheme() {
  const stored = localStorage.getItem(STORAGE_HEADER_THEME);
  // Fängt u. a. die alten Farbverlauf-Theme-IDs vor der Umstellung auf
  // echte Fotos ab (sonst bliebe der Header leer/nur abgedunkelt, da
  // css/style.css für diese IDs keine Regel mehr hat).
  const isValid = stored && HEADER_THEMES.some((t) => t.id === stored);
  return isValid ? stored : DEFAULT_HEADER_THEME;
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
