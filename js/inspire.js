// Inspire-Ansicht: Chat mit Gemini (Google-Search-Grounding) für Ideen zum
// Urlaub – echtes Hin und Her, Gemini kann auch Rückfragen stellen statt nur
// eine starre Liste auszuspucken. Rückfragen kommen zusätzlich als klickbare
// Antwort-Chips, konkrete Ortsvorschläge als Vorschau-Karten (Bild/Sterne aus
// der Google-Places-Suche) mit direkter Übernahme nach "Plan".

import { getGeminiKey } from "./settings.js";
import { getState, setPlaces } from "./state.js";
import { createPlace, deletePlace } from "./api.js";
import { photoUrl, starRating, searchGooglePlaces } from "./places-search.js";
import { openPlaceDetailModal } from "./place-details.js";
import { friendlyError } from "./errors.js";

const MODEL = "gemini-3.5-flash";
const EXAMPLE_HINT = "Frag nach Ideen für Orte, Routen oder Aktivitäten – z. B. \"Was können wir an einem Regentag an der Nordsee machen?\"";
const EXAMPLE_PLACEHOLDER = "z. B. Was können wir an einem Regentag machen?";
const FOLLOWUP_PLACEHOLDER = "Deine Antwort …";

let onStatus = () => {};
let conversation = []; // [{ role: "user"|"model", text, quickReplies?, placeSuggestions? }]
let resolvedSuggestions = {}; // key (name+query) -> { status: "loading"|"done"|"error", place? }
let addedSuggestions = new Map(); // key -> placeId des angelegten Plan-Eintrags
let typing = false; // Tipp-Indikator während auf Gemini gewartet wird

function suggestionKey(s) {
  return `${s.name}|${s.query || ""}`;
}

function scrollToBottom() {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
}

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
    `Hänge an JEDE Antwort ganz am Ende einen Codeblock der Form \`\`\`json\n` +
    `{"quickReplies": ["kurze klickbare Antwortoption", "..."], "places": [{"name": "Name des konkreten Orts", "query": "guter Google-Maps-Suchbegriff dafür (Name + Ort/Region)"}]}\n` +
    `\`\`\` an. "quickReplies": 2-4 kurze Antwortmöglichkeiten, wenn du eine Rückfrage gestellt hast ` +
    `(sonst leeres Array). "places": konkrete Orte, die du im Text vorgeschlagen hast und die sich ` +
    `lohnen würden nachzuschlagen (sonst leeres Array, nicht erzwingen). Der JSON-Block wird dem ` +
    `Nutzer nicht direkt angezeigt, sondern maschinell ausgewertet – halte dich exakt an dieses Format.`
  );
}

function extractStructured(text) {
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  if (matches.length === 0) return { reply: text.trim(), quickReplies: [], placeSuggestions: [] };

  const last = matches[matches.length - 1];
  let quickReplies = [];
  let placeSuggestions = [];
  try {
    const parsed = JSON.parse(last[1]);
    if (Array.isArray(parsed.quickReplies)) quickReplies = parsed.quickReplies.filter((s) => typeof s === "string");
    if (Array.isArray(parsed.places)) {
      placeSuggestions = parsed.places
        .filter((p) => p && typeof p.name === "string")
        .map((p) => ({ name: p.name, query: typeof p.query === "string" ? p.query : p.name }));
    }
  } catch {
    // Kaputtes/unerwartetes JSON -> einfach ignorieren, Chat läuft als reiner Text weiter.
  }
  const reply = text.slice(0, last.index).trim();
  return { reply: reply || text.trim(), quickReplies, placeSuggestions };
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

async function resolveSuggestion(suggestion) {
  const key = suggestionKey(suggestion);
  resolvedSuggestions[key] = { status: "loading" };
  renderConversation();
  try {
    const results = await searchGooglePlaces(suggestion.query || suggestion.name);
    resolvedSuggestions[key] = { status: "done", place: results[0] || null };
  } catch (err) {
    resolvedSuggestions[key] = { status: "error", error: err.message };
  }
  renderConversation();
}

async function addSuggestionToPlan(suggestion, place, btn) {
  const { currentTripId, places } = getState();
  if (!currentTripId) {
    onStatus("Bitte zuerst einen Urlaub auswählen oder anlegen.");
    return;
  }
  const key = suggestionKey(suggestion);
  btn.disabled = true;
  btn.textContent = "Speichert …";
  const record = {
    id: crypto.randomUUID(),
    tripId: currentTripId,
    order: places.length,
    name: place.displayName?.text || suggestion.name,
    category: "",
    arrivalDate: "",
    departureDate: "",
    address: place.formattedAddress || "",
    lat: place.location?.latitude ?? "",
    lng: place.location?.longitude ?? "",
    note: "",
    placeId: place.id || "",
    createdAt: new Date().toISOString(),
    photoRef: place.photos?.[0]?.name || "",
    rating: place.rating ?? "",
    userRatingCount: place.userRatingCount ?? "",
  };

  try {
    await createPlace(record);
    setPlaces([...places, record]);
    addedSuggestions.set(key, record.id);
    onStatus(`"${record.name}" zum Plan hinzugefügt.`);
    renderConversation();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Zu Plan hinzufügen";
    onStatus(`Fehler beim Speichern: ${friendlyError(err)}`);
    console.error(err);
  }
}

async function removeSuggestionFromPlan(suggestion, btn) {
  const key = suggestionKey(suggestion);
  const placeId = addedSuggestions.get(key);
  if (!placeId) return;
  btn.disabled = true;
  btn.textContent = "Entfernt …";
  try {
    await deletePlace(placeId);
    setPlaces(getState().places.filter((p) => p.id !== placeId));
    addedSuggestions.delete(key);
    renderConversation();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Hinzugefügt";
    onStatus(`Fehler beim Entfernen: ${friendlyError(err)}`);
    console.error(err);
  }
}

function buildSuggestionCard(suggestion) {
  const key = suggestionKey(suggestion);
  const card = document.createElement("div");
  card.className = "inspire-card inspire-suggestion-card";

  const resolved = resolvedSuggestions[key];
  if (!resolved) {
    resolveSuggestion(suggestion);
  }

  if (!resolved || resolved.status === "loading") {
    const loading = document.createElement("div");
    loading.className = "muted";
    loading.textContent = `Lädt „${suggestion.name}" …`;
    card.appendChild(loading);
    return card;
  }

  if (resolved.status === "error" || !resolved.place) {
    const errEl = document.createElement("div");
    errEl.className = "muted";
    errEl.textContent = `„${suggestion.name}" konnte nicht gefunden werden.`;
    card.appendChild(errEl);
    return card;
  }

  const place = resolved.place;
  const photo = place.photos?.[0];
  if (photo) {
    const img = document.createElement("img");
    img.className = "inspire-card-photo";
    img.src = photoUrl(photo.name);
    img.alt = place.displayName?.text || suggestion.name;
    card.appendChild(img);
  }

  const title = document.createElement("div");
  title.className = "trip-title";
  title.textContent = place.displayName?.text || suggestion.name;
  card.appendChild(title);

  if (place.rating) {
    const ratingEl = document.createElement("div");
    ratingEl.className = "trip-meta";
    ratingEl.textContent = `${starRating(place.rating)} ${place.rating} (${place.userRatingCount || 0})`;
    card.appendChild(ratingEl);
  }

  if (place.formattedAddress) {
    const addr = document.createElement("div");
    addr.className = "trip-meta";
    addr.textContent = place.formattedAddress;
    card.appendChild(addr);
  }

  const actions = document.createElement("div");
  actions.className = "inspire-card-actions";

  const addBtn = document.createElement("button");
  addBtn.className = "btn btn-primary";
  const alreadyAdded = addedSuggestions.has(key);
  addBtn.textContent = alreadyAdded ? "Hinzugefügt" : "Zu Plan hinzufügen";
  addBtn.addEventListener("click", () => {
    if (alreadyAdded) removeSuggestionFromPlan(suggestion, addBtn);
    else addSuggestionToPlan(suggestion, place, addBtn);
  });
  actions.appendChild(addBtn);

  if (place.id) {
    const detailsBtn = document.createElement("button");
    detailsBtn.className = "btn btn-ghost-dark";
    detailsBtn.textContent = "Details";
    detailsBtn.addEventListener("click", () => openPlaceDetailModal({
      name: place.displayName?.text || suggestion.name,
      placeId: place.id,
    }));
    actions.appendChild(detailsBtn);
  }

  card.appendChild(actions);

  return card;
}

function renderConversation() {
  const container = document.getElementById("inspire-results");
  const resetBtn = document.getElementById("inspire-reset-btn");
  container.innerHTML = "";
  resetBtn.classList.toggle("hidden", conversation.length === 0);

  if (conversation.length === 0) {
    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = EXAMPLE_HINT;
    container.appendChild(hint);
    return;
  }

  const firstModelIndex = conversation.findIndex((t) => t.role === "model");

  conversation.forEach((turn, index) => {
    const bubble = document.createElement("div");
    bubble.className = turn.role === "user" ? "chat-bubble chat-bubble-user" : "chat-bubble chat-bubble-model";
    bubble.textContent = turn.text;
    container.appendChild(bubble);

    if (turn.role !== "model") return;

    if (turn.quickReplies?.length) {
      const chipRow = document.createElement("div");
      chipRow.className = "category-filters inspire-quick-replies";
      turn.quickReplies.forEach((reply) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "category-chip";
        chip.textContent = reply;
        chip.addEventListener("click", () => { scrollToBottom(); onSend(reply); });
        chipRow.appendChild(chip);
      });
      container.appendChild(chipRow);
    }

    if (index === firstModelIndex) {
      const hintLine = document.createElement("p");
      hintLine.className = "inspire-hint-line";
      hintLine.textContent = `Beispiel: ${EXAMPLE_PLACEHOLDER}`;
      container.appendChild(hintLine);
    }

    if (turn.placeSuggestions?.length) {
      const headline = document.createElement("div");
      headline.className = "inspire-suggestions-headline";
      headline.textContent = "Meine Vorschläge:";
      container.appendChild(headline);

      const cardsWrap = document.createElement("div");
      cardsWrap.className = "inspire-results";
      turn.placeSuggestions.forEach((s) => cardsWrap.appendChild(buildSuggestionCard(s)));
      container.appendChild(cardsWrap);
    }
  });

  if (typing) {
    const typingBubble = document.createElement("div");
    typingBubble.className = "chat-bubble chat-bubble-model chat-bubble-typing";
    typingBubble.innerHTML = "<span></span><span></span><span></span>";
    container.appendChild(typingBubble);
  }
}

async function onSend(presetText) {
  const input = document.getElementById("inspire-query");
  const text = (presetText ?? input.value).trim();
  const hint = document.getElementById("inspire-key-hint");

  if (!getGeminiKey()) {
    hint.classList.remove("hidden");
    return;
  }
  hint.classList.add("hidden");
  if (!text) return;

  const btn = document.getElementById("inspire-search-btn");
  const wasFirstMessage = conversation.length === 0;
  conversation.push({ role: "user", text });
  input.value = "";
  typing = true;
  renderConversation();
  scrollToBottom();

  btn.disabled = true;
  btn.textContent = "…";
  onStatus("");
  try {
    const raw = await callGemini();
    const { reply, quickReplies, placeSuggestions } = extractStructured(raw);
    conversation.push({ role: "model", text: reply, quickReplies, placeSuggestions });
    if (wasFirstMessage) input.placeholder = FOLLOWUP_PLACEHOLDER;
  } catch (err) {
    onStatus(friendlyError(err));
    console.error(err);
  } finally {
    typing = false;
    renderConversation();
    scrollToBottom();
    btn.disabled = false;
    btn.textContent = "Senden";
  }
}

function resetConversation() {
  conversation = [];
  resolvedSuggestions = {};
  addedSuggestions = new Map();
  typing = false;
  document.getElementById("inspire-query").placeholder = EXAMPLE_PLACEHOLDER;
  onStatus("");
  renderConversation();
}

export function initInspire(statusCallback) {
  onStatus = statusCallback;
  document.getElementById("inspire-search-btn").addEventListener("click", () => onSend());
  document.getElementById("inspire-query").addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSend();
  });
  document.getElementById("inspire-reset-btn").addEventListener("click", resetConversation);
  document.getElementById("inspire-key-hint").classList.toggle("hidden", !!getGeminiKey());
  renderConversation();
}

export function refreshInspireKeyHint() {
  document.getElementById("inspire-key-hint").classList.toggle("hidden", !!getGeminiKey());
}
