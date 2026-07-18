// Kategorie-Definitionen für Places: Name + Farbe. Global editierbar (gilt
// für die ganze App, nicht pro Urlaub) über Einstellungen, gespeichert in
// localStorage. Genutzt von plan.js (Gruppierung/Filter) und route.js
// (Marker-Farben).

const STORAGE_CATEGORIES = "campingAppCategories";

const DEFAULT_CATEGORIES = [
  { id: "Camping", label: "Camping", color: "#2f7f6e" },
  { id: "Sport", label: "Sport", color: "#e0703a" },
  { id: "Sightseeing", label: "Sightseeing", color: "#3a6fb0" },
  { id: "Restaurant", label: "Restaurant", color: "#c2417a" },
  { id: "Sonstiges", label: "Sonstiges", color: "#8a7d5e" },
];

export const UNCATEGORIZED = { id: "", label: "Noch nicht eingeplante Orte", color: "#9199ab" };

export function getCategories() {
  const raw = localStorage.getItem(STORAGE_CATEGORIES);
  if (!raw) return DEFAULT_CATEGORIES;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

function saveCategories(categories) {
  localStorage.setItem(STORAGE_CATEGORIES, JSON.stringify(categories));
}

export function addCategory(label, color) {
  const id = label.trim();
  if (!id) return false;
  const categories = getCategories();
  if (categories.some((c) => c.id.toLowerCase() === id.toLowerCase())) return false;
  saveCategories([...categories, { id, label: id, color }]);
  return true;
}

export function renameCategory(id, newLabel, newColor) {
  const trimmed = newLabel.trim();
  if (!trimmed) return false;
  saveCategories(getCategories().map((c) => (c.id === id ? { id: trimmed, label: trimmed, color: newColor } : c)));
  return true;
}

export function removeCategory(id) {
  saveCategories(getCategories().filter((c) => c.id !== id));
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

function renderCategoriesSettingsRow(list, cat) {
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
  saveBtn.addEventListener("click", () => {
    if (!nameField.value.trim()) return;
    renameCategory(cat.id, nameField.value, colorField.value);
    renderCategoriesSettings(list);
  });

  const delBtn = document.createElement("button");
  delBtn.className = "trip-icon-btn";
  delBtn.textContent = "✕";
  delBtn.setAttribute("aria-label", "Löschen");
  delBtn.addEventListener("click", () => {
    if (!window.confirm(`Kategorie "${cat.label}" löschen? Orte mit dieser Kategorie werden zu "Ohne Kategorie".`)) return;
    removeCategory(cat.id);
    renderCategoriesSettings(list);
  });

  li.append(dot, nameField, colorField, saveBtn, delBtn);
  return li;
}

// Rendert die Kategorienverwaltung (Liste + "Neu anlegen"-Formular) in `container`.
export function renderCategoriesSettings(container) {
  container.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "trips-list category-settings-list";
  getCategories().forEach((cat) => list.appendChild(renderCategoriesSettingsRow(container, cat)));
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
  addBtn.addEventListener("click", () => {
    if (!newName.value.trim()) return;
    if (!addCategory(newName.value, newColor.value)) return;
    renderCategoriesSettings(container);
  });

  addRow.append(newName, newColor, addBtn);
  container.appendChild(addRow);
}
