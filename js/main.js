// Camper Touren – App-Einstieg
// Milestone 2: Google-Login (GIS OAuth) + Lese-Testabruf gegen das Sheet.
// Sheets-CRUD (voll), Places, Maps, Drag&Drop folgen in späteren Milestones.

import { registerServiceWorker } from "./sw-register.js";
import { login, logout, onAuthChange, isSignedIn, getUser } from "./auth.js";
import { testReadHeaders } from "./sheets.js";

function initNav() {
  const navButtons = document.querySelectorAll(".nav-item");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      navButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      // Milestone 5+: hier Views wechseln (Trips / Karte / Einstellungen)
    });
  });
}

function initOfflineBanner() {
  const banner = document.getElementById("offline-banner");
  const update = () => banner.classList.toggle("hidden", navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function setEmptyStateText(text) {
  document.getElementById("empty-state-text").textContent = text;
}

async function runSheetTest() {
  const testSection = document.getElementById("sheet-test");
  const output = document.getElementById("sheet-test-output");
  try {
    setEmptyStateText("Lese Sheet …");
    const { tripsHeader, placesHeader } = await testReadHeaders();
    testSection.classList.remove("hidden");
    output.textContent =
      `Trips!A1:G1  → ${JSON.stringify(tripsHeader)}\n` +
      `Places!A1:M1 → ${JSON.stringify(placesHeader)}`;
    setEmptyStateText(
      tripsHeader.length && placesHeader.length
        ? "Sheet-Zugriff funktioniert. Trip-Verwaltung folgt in Milestone 3."
        : "Sheet erreichbar, aber Kopfzeilen fehlen/leer – Tab-Namen und Spalten prüfen."
    );
  } catch (err) {
    testSection.classList.add("hidden");
    setEmptyStateText(`Fehler beim Sheet-Zugriff: ${err.message}`);
    console.error(err);
  }
}

function renderAuthState({ user, isSignedIn: signedIn }) {
  const loginBtn = document.getElementById("login-btn");
  const userChip = document.getElementById("user-chip");
  const userEmail = document.getElementById("user-email");

  loginBtn.classList.toggle("hidden", signedIn);
  userChip.classList.toggle("hidden", !signedIn);

  if (signedIn && user) {
    userEmail.textContent = user.email || "Angemeldet";
    runSheetTest();
  } else {
    document.getElementById("sheet-test").classList.add("hidden");
    setEmptyStateText("Bitte zuerst mit Google anmelden.");
  }
}

function initAuthUI() {
  onAuthChange(renderAuthState);
  renderAuthState({ user: getUser(), isSignedIn: isSignedIn() });

  document.getElementById("login-btn").addEventListener("click", async () => {
    try {
      await login();
    } catch (err) {
      setEmptyStateText(`Login fehlgeschlagen: ${err.message}`);
      console.error(err);
    }
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    logout();
  });
}

function init() {
  initNav();
  initOfflineBanner();
  initAuthUI();
  registerServiceWorker();
}

document.addEventListener("DOMContentLoaded", init);
