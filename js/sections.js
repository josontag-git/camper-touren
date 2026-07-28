// Abschnitte (Sections): benutzerdefinierte Gruppierung der Orte innerhalb
// eines Urlaubs (z. B. "Etappe 1", "Küste"), um lange Touren in Plan/Route
// übersichtlicher zu machen. Anders als Kategorien (js/categories.js) sind
// Abschnitte pro Urlaub statt global – sonst fast identisches Muster (Sheet-
// Sync über js/api.js, Drag&Drop-Sortierung über js/drag-reorder.js).

import { getState, setSections } from "./state.js";
import { getSectionsData, createSection, updateSection, deleteSection } from "./api.js";
import { attachDragHandle } from "./drag-reorder.js";

export const UNSECTIONED = { id: "", label: "Ohne Abschnitt", color: "#9199ab" };

// Solange die Apps-Script-Bereitstellung noch nicht neu ausgerollt wurde
// (altes Code.gs kennt "section" als Entity nicht), NICHT versuchen, ins
// Sheet zu schreiben -- gleiche Schutzlogik wie bei categoriesSynced in
// categories.js.
let sectionsSynced = true;

export function sectionsAreSynced() {
  return sectionsSynced;
}

export function getSectionsForTrip(tripId) {
  return getState().sections
    .filter((s) => s.tripId === tripId)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

// IDs sind UUIDs (nicht vom Label abgeleitet wie bei Categories) -- Section-
// Namen müssen nicht global eindeutig sein, das würde nur unnötige
// Kollisions-Prüfungen über alle Urlaube hinweg erzwingen. UUID-Eindeutigkeit
// erlaubt außerdem sectionInfo(id) ohne tripId-Parameter.
export function sectionInfo(id) {
  return getState().sections.find((s) => s.id === id) || UNSECTIONED;
}

// Einmaliges Laden beim App-Start (main.js, parallel zu loadCategories()).
export async function loadSections() {
  const secs = await getSectionsData();
  if (secs === null) {
    sectionsSynced = false;
    return;
  }
  sectionsSynced = true;
  setSections(secs);
}

export async function addSection(tripId, label, color) {
  const trimmed = label.trim();
  if (!trimmed || !sectionsSynced) return false;
  const record = { id: crypto.randomUUID(), tripId, label: trimmed, color, order: getSectionsForTrip(tripId).length };
  await createSection(record);
  setSections([...getState().sections, record]);
  return true;
}

export async function renameSection(id, newLabel, newColor) {
  const trimmed = newLabel.trim();
  const existing = getState().sections.find((s) => s.id === id);
  if (!trimmed || !existing) return false;
  const record = { ...existing, label: trimmed, color: newColor };
  await updateSection(record);
  setSections(getState().sections.map((s) => (s.id === id ? record : s)));
  return true;
}

// Löscht nur den Abschnitt selbst -- Orte mit dieser sectionId bleiben
// unverändert im Sheet, fallen aber automatisch auf "Ohne Abschnitt" zurück
// (sectionInfo() liefert UNSECTIONED für eine unbekannte id). Exakt dasselbe
// Verhalten wie removeCategory() in categories.js.
export async function removeSection(id) {
  await deleteSection(id);
  setSections(getState().sections.filter((s) => s.id !== id));
}

async function onReorderSections(tripId, sourceId, targetId) {
  const ordered = getSectionsForTrip(tripId);
  const before = new Map(ordered.map((s) => [s.id, s.order]));
  const fromIndex = ordered.findIndex((s) => s.id === sourceId);
  const toIndex = ordered.findIndex((s) => s.id === targetId);
  if (fromIndex === -1 || toIndex === -1) return;

  const [moved] = ordered.splice(fromIndex, 1);
  ordered.splice(toIndex, 0, moved);
  const reindexed = ordered.map((s, i) => ({ ...s, order: i }));
  const others = getState().sections.filter((s) => s.tripId !== tripId);
  setSections([...others, ...reindexed]);

  // Nur tatsächlich verschobene Abschnitte schreiben, UND ein fehlgeschlagener
  // Request darf den Rest nicht blockieren -- siehe writeChangedPlaces() in
  // plan.js für den (live nachgewiesenen) Hintergrund dieser beiden Punkte.
  const toWrite = reindexed.filter((s) => before.get(s.id) !== s.order);
  for (const s of toWrite) {
    try {
      await updateSection(s);
    } catch (err) {
      console.error(err);
    }
  }
}

function renderSectionsSettingsRow(section) {
  const li = document.createElement("li");
  li.className = "trip-item";
  li.dataset.id = section.id;
  li.style.setProperty("--category-color", section.color);

  const handle = document.createElement("span");
  handle.className = "place-drag-handle";
  handle.textContent = "⠿";
  handle.setAttribute("role", "button");
  handle.setAttribute("aria-label", "Ziehen zum Sortieren");
  attachDragHandle(handle, li, (draggedLi) => {
    const listEl = draggedLi.parentElement;
    return [...listEl.querySelectorAll(".trip-item")].filter((el) => el !== draggedLi);
  }, (sourceId, targetId) => onReorderSections(section.tripId, sourceId, targetId));

  const dot = document.createElement("span");
  dot.className = "route-category-dot";

  const nameField = document.createElement("input");
  nameField.type = "text";
  nameField.value = section.label;
  nameField.className = "category-settings-name";

  const colorField = document.createElement("input");
  colorField.type = "color";
  colorField.value = section.color;
  colorField.className = "category-settings-color";

  const saveBtn = document.createElement("button");
  saveBtn.className = "trip-icon-btn";
  saveBtn.textContent = "✓";
  saveBtn.setAttribute("aria-label", "Speichern");
  saveBtn.addEventListener("click", async () => {
    if (!nameField.value.trim()) return;
    saveBtn.disabled = true;
    await renameSection(section.id, nameField.value, colorField.value);
  });

  const delBtn = document.createElement("button");
  delBtn.className = "trip-icon-btn";
  delBtn.textContent = "✕";
  delBtn.setAttribute("aria-label", "Löschen");
  delBtn.addEventListener("click", async () => {
    if (!window.confirm(`Abschnitt "${section.label}" löschen? Orte darin werden zu "Ohne Abschnitt".`)) return;
    delBtn.disabled = true;
    await removeSection(section.id);
  });

  li.append(handle, dot, nameField, colorField, saveBtn, delBtn);
  return li;
}

// Rendert die Abschnittsverwaltung (Liste + "Neu anlegen"-Formular) für den
// gegebenen Urlaub in `container` -- aufgerufen aus plan.js' render(), immer
// wenn das "Abschnitte verwalten"-Panel offen ist (kein eigenes subscribe()
// nötig, plan.js ruft bei jedem eigenen Render ohnehin neu auf).
export function renderSectionsSettings(container, tripId) {
  container.innerHTML = "";

  if (!sectionsSynced) {
    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = "Abschnitte sind noch nicht verfügbar – dazu muss die Apps-Script-Bereitstellung (Code.gs) neu ausgerollt werden (siehe README).";
    container.appendChild(hint);
    return;
  }

  const list = document.createElement("ul");
  list.className = "trips-list category-settings-list";
  getSectionsForTrip(tripId).forEach((section) => list.appendChild(renderSectionsSettingsRow(section)));
  container.appendChild(list);

  const addRow = document.createElement("div");
  addRow.className = "category-settings-add";

  const newName = document.createElement("input");
  newName.type = "text";
  newName.placeholder = "Neuer Abschnitt";

  const newColor = document.createElement("input");
  newColor.type = "color";
  newColor.value = "#3a6fb0";
  newColor.className = "category-settings-color";

  const addBtn = document.createElement("button");
  addBtn.className = "btn btn-primary";
  addBtn.textContent = "+ Hinzufügen";
  addBtn.addEventListener("click", async () => {
    if (!newName.value.trim()) return;
    addBtn.disabled = true;
    await addSection(tripId, newName.value, newColor.value);
  });

  addRow.append(newName, newColor, addBtn);
  container.appendChild(addRow);
}
