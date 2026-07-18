// Wiederverwendbare Pointer-basierte Drag&Drop-Sortierung (Maus UND Touch)
// für Listen mit einem Ziehgriff-Element. Ursprünglich für die Orte-Liste in
// plan.js gebaut (native HTML5-Drag&Drop löst auf iOS/den meisten mobilen
// Browsern ohne Touch-Support nicht aus) – jetzt auch von trips.js und
// categories.js für die Touren-/Kategorien-Sortierung in den Einstellungen
// genutzt.

let activeDrag = null;

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

  const items = getSiblings(li).map((el) => {
    const r = el.getBoundingClientRect();
    return { id: el.dataset.id, el, top: r.top, bottom: r.bottom };
  });

  activeDrag = { id: li.dataset.id, pointerId: e.pointerId, li, items, startClientY: e.clientY, targetId: null, onDrop };
  li.classList.add("dragging");
  try { e.target.setPointerCapture(e.pointerId); } catch { /* iOS < 13 ohne Pointer-Capture: Fallback ohne */ }

  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onEnd);
  document.addEventListener("pointercancel", onEnd);
}

function onMove(e) {
  if (!activeDrag || e.pointerId !== activeDrag.pointerId) return;
  const deltaY = e.clientY - activeDrag.startClientY;
  activeDrag.li.style.transform = `translateY(${deltaY}px)`;

  const target = activeDrag.items.find((item) => e.clientY >= item.top && e.clientY <= item.bottom);
  activeDrag.items.forEach((item) => item.el.classList.toggle("drop-target", item === target));
  activeDrag.targetId = target ? target.id : null;
}

function onEnd(e) {
  if (!activeDrag || e.pointerId !== activeDrag.pointerId) return;
  const { li, targetId, id, items, onDrop } = activeDrag;
  li.style.transform = "";
  li.classList.remove("dragging");
  items.forEach((item) => item.el.classList.remove("drop-target"));
  document.removeEventListener("pointermove", onMove);
  document.removeEventListener("pointerup", onEnd);
  document.removeEventListener("pointercancel", onEnd);
  activeDrag = null;
  if (targetId && targetId !== id) onDrop(id, targetId);
}
