// Kopiere diese Datei zu "config.js" und trage dort den eigenen, öffentlichen
// Maps-API-Key ein. "config.js" wird mit committed/deployed (siehe unten).
//
// WICHTIG: Der Maps-API-Key ist ein Client-seitiger Wert, KEIN Secret – er
// MUSS aber per HTTP-Referrer-Beschränkung in der Google Cloud Console auf
// die eigene Domain begrenzt sein. Niemals einen Service-Account-Key hier
// eintragen. Der Sheet-Zugriff selbst läuft über Apps Script, nicht über
// diese Datei (siehe README, Abschnitt "Google Sheet / Apps Script").

export const CONFIG = {
  GOOGLE_MAPS_API_KEY: "REPLACE_ME",
};
