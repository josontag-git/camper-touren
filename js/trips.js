// Trip-Leiste (Auswahl/Anlegen/Bearbeiten/Löschen des aktuellen Urlaubs).

import { createTrip, updateTrip, deleteTrip } from "./api.js";
import { getState, subscribe, setTrips, setCurrentTripId } from "./state.js";

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

async function onDeleteTrip() {
  const { currentTrip } = getState();
  if (!currentTrip) return;
  if (!window.confirm(`"${currentTrip.name || "Urlaub"}" wirklich löschen? Zugehörige Orte bleiben im Sheet erhalten.`)) return;
  try {
    await deleteTrip(currentTrip.id);
    const { trips } = getState();
    setTrips(trips.filter((t) => t.id !== currentTrip.id));
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
  });
  renderPicker();
}

export function openNewTripForm() {
  editingTrip = null;
  renderForm();
}

export function tripBarLabel(trip) {
  return formatDateRange(trip);
}
