// Plan-Ansicht: Orte des aktuellen Urlaubs suchen (volle Google-Maps-Suche:
// Umkreis, Fotos, Bewertungen, Kartenansicht der Treffer)/manuell anlegen/
// bearbeiten/löschen/sortieren. Drei Ansichten wählbar: nach Kategorie
// geclustert (mit Filter-Chips und Drag&Drop), nach Datum gruppiert, oder
// nach aktueller Entfernung sortiert.

import { CONFIG } from "./config.js";
import { createPlace, updatePlace, deletePlace } from "./api.js";
import { getState, subscribe, setPlaces, toggleCategoryFilter, isCategoryVisible } from "./state.js";
import { getCategories, UNCATEGORIZED, categoryInfo, allCategoryIds, renderCategoryFilterChips, renderCategoryButtons } from "./categories.js";
import { loadMapsApi } from "./maps-loader.js";

const RADIUS_OPTIONS = [
  { value: "", label: "Umkreis: egal" },
  { value: "5", label: "5 km um mich" },
  { value: "10", label: "10 km um mich" },
  { value: "25", label: "25 km um mich" },
  { value: "50", label: "50 km um mich" },
  { value: "100", label: "100 km um mich" },
];

let onStatus = () => {};
let editingPlaceId = null; // Bearbeiten eines bestehenden Orts inline in der Liste
let dragSource = null; // { id, category }
let viewMode = "category"; // "category" | "date" | "distance"
let userPosition = null; // { lat, lng }, für viewMode "distance"

let addMode = null; // null | "search" | "manual"
let searchResults = [];
let expandedResultIndex = null;
let selectedCategoryByResult = {};
let resultsMap = null;
let resultsMarkers = [];

function sortedPlaces() {
  return getState().places.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function hasCoords(place) {
  return place.lat !== "" && place.lat != null && place.lng !== "" && place.lng != null && !Number.isNaN(Number(place.lat));
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function groupedByCategory() {
  const all = sortedPlaces();
  return [...getCategories(), UNCATEGORIZED].map((cat) => ({
    ...cat,
    places: all.filter((p) => (p.category || "") === cat.id),
  }));
}

function groupedByDate() {
  const all = sortedPlaces();
  const withDate = all.filter((p) => p.arrivalDate);
  const withoutDate = all.filter((p) => !p.arrivalDate);
  const dates = [...new Set(withDate.map((p) => p.arrivalDate))].sort();
  const groups = dates.map((date) => ({
    id: date,
    label: new Date(date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }),
    color: "#6b7278",
    places: withDate.filter((p) => p.arrivalDate === date),
  }));
  if (withoutDate.length) groups.push({ id: "__none__", label: "Ohne Datum", color: "#9199ab", places: withoutDate });
  return groups;
}

function formatMeta(place) {
  const parts = [];
  if (place.arrivalDate) parts.push(place.departureDate ? `${place.arrivalDate} – ${place.departureDate}` : place.arrivalDate);
  if (place.address) parts.push(place.address);
  return parts.join(" · ") || "Keine Details";
}

function createViewRow(place, metaOverride) {
  const li = document.createElement("li");
  li.className = "trip-item place-item";
  li.dataset.id = place.id;
  li.style.setProperty("--category-color", categoryInfo(place.category).color);

  const draggable = viewMode === "category";
  li.draggable = draggable;
  if (draggable) {
    li.addEventListener("dragstart", () => {
      dragSource = { id: place.id, category: place.category || "" };
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => { li.classList.remove("dragging"); dragSource = null; });
    li.addEventListener("dragover", (e) => {
      if (dragSource && dragSource.category === (place.category || "")) e.preventDefault();
    });
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      if (dragSource && dragSource.id !== place.id && dragSource.category === (place.category || "")) {
        onReorder(dragSource.id, place.id);
      }
    });
  }

  const info = document.createElement("div");
  info.className = "trip-info";
  const title = document.createElement("div");
  title.className = "trip-title";
  title.textContent = place.name || "(ohne Namen)";
  const meta = document.createElement("div");
  meta.className = "trip-meta";
  const baseMeta = metaOverride || formatMeta(place);
  meta.textContent = place.note ? `${baseMeta} · ${place.note}` : baseMeta;
  info.append(title, meta);

  const editBtn = document.createElement("button");
  editBtn.className = "trip-icon-btn";
  editBtn.textContent = "✎";
  editBtn.setAttribute("aria-label", "Bearbeiten");
  editBtn.addEventListener("click", () => { editingPlaceId = place.id; render(); });

  const delBtn = document.createElement("button");
  delBtn.className = "trip-icon-btn";
  delBtn.textContent = "✕";
  delBtn.setAttribute("aria-label", "Löschen");
  delBtn.addEventListener("click", () => onDelete(place));

  if (draggable) {
    const handle = document.createElement("span");
    handle.className = "place-drag-handle";
    handle.textContent = "☰";
    handle.setAttribute("aria-label", "Ziehen zum Sortieren");
    li.append(handle, info, editBtn, delBtn);
  } else {
    li.append(info, editBtn, delBtn);
  }
  return li;
}

function createFormRow(place) {
  const isNew = !place;
  const li = document.createElement("li");
  li.className = "trip-item trip-item-editing";

  const nameField = document.createElement("input");
  nameField.type = "text";
  nameField.placeholder = "Name des Orts";
  nameField.value = place?.name || "";

  const categoryField = document.createElement("select");
  const blankOpt = document.createElement("option");
  blankOpt.value = "";
  blankOpt.textContent = "Kategorie …";
  categoryField.appendChild(blankOpt);
  getCategories().forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.label;
    if (place?.category === cat.id) opt.selected = true;
    categoryField.appendChild(opt);
  });

  const arrivalField = document.createElement("input");
  arrivalField.type = "date";
  arrivalField.value = place?.arrivalDate || "";

  const departureField = document.createElement("input");
  departureField.type = "date";
  departureField.value = place?.departureDate || "";

  const addressField = document.createElement("input");
  addressField.type = "text";
  addressField.placeholder = "Adresse (optional)";
  addressField.value = place?.address || "";

  const latField = document.createElement("input");
  latField.type = "number";
  latField.step = "any";
  latField.placeholder = "Breitengrad (optional)";
  latField.value = place?.lat ?? "";

  const lngField = document.createElement("input");
  lngField.type = "number";
  lngField.step = "any";
  lngField.placeholder = "Längengrad (optional)";
  lngField.value = place?.lng ?? "";

  const noteField = document.createElement("input");
  noteField.type = "text";
  noteField.placeholder = "Notiz";
  noteField.value = place?.note || "";

  const fieldsWrap = document.createElement("div");
  fieldsWrap.className = "trip-edit-fields";
  fieldsWrap.append(nameField, categoryField, arrivalField, departureField, addressField, latField, lngField, noteField);

  const actions = document.createElement("div");
  actions.className = "trip-edit-actions";

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "Speichern";
  saveBtn.addEventListener("click", () => onSave(place, {
    name: nameField.value.trim(),
    category: categoryField.value,
    arrivalDate: arrivalField.value,
    departureDate: departureField.value,
    address: addressField.value.trim(),
    lat: latField.value,
    lng: lngField.value,
    note: noteField.value.trim(),
  }, saveBtn));

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-ghost-dark";
  cancelBtn.textContent = "Abbrechen";
  cancelBtn.addEventListener("click", () => {
    if (isNew) { addMode = null; } else { editingPlaceId = null; }
    render();
  });

  actions.append(saveBtn, cancelBtn);
  li.append(fieldsWrap, actions);
  if (isNew) nameField.focus();
  return li;
}

async function onSave(existing, fields, saveBtn) {
  if (!fields.name) {
    onStatus("Bitte einen Namen für den Ort eingeben.");
    return;
  }
  const { currentTripId, places } = getState();
  saveBtn.disabled = true;
  saveBtn.textContent = "Speichert …";
  const record = {
    id: existing?.id || crypto.randomUUID(),
    tripId: currentTripId,
    order: existing?.order ?? places.length,
    ...fields,
    placeId: existing?.placeId || "",
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  try {
    if (existing) {
      await updatePlace(record);
      setPlaces(places.map((p) => (p.id === record.id ? record : p)));
    } else {
      await createPlace(record);
      setPlaces([...places, record]);
    }
    editingPlaceId = null;
    addMode = null;
    render();
  } catch (err) {
    saveBtn.disabled = false;
    saveBtn.textContent = "Speichern";
    onStatus(`Fehler beim Speichern: ${err.message}`);
    console.error(err);
  }
}

async function onDelete(place) {
  if (!window.confirm(`"${place.name || "Ort"}" wirklich löschen?`)) return;
  try {
    await deletePlace(place.id);
    setPlaces(getState().places.filter((p) => p.id !== place.id));
  } catch (err) {
    onStatus(`Fehler beim Löschen: ${err.message}`);
    console.error(err);
  }
}

async function onReorder(sourceId, targetId) {
  const ordered = sortedPlaces();
  const fromIndex = ordered.findIndex((p) => p.id === sourceId);
  const toIndex = ordered.findIndex((p) => p.id === targetId);
  if (fromIndex === -1 || toIndex === -1) return;

  const [moved] = ordered.splice(fromIndex, 1);
  ordered.splice(toIndex, 0, moved);
  const reindexed = ordered.map((p, i) => ({ ...p, order: i }));
  setPlaces(reindexed);
  render();
  await Promise.all(reindexed.map((p) => updatePlace(p))).catch((err) => {
    onStatus(`Fehler beim Sortieren: ${err.message}`);
    console.error(err);
  });
}

let distanceAttempted = false;

function requestUserPosition() {
  onStatus("Ermittle deinen Standort …");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      onStatus("");
      render();
    },
    (err) => {
      onStatus(`Standort konnte nicht ermittelt werden: ${err.message}`);
      render();
    },
    { timeout: 8000 }
  );
}

function renderGroups(groups, list) {
  let visibleCount = 0;
  groups.forEach((group) => {
    const visiblePlaces = group.places.filter((p) => isCategoryVisible(p.category || ""));
    if (visiblePlaces.length === 0) return;
    visibleCount += visiblePlaces.length;

    const heading = document.createElement("li");
    heading.className = "place-group-heading";
    heading.style.setProperty("--category-color", group.color);
    heading.textContent = `${group.label} (${visiblePlaces.length})`;
    list.appendChild(heading);

    visiblePlaces.forEach((place) => {
      list.appendChild(place.id === editingPlaceId ? createFormRow(place) : createViewRow(place));
    });
  });
  return visibleCount;
}

function renderDistanceMode(list) {
  if (!userPosition) {
    if (!distanceAttempted) {
      distanceAttempted = true;
      requestUserPosition();
    }
    return 0;
  }
  const all = sortedPlaces().filter((p) => isCategoryVisible(p.category || ""));
  const withCoords = all.filter(hasCoords).map((p) => ({
    ...p,
    __distance: haversineKm(userPosition.lat, userPosition.lng, Number(p.lat), Number(p.lng)),
  })).sort((a, b) => a.__distance - b.__distance);
  const withoutCoords = all.filter((p) => !hasCoords(p));

  withCoords.forEach((place) => {
    const metaText = `${place.__distance.toFixed(1)} km entfernt`;
    list.appendChild(place.id === editingPlaceId ? createFormRow(place) : createViewRow(place, metaText));
  });

  if (withoutCoords.length) {
    const heading = document.createElement("li");
    heading.className = "place-group-heading";
    heading.style.setProperty("--category-color", "#9199ab");
    heading.textContent = `Ohne Koordinaten (${withoutCoords.length})`;
    list.appendChild(heading);
    withoutCoords.forEach((place) => {
      list.appendChild(place.id === editingPlaceId ? createFormRow(place) : createViewRow(place));
    });
  }

  return withCoords.length + withoutCoords.length;
}

// --- Google-Maps-Suche (Places Text Search, New) beim Ort-Hinzufügen ---

function photoUrl(name, maxWidthPx = 400) {
  return `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidthPx}&key=${CONFIG.GOOGLE_MAPS_API_KEY}`;
}

function starRating(rating) {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Standortbestimmung wird von diesem Browser nicht unterstützt."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("Standort konnte nicht ermittelt werden (Berechtigung erteilt?).")),
      { timeout: 8000 }
    );
  });
}

async function searchGooglePlaces(query, radiusKm) {
  if (!CONFIG.GOOGLE_MAPS_API_KEY || CONFIG.GOOGLE_MAPS_API_KEY === "REPLACE_ME") {
    throw new Error("Kein Google-Maps-API-Key in js/config.js hinterlegt.");
  }
  const body = { textQuery: query };
  if (radiusKm) {
    const pos = await getCurrentPosition();
    body.locationBias = { circle: { center: { latitude: pos.lat, longitude: pos.lng }, radius: Number(radiusKm) * 1000 } };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": CONFIG.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": [
        "places.id", "places.displayName", "places.formattedAddress", "places.location",
        "places.rating", "places.userRatingCount", "places.photos", "places.googleMapsUri",
      ].join(","),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Places-API-Fehler ${res.status}: ${errBody}`);
  }
  const data = await res.json();
  return data.places || [];
}

async function saveSearchResult(place, index, dates, saveBtn) {
  const { currentTripId, places } = getState();
  if (!currentTripId) {
    onStatus("Bitte zuerst einen Urlaub auswählen oder anlegen.");
    return;
  }
  saveBtn.disabled = true;
  saveBtn.textContent = "Speichert …";
  const record = {
    id: crypto.randomUUID(),
    tripId: currentTripId,
    order: places.length,
    name: place.displayName?.text || "",
    category: selectedCategoryByResult[index] || "",
    arrivalDate: dates.arrivalDate,
    departureDate: dates.departureDate,
    address: place.formattedAddress || "",
    lat: place.location?.latitude ?? "",
    lng: place.location?.longitude ?? "",
    note: "",
    placeId: place.id || "",
    createdAt: new Date().toISOString(),
  };

  try {
    await createPlace(record);
    setPlaces([...places, record]);
    addMode = null;
    onStatus(`"${record.name}" zum Plan hinzugefügt.`);
    render();
  } catch (err) {
    saveBtn.disabled = false;
    saveBtn.textContent = "In Plan speichern";
    onStatus(`Fehler beim Speichern: ${err.message}`);
    console.error(err);
  }
}

function buildResultDetailPanel(place, index) {
  const panel = document.createElement("div");
  panel.className = "inspire-add-panel";

  if (place.photos?.length) {
    const gallery = document.createElement("div");
    gallery.className = "inspire-photo-gallery";
    place.photos.slice(0, 8).forEach((p) => {
      const img = document.createElement("img");
      img.src = photoUrl(p.name);
      img.alt = place.displayName?.text || "";
      gallery.appendChild(img);
    });
    panel.appendChild(gallery);
  }

  if (place.rating || place.googleMapsUri) {
    const link = document.createElement("a");
    link.className = "btn btn-ghost-dark";
    link.target = "_blank";
    link.rel = "noopener";
    link.href = place.googleMapsUri || "#";
    link.textContent = place.rating
      ? `${starRating(place.rating)} ${place.rating} (${place.userRatingCount || 0}) auf Google Maps ↗`
      : "Auf Google Maps ansehen ↗";
    panel.appendChild(link);
  }

  const catLabel = document.createElement("div");
  catLabel.className = "muted";
  catLabel.textContent = "Kategorie:";
  panel.appendChild(catLabel);

  const catWrap = document.createElement("div");
  catWrap.className = "category-filters";
  renderCategoryButtons(catWrap, selectedCategoryByResult[index] || "", (catId) => {
    selectedCategoryByResult[index] = catId;
    renderAddContainer();
  });
  panel.appendChild(catWrap);

  const dateWrap = document.createElement("div");
  dateWrap.className = "trip-edit-fields";
  const arrivalField = document.createElement("input");
  arrivalField.type = "date";
  const departureField = document.createElement("input");
  departureField.type = "date";
  dateWrap.append(arrivalField, departureField);
  panel.appendChild(dateWrap);

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "In Plan speichern";
  saveBtn.addEventListener("click", () => saveSearchResult(place, index, {
    arrivalDate: arrivalField.value,
    departureDate: departureField.value,
  }, saveBtn));
  panel.appendChild(saveBtn);

  return panel;
}

function renderSearchResults(container) {
  const resultsEl = document.createElement("div");
  resultsEl.className = "inspire-results";

  searchResults.forEach((place, i) => {
    const card = document.createElement("div");
    card.className = "inspire-card";

    const photo = place.photos?.[0];
    if (photo) {
      const img = document.createElement("img");
      img.className = "inspire-card-photo";
      img.src = photoUrl(photo.name);
      img.alt = place.displayName?.text || "";
      card.appendChild(img);
    }

    const title = document.createElement("div");
    title.className = "trip-title";
    title.textContent = place.displayName?.text || "(ohne Namen)";
    card.appendChild(title);

    if (place.rating) {
      const ratingEl = document.createElement("div");
      ratingEl.className = "trip-meta";
      ratingEl.textContent = `${starRating(place.rating)} ${place.rating} (${place.userRatingCount || 0})`;
      card.appendChild(ratingEl);
    }

    if (place.formattedAddress) {
      const addr = document.createElement("div");
      addr.className = "trip-meta";
      addr.textContent = place.formattedAddress;
      card.appendChild(addr);
    }

    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary";
    addBtn.textContent = expandedResultIndex === i ? "Zuklappen" : "Zu Plan hinzufügen";
    addBtn.addEventListener("click", () => {
      expandedResultIndex = expandedResultIndex === i ? null : i;
      renderAddContainer();
    });
    card.appendChild(addBtn);

    if (expandedResultIndex === i) card.appendChild(buildResultDetailPanel(place, i));

    resultsEl.appendChild(card);
  });

  container.appendChild(resultsEl);
}

async function renderResultsMap(mapEl) {
  const withCoords = searchResults.filter((p) => p.location);
  if (withCoords.length === 0) {
    onStatus("Keine der Suchergebnisse hat Koordinaten.");
    return;
  }
  try {
    const maps = await loadMapsApi();
    mapEl.classList.remove("hidden");
    resultsMap = new maps.Map(mapEl, {
      zoom: 6,
      center: { lat: withCoords[0].location.latitude, lng: withCoords[0].location.longitude },
    });
    resultsMarkers.forEach((m) => m.setMap(null));
    resultsMarkers = withCoords.map((p) => new maps.Marker({
      position: { lat: p.location.latitude, lng: p.location.longitude },
      map: resultsMap,
      title: p.displayName?.text || "",
    }));
    const bounds = new maps.LatLngBounds();
    withCoords.forEach((p) => bounds.extend({ lat: p.location.latitude, lng: p.location.longitude }));
    resultsMap.fitBounds(bounds);
  } catch (err) {
    onStatus(err.message);
    console.error(err);
  }
}

function renderSearchUI(container) {
  const searchRow = document.createElement("div");
  searchRow.className = "inspire-search";

  const queryField = document.createElement("input");
  queryField.type = "text";
  queryField.placeholder = "z. B. Campingplatz an der Nordsee";

  const radiusSelect = document.createElement("select");
  RADIUS_OPTIONS.forEach((opt) => {
    const el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    radiusSelect.appendChild(el);
  });

  const searchBtn = document.createElement("button");
  searchBtn.className = "btn btn-primary";
  searchBtn.textContent = "Suchen";

  searchRow.append(queryField, radiusSelect, searchBtn);
  container.appendChild(searchRow);

  const mapBtn = document.createElement("button");
  mapBtn.className = "btn btn-ghost-dark";
  mapBtn.textContent = "Auf Karte anzeigen";
  mapBtn.classList.toggle("hidden", searchResults.length === 0);
  container.appendChild(mapBtn);

  const mapEl = document.createElement("div");
  mapEl.className = "route-map hidden";
  container.appendChild(mapEl);

  mapBtn.addEventListener("click", async () => {
    const wasHidden = mapEl.classList.contains("hidden");
    if (wasHidden) {
      await renderResultsMap(mapEl);
      mapBtn.textContent = "Karte ausblenden";
    } else {
      mapEl.classList.add("hidden");
      mapBtn.textContent = "Auf Karte anzeigen";
    }
  });

  async function runSearch() {
    const query = queryField.value.trim();
    if (!query) return;
    searchBtn.disabled = true;
    searchBtn.textContent = "Sucht …";
    onStatus("");
    try {
      searchResults = await searchGooglePlaces(query, radiusSelect.value);
      expandedResultIndex = null;
      selectedCategoryByResult = {};
      if (searchResults.length === 0) onStatus("Keine Ergebnisse gefunden.");
      renderAddContainer();
    } catch (err) {
      searchResults = [];
      onStatus(err.message);
      console.error(err);
      renderAddContainer();
    } finally {
      searchBtn.disabled = false;
      searchBtn.textContent = "Suchen";
    }
  }
  searchBtn.addEventListener("click", runSearch);
  queryField.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });

  if (searchResults.length > 0) renderSearchResults(container);

  const manualLink = document.createElement("button");
  manualLink.className = "btn btn-ghost-dark";
  manualLink.textContent = "Ohne Suche manuell eintragen";
  manualLink.addEventListener("click", () => { addMode = "manual"; render(); });
  container.appendChild(manualLink);
}

function renderAddContainer() {
  const container = document.getElementById("place-add-container");
  container.innerHTML = "";
  if (addMode === "search") {
    renderSearchUI(container);
  } else if (addMode === "manual") {
    const ul = document.createElement("ul");
    ul.className = "trips-list";
    ul.appendChild(createFormRow(null));
    container.appendChild(ul);
  }
}

// --- Hauptrendering ---

function render() {
  const { currentTrip, places } = getState();
  const filtersEl = document.getElementById("place-category-filters");
  const list = document.getElementById("places-list");
  filtersEl.innerHTML = "";
  list.innerHTML = "";

  renderAddContainer();
  document.getElementById("add-place-btn").textContent = addMode ? "Abbrechen" : "+ Ort hinzufügen";

  if (!currentTrip) {
    document.getElementById("plan-empty").classList.remove("hidden");
    document.getElementById("add-place-btn").disabled = true;
    return;
  }
  document.getElementById("add-place-btn").disabled = false;

  if (places.length > 0) {
    renderCategoryFilterChips(filtersEl, isCategoryVisible, (catId) => {
      toggleCategoryFilter(allCategoryIds(), catId);
      render();
    });
  }

  let visibleCount = 0;
  if (viewMode === "category") {
    visibleCount = renderGroups(groupedByCategory(), list);
  } else if (viewMode === "date") {
    visibleCount = renderGroups(groupedByDate(), list);
  } else if (viewMode === "distance") {
    visibleCount = renderDistanceMode(list);
  }

  document.getElementById("plan-empty").classList.toggle("hidden", visibleCount > 0 || addMode !== null);
}

function initViewModeSwitch() {
  document.querySelectorAll(".view-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewMode = btn.dataset.mode;
      document.querySelectorAll(".view-mode-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      if (viewMode === "distance") distanceAttempted = false; // bei jedem Klick neu versuchen
      render();
    });
  });
}

export function initPlan(statusCallback) {
  onStatus = statusCallback;
  document.getElementById("add-place-btn").addEventListener("click", () => {
    addMode = addMode ? null : "search";
    render();
  });
  initViewModeSwitch();
  subscribe(render);
  render();
}
