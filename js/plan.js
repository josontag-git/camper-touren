// Plan-Ansicht: Orte des aktuellen Urlaubs suchen (Google-Places-Suche
// [Umkreis, Fotos, Bewertungen, Kartenansicht] oder park4night-Stellplatz-
// Community-Daten [nach Koordinaten], umschaltbar per Tab)/manuell anlegen/
// bearbeiten/löschen/sortieren. Drei Ansichten wählbar: nach Kategorie
// geclustert (mit Filter-Chips und Drag&Drop), nach Datum gruppiert, oder
// nach aktueller Entfernung sortiert.

import { createPlace, updatePlace, deletePlace } from "./api.js";
import { getState, subscribe, setPlaces, toggleCategoryFilter, isCategoryVisible } from "./state.js";
import { getCategories, UNCATEGORIZED, categoryInfo, allCategoryIds, renderCategoryFilterChips, renderCategoryButtons } from "./categories.js";
import { getSectionsForTrip, UNSECTIONED, renderSectionsSettings } from "./sections.js";
import { loadMapsApi } from "./maps-loader.js";
import { photoUrl, starRating, searchGooglePlaces, getCurrentPosition, fetchFirstPhotoRef } from "./places-search.js";
import { openPlaceDetailModal } from "./place-details.js";
import { friendlyError } from "./errors.js";
import { attachDragHandle } from "./drag-reorder.js";
import { searchPark4nightNear } from "./park4night.js";

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
let viewMode = "date"; // "category" | "date" | "distance" | "section"
let userPosition = null; // { lat, lng }, für viewMode "distance"
let manageSectionsOpen = false;

let addMode = null; // null | "search" | "manual"
let searchSource = "google"; // "google" | "park4night", siehe renderSourceTabs()
let searchResults = [];
let expandedResultIndex = null;
let selectedCategoryByResult = {};
let resultsMap = null;
let resultsMarkers = [];

// Native Date-Inputs unterstützen kein zuverlässiges placeholder-Attribut
// (Safari ignoriert es für type="date" komplett) -- deshalb ein echtes,
// kleines Label ("Ankunft"/"Abreise") fest im Feld statt eines leeren,
// nichtssagenden Inputs. Gibt Wrapper (zum Einfügen) + das rohe Input
// (zum Lesen/Setzen von .value) zurück.
function createLabeledDateField(labelText, value) {
  const wrap = document.createElement("label");
  wrap.className = "date-field";
  const span = document.createElement("span");
  span.textContent = labelText;
  const input = document.createElement("input");
  input.type = "date";
  input.value = value || "";
  wrap.append(span, input);
  return { wrap, input };
}

function sortedPlaces() {
  return getState().places.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

// Orte mit status "interested" ("Könnte interessant sein", z. B. aus Inspire)
// sind eine lose Wunschliste und laufen separat von den normalen
// Kategorie-/Datum-/Entfernung-Ansichten – siehe renderInterestedList().
function plannedPlaces() {
  return sortedPlaces().filter((p) => (p.status || "") !== "interested");
}

function interestedPlaces() {
  return getState().places.filter((p) => p.status === "interested");
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
  const all = plannedPlaces();
  return [...getCategories(), UNCATEGORIZED].map((cat) => ({
    ...cat,
    places: all.filter((p) => (p.category || "") === cat.id),
  }));
}

function groupedBySection() {
  const all = plannedPlaces();
  const { currentTripId } = getState();
  return [...getSectionsForTrip(currentTripId), UNSECTIONED].map((section) => ({
    ...section,
    places: all.filter((p) => (p.sectionId || "") === section.id),
  }));
}

// Liefert alle Tage von trip.startDate bis trip.endDate (inklusive) als
// "yyyy-MM-dd"-Strings -- lokal gerechnet (nicht über Date.toISOString(),
// das würde bei der Tagesinkrementierung je nach Zeitzone zu Verschiebungen
// führen). null, falls der Urlaub keinen festen Zeitraum hat.
function allTripDates(trip) {
  if (!trip?.startDate || !trip?.endDate) return null;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const end = parse(trip.endDate);
  const dates = [];
  for (let cur = parse(trip.startDate); cur <= end; cur.setDate(cur.getDate() + 1)) {
    dates.push(fmt(cur));
  }
  return dates;
}

// Zeigt bei Urlauben mit festem Zeitraum ALLE Tage des Urlaubs an (auch ohne
// eingeplante Orte), nicht nur die Tage, an denen tatsächlich ein Ort
// hinterlegt ist -- macht die Zeitachse als vollständigen Reiseplan lesbar.
// Orte mit einem Datum außerhalb des Urlaubszeitraums (Sonderfall) fallen
// nicht unter den Tisch, sondern ergänzen die Liste zusätzlich.
function groupedByDate() {
  const { currentTrip } = getState();
  const all = plannedPlaces();
  const withDate = all.filter((p) => p.arrivalDate);
  const withoutDate = all.filter((p) => !p.arrivalDate);
  const tripDates = allTripDates(currentTrip);
  const placeDates = withDate.map((p) => p.arrivalDate);
  const dates = [...new Set([...(tripDates || []), ...placeDates])].sort();
  const groups = dates.map((date) => ({
    id: date,
    label: new Date(date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }),
    color: "#6b7278",
    places: withDate.filter((p) => p.arrivalDate === date),
  }));
  if (withoutDate.length) groups.push({ id: "__none__", label: "Ohne Datum", color: "#9199ab", places: withoutDate });
  return groups;
}

// Fügt einen "Heute"-Eintrag an der chronologisch richtigen Stelle zwischen
// den Datums-Gruppen ein (vor "Ohne Datum", falls vorhanden) -- rein
// visueller Fortschritts-Marker auf der Zeitachse, keine echte Gruppe mit
// Orten. Ist "heute" bereits eine echte Datums-Gruppe (z. B. weil jetzt alle
// Urlaubstage angezeigt werden), wird stattdessen NUR diese Gruppe markiert
// (isTodayReal), statt eine zweite, doppelte Überschrift einzufügen.
function withTodayMarker(groups) {
  const today = new Date().toISOString().slice(0, 10);
  const undated = groups.find((g) => g.id === "__none__");
  const dated = groups.filter((g) => g.id !== "__none__");

  const existingToday = dated.find((g) => g.id === today);
  if (existingToday) {
    existingToday.isTodayReal = true;
    return groups;
  }

  const marker = { id: "__today__", label: "Heute", places: [], isToday: true };
  const insertAt = dated.findIndex((g) => g.id > today);
  const withMarker = dated.slice();
  withMarker.splice(insertAt === -1 ? withMarker.length : insertAt, 0, marker);
  return undated ? [...withMarker, undated] : withMarker;
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
  li.dataset.category = place.category || "";
  li.style.setProperty("--category-color", categoryInfo(place.category).color);

  const draggable = viewMode === "category" || viewMode === "section" || viewMode === "date";

  const info = document.createElement("div");
  info.className = "trip-info";
  if (place.placeId) {
    info.classList.add("trip-info-clickable");
    info.setAttribute("role", "button");
    info.setAttribute("tabindex", "0");
    info.addEventListener("click", () => openPlaceDetailModal(place));
    info.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPlaceDetailModal(place); }
    });
  }
  const title = document.createElement("div");
  title.className = "trip-title";
  title.textContent = place.name || "(ohne Namen)";
  const meta = document.createElement("div");
  meta.className = "trip-meta";
  const baseMeta = metaOverride || formatMeta(place);
  const ratingPrefix = place.rating ? `${starRating(place.rating)} ${place.rating} · ` : "";
  meta.textContent = place.note ? `${ratingPrefix}${baseMeta} · ${place.note}` : `${ratingPrefix}${baseMeta}`;
  info.append(title, meta);

  let thumb = null;
  if (place.photoRef) {
    thumb = document.createElement("img");
    thumb.className = "place-thumb";
    thumb.src = photoUrl(place.photoRef, 120);
    thumb.alt = "";
  }

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

  const thumbPart = thumb ? [thumb] : [];
  if (draggable) {
    const handle = document.createElement("span");
    handle.className = "place-drag-handle";
    handle.textContent = "⠿";
    handle.setAttribute("role", "button");
    handle.setAttribute("aria-label", "Ziehen zum Sortieren");
    if (viewMode === "category") {
      const category = place.category || "";
      attachDragHandle(handle, li, (draggedLi) => {
        const listEl = draggedLi.parentElement;
        return [...listEl.querySelectorAll(".place-item")]
          .filter((el) => el !== draggedLi && el.dataset.category === category);
      }, onReorder);
    } else if (viewMode === "section") {
      // Abschnitt-Modus: anders als bei Kategorie darf hier auch über
      // Gruppen hinweg gezogen werden (das ist der eigentliche Zweck --
      // Orte zwischen Abschnitten verschieben). Gruppen-Überschriften zählen
      // als Ziel mit dazu (dataset.id "section:"+id, siehe renderGroups()),
      // sonst ließe sich ein Ort nie in einen noch LEEREN Abschnitt ziehen.
      attachDragHandle(handle, li, (draggedLi) => {
        const listEl = draggedLi.parentElement;
        return [...listEl.querySelectorAll(".place-item, .place-group-heading[data-section-target]")]
          .filter((el) => el !== draggedLi);
      }, onSectionDrop);
    } else {
      // Datum-Modus: Ort auf eine Datums-Überschrift (oder eine Ort-Zeile
      // eines anderen Tages) ziehen setzt Ankunft UND Abreise auf diesen
      // einen Tag -- gleiches Cross-Gruppen-Muster wie beim Abschnitt-Modus.
      attachDragHandle(handle, li, (draggedLi) => {
        const listEl = draggedLi.parentElement;
        return [...listEl.querySelectorAll(".place-item, .place-group-heading[data-date-target]")]
          .filter((el) => el !== draggedLi);
      }, onDateDrop);
    }
    li.append(handle, ...thumbPart, info, editBtn, delBtn);
  } else {
    li.append(...thumbPart, info, editBtn, delBtn);
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

  const { wrap: arrivalWrap, input: arrivalField } = createLabeledDateField("Ankunft", place?.arrivalDate);
  const { wrap: departureWrap, input: departureField } = createLabeledDateField("Abreise", place?.departureDate);
  // Abreise ist noch leer -> beim Wählen der Ankunft direkt dasselbe Datum
  // vorbelegen (häufigster Fall: eintägiger Stopp), lässt sich danach aber
  // weiterhin frei ändern. Überschreibt keine bereits gesetzte Abreise.
  arrivalField.addEventListener("change", () => {
    if (!departureField.value) departureField.value = arrivalField.value;
  });

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
  fieldsWrap.append(nameField, categoryField, arrivalWrap, departureWrap, addressField, latField, lngField, noteField);

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
  // Erst die vorhandenen Felder übernehmen (photoRef/rating/userRatingCount/
  // status/sectionId etc.), DANN mit den im Formular bearbeiteten Feldern
  // überschreiben -- sonst würde jedes Speichern über das Bearbeiten-
  // Formular Felder löschen, die das Formular selbst gar nicht kennt (z. B.
  // den per Drag zugewiesenen Abschnitt).
  const record = {
    ...existing,
    id: existing?.id || crypto.randomUUID(),
    tripId: currentTripId,
    // Date.now() statt places.length: places.length ist der lokale Stand
    // DIESES Geräts -- legen zwei Geräte fast gleichzeitig je einen neuen
    // Ort an, können beide dieselbe Länge sehen und denselben order-Wert
    // vergeben (live als doppelter order-Wert beobachtet, nachdem auf einem
    // zweiten Gerät ein Ort hinzugefügt wurde). Ein Millisekunden-Zeitstempel
    // kollidiert praktisch nie und sortiert neue Orte trotzdem ans Ende;
    // jede spätere Drag-Sortierung normalisiert ohnehin wieder auf 0..n-1.
    order: existing?.order ?? Date.now(),
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
    onStatus(`Fehler beim Speichern: ${friendlyError(err)}`);
    console.error(err);
  }
}

async function onDelete(place) {
  if (!window.confirm(`"${place.name || "Ort"}" wirklich löschen?`)) return;
  try {
    await deletePlace(place.id);
    setPlaces(getState().places.filter((p) => p.id !== place.id));
  } catch (err) {
    onStatus(`Fehler beim Löschen: ${friendlyError(err)}`);
    console.error(err);
  }
}

// Schreibt nur Orte, deren order/sectionId sich tatsächlich geändert hat
// (statt blind den ganzen Urlaub neu zu schreiben), und lässt einen
// einzelnen fehlgeschlagenen Request nicht den ganzen Rest blockieren --
// beides behebt einen live nachgewiesenen Datenverlust: bei "alle Orte immer
// neu schreiben" + "ein Fehler bricht die ganze Schleife ab" blieben nach
// vielen sequenziellen Schreibvorgängen mehrere Orte mit identischem/altem
// order-Wert stehen (per direktem GET/POST-Test gegen das echte Sheet
// nachgewiesen). Weniger Requests pro Aktion + robuste Einzelverarbeitung
// senken das Risiko deutlich.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Schnappschuss der Felder, die von onReorder()/onSectionDrop()/onDateDrop()
// verändert werden können -- zentral hier, damit "before"-Snapshot und
// Änderungs-Check nie auseinanderlaufen.
function placeSnapshot(p) {
  return { order: p.order, sectionId: p.sectionId || "", arrivalDate: p.arrivalDate || "", departureDate: p.departureDate || "" };
}

async function writeChangedPlaces(before, after, statusPrefix) {
  const toWrite = after.filter((p) => {
    const orig = before.get(p.id);
    if (!orig) return true;
    const now = placeSnapshot(p);
    return Object.keys(now).some((key) => orig[key] !== now[key]);
  });
  const failed = [];
  // Nacheinander statt parallel: Apps Script hat kein Locking auf
  // getLastRow()/setValues() in upsertRow(), gleichzeitige Requests auf
  // dasselbe Sheet können sich gegenseitig überschreiben. Zusätzlich:
  // ein zweiter Versuch nach kurzer Pause bei einem fehlgeschlagenen
  // Request, UND eine kleine Pause zwischen allen Requests -- live
  // beobachtet, dass Apps Script bei vielen schnell aufeinanderfolgenden
  // Requests einzelne davon ungewöhnlich langsam verarbeitet oder verliert
  // (ein einzelner Test-Request brauchte über 2 Minuten). Behebt einen Rest
  // an Datenverlust, der auch nach der ersten Fix-Runde noch live
  // nachgewiesen wurde (einzelner Ort ohne Abschnitts-Zuordnung übrig).
  for (const p of toWrite) {
    try {
      await updatePlace(p);
    } catch (err) {
      try {
        await wait(400);
        await updatePlace(p);
      } catch (err2) {
        failed.push(p);
        console.error(err2);
      }
    }
    await wait(150);
  }
  if (failed.length) {
    onStatus(`${statusPrefix}: ${failed.length} von ${toWrite.length} Änderungen konnten nicht gespeichert werden.`);
  }
}

async function onReorder(sourceId, targetId) {
  const ordered = sortedPlaces();
  const before = new Map(ordered.map((p) => [p.id, placeSnapshot(p)]));
  const fromIndex = ordered.findIndex((p) => p.id === sourceId);
  const toIndex = ordered.findIndex((p) => p.id === targetId);
  if (fromIndex === -1 || toIndex === -1) return;

  const [moved] = ordered.splice(fromIndex, 1);
  ordered.splice(toIndex, 0, moved);
  const reindexed = ordered.map((p, i) => ({ ...p, order: i }));
  setPlaces(reindexed);
  render();
  await writeChangedPlaces(before, reindexed, "Fehler beim Sortieren");
}

// Ziel ist eine Abschnitts-Überschrift ("section:"+id) -> Ort bekommt diese
// sectionId und wandert ans Ende der Gesamtreihenfolge. Ziel ist eine
// Ort-Zeile -> Ort übernimmt deren sectionId UND wird an deren Position
// eingefügt (wie onReorder(), nur zusätzlich mit Abschnitts-Wechsel).
async function onSectionDrop(sourceId, targetId) {
  const ordered = sortedPlaces();
  const before = new Map(ordered.map((p) => [p.id, placeSnapshot(p)]));
  const fromIndex = ordered.findIndex((p) => p.id === sourceId);
  if (fromIndex === -1) return;
  const [moved] = ordered.splice(fromIndex, 1);

  if (targetId.startsWith("section:")) {
    moved.sectionId = targetId.slice("section:".length);
    ordered.push(moved);
  } else {
    const toIndex = ordered.findIndex((p) => p.id === targetId);
    if (toIndex === -1) { ordered.splice(fromIndex, 0, moved); return; }
    moved.sectionId = ordered[toIndex].sectionId || "";
    ordered.splice(toIndex, 0, moved);
  }

  const reindexed = ordered.map((p, i) => ({ ...p, order: i }));
  setPlaces(reindexed);
  render();
  await writeChangedPlaces(before, reindexed, "Fehler beim Verschieben");
}

// Ziel ist eine Datums-Überschrift ("date:"+yyyy-MM-dd, leer für "Ohne
// Datum") -> Ort bekommt Ankunft UND Abreise auf dieses Datum gesetzt
// (Drop = ein konkreter Tag, kein Zeitraum) und wandert ans Ende der
// Gesamtreihenfolge. Ziel ist eine Ort-Zeile -> Ort übernimmt deren Datum
// UND wird an deren Position eingefügt (wie onSectionDrop(), nur mit
// Datums- statt Abschnitts-Wechsel).
async function onDateDrop(sourceId, targetId) {
  const ordered = sortedPlaces();
  const before = new Map(ordered.map((p) => [p.id, placeSnapshot(p)]));
  const fromIndex = ordered.findIndex((p) => p.id === sourceId);
  if (fromIndex === -1) return;
  const [moved] = ordered.splice(fromIndex, 1);

  if (targetId.startsWith("date:")) {
    const date = targetId.slice("date:".length);
    moved.arrivalDate = date;
    moved.departureDate = date;
    ordered.push(moved);
  } else {
    const toIndex = ordered.findIndex((p) => p.id === targetId);
    if (toIndex === -1) { ordered.splice(fromIndex, 0, moved); return; }
    const date = ordered[toIndex].arrivalDate || "";
    moved.arrivalDate = date;
    moved.departureDate = date;
    ordered.splice(toIndex, 0, moved);
  }

  const reindexed = ordered.map((p, i) => ({ ...p, order: i }));
  setPlaces(reindexed);
  render();
  await writeChangedPlaces(before, reindexed, "Fehler beim Verschieben");
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

async function onMoveToPlan(place) {
  const record = { ...place, status: "" };
  try {
    await updatePlace(record);
    setPlaces(getState().places.map((p) => (p.id === place.id ? record : p)));
  } catch (err) {
    onStatus(`Fehler beim Verschieben: ${friendlyError(err)}`);
    console.error(err);
  }
}

async function onRemoveInterested(place) {
  if (!window.confirm(`"${place.name || "Ort"}" wirklich entfernen?`)) return;
  try {
    await deletePlace(place.id);
    setPlaces(getState().places.filter((p) => p.id !== place.id));
  } catch (err) {
    onStatus(`Fehler beim Entfernen: ${friendlyError(err)}`);
    console.error(err);
  }
}

function renderInterestedList() {
  const wrap = document.getElementById("interested-places");
  const list = document.getElementById("interested-places-list");
  const items = interestedPlaces();
  wrap.classList.toggle("hidden", items.length === 0);
  list.innerHTML = "";

  items.forEach((place) => {
    if (place.id === editingPlaceId) {
      list.appendChild(createFormRow(place));
      return;
    }

    const li = document.createElement("li");
    li.className = "trip-item";
    li.style.setProperty("--category-color", categoryInfo(place.category).color);

    let thumb = null;
    if (place.photoRef) {
      thumb = document.createElement("img");
      thumb.className = "place-thumb";
      thumb.src = photoUrl(place.photoRef, 120);
      thumb.alt = "";
    }

    const info = document.createElement("div");
    info.className = "trip-info";
    const title = document.createElement("div");
    title.className = "trip-title";
    title.textContent = place.name || "(ohne Namen)";
    const meta = document.createElement("div");
    meta.className = "trip-meta";
    const ratingPrefix = place.rating ? `${starRating(place.rating)} ${place.rating} · ` : "";
    const baseMeta = `${ratingPrefix}${formatMeta(place)}`;
    meta.textContent = place.note ? `${baseMeta} · ${place.note}` : baseMeta;
    info.append(title, meta);

    const editBtn = document.createElement("button");
    editBtn.className = "trip-icon-btn";
    editBtn.textContent = "✎";
    editBtn.setAttribute("aria-label", "Bearbeiten");
    editBtn.addEventListener("click", () => { editingPlaceId = place.id; render(); });

    const moveBtn = document.createElement("button");
    moveBtn.className = "btn btn-ghost-dark";
    moveBtn.textContent = "Zu Plan verschieben";
    moveBtn.addEventListener("click", () => onMoveToPlan(place));

    const removeBtn = document.createElement("button");
    removeBtn.className = "trip-icon-btn";
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", "Entfernen");
    removeBtn.addEventListener("click", () => onRemoveInterested(place));

    li.append(...(thumb ? [thumb] : []), info, editBtn, moveBtn, removeBtn);
    list.appendChild(li);
  });
}

// allowEmpty: Überschriften bleiben auch bei 0 Orten sichtbar (Datum-Modus
// mit festem Urlaubszeitraum: alle Tage sollen auftauchen, nicht nur die mit
// Orten; Abschnitt-Modus: sonst könnte man nie einen Ort in einen frisch
// angelegten, leeren Abschnitt ziehen). sectionMode: Überschriften bekommen
// zusätzlich dataset.id/data-section-target, damit sie in createViewRow()'s
// Abschnitt-Drag als Drop-Ziel erkannt werden.
function renderGroups(groups, list, { allowEmpty = false, sectionMode = false, dateMode = false } = {}) {
  let visibleCount = 0;
  groups.forEach((group) => {
    if (group.isToday) {
      const heading = document.createElement("li");
      heading.className = "place-group-heading place-group-heading--today";
      heading.textContent = group.label;
      if (dateMode) {
        heading.dataset.id = `date:${new Date().toISOString().slice(0, 10)}`;
        heading.dataset.dateTarget = "true";
      }
      list.appendChild(heading);
      return;
    }
    const visiblePlaces = group.places.filter((p) => isCategoryVisible(p.category || ""));
    if (visiblePlaces.length === 0 && !allowEmpty) return;
    visibleCount += visiblePlaces.length;

    const heading = document.createElement("li");
    heading.className = group.isTodayReal ? "place-group-heading place-group-heading--today" : "place-group-heading";
    heading.style.setProperty("--category-color", group.color);
    heading.textContent = group.isTodayReal
      ? `${group.label} (${visiblePlaces.length}) · Heute`
      : `${group.label} (${visiblePlaces.length})`;
    if (sectionMode) {
      heading.dataset.id = `section:${group.id}`;
      heading.dataset.sectionTarget = "true";
    }
    if (dateMode) {
      heading.dataset.id = `date:${group.id === "__none__" ? "" : group.id}`;
      heading.dataset.dateTarget = "true";
    }
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
  const all = plannedPlaces().filter((p) => isCategoryVisible(p.category || ""));
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

async function saveSearchResult(place, index, dates, saveBtn, status = "", originalLabel = "In Plan speichern") {
  const { currentTripId, places } = getState();
  if (!currentTripId) {
    onStatus("Bitte zuerst einen Urlaub auswählen oder anlegen.");
    return;
  }
  saveBtn.disabled = true;
  saveBtn.textContent = "Speichert …";

  // Die Google-Ergebnisliste selbst liefert bewusst kein Foto mehr (siehe
  // places-search.js) -- beim tatsächlichen Speichern eines Orts aber schon,
  // damit Plan/Route in der Listenansicht ein Vorschaubild zeigen können.
  let photoRef = place.photos?.[0]?.thumb || place.photos?.[0]?.name || "";
  if (!photoRef && place.source !== "park4night" && place.id) {
    photoRef = await fetchFirstPhotoRef(place.id);
  }

  const record = {
    id: crypto.randomUUID(),
    tripId: currentTripId,
    // Date.now() statt places.length -- siehe Kommentar in onSave() zur
    // Kollisionsgefahr bei zwei Geräten, die fast gleichzeitig einen Ort anlegen.
    order: Date.now(),
    name: place.displayName?.text || "",
    category: selectedCategoryByResult[index]
      || (place.source === "park4night" ? (getCategories().find((c) => /camp/i.test(c.label))?.id || "") : ""),
    arrivalDate: dates.arrivalDate,
    departureDate: dates.departureDate,
    address: place.formattedAddress || "",
    lat: place.location?.latitude ?? "",
    lng: place.location?.longitude ?? "",
    note: place.source === "park4night" ? place.note : "",
    placeId: place.id || "",
    createdAt: new Date().toISOString(),
    photoRef,
    rating: place.rating ?? "",
    userRatingCount: place.userRatingCount ?? "",
    status,
  };

  try {
    await createPlace(record);
    setPlaces([...places, record]);
    addMode = null;
    onStatus(status === "interested" ? `"${record.name}" vorgemerkt.` : `"${record.name}" zum Plan hinzugefügt.`);
    render();
  } catch (err) {
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel;
    onStatus(`Fehler beim Speichern: ${friendlyError(err)}`);
    console.error(err);
  }
}

// Baut das Objekt, das openPlaceDetailModal() aus einem noch nicht
// gespeicherten Suchergebnis erwartet -- bei Google reicht placeId (die
// Detailansicht lädt den Rest live nach), park4night hat keinen
// "per ID neu abrufen"-Endpunkt und bekommt deshalb die bereits vorhandenen
// Daten aus dem Suchergebnis direkt mit (analog zu js/inspire.js).
function detailModalSeed(place) {
  if (place.source === "park4night") {
    return {
      name: place.displayName?.text || "",
      placeId: place.id,
      photoRef: place.photos?.[0]?.name || "",
      address: place.formattedAddress || "",
      note: place.note || "",
    };
  }
  return { name: place.displayName?.text || "", placeId: place.id };
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

  if (place.source === "park4night" && place.note) {
    const amenities = document.createElement("p");
    amenities.className = "muted";
    amenities.textContent = `Ausstattung: ${place.note}`;
    panel.appendChild(amenities);
  }

  if (place.rating || place.googleMapsUri) {
    const link = document.createElement("a");
    link.className = "btn btn-ghost-dark";
    link.target = "_blank";
    link.rel = "noopener";
    link.href = place.googleMapsUri || "#";
    const sourceLabel = place.source === "park4night" ? "Auf park4night" : "Auf Google Maps";
    link.textContent = place.rating
      ? `${starRating(place.rating)} ${place.rating} (${place.userRatingCount || 0}) ${sourceLabel.toLowerCase()} ↗`
      : `${sourceLabel} ansehen ↗`;
    panel.appendChild(link);
  }

  // Bei park4night-Treffern die Kategorie automatisch auf "Camping"
  // vorbelegen (beim ersten Öffnen des Panels), bleibt über die Buttons
  // unten änderbar.
  if (place.source === "park4night" && selectedCategoryByResult[index] === undefined) {
    const campingCat = getCategories().find((c) => /camp/i.test(c.label));
    if (campingCat) selectedCategoryByResult[index] = campingCat.id;
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
  const { wrap: arrivalWrap, input: arrivalField } = createLabeledDateField("Ankunft");
  const { wrap: departureWrap, input: departureField } = createLabeledDateField("Abreise");
  arrivalField.addEventListener("change", () => {
    if (!departureField.value) departureField.value = arrivalField.value;
  });
  dateWrap.append(arrivalWrap, departureWrap);
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

    const actions = document.createElement("div");
    actions.className = "inspire-card-actions";

    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary";
    addBtn.textContent = expandedResultIndex === i ? "Zuklappen" : "Zu Plan hinzufügen";
    addBtn.addEventListener("click", () => {
      expandedResultIndex = expandedResultIndex === i ? null : i;
      renderAddContainer();
    });
    actions.appendChild(addBtn);

    const detailsBtn = document.createElement("button");
    detailsBtn.className = "btn btn-subtle";
    detailsBtn.textContent = "Details";
    detailsBtn.addEventListener("click", () => openPlaceDetailModal(detailModalSeed(place)));
    actions.appendChild(detailsBtn);

    card.appendChild(actions);

    const secondaryActions = document.createElement("div");
    secondaryActions.className = "inspire-card-actions inspire-card-actions-secondary";
    const interestBtn = document.createElement("button");
    interestBtn.className = "btn btn-subtle";
    interestBtn.textContent = "✓ Könnte interessant sein";
    interestBtn.addEventListener("click", () => saveSearchResult(
      place, i, { arrivalDate: "", departureDate: "" }, interestBtn, "interested", "✓ Könnte interessant sein"
    ));
    secondaryActions.appendChild(interestBtn);
    card.appendChild(secondaryActions);

    if (expandedResultIndex === i) card.appendChild(buildResultDetailPanel(place, i));

    resultsEl.appendChild(card);
  });

  container.appendChild(resultsEl);
}

// Inhalt des InfoWindow, das beim Klick auf einen Marker aufgeht (Google-
// oder park4night-Ergebnis, siehe renderResultsMap) – Foto/Name/Sterne plus
// dieselben drei Aktionen wie bei der Listen-Ansicht der Suchergebnisse:
// direkt speichern, vormerken, oder Details ansehen. "Details" öffnet dabei
// bewusst dasselbe App-weite Modal wie bei Inspire (openPlaceDetailModal,
// siehe js/place-details.js) statt einer eigenen Mini-Ansicht im schmalen
// InfoWindow – es legt sich als vollflächiges Overlay über die ganze App,
// genau wie überall sonst.
function buildMapInfoContent(place, index) {
  const wrap = document.createElement("div");
  wrap.className = "map-info-window";

  const photo = place.photos?.[0];
  if (photo) {
    const img = document.createElement("img");
    img.className = "map-info-photo";
    img.src = photoUrl(photo.name, 240);
    img.alt = "";
    wrap.appendChild(img);
  }

  const title = document.createElement("div");
  title.className = "map-info-title";
  title.textContent = place.displayName?.text || "(ohne Namen)";
  wrap.appendChild(title);

  if (place.rating) {
    const rating = document.createElement("div");
    rating.className = "map-info-rating";
    rating.textContent = `${starRating(place.rating)} ${place.rating}`;
    wrap.appendChild(rating);
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-primary map-info-btn";
  addBtn.textContent = "✓ Zu Plan hinzufügen";
  addBtn.addEventListener("click", () => saveSearchResult(place, index, { arrivalDate: "", departureDate: "" }, addBtn));
  wrap.appendChild(addBtn);

  const detailsBtn = document.createElement("button");
  detailsBtn.type = "button";
  detailsBtn.className = "btn btn-subtle map-info-btn";
  detailsBtn.textContent = "Details";
  detailsBtn.addEventListener("click", () => openPlaceDetailModal(detailModalSeed(place)));
  wrap.appendChild(detailsBtn);

  const interestBtn = document.createElement("button");
  interestBtn.type = "button";
  interestBtn.className = "btn btn-subtle map-info-btn";
  interestBtn.textContent = "✓ Könnte interessant sein";
  interestBtn.addEventListener("click", () => saveSearchResult(
    place, index, { arrivalDate: "", departureDate: "" }, interestBtn, "interested", "✓ Könnte interessant sein"
  ));
  wrap.appendChild(interestBtn);

  return wrap;
}

async function renderResultsMap(mapEl) {
  const indexed = searchResults.map((p, i) => ({ p, i })).filter(({ p }) => p.location);
  if (indexed.length === 0) {
    onStatus("Keine der Suchergebnisse hat Koordinaten.");
    return;
  }
  try {
    const maps = await loadMapsApi();
    mapEl.classList.remove("hidden");
    resultsMap = new maps.Map(mapEl, {
      zoom: 6,
      center: { lat: indexed[0].p.location.latitude, lng: indexed[0].p.location.longitude },
    });
    const infoWindow = new maps.InfoWindow();
    resultsMarkers.forEach((m) => m.setMap(null));
    resultsMarkers = indexed.map(({ p, i }) => {
      const marker = new maps.Marker({
        position: { lat: p.location.latitude, lng: p.location.longitude },
        map: resultsMap,
        title: p.displayName?.text || "",
      });
      marker.addListener("click", () => {
        infoWindow.setContent(buildMapInfoContent(p, i));
        infoWindow.open({ map: resultsMap, anchor: marker });
      });
      return marker;
    });
    const bounds = new maps.LatLngBounds();
    indexed.forEach(({ p }) => bounds.extend({ lat: p.location.latitude, lng: p.location.longitude }));
    resultsMap.fitBounds(bounds);
  } catch (err) {
    onStatus(friendlyError(err));
    console.error(err);
  }
}

// Umschalter zwischen den beiden Suchquellen (Google Places / park4night) --
// gleiche CSS-Klassen wie der Kategorie/Datum/Entfernung-Umschalter oben in
// dieser Datei. Quellwechsel verwirft die bisherigen Ergebnisse, damit nicht
// beide Quellen vermischt in der Liste stehen.
function renderSourceTabs(container) {
  const tabs = document.createElement("div");
  tabs.className = "view-mode-switch";
  [["google", "Google"], ["park4night", "park4night"]].forEach(([id, label]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "view-mode-btn";
    btn.classList.toggle("is-active", searchSource === id);
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (searchSource === id) return;
      searchSource = id;
      searchResults = [];
      expandedResultIndex = null;
      selectedCategoryByResult = {};
      renderAddContainer();
    });
    tabs.appendChild(btn);
  });
  container.appendChild(tabs);
}

function renderGoogleSearchRow(container) {
  const searchRow = document.createElement("div");
  searchRow.className = "inspire-search inspire-search-wrap";

  const queryField = document.createElement("input");
  queryField.type = "text";
  queryField.placeholder = "z. B. Restaurant, Strand, Sehenswürdigkeit …";

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
      onStatus(friendlyError(err));
      console.error(err);
      renderAddContainer();
    } finally {
      searchBtn.disabled = false;
      searchBtn.textContent = "Suchen";
    }
  }
  searchBtn.addEventListener("click", runSearch);
  queryField.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });
}

// park4night durchsucht nur nach Koordinaten (keine Freitextsuche wie
// Google) -- entweder einen Ortsnamen grob über die bestehende
// Google-Textsuche geokoden (erstes Ergebnis mit Koordinaten) oder direkt
// den aktuellen Standort verwenden.
async function runPark4nightSearch(lat, lng) {
  onStatus("");
  const results = await searchPark4nightNear(lat, lng, { filterByType: true });
  searchResults = results.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  expandedResultIndex = null;
  selectedCategoryByResult = {};
  if (searchResults.length === 0) {
    onStatus("Keine park4night-Treffer gefunden (oder die Quelle ist gerade nicht erreichbar).");
  }
  renderAddContainer();
}

function renderPark4nightSearchRow(container) {
  const searchRow = document.createElement("div");
  searchRow.className = "inspire-search inspire-search-wrap";

  const queryField = document.createElement("input");
  queryField.type = "text";
  queryField.placeholder = "Ort (optional, z. B. Bretagne)";

  const searchBtn = document.createElement("button");
  searchBtn.className = "btn btn-primary";
  searchBtn.textContent = "Suchen";
  searchBtn.addEventListener("click", async () => {
    const query = queryField.value.trim();
    if (!query) return;
    searchBtn.disabled = true;
    searchBtn.textContent = "Sucht …";
    onStatus("");
    try {
      const geocoded = await searchGooglePlaces(query);
      const first = geocoded.find((p) => p.location);
      if (!first) {
        onStatus(`„${query}" konnte nicht gefunden werden.`);
        return;
      }
      await runPark4nightSearch(first.location.latitude, first.location.longitude);
    } catch (err) {
      onStatus(friendlyError(err));
      console.error(err);
    } finally {
      searchBtn.disabled = false;
      searchBtn.textContent = "Suchen";
    }
  });
  queryField.addEventListener("keydown", (e) => { if (e.key === "Enter") searchBtn.click(); });

  searchRow.append(queryField, searchBtn);
  container.appendChild(searchRow);

  const locBtn = document.createElement("button");
  locBtn.className = "btn btn-ghost-dark";
  locBtn.textContent = "📍 Meinen Standort verwenden";
  locBtn.addEventListener("click", async () => {
    locBtn.disabled = true;
    const originalLabel = locBtn.textContent;
    locBtn.textContent = "Ermittle Standort …";
    onStatus("");
    try {
      const pos = await getCurrentPosition();
      locBtn.textContent = "Sucht …";
      await runPark4nightSearch(pos.lat, pos.lng);
    } catch (err) {
      onStatus(friendlyError(err));
      console.error(err);
    } finally {
      locBtn.disabled = false;
      locBtn.textContent = originalLabel;
    }
  });
  container.appendChild(locBtn);

  const hint = document.createElement("p");
  hint.className = "muted";
  hint.textContent = "Community-Daten von park4night.";
  container.appendChild(hint);
}

function renderSearchUI(container) {
  renderSourceTabs(container);

  if (searchSource === "google") {
    renderGoogleSearchRow(container);
  } else {
    renderPark4nightSearchRow(container);
  }

  const hasMapResults = searchResults.some((p) => p.location);

  const mapBtn = document.createElement("button");
  mapBtn.className = "btn btn-ghost-dark";
  mapBtn.textContent = hasMapResults ? "Karte ausblenden" : "Auf Karte anzeigen";
  mapBtn.classList.toggle("hidden", searchResults.length === 0);
  container.appendChild(mapBtn);

  const mapEl = document.createElement("div");
  mapEl.className = "route-map hidden";
  container.appendChild(mapEl);

  // Karte erscheint automatisch mit den Ergebnissen (statt hinter dem
  // Button versteckt) – Marker sind klickbar und lassen den Ort direkt
  // von der Karte aus hinzufügen, siehe buildMapInfoContent().
  if (hasMapResults) renderResultsMap(mapEl);

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
    document.getElementById("interested-places").classList.add("hidden");
    return;
  }
  document.getElementById("add-place-btn").disabled = false;
  renderInterestedList();

  if (places.length > 0) {
    renderCategoryFilterChips(filtersEl, isCategoryVisible, (catId) => {
      toggleCategoryFilter(allCategoryIds(), catId);
      render();
    });
  }

  const showTimeline = viewMode === "date" && !!currentTrip.startDate && !!currentTrip.endDate;

  const manageBtn = document.getElementById("manage-sections-btn");
  const manageContainer = document.getElementById("manage-sections-container");
  manageBtn.classList.toggle("hidden", viewMode !== "section");
  manageBtn.textContent = manageSectionsOpen ? "Abschnitte verwalten ✕" : "Abschnitte verwalten";
  if (viewMode === "section" && manageSectionsOpen) {
    manageContainer.classList.remove("hidden");
    renderSectionsSettings(manageContainer, currentTrip.id);
  } else {
    manageContainer.classList.add("hidden");
    manageContainer.innerHTML = "";
  }

  let visibleCount = 0;
  if (viewMode === "category") {
    visibleCount = renderGroups(groupedByCategory(), list);
  } else if (viewMode === "date") {
    visibleCount = renderGroups(showTimeline ? withTodayMarker(groupedByDate()) : groupedByDate(), list, { allowEmpty: true, dateMode: true });
  } else if (viewMode === "distance") {
    visibleCount = renderDistanceMode(list);
  } else if (viewMode === "section") {
    visibleCount = renderGroups(groupedBySection(), list, { allowEmpty: true, sectionMode: true });
  }

  list.classList.toggle("trips-list--timeline", showTimeline);

  document.getElementById("plan-empty").classList.toggle("hidden", visibleCount > 0 || addMode !== null);
}

function initViewModeSwitch() {
  const switchEl = document.getElementById("plan-view-mode-switch");
  switchEl.querySelectorAll(".view-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewMode = btn.dataset.mode;
      switchEl.querySelectorAll(".view-mode-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
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
  document.getElementById("manage-sections-btn").addEventListener("click", () => {
    manageSectionsOpen = !manageSectionsOpen;
    render();
  });
  subscribe(render);
  render();
}
