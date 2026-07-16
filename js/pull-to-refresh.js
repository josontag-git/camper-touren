// Pull-to-Refresh: am oberen Rand der Seite nach unten ziehen lädt die
// aktuellen Trip-/Places-Daten neu. Reine Touch-Geste (kein Maus-Äquivalent),
// da vor allem für die iPhone-Nutzung als Home-Screen-App gedacht.

const TRIGGER_THRESHOLD = 55;
const MAX_PULL = 70;
const PULL_RESISTANCE = 0.5;

export function initPullToRefresh(onRefresh) {
  const indicator = document.getElementById("pull-refresh-indicator");
  const text = document.getElementById("pull-refresh-text");

  let startY = 0;
  let pulling = false;
  let refreshing = false;

  function atTop() {
    return (document.scrollingElement || document.documentElement).scrollTop <= 0;
  }

  document.addEventListener("touchstart", (e) => {
    if (refreshing || !atTop()) { pulling = false; return; }
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!pulling || refreshing) return;
    const delta = e.touches[0].clientY - startY;
    if (delta <= 0 || !atTop()) {
      pulling = false;
      indicator.style.height = "0px";
      return;
    }
    e.preventDefault();
    const height = Math.min(delta * PULL_RESISTANCE, MAX_PULL);
    indicator.style.height = `${height}px`;
    text.textContent = height >= TRIGGER_THRESHOLD ? "↑ Loslassen zum Aktualisieren" : "↓ Ziehen zum Aktualisieren";
  }, { passive: false });

  document.addEventListener("touchend", async () => {
    if (!pulling || refreshing) { pulling = false; return; }
    pulling = false;
    const height = parseFloat(indicator.style.height) || 0;
    if (height < TRIGGER_THRESHOLD) {
      indicator.style.height = "0px";
      return;
    }
    refreshing = true;
    text.textContent = "Aktualisiert …";
    indicator.style.height = "40px";
    try {
      await onRefresh();
    } finally {
      refreshing = false;
      indicator.style.height = "0px";
      text.textContent = "↓ Ziehen zum Aktualisieren";
    }
  });
}
