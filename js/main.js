// Camper Touren – App-Einstieg. Orchestriert Trip-Auswahl (trips.js) und die
// drei Bereiche Inspire (inspire.js) / Plan (plan.js) / Route (route.js) für
// den jeweils gewählten Urlaub, plus Einstellungen (Apps-Script-URL, Farbschema).

import { registerServiceWorker } from "./sw-register.js";
import { getTrips, getPlaces, wasLastLoadOffline } from "./api.js";
import { getScriptUrl, setScriptUrl, getGeminiKey, setGeminiKey } from "./settings.js";
import { getColorTheme, setColorTheme, applyColorTheme, THEMES } from "./theme.js";
import { getHeaderTheme, setHeaderTheme, applyHeaderTheme, HEADER_THEMES } from "./header-theme.js";
import { getState, subscribe, setTrips, setPlaces } from "./state.js";
import { initTripBar, openNewTripForm, initTripsSettings } from "./trips.js";
import { initPlan } from "./plan.js";
import { initRoute } from "./route.js";
import { initInspire, refreshInspireKeyHint } from "./inspire.js";
import { initPullToRefresh } from "./pull-to-refresh.js";
import { renderCategoriesSettings, loadCategories } from "./categories.js";
import { friendlyError } from "./errors.js";
import { LATEST_CHANGE, isChangelogDismissed, dismissChangelog } from "./changelog.js";

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

// Zeigt CACHE_VERSION aus service-worker.js an (frisch vom Netz geladen,
// nicht aus dem HTTP-Cache) – so lässt sich erkennen, ob das Gerät noch auf
// einem alten App-Shell-Stand hängt.
async function initVersionFooter() {
  const el = document.getElementById("app-version");
  try {
    const res = await fetch("./service-worker.js", { cache: "no-store" });
    const text = await res.text();
    const match = text.match(/CACHE_VERSION\s*=\s*"([^"]+)"/);
    el.textContent = match ? `Version: ${match[1]}` : "";
  } catch {
    el.textContent = "";
  }
}

function initChangelogBanner() {
  const banner = document.getElementById("changelog-banner");
  const text = document.getElementById("changelog-banner-text");
  text.textContent = LATEST_CHANGE.text;
  banner.classList.toggle("hidden", isChangelogDismissed());
  document.getElementById("changelog-banner-close").addEventListener("click", () => {
    dismissChangelog();
    banner.classList.add("hidden");
  });
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
    await loadCategories();
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
  const headerThemeSelect = document.getElementById("header-theme-select");
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

  HEADER_THEMES.forEach((theme) => {
    const opt = document.createElement("option");
    opt.value = theme.id;
    opt.textContent = theme.label;
    headerThemeSelect.appendChild(opt);
  });
  headerThemeSelect.value = getHeaderTheme();
  headerThemeSelect.addEventListener("change", () => setHeaderTheme(headerThemeSelect.value));

  document.getElementById("save-settings-btn").addEventListener("click", () => {
    setScriptUrl(urlInput.value);
    setGeminiKey(geminiInput.value);
    refreshInspireKeyHint();
    status.textContent = "Gespeichert.";
    loadTrips();
  });

  initTripsSettings();
  const categoriesContainer = document.getElementById("settings-categories-container");
  subscribe(() => renderCategoriesSettings(categoriesContainer));
  renderCategoriesSettings(categoriesContainer);
}

function init() {
  applyColorTheme(getColorTheme());
  applyHeaderTheme(getHeaderTheme());
  initNav();
  initOfflineBanner();
  initChangelogBanner();
  initVersionFooter();
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
