// Wiederverwendbare Pointer-basierte Drag&Drop-Sortierung (Maus UND Touch)
// für Listen mit einem Ziehgriff-Element. Ursprünglich für die Orte-Liste in
// plan.js gebaut (native HTML5-Drag&Drop löst auf iOS/den meisten mobilen
// Browsern ohne Touch-Support nicht aus) – jetzt auch von trips.js und
// categories.js für die Touren-/Kategorien-Sortierung in den Einstellungen
// genutzt.

let activeDrag = null;

// Auto-Scroll, wenn beim Ziehen der Rand des sichtbaren Bereichs erreicht
// wird -- .place-drag-handle setzt touch-action:none, wodurch das normale
// Scrollen per Touch während des Ziehens deaktiviert ist; ohne das hier
// ließe sich ein Ort nie in eine Gruppe (Abschnitt/Datum) außerhalb des
// aktuell sichtbaren Bereichs ziehen.
const SCROLL_ZONE = 90; // px vom oberen/unteren Viewport-Rand
const SCROLL_MAX_SPEED = 16; // px pro Frame bei maximaler Nähe zum Rand

// handle: das Ziehgriff-Element (bekommt den pointerdown-Listener).
// li: die zu ziehende Listenzeile (bekommt data-id + die "dragging"-Klasse).
// getSiblings(li): liefert die anderen Zeilen, mit denen li die Position
// tauschen darf (z. B. nur innerhalb derselben Kategorie-Gruppe).
// onDrop(sourceId, targetId): wird beim Loslassen über einer anderen Zeile aufgerufen.
export function attachDragHandle(handle, li, getSiblings, onDrop) {
  handle.addEventListener("pointerdown", (e) => startDrag(e, li, getSiblings, onDrop));
}

function startDrag(e, li, getSiblings, onDrop) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  e.preventDefault();

  // Dokument-relative Positionen (getBoundingClientRect() + aktueller
  // Scroll-Versatz) statt Viewport-relativer -- sonst würden die
  // gespeicherten Positionen ungültig, sobald während des Ziehens
  // automatisch gescrollt wird.
  const items = getSiblings(li).map((el) => {
    const r = el.getBoundingClientRect();
    return { id: el.dataset.id, el, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
  });

  activeDrag = {
    id: li.dataset.id, pointerId: e.pointerId, li, items, onDrop,
    startClientY: e.clientY, startScrollY: window.scrollY,
    lastClientY: e.clientY, targetId: null, scrollSpeed: 0, scrollRaf: null,
  };
  li.classList.add("dragging");
  try { e.target.setPointerCapture(e.pointerId); } catch { /* iOS < 13 ohne Pointer-Capture: Fallback ohne */ }

  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onEnd);
  document.addEventListener("pointercancel", onEnd);
  activeDrag.scrollRaf = requestAnimationFrame(scrollTick);
}

// Aktualisiert die visuelle Position der gezogenen Zeile und das aktuelle
// Drop-Ziel -- läuft sowohl bei pointermove als auch bei jedem Auto-Scroll-
// Frame, da sich das Ziel unter dem Finger auch ohne Fingerbewegung ändert,
// sobald die Seite selbst weiterscrollt.
function updateDragVisuals() {
  const { lastClientY, startClientY, startScrollY } = activeDrag;
  const deltaY = (lastClientY - startClientY) + (window.scrollY - startScrollY);
  activeDrag.li.style.transform = `translateY(${deltaY}px)`;

  const docY = lastClientY + window.scrollY;
  const target = activeDrag.items.find((item) => docY >= item.top && docY <= item.bottom);
  activeDrag.items.forEach((item) => item.el.classList.toggle("drop-target", item === target));
  activeDrag.targetId = target ? target.id : null;
}

function updateAutoScrollSpeed(clientY) {
  const vh = window.innerHeight;
  let speed = 0;
  if (clientY < SCROLL_ZONE) {
    speed = -SCROLL_MAX_SPEED * (1 - Math.max(clientY, 0) / SCROLL_ZONE);
  } else if (clientY > vh - SCROLL_ZONE) {
    speed = SCROLL_MAX_SPEED * (1 - Math.max(vh - clientY, 0) / SCROLL_ZONE);
  }
  activeDrag.scrollSpeed = speed;
}

function scrollTick() {
  if (!activeDrag) return;
  if (activeDrag.scrollSpeed) {
    window.scrollBy(0, activeDrag.scrollSpeed);
    updateDragVisuals();
  }
  activeDrag.scrollRaf = requestAnimationFrame(scrollTick);
}

function onMove(e) {
  if (!activeDrag || e.pointerId !== activeDrag.pointerId) return;
  activeDrag.lastClientY = e.clientY;
  updateAutoScrollSpeed(e.clientY);
  updateDragVisuals();
}

function onEnd(e) {
  if (!activeDrag || e.pointerId !== activeDrag.pointerId) return;
  const { li, targetId, id, items, onDrop, scrollRaf } = activeDrag;
  cancelAnimationFrame(scrollRaf);
  li.style.transform = "";
  li.classList.remove("dragging");
  items.forEach((item) => item.el.classList.remove("drop-target"));
  document.removeEventListener("pointermove", onMove);
  document.removeEventListener("pointerup", onEnd);
  document.removeEventListener("pointercancel", onEnd);
  activeDrag = null;
  if (targetId && targetId !== id) onDrop(id, targetId);
}
