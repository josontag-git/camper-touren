// Plan-Ansicht: Orte des aktuellen Urlaubs anlegen/bearbeiten/löschen/sortieren,
// gruppiert (geclustert) nach Kategorie mit Filter-Chips.

import { createPlace, updatePlace, deletePlace } from "./api.js";
import { getState, subscribe, setPlaces, toggleCategoryFilter, isCategoryVisible } from "./state.js";
import { CATEGORIES, UNCATEGORIZED, categoryInfo, ALL_CATEGORY_IDS, renderCategoryFilterChips } from "./categories.js";
import { loadMapsApi } from "./maps-loader.js";

let onStatus = () => {};
let editingPlaceId = null; // null = nichts, "new" = neuer Ort, sonst place.id
let dragSource = null; // { id, category }
let prefillFields = null; // einmalige Vorbelegung, z. B. aus einem Inspire-Vorschlag

function sortedPlaces() {
  return getState().places.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function groupedPlaces() {
  const all = sortedPlaces();
  return [...CATEGORIES, UNCATEGORIZED].map((cat) => ({
    ...cat,
    places: all.filter((p) => (p.category || "") === cat.id),
  }));
}

function formatMeta(place) {
  const parts = [];
  if (place.arrivalDate) parts.push(place.departureDate ? `${place.arrivalDate} – ${place.departureDate}` : place.arrivalDate);
  if (place.address) parts.push(place.address);
  return parts.join(" · ") || "Keine Details";
}

function createViewRow(place) {
  const li = document.createElement("li");
  li.className = "trip-item place-item";
  li.draggable = true;
  li.dataset.id = place.id;
  li.style.setProperty("--category-color", categoryInfo(place.category).color);

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

  const handle = document.createElement("span");
  handle.className = "place-drag-handle";
  handle.textContent = "☰";
  handle.setAttribute("aria-label", "Ziehen zum Sortieren");

  const info = document.createElement("div");
  info.className = "trip-info";
  const title = document.createElement("div");
  title.className = "trip-title";
  title.textContent = place.name || "(ohne Namen)";
  const meta = document.createElement("div");
  meta.className = "trip-meta";
  meta.textContent = place.note ? `${formatMeta(place)} · ${place.note}` : formatMeta(place);
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

  li.append(handle, info, editBtn, delBtn);
  return li;
}

// Fügt ein Google-Places-Suchfeld in `container` ein (neue PlaceAutocompleteElement-
// API, da die alte google.maps.places.Autocomplete für neue Google-Cloud-Projekte
// nicht mehr aktivierbar ist). Auswahl eines Vorschlags füllt Name/Adresse/
// Koordinaten automatisch (kein manuelles Koordinaten-Tippen mehr nötig, das war
// fehleranfällig). Ohne Maps-Key bleibt das Feld einfach leer/unsichtbar.
function attachPlacesAutocomplete(container, nameField, addressField, latField, lngField) {
  loadMapsApi().then(async (maps) => {
    await maps.importLibrary("places");
    const widget = new maps.places.PlaceAutocompleteElement({});
    widget.classList.add("place-autocomplete-widget");
    container.appendChild(widget);
    widget.addEventListener("gmp-select", async ({ placePrediction }) => {
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
      if (place.displayName) nameField.value = place.displayName;
      if (place.formattedAddress) addressField.value = place.formattedAddress;
      if (place.location) {
        latField.value = place.location.lat();
        lngField.value = place.location.lng();
      }
    });
  }).catch(() => { /* kein Maps-Key -> kein Suchfeld, manuelle Eingabe bleibt möglich */ });
}

function createFormRow(place) {
  const isNew = !place;
  const li = document.createElement("li");
  li.className = "trip-item trip-item-editing";

  const prefill = !place && prefillFields ? prefillFields : null;

  const searchContainer = document.createElement("div");
  searchContainer.className = "place-search-container";

  const nameField = document.createElement("input");
  nameField.type = "text";
  nameField.placeholder = "Name des Orts";
  nameField.value = place?.name || prefill?.name || "";

  const categoryField = document.createElement("select");
  const blankOpt = document.createElement("option");
  blankOpt.value = "";
  blankOpt.textContent = "Kategorie …";
  categoryField.appendChild(blankOpt);
  CATEGORIES.forEach((cat) => {
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

  attachPlacesAutocomplete(searchContainer, nameField, addressField, latField, lngField);

  const noteField = document.createElement("input");
  noteField.type = "text";
  noteField.placeholder = "Notiz";
  noteField.value = place?.note || prefill?.note || "";

  if (prefill) prefillFields = null; // einmalig verwenden

  const fieldsWrap = document.createElement("div");
  fieldsWrap.className = "trip-edit-fields";
  fieldsWrap.append(searchContainer, nameField, categoryField, arrivalField, departureField, addressField, latField, lngField, noteField);

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
  cancelBtn.addEventListener("click", () => { editingPlaceId = null; render(); });

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

export function addPlaceFromSuggestion(fields) {
  const { currentTripId } = getState();
  if (!currentTripId) {
    onStatus("Bitte zuerst einen Urlaub auswählen oder anlegen.");
    return false;
  }
  prefillFields = fields;
  editingPlaceId = "new";
  render();
  return true;
}

function render() {
  const { currentTrip, places } = getState();
  const filtersEl = document.getElementById("place-category-filters");
  const list = document.getElementById("places-list");
  filtersEl.innerHTML = "";
  list.innerHTML = "";

  if (!currentTrip) {
    document.getElementById("plan-empty").classList.remove("hidden");
    document.getElementById("add-place-btn").disabled = true;
    return;
  }
  document.getElementById("add-place-btn").disabled = false;

  if (places.length > 0) {
    renderCategoryFilterChips(filtersEl, isCategoryVisible, (catId) => {
      toggleCategoryFilter(ALL_CATEGORY_IDS, catId);
      render();
    });
  }

  if (editingPlaceId === "new") {
    const newGroup = document.createElement("li");
    newGroup.appendChild(createFormRow(null));
    list.appendChild(newGroup);
  }

  let visibleCount = 0;
  groupedPlaces().forEach((group) => {
    if (group.places.length === 0 || !isCategoryVisible(group.id)) return;
    visibleCount += group.places.length;

    const heading = document.createElement("li");
    heading.className = "place-group-heading";
    heading.style.setProperty("--category-color", group.color);
    heading.textContent = `${group.label} (${group.places.length})`;
    list.appendChild(heading);

    group.places.forEach((place) => {
      list.appendChild(place.id === editingPlaceId ? createFormRow(place) : createViewRow(place));
    });
  });

  document.getElementById("plan-empty").classList.toggle("hidden", visibleCount > 0 || editingPlaceId === "new");
}

export function initPlan(statusCallback) {
  onStatus = statusCallback;
  document.getElementById("add-place-btn").addEventListener("click", () => {
    editingPlaceId = "new";
    render();
  });
  subscribe(render);
  render();
}
