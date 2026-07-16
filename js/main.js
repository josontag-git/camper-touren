// Camper Touren – App-Einstieg
// Milestone 3: Trip-Übersicht mit Sheets-CRUD (anlegen/bearbeiten/löschen).
// Places, Maps, Drag&Drop folgen in späteren Milestones.

import { registerServiceWorker } from "./sw-register.js";
import { login, logout, onAuthChange, isSignedIn, getUser } from "./auth.js";
import { getTrips, createTrip, updateTrip, deleteTrip } from "./sheets.js";

let trips = [];
let editingTripId = null; // null = nichts wird bearbeitet, "new" = neuer Urlaub, sonst trip.id

function initNav() {
  const navButtons = document.querySelectorAll(".nav-item");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      navButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      // Milestone 5+: hier Views wechseln (Trips / Karte / Einstellungen)
    });
  });
}

function initOfflineBanner() {
  const banner = document.getElementById("offline-banner");
  const update = () => banner.classList.toggle("hidden", navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function setEmptyStateText(text) {
  document.getElementById("empty-state-text").textContent = text;
}

function formatDateRange(trip) {
  if (trip.startDate && trip.endDate) return `${trip.startDate} – ${trip.endDate}`;
  return trip.startDate || trip.endDate || "Kein Datum";
}

function createTripViewRow(trip) {
  const li = document.createElement("li");
  li.className = "trip-item";

  const info = document.createElement("div");
  info.className = "trip-info";
  const title = document.createElement("div");
  title.className = "trip-title";
  title.textContent = trip.name || "(ohne Namen)";
  const meta = document.createElement("div");
  meta.className = "trip-meta";
  meta.textContent = trip.note ? `${formatDateRange(trip)} · ${trip.note}` : formatDateRange(trip);
  info.append(title, meta);

  const editBtn = document.createElement("button");
  editBtn.className = "trip-icon-btn";
  editBtn.textContent = "✎";
  editBtn.setAttribute("aria-label", "Bearbeiten");
  editBtn.addEventListener("click", () => {
    editingTripId = trip.id;
    renderTrips();
  });

  const delBtn = document.createElement("button");
  delBtn.className = "trip-icon-btn";
  delBtn.textContent = "✕";
  delBtn.setAttribute("aria-label", "Löschen");
  delBtn.addEventListener("click", () => onDeleteTrip(trip));

  li.append(info, editBtn, delBtn);
  return li;
}

function createTripFormRow(trip) {
  const isNew = !trip;
  const li = document.createElement("li");
  li.className = "trip-item trip-item-editing";

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

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-ghost-dark";
  cancelBtn.textContent = "Abbrechen";
  cancelBtn.addEventListener("click", () => {
    editingTripId = null;
    renderTrips();
  });

  actions.append(saveBtn, cancelBtn);
  li.append(fieldsWrap, actions);
  if (isNew) nameField.focus();
  return li;
}

async function onSaveTrip(existingTrip, fields, saveBtn) {
  if (!fields.name) {
    nameRequiredHint();
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
      trips = trips.map((t) => (t.id === record.id ? record : t));
    } else {
      await createTrip(record);
      trips = [...trips, record];
    }
    editingTripId = null;
    renderTrips();
  } catch (err) {
    saveBtn.disabled = false;
    saveBtn.textContent = "Speichern";
    setEmptyStateText(`Fehler beim Speichern: ${err.message}`);
    console.error(err);
  }
}

function nameRequiredHint() {
  setEmptyStateText("Bitte einen Namen für den Urlaub eingeben.");
  document.getElementById("empty-state").classList.remove("hidden");
  setTimeout(() => document.getElementById("empty-state").classList.add("hidden"), 2000);
}

async function onDeleteTrip(trip) {
  if (!window.confirm(`"${trip.name || "Urlaub"}" wirklich löschen?`)) return;
  try {
    await deleteTrip(trip.id);
    trips = trips.filter((t) => t.id !== trip.id);
    renderTrips();
  } catch (err) {
    setEmptyStateText(`Fehler beim Löschen: ${err.message}`);
    console.error(err);
  }
}

function renderTrips() {
  const list = document.getElementById("trips-list");
  list.innerHTML = "";

  trips
    .slice()
    .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""))
    .forEach((trip) => {
      list.appendChild(trip.id === editingTripId ? createTripFormRow(trip) : createTripViewRow(trip));
    });

  if (editingTripId === "new") {
    list.appendChild(createTripFormRow(null));
  }

  document.getElementById("empty-state").classList.toggle("hidden", trips.length > 0 || editingTripId === "new");
  if (trips.length === 0 && editingTripId !== "new") {
    setEmptyStateText("Noch keine Urlaube angelegt – leg deinen ersten Urlaub an!");
  }
}

async function loadAndRenderTrips() {
  const trigger = document.getElementById("trips-view");
  trigger.classList.remove("hidden");
  setEmptyStateText("Lade Urlaube …");
  document.getElementById("empty-state").classList.remove("hidden");
  try {
    trips = await getTrips();
    renderTrips();
  } catch (err) {
    setEmptyStateText(`Fehler beim Laden der Urlaube: ${err.message}`);
    console.error(err);
  }
}

function initTripsUI() {
  document.getElementById("add-trip-btn").addEventListener("click", () => {
    editingTripId = "new";
    renderTrips();
  });
}

function renderAuthState({ user, isSignedIn: signedIn }) {
  const loginBtn = document.getElementById("login-btn");
  const userChip = document.getElementById("user-chip");
  const userEmail = document.getElementById("user-email");

  loginBtn.classList.toggle("hidden", signedIn);
  userChip.classList.toggle("hidden", !signedIn);

  if (signedIn && user) {
    userEmail.textContent = user.email || "Angemeldet";
    loadAndRenderTrips();
  } else {
    document.getElementById("trips-view").classList.add("hidden");
    setEmptyStateText("Bitte zuerst mit Google anmelden.");
  }
}

function initAuthUI() {
  onAuthChange(renderAuthState);
  renderAuthState({ user: getUser(), isSignedIn: isSignedIn() });

  document.getElementById("login-btn").addEventListener("click", async () => {
    try {
      await login();
    } catch (err) {
      setEmptyStateText(`Login fehlgeschlagen: ${err.message}`);
      console.error(err);
    }
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    logout();
  });
}

function init() {
  initNav();
  initOfflineBanner();
  initTripsUI();
  initAuthUI();
  registerServiceWorker();
}

document.addEventListener("DOMContentLoaded", init);
