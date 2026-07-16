// Einfacher Pub/Sub-State-Store (kein Framework) für den aktuell gewählten
// Urlaub + dessen Orte, damit trips.js/plan.js/route.js/inspire.js sich
// nicht gegenseitig importieren müssen.

const STORAGE_CURRENT_TRIP = "campingAppCurrentTripId";

let trips = [];
let places = [];
let currentTripId = localStorage.getItem(STORAGE_CURRENT_TRIP) || null;

const listeners = new Set();

function notify() {
  listeners.forEach((cb) => cb(getState()));
}

export function getState() {
  return {
    trips,
    places,
    currentTripId,
    currentTrip: trips.find((t) => t.id === currentTripId) || null,
  };
}

export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setTrips(newTrips) {
  trips = newTrips;
  if (currentTripId && !trips.some((t) => t.id === currentTripId)) {
    setCurrentTripId(trips[0]?.id || null);
    return;
  }
  notify();
}

export function setPlaces(newPlaces) {
  places = newPlaces;
  notify();
}

export function setCurrentTripId(id) {
  currentTripId = id;
  if (id) localStorage.setItem(STORAGE_CURRENT_TRIP, id);
  else localStorage.removeItem(STORAGE_CURRENT_TRIP);
  notify();
}
