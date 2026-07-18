// Camper Touren – App-Einstieg. Orchestriert Trip-Auswahl (trips.js) und die
// drei Bereiche Inspire (inspire.js) / Plan (plan.js) / Route (route.js) für
// den jeweils gewählten Urlaub, plus Einstellungen (Apps-Script-URL, Farbschema).

import { registerServiceWorker } from "./sw-register.js";
import { getTrips, getPlaces, wasLastLoadOffline } from "./api.js";
import { getScriptUrl, setScriptUrl, getGeminiKey, setGeminiKey } from "./settings.js";
import { getColorTheme, setColorTheme, applyColorTheme, THEMES } from "./theme.js";
import { getState, subscribe, setTrips, setPlaces } from "./state.js";
import { initTripBar, openNewTripForm, initTripsSettings } from "./trips.js";
import { initPlan } from "./plan.js";
import { initRoute } from "./route.js";
import { initInspire, refreshInspireKeyHint } from "./inspire.js";
import { initPullToRefresh } from "./pull-to-refresh.js";
import { renderCategoriesSettings } from "./categories.js";
import { friendlyError } from "./errors.js";

const VIEWS = ["inspire-view", "plan-view", "route-view", "settings-view"];

function switchView(viewId) {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.view === viewId);
  });
  VIEWS.forEach((id) => document.getElementById(id).classList.toggle("hidden", id !== viewId));
}

function initNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
}

function initOfflineBanner() {
  const banner = document.getElementById("offline-banner");
  const update = () => banner.classList.toggle("hidden", navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function setStatus(text) {
  document.getElementById("status-message-text").textContent = text;
  document.getElementById("status-message").classList.toggle("hidden", !text);
}

async function loadPlacesForCurrentTrip() {
  const { currentTripId } = getState();
  if (!currentTripId) {
    setPlaces([]);
    return;
  }
  try {
    setPlaces(await getPlaces(currentTripId));
  } catch (err) {
    setStatus(`Fehler beim Laden der Orte: ${friendlyError(err)}`);
    console.error(err);
  }
}

async function loadTrips() {
  setStatus("Lade Urlaube …");
  try {
    const trips = await getTrips();
    setTrips(trips);
    setStatus(wasLastLoadOffline() ? "Offline – zeige zuletzt gespeicherten Stand." : "");
    if (trips.length === 0) openNewTripForm();
  } catch (err) {
    setStatus(friendlyError(err));
    console.error(err);
  }
}

async function refreshAll() {
  await loadTrips();
  await loadPlacesForCurrentTrip();
}

function initSettingsUI() {
  const urlInput = document.getElementById("script-url-input");
  const geminiInput = document.getElementById("gemini-key-input");
  const themeSelect = document.getElementById("color-theme-select");
  const status = document.getElementById("settings-status");

  urlInput.value = getScriptUrl();
  geminiInput.value = getGeminiKey();

  THEMES.forEach((theme) => {
    const opt = document.createElement("option");
    opt.value = theme.id;
    opt.textContent = theme.label;
    themeSelect.appendChild(opt);
  });
  themeSelect.value = getColorTheme();
  themeSelect.addEventListener("change", () => setColorTheme(themeSelect.value));

  document.getElementById("save-settings-btn").addEventListener("click", () => {
    setScriptUrl(urlInput.value);
    setGeminiKey(geminiInput.value);
    refreshInspireKeyHint();
    status.textContent = "Gespeichert.";
    loadTrips();
  });

  initTripsSettings();
  renderCategoriesSettings(document.getElementById("settings-categories-container"));
}

function init() {
  applyColorTheme(getColorTheme());
  initNav();
  initOfflineBanner();
  initSettingsUI();
  initTripBar(setStatus);
  initPlan(setStatus);
  initRoute();
  initInspire(setStatus);
  registerServiceWorker();
  initPullToRefresh(refreshAll);

  let lastTripId;
  subscribe((state) => {
    if (state.currentTripId !== lastTripId) {
      lastTripId = state.currentTripId;
      loadPlacesForCurrentTrip();
    }
  });

  if (!getScriptUrl()) {
    setStatus("Bitte zuerst die Apps-Script-URL unter Einstellungen eintragen.");
    switchView("settings-view");
    return;
  }
  loadTrips();
}

document.addEventListener("DOMContentLoaded", init);
