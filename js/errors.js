// Übersetzt technische Fehler (rohe API-JSON-Antworten, Netzwerkfehler) in
// kurze, verständliche Statuszeilen-Texte. Das volle Detail geht weiterhin
// per console.error() an die Konsole – hier nur die Kurzfassung für den Nutzer.

export function friendlyError(err) {
  const msg = err?.message || String(err);

  if (msg.includes("Places-API-Fehler") || msg.includes("places.googleapis.com")) {
    if (msg.includes("REFERRER") || msg.includes("referer")) {
      return "Google-Orte-Suche ist für diese Adresse nicht freigegeben (API-Key-Einschränkung prüfen).";
    }
    if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
      return "Google-Orte-Suche wurde abgelehnt (API-Key-Berechtigung prüfen).";
    }
    return "Die Google-Orte-Suche ist gerade nicht erreichbar.";
  }

  if (msg.includes("Gemini-API-Fehler")) {
    return "Gemini konnte nicht antworten. API-Key in den Einstellungen prüfen oder später erneut versuchen.";
  }

  if (msg.includes("Apps-Script-Antwort") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
    return "Die Urlaubsdaten konnten nicht geladen werden. Prüfe deine Internetverbindung.";
  }

  // Kurze, bereits verständliche Meldungen (kein JSON/Stacktrace) unverändert durchreichen.
  if (!msg.includes("{") && msg.length <= 140) return msg;

  return "Etwas ist schiefgelaufen. Bitte später erneut versuchen.";
}
