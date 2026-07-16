# Camper Touren – PWA

Private Camper-Urlaubsplanung (Orte, Tage, Routen, Google Sheets als Datenbank).

## Stand: Milestone 3 – Sheets-CRUD für Trips (über Apps Script)

Enthalten:
- `index.html` – App-Shell mit Header, Bottom-Nav, Urlaubs-Liste, Einstellungen
- `manifest.webmanifest` – installierbar als PWA
- `service-worker.js` – cached die App-Shell (HTML/CSS/JS/Icons) für Offline-Start
- `css/style.css`, `js/main.js`, `js/sw-register.js`
- `js/api.js` – Client für die Google-Apps-Script-Web-App (Trips/Places CRUD)
- `apps-script/Code.gs` – Code für Google Apps Script (wird manuell ins Google
  Sheet eingefügt, nicht automatisch deployt), legt die Tabs "Trips"/"Places"
  samt Kopfzeile automatisch an, falls sie fehlen
- `icons/` – Platzhalter-Icons (SVG)

Urlaube lassen sich anlegen, bearbeiten und löschen (Upsert per ID). Places
(Orte innerhalb eines Urlaubs) sind als CRUD-API vorbereitet, aber noch ohne UI.

Noch NICHT enthalten (folgt in späteren Milestones): Places-Suche, Karten/Routen,
Drag&Drop, IndexedDB-Offline-Cache für Trip-Daten.

## Technische Entscheidung: Apps Script statt Google-Cloud-OAuth

Ursprünglich lief der Sheet-Zugriff über einen client-seitigen Google-Login
(OAuth 2.0, Google Identity Services) direkt gegen die Sheets API. Das erwies
sich für ein privates 2-Personen-Projekt als unnötig aufwändig: Google-Cloud-
Projekt anlegen, Sheets API aktivieren, OAuth-Consent-Screen konfigurieren,
jeden Nutzer einzeln als Tester freischalten – bei jedem Fehler musste man in
der Cloud Console debuggen statt in der App.

Stattdessen läuft der komplette Datenzugriff jetzt über eine an das Sheet
gebundene **Google-Apps-Script-Web-App** (wie im Schwesterprojekt "Zeiterfassung"):
- Kein Login in der App nötig – die Web App läuft "als Ich" (Sheet-Besitzer)
  und ist für "Jeder" freigegeben.
- Keine Google-Cloud-Console-Einrichtung nötig, nur ein Copy-Paste in den
  Apps-Script-Editor des Sheets selbst.
- Die Web-App-URL ist der einzige "Schlüssel" und wird **nur lokal** in den
  App-Einstellungen gespeichert (`localStorage`), nie committed.

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

## Google Sheet einrichten (einmalig)

1. Neues Google Sheet anlegen (oder das bestehende Camper-Sheet verwenden).
2. Menü **Erweiterungen → Apps Script** öffnen.
3. Inhalt aus [`apps-script/Code.gs`](apps-script/Code.gs) in den Editor
   einfügen (bestehenden Beispielcode ersetzen).
4. Speichern, dann **Bereitstellen → Neue Bereitstellung**.
5. Typ: **Web App**.
   - "Ausführen als": **Ich (dein Google-Konto)**
   - "Wer hat Zugriff": **Jeder** (nötig, damit die App ohne Google-Login
     GET/POST-Requests senden kann)
6. Bereitstellen, Berechtigungen bestätigen.
7. Die angezeigte **Web-App-URL** (endet auf `/exec`) kopieren.

Die Tabs "Trips" und "Places" (inkl. Kopfzeile) werden beim ersten Zugriff
automatisch angelegt – im Sheet muss vorher nichts vorbereitet werden.

## App mit dem Sheet verbinden

1. In der App unten auf **"Einstellungen"** tippen.
2. Die kopierte Web-App-URL einfügen, **Speichern**.
3. Ab jetzt werden Urlaube direkt aus dem Sheet geladen und Änderungen dorthin
   geschrieben. Die URL bleibt lokal im Browser (`localStorage`) gespeichert.

Bei Änderungen an `Code.gs` muss im Sheet eine **neue Version** der
Bereitstellung erstellt werden (Bereitstellen → Bereitstellungen verwalten →
Bearbeiten → Neue Version) – die `/exec`-URL bleibt dabei gleich.

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

## Konfiguration (`js/config.js`)

`js/config.js` wird aus `js/config.example.js` erstellt und **mit committed**
(kein Secret, nur der client-seitige Maps-API-Key – siehe Kommentar in der
Beispieldatei). Wird erst ab der Places-Suche (Milestone 4) benötigt; die
Sheet-Anbindung läuft komplett über die Apps-Script-URL aus den Einstellungen.

## Hosting (GitHub Pages)

Dieses Repo ist für GitHub Pages vorbereitet – kein Server nötig, alles läuft
statisch im Browser. Nach dem Push auf `main` unter **Settings → Pages** als
Quelle Branch `main` / Root-Verzeichnis einstellen.

## Icons

`icons/camper_app_icon.png` ist die Quelldatei ("We travel the world"-Motiv,
2048×2048). Daraus generiert: `icon-192.png`, `icon-512.png` (normale
App-Icons), `icon-maskable-192.png`/`icon-maskable-512.png` (mit Safe-Zone-
Rand, damit OS-Masken nichts Wichtiges abschneiden) sowie
`apple-touch-icon.png` (180×180, eckig – iOS rundet selbst ab).

## Datenmodell (Google Sheet)

Wird beim ersten Zugriff automatisch angelegt, falls die Tabs noch fehlen:

- `Trips`: `id, name, startDate, endDate, note, createdAt, updatedAt`
- `Places`: `id, tripId, order, name, lat, lng, address, category, arrivalDate, departureDate, note, placeId, createdAt`

## Nächster Schritt (Milestone 4)

Places-Suche (Google Places API) und UI zum Hinzufügen von Orten zu einem
Urlaub, darauf aufbauend Kartenansicht (Milestone 5) und Drag&Drop-Reihenfolge
(Milestone 6).
