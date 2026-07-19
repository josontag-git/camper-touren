// Let’s Camp – App-Einstieg. Orchestriert Trip-Auswahl (trips.js) und die
// drei Bereiche Inspire (inspire.js) / Plan (plan.js) / Route (route.js) für
// den jeweils gewählten Urlaub, plus Einstellungen (Apps-Script-URL, Farbschema).

import { registerServiceWorker } from "./sw-register.js";
import { getTrips, getPlaces, wasLastLoadOffline } from "./api.js";
import {
  getScriptUrl, setScriptUrl, getGeminiKey, setGeminiKey,
  getPark4nightRequiredAmenities, setPark4nightRequiredAmenities,
  getPark4nightPlaceTypes, setPark4nightPlaceTypes,
} from "./settings.js";
import { getColorTheme, setColorTheme, applyColorTheme, THEMES } from "./theme.js";
import { getHeaderTheme, setHeaderTheme, applyHeaderTheme, HEADER_THEMES } from "./header-theme.js";
import { getState, subscribe, setTrips, setPlaces } from "./state.js";
import { initTripBar, openNewTripForm, initTripsSettings } from "./trips.js";
import { initPlan } from "./plan.js";
import { initRoute } from "./route.js";
import { initInspire, refreshInspireKeyHint } from "./inspire.js";
import { initPullToRefresh } from "./pull-to-refresh.js";
import { renderCategoriesSettings, loadCategories } from "./categories.js";
import { ADMIN_AMENITY_OPTIONS, ADMIN_PLACE_TYPE_OPTIONS } from "./park4night.js";
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

// Meldet den Service Worker ab und löscht alle Caches, damit sich das Gerät
// beim nächsten Laden garantiert den aktuellen App-Shell-Stand vom Netz holt
// (statt evtl. an einer alten, hartnäckig gecachten Version hängen zu bleiben).
async function clearAppCache() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } finally {
    location.reload();
  }
}

// Checkbox-Liste im Admin-Bereich für die park4night-Ausstattungsfilter
// (js/park4night.js searchPark4nightNear()) -- speichert bei jedem Toggle
// sofort, kein separater Speichern-Button (gleiches Verhalten wie die
// Farbschema-/Header-Selects daneben).
function initPark4nightAdminUI() {
  const typeContainer = document.getElementById("park4night-type-filters");
  const types = new Set(getPark4nightPlaceTypes());

  ADMIN_PLACE_TYPE_OPTIONS.forEach(({ code, label }) => {
    const row = document.createElement("label");
    row.className = "admin-checkbox-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = types.has(code);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) types.add(code);
      else types.delete(code);
      setPark4nightPlaceTypes([...types]);
    });

    row.append(checkbox, document.createTextNode(label));
    typeContainer.appendChild(row);
  });

  const amenityContainer = document.getElementById("park4night-amenity-filters");
  const required = new Set(getPark4nightRequiredAmenities());

  ADMIN_AMENITY_OPTIONS.forEach(({ key, label }) => {
    const row = document.createElement("label");
    row.className = "admin-checkbox-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = required.has(key);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) required.add(key);
      else required.delete(key);
      setPark4nightRequiredAmenities([...required]);
    });

    row.append(checkbox, document.createTextNode(label));
    amenityContainer.appendChild(row);
  });
}

// Ein-/Ausklappen der Admin-Karten (Allgemein/Urlaube/Kategorien/park4night)
// -- Zustand pro Karte in localStorage, Default aufgeklappt. Rein visuelles
// CSS-Klassen-Toggle, die dynamischen Listen (Touren/Kategorien) rendern
// unverändert in ihre Container, auch wenn die Karte gerade eingeklappt ist.
function initCollapsibleSettings() {
  document.querySelectorAll(".settings-view[data-collapsible-id]").forEach((card) => {
    const key = `campingAppAdminCollapsed_${card.dataset.collapsibleId}`;
    card.classList.toggle("is-collapsed", localStorage.getItem(key) === "1");
    card.querySelector(".settings-view-toggle").addEventListener("click", () => {
      const collapsed = !card.classList.contains("is-collapsed");
      card.classList.toggle("is-collapsed", collapsed);
      localStorage.setItem(key, collapsed ? "1" : "0");
    });
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

  document.getElementById("clear-cache-btn").addEventListener("click", clearAppCache);

  initTripsSettings();
  const categoriesContainer = document.getElementById("settings-categories-container");
  subscribe(() => renderCategoriesSettings(categoriesContainer));
  renderCategoriesSettings(categoriesContainer);

  initPark4nightAdminUI();
}

function init() {
  applyColorTheme(getColorTheme());
  applyHeaderTheme(getHeaderTheme());
  initNav();
  initOfflineBanner();
  initChangelogBanner();
  initVersionFooter();
  initSettingsUI();
  initCollapsibleSettings();
  initTripBar(setStatus);
  initPlan(setStatus);
  initRoute(setStatus);
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
