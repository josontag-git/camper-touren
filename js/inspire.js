// Inspire-Ansicht: Ortsvorschläge per Gemini (Google-Search-Grounding).
// Braucht einen Gemini-API-Key (Einstellungen) – ohne Key nur ein Hinweis.

import { getGeminiKey } from "./settings.js";
import { getState } from "./state.js";

const MODEL = "gemini-3.5-flash";

let onAddToPlan = () => {};

function buildPrompt(query, trip) {
  const context = trip ? `Kontext: Urlaub "${trip.name}"${trip.startDate ? ` (${trip.startDate} bis ${trip.endDate})` : ""}.` : "";
  return (
    `${context}\n` +
    `Gib mir Vorschläge für: ${query}\n\n` +
    `Antworte AUSSCHLIESSLICH als nummerierte Liste, ein Vorschlag pro Zeile, ` +
    `Format exakt: "1. Name – Kurzbeschreibung (max. 1 Satz)". ` +
    `Keine Einleitung, keine Zusammenfassung, keine weiteren Erklärungen.`
  );
}

function parseSuggestions(text) {
  const items = [];
  const lines = text.split("\n");
  const re = /^\s*\d+[.)]\s*(.+?)\s*[–-]\s*(.+)$/;
  lines.forEach((line) => {
    const match = line.match(re);
    if (match) {
      items.push({ name: match[1].replace(/\*\*/g, "").trim(), description: match[2].trim() });
    }
  });
  return items;
}

async function callGemini(query) {
  const key = getGeminiKey();
  const { currentTrip } = getState();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(query, currentTrip) }] }],
      tools: [{ google_search: {} }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini-API-Fehler ${res.status}: ${body}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  return text;
}

function renderResults(items, rawText) {
  const container = document.getElementById("inspire-results");
  container.innerHTML = "";

  if (items.length === 0) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = rawText || "Keine Vorschläge gefunden.";
    container.appendChild(p);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "inspire-card";

    const title = document.createElement("div");
    title.className = "trip-title";
    title.textContent = item.name;

    const desc = document.createElement("div");
    desc.className = "trip-meta";
    desc.textContent = item.description;

    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary";
    addBtn.textContent = "Zu Plan hinzufügen";
    addBtn.addEventListener("click", () => onAddToPlan({ name: item.name, note: item.description }));

    card.append(title, desc, addBtn);
    container.appendChild(card);
  });
}

async function onSearch() {
  const input = document.getElementById("inspire-query");
  const query = input.value.trim();
  const btn = document.getElementById("inspire-search-btn");
  const container = document.getElementById("inspire-results");
  const hint = document.getElementById("inspire-key-hint");

  if (!getGeminiKey()) {
    hint.classList.remove("hidden");
    return;
  }
  hint.classList.add("hidden");
  if (!query) return;

  btn.disabled = true;
  btn.textContent = "Sucht …";
  container.innerHTML = "";
  try {
    const text = await callGemini(query);
    renderResults(parseSuggestions(text), text);
  } catch (err) {
    container.innerHTML = "";
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = err.message;
    container.appendChild(p);
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = "Vorschläge holen";
  }
}

export function initInspire(addToPlanCallback) {
  onAddToPlan = addToPlanCallback;
  document.getElementById("inspire-search-btn").addEventListener("click", onSearch);
  document.getElementById("inspire-query").addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSearch();
  });
  document.getElementById("inspire-key-hint").classList.toggle("hidden", !!getGeminiKey());
}

export function refreshInspireKeyHint() {
  document.getElementById("inspire-key-hint").classList.toggle("hidden", !!getGeminiKey());
}
