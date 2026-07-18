// Kategorie-Definitionen für Places: Name + Farbe. Global editierbar (gilt
// für die ganze App, nicht pro Urlaub) und über das Google Sheet synchron
// zwischen Geräten (wie Trips/Places) statt in localStorage. Genutzt von
// plan.js (Gruppierung/Filter) und route.js (Marker-Farben).

import { getState, setCategories } from "./state.js";
import { getCategoriesData, createCategory, updateCategory, deleteCategory } from "./api.js";

const LEGACY_STORAGE_KEY = "campingAppCategories"; // vor Milestone 8, nur für die einmalige Migration gelesen

const DEFAULT_CATEGORIES = [
  { id: "Camping", label: "Camping", color: "#2f7f6e" },
  { id: "Sport", label: "Sport", color: "#e0703a" },
  { id: "Sightseeing", label: "Sightseeing", color: "#3a6fb0" },
  { id: "Restaurant", label: "Restaurant", color: "#c2417a" },
  { id: "Sonstiges", label: "Sonstiges", color: "#8a7d5e" },
];

export const UNCATEGORIZED = { id: "", label: "Noch nicht eingeplante Orte", color: "#9199ab" };

// Solange die Apps-Script-Bereitstellung noch nicht neu ausgerollt wurde
// (altes Code.gs kennt "category" als Entity nicht), NICHT versuchen, ins
// Sheet zu schreiben – ein "category"-Upsert würde vom alten doPost sonst
// fälschlich als Trip-/Place-Zeile abgelegt (so beim ersten Testlauf dieser
// Funktion auch tatsächlich passiert, siehe Milestone-8-Notizen). In diesem
// Zustand bleiben Kategorien wie vor Milestone 8 lokal in localStorage.
let categoriesSynced = true;

export function getCategories() {
  return getState().categories;
}

// Einmaliges Laden beim App-Start (main.js): holt Kategorien aus dem Sheet;
// ist die Tabelle noch leer, zuerst nach einem alten localStorage-Stand
// schauen (nahtlose Migration bereits vorhandener Anpassungen), sonst die
// Standardkategorien nehmen – beides wird dann ins Sheet geschrieben, damit
// es ab sofort auf allen Geräten gleich aussieht.
export async function loadCategories() {
  const cats = await getCategoriesData();
  if (cats === null) {
    categoriesSynced = false;
    setCategories(readLegacyCategories() || DEFAULT_CATEGORIES);
    return;
  }
  categoriesSynced = true;
  if (cats.length === 0) {
    const seeded = readLegacyCategories() || DEFAULT_CATEGORIES;
    await Promise.all(seeded.map((c) => createCategory(c)));
    setCategories(seeded);
    return;
  }
  setCategories(cats);
}

function readLegacyCategories() {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function saveLegacyCategories(categories) {
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(categories));
}

export async function addCategory(label, color) {
  const id = label.trim();
  if (!id) return false;
  const categories = getCategories();
  if (categories.some((c) => c.id.toLowerCase() === id.toLowerCase())) return false;
  const record = { id, label: id, color };
  const next = [...categories, record];
  if (categoriesSynced) await createCategory(record); else saveLegacyCategories(next);
  setCategories(next);
  return true;
}

export async function renameCategory(id, newLabel, newColor) {
  const trimmed = newLabel.trim();
  if (!trimmed) return false;
  const record = { id: trimmed, label: trimmed, color: newColor };
  const next = getCategories().map((c) => (c.id === id ? record : c));
  if (categoriesSynced) {
    // Die id ist aktuell vom Label abgeleitet -> bei Namensänderung ändert
    // sich die id mit, ein einfaches Upsert würde dann eine zweite Zeile
    // anlegen statt die alte zu ersetzen.
    if (trimmed !== id) {
      await deleteCategory(id);
      await createCategory(record);
    } else {
      await updateCategory(record);
    }
  } else {
    saveLegacyCategories(next);
  }
  setCategories(next);
  return true;
}

export async function removeCategory(id) {
  const next = getCategories().filter((c) => c.id !== id);
  if (categoriesSynced) await deleteCategory(id); else saveLegacyCategories(next);
  setCategories(next);
}

export function categoryInfo(id) {
  return getCategories().find((c) => c.id === id) || UNCATEGORIZED;
}

export function allCategoryIds() {
  return [...getCategories().map((c) => c.id), UNCATEGORIZED.id];
}

// Rendert die Filter-Chip-Leiste (Kategorie an-/abwählen) in `container`.
// `isActiveFn(id)` liefert den aktuellen Sichtbarkeitsstatus je Kategorie.
export function renderCategoryFilterChips(container, isActiveFn, onToggle) {
  container.innerHTML = "";
  [...getCategories(), UNCATEGORIZED].forEach((cat) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "category-chip";
    chip.classList.toggle("is-active", isActiveFn(cat.id));
    chip.style.setProperty("--chip-color", cat.color);
    chip.textContent = cat.label;
    chip.addEventListener("click", () => onToggle(cat.id));
    container.appendChild(chip);
  });
}

// Rendert Kategorie-Auswahl-Buttons (Einfachauswahl, z. B. beim Anlegen eines
// Orts) in `container`. `selectedId` ist die aktuell gewählte Kategorie-ID.
export function renderCategoryButtons(container, selectedId, onSelect) {
  container.innerHTML = "";
  getCategories().forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "category-chip";
    btn.classList.toggle("is-active", selectedId === cat.id);
    btn.style.setProperty("--chip-color", cat.color);
    btn.textContent = cat.label;
    btn.addEventListener("click", () => onSelect(cat.id));
    container.appendChild(btn);
  });
}

// --- Kategorienverwaltung in den Einstellungen ---

function renderCategoriesSettingsRow(cat) {
  const li = document.createElement("li");
  li.className = "trip-item";
  li.style.setProperty("--category-color", cat.color);

  const dot = document.createElement("span");
  dot.className = "route-category-dot";

  const nameField = document.createElement("input");
  nameField.type = "text";
  nameField.value = cat.label;
  nameField.className = "category-settings-name";

  const colorField = document.createElement("input");
  colorField.type = "color";
  colorField.value = cat.color;
  colorField.className = "category-settings-color";

  const saveBtn = document.createElement("button");
  saveBtn.className = "trip-icon-btn";
  saveBtn.textContent = "✓";
  saveBtn.setAttribute("aria-label", "Speichern");
  saveBtn.addEventListener("click", async () => {
    if (!nameField.value.trim()) return;
    saveBtn.disabled = true;
    await renameCategory(cat.id, nameField.value, colorField.value);
  });

  const delBtn = document.createElement("button");
  delBtn.className = "trip-icon-btn";
  delBtn.textContent = "✕";
  delBtn.setAttribute("aria-label", "Löschen");
  delBtn.addEventListener("click", async () => {
    if (!window.confirm(`Kategorie "${cat.label}" löschen? Orte mit dieser Kategorie werden zu "Ohne Kategorie".`)) return;
    delBtn.disabled = true;
    await removeCategory(cat.id);
  });

  li.append(dot, nameField, colorField, saveBtn, delBtn);
  return li;
}

// Rendert die Kategorienverwaltung (Liste + "Neu anlegen"-Formular) in `container`.
export function renderCategoriesSettings(container) {
  container.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "trips-list category-settings-list";
  getCategories().forEach((cat) => list.appendChild(renderCategoriesSettingsRow(cat)));
  container.appendChild(list);

  const addRow = document.createElement("div");
  addRow.className = "category-settings-add";

  const newName = document.createElement("input");
  newName.type = "text";
  newName.placeholder = "Neue Kategorie";

  const newColor = document.createElement("input");
  newColor.type = "color";
  newColor.value = "#3a6fb0";

  const addBtn = document.createElement("button");
  addBtn.className = "btn btn-primary";
  addBtn.textContent = "+ Hinzufügen";
  addBtn.addEventListener("click", async () => {
    if (!newName.value.trim()) return;
    addBtn.disabled = true;
    await addCategory(newName.value, newColor.value);
  });

  addRow.append(newName, newColor, addBtn);
  container.appendChild(addRow);
}
