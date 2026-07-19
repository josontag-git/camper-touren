// Trip-Leiste (Auswahl/Anlegen/Bearbeiten/Löschen des aktuellen Urlaubs).

import { createTrip, updateTrip, deleteTrip, deletePlace, getPlaces } from "./api.js";
import { getState, subscribe, setTrips, setPlaces, setCurrentTripId } from "./state.js";
import { friendlyError } from "./errors.js";
import { attachDragHandle } from "./drag-reorder.js";

const NEW_TRIP_VALUE = "__new__";

let onStatus = () => {};
let editingTrip = undefined; // undefined = Form geschlossen, null = neuer Urlaub, sonst Trip-Objekt

function formatDateRange(trip) {
  if (trip.startDate && trip.endDate) return `${trip.startDate} – ${trip.endDate}`;
  return trip.startDate || trip.endDate || "Kein Datum";
}

// Sortierung nach "order" (manuell per Drag&Drop gesetzt); Startdatum bleibt
// Tie-Breaker, solange noch nicht manuell sortiert wurde (order dann bei
// allen 0/gleich, stabile Sortierung würde sonst die Sheet-Reihenfolge zeigen).
function sortedTrips(trips) {
  return trips.slice().sort((a, b) =>
    Number(a.order || 0) - Number(b.order || 0) || (a.startDate || "").localeCompare(b.startDate || "")
  );
}

function renderPicker() {
  const { trips, currentTripId, currentTrip } = getState();
  const picker = document.getElementById("trip-picker");
  picker.innerHTML = "";

  sortedTrips(trips).forEach((trip) => {
      const opt = document.createElement("option");
      opt.value = trip.id;
      opt.textContent = trip.name || "(ohne Namen)";
      picker.appendChild(opt);
    });

  const newOpt = document.createElement("option");
  newOpt.value = NEW_TRIP_VALUE;
  newOpt.textContent = "+ Neuer Urlaub…";
  picker.appendChild(newOpt);

  picker.value = currentTripId || (trips[0]?.id ?? NEW_TRIP_VALUE);

  document.getElementById("header-trip-name").textContent = currentTrip?.name || "Let’s Camp";
  document.getElementById("edit-trip-btn").disabled = !currentTripId;
}

function renderForm() {
  const container = document.getElementById("trip-form-view");
  container.innerHTML = "";
  container.classList.toggle("hidden", editingTrip === undefined);
  if (editingTrip === undefined) return;

  const trip = editingTrip;
  const wrap = document.createElement("div");
  wrap.className = "trip-item trip-item-editing";

  const nameField = document.createElement("input");
  nameField.type = "text";
  nameField.placeholder = "Name des Urlaubs";
  nameField.value = trip?.name || "";

  const startField = document.createElement("input");
  startField.type = "date";
  startField.value = trip?.startDate || "";

  const endField = document.createElement("input");
  endField.type = "date";
  endField.value = trip?.endDate || "";

  const noteField = document.createElement("input");
  noteField.type = "text";
  noteField.placeholder = "Notiz";
  noteField.value = trip?.note || "";

  const fieldsWrap = document.createElement("div");
  fieldsWrap.className = "trip-edit-fields";
  fieldsWrap.append(nameField, startField, endField, noteField);

  const actions = document.createElement("div");
  actions.className = "trip-edit-actions";

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "Speichern";
  saveBtn.addEventListener("click", () => onSaveTrip(trip, {
    name: nameField.value.trim(),
    startDate: startField.value,
    endDate: endField.value,
    note: noteField.value.trim(),
  }, saveBtn));

  actions.append(saveBtn);

  const { trips } = getState();
  if (trips.length > 0) {
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-ghost-dark";
    cancelBtn.textContent = "Abbrechen";
    cancelBtn.addEventListener("click", () => {
      editingTrip = undefined;
      renderForm();
      renderPicker();
    });
    actions.append(cancelBtn);
  }

  wrap.append(fieldsWrap, actions);
  container.appendChild(wrap);
  nameField.focus();
}

async function onSaveTrip(existingTrip, fields, saveBtn) {
  if (!fields.name) {
    onStatus("Bitte einen Namen für den Urlaub eingeben.");
    return;
  }
  saveBtn.disabled = true;
  saveBtn.textContent = "Speichert …";
  const now = new Date().toISOString();
  const { trips } = getState();
  const record = {
    id: existingTrip?.id || crypto.randomUUID(),
    order: existingTrip?.order ?? trips.length,
    ...fields,
    createdAt: existingTrip?.createdAt || now,
    updatedAt: now,
  };

  try {
    if (existingTrip) {
      await updateTrip(record);
    } else {
      await createTrip(record);
    }
    const nextTrips = existingTrip
      ? trips.map((t) => (t.id === record.id ? record : t))
      : [...trips, record];
    editingTrip = undefined;
    setTrips(nextTrips);
    setCurrentTripId(record.id);
    renderForm();
  } catch (err) {
    saveBtn.disabled = false;
    saveBtn.textContent = "Speichern";
    onStatus(`Fehler beim Speichern: ${friendlyError(err)}`);
    console.error(err);
  }
}

async function deleteTripCascade(trip, tripPlaces) {
  // Nacheinander statt parallel: deleteRowById() sucht die Zeile per
  // Live-Scan und verschiebt beim Löschen alle Folgezeilen nach oben –
  // gleichzeitige Requests könnten sich dadurch gegenseitig die falsche
  // Zeile löschen lassen (unabhängig beobachtet bei parallelen Upserts,
  // gleiche Ursache: kein Locking in Code.gs).
  for (const p of tripPlaces) await deletePlace(p.id);
  await deleteTrip(trip.id);
  const { trips, currentTripId } = getState();
  if (currentTripId === trip.id) setPlaces([]);
  setTrips(trips.filter((t) => t.id !== trip.id));
}

export function initTripBar(statusCallback) {
  onStatus = statusCallback;

  document.getElementById("trip-picker").addEventListener("change", (e) => {
    if (e.target.value === NEW_TRIP_VALUE) {
      editingTrip = null;
      renderForm();
    } else {
      setCurrentTripId(e.target.value);
    }
  });

  document.getElementById("edit-trip-btn").addEventListener("click", () => {
    const { currentTrip } = getState();
    if (!currentTrip) return;
    editingTrip = currentTrip;
    renderForm();
  });

  document.getElementById("add-trip-btn").addEventListener("click", openNewTripForm);

  subscribe(renderPicker);
  renderPicker();
}

export function openNewTripForm() {
  editingTrip = null;
  renderForm();
}

// --- Urlaubsverwaltung in den Einstellungen (bearbeiten/löschen mit
// zweistufiger Bestätigung statt eines einzelnen Browser-Dialogs) ---

let settingsEditingId = null;
let settingsConfirmDeleteId = null;

function renderSettingsTripRow(trip) {
  const li = document.createElement("li");
  li.className = "trip-item";
  li.dataset.id = trip.id;

  const info = document.createElement("div");
  info.className = "trip-info";
  const title = document.createElement("div");
  title.className = "trip-title";
  title.textContent = trip.name || "(ohne Namen)";
  const meta = document.createElement("div");
  meta.className = "trip-meta";
  meta.textContent = formatDateRange(trip);
  info.append(title, meta);

  if (settingsConfirmDeleteId === trip.id) {
    const warn = document.createElement("span");
    warn.className = "muted";
    warn.textContent = "Wirklich löschen (inkl. aller Orte)?";

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "btn btn-primary";
    confirmBtn.textContent = "Ja, löschen";
    confirmBtn.addEventListener("click", async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Löscht …";
      try {
        const tripPlaces = await getPlaces(trip.id);
        await deleteTripCascade(trip, tripPlaces);
        settingsConfirmDeleteId = null;
        renderSettingsTrips();
      } catch (err) {
        onStatus(`Fehler beim Löschen: ${friendlyError(err)}`);
        console.error(err);
      }
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-ghost-dark";
    cancelBtn.textContent = "Abbrechen";
    cancelBtn.addEventListener("click", () => { settingsConfirmDeleteId = null; renderSettingsTrips(); });

    li.append(info, warn, confirmBtn, cancelBtn);
    return li;
  }

  const editBtn = document.createElement("button");
  editBtn.className = "trip-icon-btn";
  editBtn.textContent = "✎";
  editBtn.setAttribute("aria-label", "Bearbeiten");
  editBtn.addEventListener("click", () => { settingsEditingId = trip.id; renderSettingsTrips(); });

  const delBtn = document.createElement("button");
  delBtn.className = "trip-icon-btn";
  delBtn.textContent = "✕";
  delBtn.setAttribute("aria-label", "Löschen");
  delBtn.addEventListener("click", () => { settingsConfirmDeleteId = trip.id; renderSettingsTrips(); });

  const handle = document.createElement("span");
  handle.className = "place-drag-handle";
  handle.textContent = "⠿";
  handle.setAttribute("role", "button");
  handle.setAttribute("aria-label", "Ziehen zum Sortieren");
  attachDragHandle(handle, li, (draggedLi) => {
    const listEl = draggedLi.parentElement;
    return [...listEl.querySelectorAll(".trip-item")].filter((el) => el !== draggedLi);
  }, onReorderTrips);

  li.append(handle, info, editBtn, delBtn);
  return li;
}

function renderSettingsTripForm(trip) {
  const li = document.createElement("li");
  li.className = "trip-item trip-item-editing";

  const nameField = document.createElement("input");
  nameField.type = "text";
  nameField.placeholder = "Name des Urlaubs";
  nameField.value = trip.name || "";

  const startField = document.createElement("input");
  startField.type = "date";
  startField.value = trip.startDate || "";

  const endField = document.createElement("input");
  endField.type = "date";
  endField.value = trip.endDate || "";

  const noteField = document.createElement("input");
  noteField.type = "text";
  noteField.placeholder = "Notiz";
  noteField.value = trip.note || "";

  const fieldsWrap = document.createElement("div");
  fieldsWrap.className = "trip-edit-fields";
  fieldsWrap.append(nameField, startField, endField, noteField);

  const actions = document.createElement("div");
  actions.className = "trip-edit-actions";

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "Speichern";
  saveBtn.addEventListener("click", async () => {
    if (!nameField.value.trim()) { onStatus("Bitte einen Namen für den Urlaub eingeben."); return; }
    saveBtn.disabled = true;
    saveBtn.textContent = "Speichert …";
    const record = {
      ...trip,
      name: nameField.value.trim(),
      startDate: startField.value,
      endDate: endField.value,
      note: noteField.value.trim(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await updateTrip(record);
      const { trips } = getState();
      setTrips(trips.map((t) => (t.id === record.id ? record : t)));
      settingsEditingId = null;
      renderSettingsTrips();
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Speichern";
      onStatus(`Fehler beim Speichern: ${friendlyError(err)}`);
      console.error(err);
    }
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-ghost-dark";
  cancelBtn.textContent = "Abbrechen";
  cancelBtn.addEventListener("click", () => { settingsEditingId = null; renderSettingsTrips(); });

  actions.append(saveBtn, cancelBtn);
  li.append(fieldsWrap, actions);
  return li;
}

async function onReorderTrips(sourceId, targetId) {
  const ordered = sortedTrips(getState().trips);
  const fromIndex = ordered.findIndex((t) => t.id === sourceId);
  const toIndex = ordered.findIndex((t) => t.id === targetId);
  if (fromIndex === -1 || toIndex === -1) return;

  const [moved] = ordered.splice(fromIndex, 1);
  ordered.splice(toIndex, 0, moved);
  const reindexed = ordered.map((t, i) => ({ ...t, order: i }));
  setTrips(reindexed);
  // Nacheinander statt parallel: Apps Script hat kein Locking auf
  // getLastRow()/setValues() in upsertRow(), gleichzeitige Requests auf
  // dasselbe Sheet können sich gegenseitig überschreiben.
  try {
    for (const t of reindexed) await updateTrip(t);
  } catch (err) {
    onStatus(`Fehler beim Sortieren: ${friendlyError(err)}`);
    console.error(err);
  }
}

function renderSettingsTrips() {
  const list = document.getElementById("settings-trips-list");
  if (!list) return;
  list.innerHTML = "";
  const { trips } = getState();
  if (trips.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Noch keine Urlaube angelegt.";
    list.appendChild(empty);
    return;
  }
  sortedTrips(trips).forEach((trip) => {
    list.appendChild(trip.id === settingsEditingId ? renderSettingsTripForm(trip) : renderSettingsTripRow(trip));
  });
}

export function initTripsSettings() {
  subscribe(renderSettingsTrips);
  renderSettingsTrips();
}

export function tripBarLabel(trip) {
  return formatDateRange(trip);
}
