// Inspire-Ansicht: Chat mit Gemini (Google-Search-Grounding) für Ideen zum
// Urlaub – echtes Hin und Her, Gemini kann auch Rückfragen stellen statt nur
// eine starre Liste auszuspucken. Konkrete Orte suchen/hinzufügen passiert
// in Plan (dort mit den vollen Google-Maps-Funktionen).

import { getGeminiKey } from "./settings.js";
import { getState } from "./state.js";

const MODEL = "gemini-3.5-flash";

let onStatus = () => {};
let conversation = []; // [{ role: "user" | "model", text }]

function systemContext() {
  const { currentTrip } = getState();
  const tripInfo = currentTrip
    ? `Der Nutzer plant gerade den Urlaub "${currentTrip.name}"${currentTrip.startDate ? ` (${currentTrip.startDate} bis ${currentTrip.endDate})` : ""}.`
    : "Der Nutzer hat noch keinen konkreten Urlaub ausgewählt.";
  return (
    `Du bist "Inspire", ein kreativer Reise-Assistent in einer Camper-Urlaubsplanungs-App. ` +
    `${tripInfo} Gib konkrete, kreative Ideen (Orte, Routen, Aktivitäten, Zeitpunkte) und ` +
    `stelle bei Bedarf gezielte Rückfragen, um die Vorschläge zu verbessern (z. B. nach Interessen, ` +
    `verfügbarer Zeit, Reisestil). Antworte kurz und konkret, keine langen Einleitungen. ` +
    `Die konkrete Suche/Speicherung einzelner Orte macht der Nutzer separat im Bereich "Plan" – ` +
    `du musst keine Orte strukturiert auflisten, ein normales Gespräch reicht.`
  );
}

async function callGemini() {
  const key = getGeminiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const contents = conversation.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemContext() }] },
      tools: [{ google_search: {} }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini-API-Fehler ${res.status}: ${body}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) throw new Error("Keine Antwort von Gemini erhalten.");
  return text;
}

function renderConversation() {
  const container = document.getElementById("inspire-results");
  container.innerHTML = "";

  if (conversation.length === 0) {
    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = "Frag nach Ideen für Orte, Routen oder Aktivitäten – z. B. \"Was können wir an einem Regentag an der Nordsee machen?\"";
    container.appendChild(hint);
    return;
  }

  conversation.forEach((turn) => {
    const bubble = document.createElement("div");
    bubble.className = turn.role === "user" ? "chat-bubble chat-bubble-user" : "chat-bubble chat-bubble-model";
    bubble.textContent = turn.text;
    container.appendChild(bubble);
  });
}

async function onSend() {
  const input = document.getElementById("inspire-query");
  const text = input.value.trim();
  const hint = document.getElementById("inspire-key-hint");

  if (!getGeminiKey()) {
    hint.classList.remove("hidden");
    return;
  }
  hint.classList.add("hidden");
  if (!text) return;

  const btn = document.getElementById("inspire-search-btn");
  conversation.push({ role: "user", text });
  input.value = "";
  renderConversation();

  btn.disabled = true;
  btn.textContent = "…";
  onStatus("");
  try {
    const reply = await callGemini();
    conversation.push({ role: "model", text: reply });
    renderConversation();
  } catch (err) {
    onStatus(err.message);
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = "Senden";
  }
}

export function initInspire(statusCallback) {
  onStatus = statusCallback;
  document.getElementById("inspire-search-btn").addEventListener("click", onSend);
  document.getElementById("inspire-query").addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSend();
  });
  document.getElementById("inspire-key-hint").classList.toggle("hidden", !!getGeminiKey());
  renderConversation();
}

export function refreshInspireKeyHint() {
  document.getElementById("inspire-key-hint").classList.toggle("hidden", !!getGeminiKey());
}
