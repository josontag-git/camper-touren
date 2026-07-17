// Route-Ansicht: Karte mit ALLEN Orten des aktuellen Urlaubs (Marker nach
// Kategorie eingefärbt) + Absprung nach Google Maps (einzelner Ort oder
// gesamte Route als Wegpunkte). Liste steht unter der Karte.

import { getState, subscribe } from "./state.js";
import { categoryInfo } from "./categories.js";
import { loadMapsApi } from "./maps-loader.js";

let map = null;
let markers = [];

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
    markers.forEach((m) => m.setMap(null));
    markers = withCoords.map((p, i) => new maps.Marker({
      position: { lat: Number(p.lat), lng: Number(p.lng) },
      map,
      label: { text: String(i + 1), color: "#fff", fontSize: "11px", fontWeight: "600" },
      icon: markerIcon(maps, categoryInfo(p.category).color),
      title: p.name,
    }));
    const bounds = new maps.LatLngBounds();
    withCoords.forEach((p) => bounds.extend({ lat: Number(p.lat), lng: Number(p.lng) }));
    map.fitBounds(bounds);
  } catch (err) {
    mapEl.classList.add("hidden");
    console.error(err);
  }
}

function renderList(places) {
  const list = document.getElementById("route-list");
  list.innerHTML = "";

  places.forEach((place, i) => {
    const li = document.createElement("li");
    li.className = "trip-item";
    li.style.setProperty("--category-color", categoryInfo(place.category).color);

    const dot = document.createElement("span");
    dot.className = "route-category-dot";

    const info = document.createElement("div");
    info.className = "trip-info";
    const title = document.createElement("div");
    title.className = "trip-title";
    title.textContent = `${i + 1}. ${place.name || "(ohne Namen)"}`;
    const meta = document.createElement("div");
    meta.className = "trip-meta";
    meta.textContent = hasCoords(place) ? `${place.lat}, ${place.lng}` : (place.address || "Keine Koordinaten/Adresse");
    info.append(title, meta);

    const link = document.createElement("a");
    link.className = "btn btn-ghost-dark";
    link.href = placeMapsUrl(place);
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Maps ↗";

    li.append(dot, info, link);
    list.appendChild(li);
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
  renderList(all);

  const routeUrl = fullRouteMapsUrl(all);
  fullRouteBtn.classList.toggle("hidden", !routeUrl);
  fullRouteBtn.onclick = () => routeUrl && window.open(routeUrl, "_blank", "noopener");
}

export function initRoute() {
  subscribe(render);
  render();
}
