// Kopiere diese Datei zu "config.js" (wird per .gitignore ausgeschlossen) und
// trage dort die eigenen, öffentlichen Client-IDs/Keys ein.
//
// WICHTIG: Das hier sind Client-seitige Werte (OAuth Client-ID, Maps API-Key),
// KEIN Secret. Der Maps-API-Key MUSS per HTTP-Referrer-Beschränkung in der
// Google Cloud Console auf die eigene Domain begrenzt sein (siehe README /
// Briefing Abschnitt 3). Niemals einen Service-Account-Key hier eintragen.

export const CONFIG = {
  GOOGLE_OAUTH_CLIENT_ID: "REPLACE_ME.apps.googleusercontent.com",
  GOOGLE_MAPS_API_KEY: "REPLACE_ME",
  GOOGLE_SHEET_ID: "REPLACE_ME",
};
