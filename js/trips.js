// Trip-Leiste (Auswahl/Anlegen/Bearbeiten/Löschen des aktuellen Urlaubs).

import { createTrip, updateTrip, deleteTrip, deletePlace, getPlaces } from "./api.js";
import { getState, subscribe, setTrips, setPlaces, setCurrentTripId } from "./state.js";
import { photoUrl } from "./places-search.js";

const NEW_TRIP_VALUE = "__new__";

let onStatus = () => {};
let editingTrip = undefined; // undefined = Form geschlossen, null = neuer Urlaub, sonst Trip-Objekt

function formatDateRange(trip) {
  if (trip.startDate && trip.endDate) return `${trip.startDate} – ${trip.endDate}`;
  return trip.startDate || trip.endDate || "Kein Datum";
}

function renderPicker() {
  const { trips, currentTripId } = getState();
  const picker = document.getElementById("trip-picker");
  picker.innerHTML = "";

  trips
    .slice()
    .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""))
    .forEach((trip) => {
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

  const hasCurrent = !!currentTripId;
  document.getElementById("edit-trip-btn").disabled = !hasCurrent;
  document.getElementById("delete-trip-btn").disabled = !hasCurrent;
}

// Headerbild aus dem ersten gespeicherten Ort des aktuellen Urlaubs, der ein
// Foto hat (per `order` sortiert) – ohne Treffer bleibt der Header wie bisher
// eine reine Farbfläche, kein zusätzlicher Bild-Beschaffungsaufwand nötig.
function updateHeaderPhoto() {
  const header = document.querySelector(".app-header");
  if (!header) return;
  const { places } = getState();
  const withPhoto = places
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .find((p) => p.photoRef);

  if (withPhoto) {
    header.style.backgroundImage = `url("${photoUrl(withPhoto.photoRef, 800)}")`;
    header.classList.add("app-header--photo");
  } else {
    header.style.backgroundImage = "";
    header.classList.remove("app-header--photo");
  }
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
  const record = {
    id: existingTrip?.id || crypto.randomUUID(),
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
    const { trips } = getState();
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
    onStatus(`Fehler beim Speichern: ${err.message}`);
    console.error(err);
  }
}

async function deleteTripCascade(trip, tripPlaces) {
  await Promise.all(tripPlaces.map((p) => deletePlace(p.id)));
  await deleteTrip(trip.id);
  const { trips, currentTripId } = getState();
  if (currentTripId === trip.id) setPlaces([]);
  setTrips(trips.filter((t) => t.id !== trip.id));
}

async function onDeleteTrip() {
  const { currentTrip, places } = getState();
  if (!currentTrip) return;
  const placeCount = places.length;
  const warning = placeCount > 0 ? ` (inkl. ${placeCount} Ort${placeCount === 1 ? "" : "e"} im Plan)` : "";
  if (!window.confirm(`"${currentTrip.name || "Urlaub"}"${warning} wirklich löschen?`)) return;
  try {
    await deleteTripCascade(currentTrip, places);
  } catch (err) {
    onStatus(`Fehler beim Löschen: ${err.message}`);
    console.error(err);
  }
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

  document.getElementById("delete-trip-btn").addEventListener("click", onDeleteTrip);

  subscribe(() => {
    renderPicker();
    updateHeaderPhoto();
  });
  renderPicker();
  updateHeaderPhoto();
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
        onStatus(`Fehler beim Löschen: ${err.message}`);
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

  li.append(info, editBtn, delBtn);
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
      onStatus(`Fehler beim Speichern: ${err.message}`);
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
  trips
    .slice()
    .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""))
    .forEach((trip) => {
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
