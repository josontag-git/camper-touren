# Camper Touren – PWA

Private Camper-Urlaubsplanung (Orte, Tage, Routen, Google Sheets als Datenbank).

## Stand: Milestone 1 – Grundgerüst

Enthalten:
- `index.html` – App-Shell mit Header, Bottom-Nav, Platzhalter-Views
- `manifest.webmanifest` – installierbar als PWA
- `service-worker.js` – cached die App-Shell (HTML/CSS/JS/Icons) für Offline-Start
- `css/style.css`, `js/main.js`, `js/sw-register.js`
- `icons/` – Platzhalter-Icons (SVG)

Noch NICHT enthalten (folgt in späteren Milestones): Google-Login, Sheets-Sync,
Places-Suche, Karten/Routen, Drag&Drop, IndexedDB-Offline-Cache für Trip-Daten.

## Technische Entscheidung: kein Build-Tool (kein Vite/React)

Der Vorschlag im Projekt-Briefing war Vanilla JS *oder* Vite+React. Ich habe mich
für **reines Vanilla JS ohne Build-Schritt** entschieden:

- Kein Build-Schritt nötig für GitHub Pages – die Dateien hier sind 1:1 das,
  was ausgeliefert wird.
- Einfacher zu debuggen auf dem Gerät im Camper (kein Sourcemap-Ärger).
- Für den Funktionsumfang (2 Nutzer, kein komplexer State) reicht Vanilla JS/ES-Module.

Falls sich das im Verlauf als zu unübersichtlich erweist (z. B. ab Milestone 5,
Drag&Drop-UI), können wir jederzeit auf ein leichtes Framework wechseln – dann
aber mit Kenntnis, dass dafür ein Build-Schritt vor dem Deploy nötig wird.

## Lokal starten

Kein `npm install` nötig. Einfach einen statischen Server im Projektordner starten:

```bash
# Variante A (Python, meist vorinstalliert)
python3 -m http.server 8080

# Variante B (Node, falls vorhanden)
npx serve .
```

Danach `http://localhost:8080` öffnen. Service Worker und Manifest funktionieren
nur über `http://localhost` oder HTTPS (nicht über `file://`).

Für den Google-Login lokal: `http://localhost:8080` (bzw. der genutzte Port)
muss als autorisierte JavaScript-Origin beim OAuth-Client in der Google Cloud
Console eingetragen sein, sonst schlägt der Login mit einem Origin-Fehler fehl.

## Konfiguration (`js/config.js`)

`js/config.js` ist per `.gitignore` ausgeschlossen (enthält Client-ID/Keys für
dieses Projekt) und muss lokal aus `js/config.example.js` erstellt werden.
Siehe Kommentar in der Beispieldatei für Details zu den einzutragenden Werten.

## Hosting (GitHub Pages)

Dieses Repo ist für GitHub Pages vorbereitet – kein Server nötig, alles läuft
statisch im Browser. Nach dem Push auf `main` unter **Settings → Pages** als
Quelle Branch `main` / Root-Verzeichnis einstellen. Die resultierende
`https://<user>.github.io/<repo>/`-URL muss anschließend ebenfalls als
autorisierte JavaScript-Origin beim OAuth-Client hinterlegt werden.

## Icons – bitte einmal nachziehen

Die Icons in `icons/` sind Platzhalter (einfache SVG-Van-Silhouette), da ich das
im Chat gezeigte App-Icon ("We travel the world") nicht automatisiert in diesen
Ordner speichern konnte. Bitte die Bilddatei direkt in diesen Projektordner legen
(z. B. als `icons/source-icon.png`) – dann erzeuge ich daraus im nächsten Schritt
das finale Icon-Set (192, 512, maskable, apple-touch-icon) als PNG.

## Nächster Schritt (Milestone 2)

Google-Login via Google Identity Services (OAuth 2.0), Testabruf gegen das
Google Sheet (lesen). Voraussetzung dafür: die Punkte 1–4 aus Abschnitt 3 des
Briefings (Google-Cloud-Projekt, APIs aktivieren, OAuth-Client-ID, API-Key) –
bitte Bescheid geben, sobald das erledigt ist, dann geht's weiter.
