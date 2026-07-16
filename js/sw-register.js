// Registriert den Service Worker. Pfad ist bewusst relativ ("./service-worker.js"),
// damit es sowohl lokal als auch auf GitHub Pages funktioniert (siehe README.md,
// Abschnitt "Hosting (GitHub Pages)").
export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register("./service-worker.js", {
      scope: "./",
    });

    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "activated") {
          console.info("[SW] neue Version aktiv");
        }
      });
    });
  } catch (err) {
    console.error("[SW] Registrierung fehlgeschlagen:", err);
  }
}
