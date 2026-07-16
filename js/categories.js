// Zentrale Kategorie-Definition für Places: Name + Farbe, gemeinsam genutzt
// von plan.js (Gruppierung/Filter) und route.js (Marker-Farben/Legende).

export const CATEGORIES = [
  { id: "Camping", label: "Camping", color: "#2f7f6e" },
  { id: "Sport", label: "Sport", color: "#e0703a" },
  { id: "Sightseeing", label: "Sightseeing", color: "#3a6fb0" },
  { id: "Restaurant", label: "Restaurant", color: "#c2417a" },
  { id: "Sonstiges", label: "Sonstiges", color: "#8a7d5e" },
];

export const UNCATEGORIZED = { id: "", label: "Ohne Kategorie", color: "#9199ab" };

export function categoryInfo(id) {
  return CATEGORIES.find((c) => c.id === id) || UNCATEGORIZED;
}

export const ALL_CATEGORY_IDS = [...CATEGORIES.map((c) => c.id), UNCATEGORIZED.id];

// Rendert die Filter-Chip-Leiste (Kategorie an-/abwählen) in `container`.
// `isActiveFn(id)` liefert den aktuellen Sichtbarkeitsstatus je Kategorie.
export function renderCategoryFilterChips(container, isActiveFn, onToggle) {
  container.innerHTML = "";
  [...CATEGORIES, UNCATEGORIZED].forEach((cat) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "category-chip";
    chip.classList.toggle("is-active", isActiveFn(cat.id));
    chip.style.setProperty("--chip-color", cat.color);
    chip.textContent = cat.label;
    chip.addEventListener("click", () => onToggle(cat.id));
    container.appendChild(chip);
  });
}
