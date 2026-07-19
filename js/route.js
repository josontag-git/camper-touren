// Route-Ansicht: Karte mit ALLEN Orten des aktuellen Urlaubs (Marker nach
// Kategorie eingefärbt) + Absprung nach Google Maps (einzelner Ort oder
// gesamte Route als Wegpunkte). Liste steht unter der Karte.

import { getState, subscribe, setPlaces } from "./state.js";
import { categoryInfo } from "./categories.js";
import { loadMapsApi } from "./maps-loader.js";
import { photoUrl, starRating } from "./places-search.js";
import { openPlaceDetailModal } from "./place-details.js";
import { deletePlace } from "./api.js";
import { friendlyError } from "./errors.js";

let onStatus = () => {};
let map = null;
let markers = [];
let infoWindow = null;

function sortedPlaces() {
  return getState().places.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function hasCoords(place) {
  return place.lat !== "" && place.lat != null && place.lng !== "" && place.lng != null && !Number.isNaN(Number(place.lat));
}

function placeMapsUrl(place) {
  if (hasCoords(place)) {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }
  const query = encodeURIComponent(place.address || place.name);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function fullRouteMapsUrl(places) {
  const stops = places.map((p) => (hasCoords(p) ? `${p.lat},${p.lng}` : encodeURIComponent(p.address || p.name)));
  if (stops.length === 0) return null;
  if (stops.length === 1) return `https://www.google.com/maps/search/?api=1&query=${stops[0]}`;

  const destination = stops[stops.length - 1];
  const origin = stops[0];
  const waypoints = stops.slice(1, -1).join("|");
  const params = new URLSearchParams({ api: "1", origin, destination });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function markerIcon(maps, color) {
  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#fff",
    strokeWeight: 2,
    scale: 9,
  };
}

async function onRemoveFromRoute(place) {
  if (!window.confirm(`"${place.name || "Ort"}" wirklich von der Route entfernen?`)) return;
  try {
    await deletePlace(place.id);
    setPlaces(getState().places.filter((p) => p.id !== place.id));
  } catch (err) {
    onStatus(`Fehler beim Entfernen: ${friendlyError(err)}`);
    console.error(err);
  }
}

// Inhalt des InfoWindow beim Klick auf einen Routen-Marker -- Foto/Name/
// Sterne plus "Details" (dasselbe App-weite Modal wie überall sonst) und
// "Von Route entfernen" (löscht den Ort, gleicher Pfad wie Plans eigener
// Löschen-Button). Gleiche CSS-Klassen wie plan.js buildMapInfoContent().
function buildRouteInfoContent(place) {
  const wrap = document.createElement("div");
  wrap.className = "map-info-window";

  if (place.photoRef) {
    const img = document.createElement("img");
    img.className = "map-info-photo";
    img.src = photoUrl(place.photoRef, 240);
    img.alt = "";
    wrap.appendChild(img);
  }

  const title = document.createElement("div");
  title.className = "map-info-title";
  title.textContent = place.name || "(ohne Namen)";
  wrap.appendChild(title);

  if (place.rating) {
    const rating = document.createElement("div");
    rating.className = "map-info-rating";
    rating.textContent = `${starRating(place.rating)} ${place.rating}`;
    wrap.appendChild(rating);
  }

  const detailsBtn = document.createElement("button");
  detailsBtn.type = "button";
  detailsBtn.className = "btn btn-subtle map-info-btn";
  detailsBtn.textContent = "Details";
  detailsBtn.addEventListener("click", () => openPlaceDetailModal(place));
  wrap.appendChild(detailsBtn);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-ghost-dark map-info-btn";
  removeBtn.textContent = "✕ Von Route entfernen";
  removeBtn.addEventListener("click", () => onRemoveFromRoute(place));
  wrap.appendChild(removeBtn);

  return wrap;
}

async function renderMap(places) {
  const mapEl = document.getElementById("route-map");
  const withCoords = places.filter(hasCoords);

  if (withCoords.length === 0) {
    mapEl.classList.add("hidden");
    return;
  }

  try {
    const maps = await loadMapsApi();
    mapEl.classList.remove("hidden");
    if (!map) {
      map = new maps.Map(mapEl, { zoom: 6, center: { lat: Number(withCoords[0].lat), lng: Number(withCoords[0].lng) } });
    }
    if (!infoWindow) infoWindow = new maps.InfoWindow();
    markers.forEach((m) => m.setMap(null));
    markers = withCoords.map((p, i) => {
      const marker = new maps.Marker({
        position: { lat: Number(p.lat), lng: Number(p.lng) },
        map,
        label: { text: String(i + 1), color: "#fff", fontSize: "11px", fontWeight: "600" },
        icon: markerIcon(maps, categoryInfo(p.category).color),
        title: p.name,
      });
      marker.addListener("click", () => {
        infoWindow.setContent(buildRouteInfoContent(p));
        infoWindow.open({ map, anchor: marker });
      });
      return marker;
    });
    const bounds = new maps.LatLngBounds();
    withCoords.forEach((p) => bounds.extend({ lat: Number(p.lat), lng: Number(p.lng) }));
    map.fitBounds(bounds);
  } catch (err) {
    mapEl.classList.add("hidden");
    console.error(err);
  }
}

function buildRouteRow(place, markerNumber) {
  const li = document.createElement("li");
  li.className = "trip-item";
  li.style.setProperty("--category-color", categoryInfo(place.category).color);

  const dot = document.createElement("span");
  dot.className = "route-category-dot";

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
  title.textContent = `${markerNumber}. ${place.name || "(ohne Namen)"}`;
  const meta = document.createElement("div");
  meta.className = "trip-meta";
  const baseMeta = hasCoords(place) ? `${place.lat}, ${place.lng}` : (place.address || "Keine Koordinaten/Adresse");
  meta.textContent = place.rating ? `${starRating(place.rating)} ${place.rating} · ${baseMeta}` : baseMeta;
  info.append(title, meta);

  const link = document.createElement("a");
  link.className = "btn btn-ghost-dark";
  link.href = placeMapsUrl(place);
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Maps ↗";

  const thumbPart = [];
  if (place.photoRef) {
    const thumb = document.createElement("img");
    thumb.className = "place-thumb";
    thumb.src = photoUrl(place.photoRef, 120);
    thumb.alt = "";
    thumbPart.push(thumb);
  }

  li.append(dot, ...thumbPart, info, link);
  return li;
}

function renderList(places) {
  const list = document.getElementById("route-list");
  list.classList.remove("trips-list--timeline");
  list.innerHTML = "";
  places.forEach((place, i) => list.appendChild(buildRouteRow(place, i + 1)));
}

// Gruppiert nach arrivalDate (gleiches Muster wie plan.js) – nur für die
// Zeitachsen-Ansicht, wenn der Urlaub einen festen Zeitraum hat.
function groupedByDate(places) {
  const withDate = places.filter((p) => p.arrivalDate);
  const withoutDate = places.filter((p) => !p.arrivalDate);
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

// Zeitachsen-Ansicht: Reihenfolge/Gruppierung nach Datum, aber die Marker-
// Nummer bleibt die Position im ORIGINAL order-sortierten Array, damit sie
// weiterhin exakt zum entsprechenden Kartenmarker aus renderMap() passt.
function renderTimelineList(allOrderSorted) {
  const list = document.getElementById("route-list");
  list.classList.add("trips-list--timeline");
  list.innerHTML = "";

  const markerNumberById = new Map(allOrderSorted.map((p, i) => [p.id, i + 1]));
  groupedByDate(allOrderSorted).forEach((group) => {
    const heading = document.createElement("li");
    heading.className = "place-group-heading";
    heading.style.setProperty("--category-color", group.color);
    heading.textContent = group.label;
    list.appendChild(heading);

    group.places.forEach((place) => {
      list.appendChild(buildRouteRow(place, markerNumberById.get(place.id)));
    });
  });
}

function render() {
  const { currentTrip, places } = getState();
  const emptyEl = document.getElementById("route-empty");
  const fullRouteBtn = document.getElementById("open-full-route-btn");

  if (!currentTrip) {
    emptyEl.classList.remove("hidden");
    emptyEl.textContent = "Bitte zuerst einen Urlaub auswählen.";
    document.getElementById("route-map").classList.add("hidden");
    document.getElementById("route-list").innerHTML = "";
    fullRouteBtn.classList.add("hidden");
    return;
  }

  if (places.length === 0) {
    emptyEl.classList.remove("hidden");
    emptyEl.textContent = "Noch keine Orte im Plan – füge welche im Bereich \"Plan\" hinzu.";
    document.getElementById("route-map").classList.add("hidden");
    document.getElementById("route-list").innerHTML = "";
    fullRouteBtn.classList.add("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  const all = sortedPlaces();
  renderMap(all);
  if (currentTrip.startDate && currentTrip.endDate) {
    renderTimelineList(all);
  } else {
    renderList(all);
  }

  const routeUrl = fullRouteMapsUrl(all);
  fullRouteBtn.classList.toggle("hidden", !routeUrl);
  fullRouteBtn.onclick = () => routeUrl && window.open(routeUrl, "_blank", "noopener");
}

export function initRoute(statusCallback) {
  onStatus = statusCallback || (() => {});
  subscribe(render);
  render();
}
