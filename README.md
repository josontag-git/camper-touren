# Camper Touren – PWA

Private Camper-Urlaubsplanung (Orte, Tage, Routen, Google Sheets als Datenbank).

## UX-Nacharbeit (nach Milestone 6)

Nach einer UX-Durchsicht behoben:
- **Sortieren in Plan funktioniert jetzt auf dem Handy.** Die alte native
  HTML5-Drag&Drop-API (`draggable`) löst auf iOS/den meisten mobilen Browsern
  nicht über Touch aus – `js/plan.js` nutzt jetzt eine eigene, auf Pointer
  Events basierende Drag-Logik (Maus UND Touch), Drag-Handle-Icon von „☰"
  (liest sich wie ein Menü) auf „⠿" geändert.
- **Kontrast:** `--color-muted` in Mono/Seaview/Beach/Mountain View/Relax war
  unter dem WCAG-AA-Grenzwert (4.5:1) für Fließtext – nachgedunkelt.
- **Touch-Targets:** `.trip-icon-btn` (Bearbeiten/Löschen-Icons in jeder
  Liste) von 34×34px auf 44×44px vergrößert.
- **Fehlermeldungen:** rohe API-JSON-Fehler (z. B. Places-API-403) werden
  nicht mehr direkt in der Status-Zeile angezeigt, sondern über
  `js/errors.js` (`friendlyError()`) in einen kurzen, verständlichen Satz
  übersetzt; das technische Detail steht weiterhin per `console.error` in
  der Browser-Konsole.

## Stand: Milestone 8 – Wunschliste, Header mit Tourname, Kategorien geräteübergreifend

Der Header zeigt den Namen des gewählten Urlaubs (statt "Camper Touren")
direkt mit den Trip-Aktionen daneben: Stift zum Bearbeiten, ein Auswahl-Icon
(öffnet den nativen Urlaub-Auswahldialog) und „＋" für einen neuen Urlaub –
Löschen gibt es bewusst nur noch in den Einstellungen, mit zweistufiger
Bestätigung, siehe unten. Für den gewählten Urlaub gibt es drei Bereiche plus
Einstellungen (floatende Bottom-Nav mit Icon + Text-Label):

- **Inspire** – Chat mit Gemini (Google-Search-Grounding, Mehrturn-Konversation)
  für kreative Ideen zum Urlaub, mit Tipp-Indikator während der Antwort
  überlegt wird. Rückfragen kommen zusätzlich als klickbare Antwort-Chips
  (Klick befüllt, sendet die Nachricht und scrollt automatisch ans Ende).
  Konkrete Ortsvorschläge erscheinen unter der Headline „Meine Vorschläge:"
  als Vorschau-Karten (Foto + Sterne-Bewertung aus der Google-Places-Suche)
  mit drei Aktionen: „Zu Plan hinzufügen" (fest einplanen, lässt sich per
  erneutem Klick auf „Hinzugefügt" wieder entfernen), „Details" (öffnet
  dieselbe Fotos/Rezensionen-Detailansicht wie in Plan/Route) und „Könnte
  interessant sein" (unverbindlich vormerken, siehe Wunschliste unten).
  Braucht einen Gemini-API-Key (Einstellungen), sonst nur ein Hinweis statt
  Chat. „Neue Inspiration" ganz unten setzt die Konversation zurück auf die
  leere Ausgangsansicht.
- **Plan** – Orte suchen (volle Google-Places-Suche: Umkreis um den aktuellen
  Standort, Foto, Sterne-Bewertung + Link zur Maps-Seite, Kategorie per Button
  wählen) oder manuell eintragen, nach Kategorie gruppiert mit Filter-Chips
  zum Ein-/Ausblenden. Umschaltbar zwischen Ansicht nach Kategorie (mit
  Drag&Drop-Sortierung, auch per Touch), nach Datum (als vertikale Zeitachse,
  sobald der Urlaub Start-/Enddatum hat), oder nach aktueller Entfernung
  (Standortabfrage). Gespeicherte Orte aus einer Suche zeigen in der Liste
  ein Vorschaubild + Sterne; antippen öffnet eine Detailansicht mit weiteren
  Fotos und Rezensionen. Orte ohne Kategorie (u. a. alle aus Inspire fest
  hinzugefügten) laufen unter „Noch nicht eingeplante Orte". Ganz oben
  erscheint zusätzlich, falls vorhanden, der Block „💡 Könnte interessant
  sein" – eine lose Wunschliste (z. B. aus Inspire vorgemerkte Orte) mit „Zu
  Plan verschieben" (fest einplanen) oder „✕" (verwerfen) je Eintrag,
  komplett getrennt von den normalen Kategorie-/Datum-/Entfernung-Ansichten.
- **Route** – Karte (Google Maps JavaScript API) mit ALLEN Orten des Urlaubs,
  die Koordinaten haben – Marker nach Kategorie eingefärbt –, Liste darunter
  (ebenfalls mit Vorschaubild/Sterne + antippbarer Detailansicht). Hat der
  Urlaub ein Start-/Enddatum, gruppiert sich die Liste wie in Plan entlang
  einer vertikalen Zeitachse nach Ankunftsdatum – die Nummerierung bleibt
  dabei die Positions-Nummer aus der Routen-Reihenfolge, damit sie weiterhin
  zum passenden Kartenmarker passt. Plus Absprung einzelner Orte oder der
  gesamten Route nach Google Maps.
- **Einstellungen** – Apps-Script-URL, Gemini-API-Key, Farbschema,
  Header-Hintergrund, sowie Urlaubs- und Kategorienverwaltung (siehe unten).

Direkt unter dem Header klebt ein Changelog-Banner mit einem kurzen Hinweis
auf die letzte nennenswerte Änderung, per „✕" dauerhaft ausblendbar
(erscheint erst wieder, wenn sich der Text beim nächsten Release ändert).
Ganz unten, unterhalb der Fußnavigation, steht klein die aktuelle
App-Shell-Version (aus `service-worker.js` `CACHE_VERSION`, live geladen) –
hilfreich, um zu erkennen, ob ein Gerät noch eine alte, gecachte Version
zeigt. Am oberen Rand nach unten ziehen (Pull-to-Refresh) lädt Urlaube/Orte
neu.

### Design

Helles, warmes Grundlayout (Creme-Hintergrund, schwarzer Text, abgerundete
weiße Karten mit weichem Schatten statt Rahmen, pillenförmige Buttons/Chips,
floatende schwarze Bottom-Nav mit weißem Kreis um das aktive Icon) –
angelehnt an ein vorgegebenes Referenzdesign. "Mono" (Schwarz/Weiß/Creme) ist
das Standard-Farbschema; die übrigen 8 Farbschemata (Seaview, Sunset, Beach,
Citylights, Mountain View, Party, Relax, Crazy) überschreiben nur die
Farbwerte, nicht die Grundform der Elemente.

### Urlaubsverwaltung (Einstellungen)

Die Trip-Leiste oben bietet nur noch Bearbeiten (Stift) und einen neuen
Urlaub anlegen ("＋"). Gelöscht wird ausschließlich unter
**Einstellungen → Urlaube verwalten**: jeder Urlaub lässt sich dort inline
bearbeiten (Name/Zeitraum/Notiz) oder löschen. Löschen entfernt den Urlaub
inkl. aller zugehörigen Orte unwiderruflich und erfordert eine zweite,
inline eingeblendete Bestätigung ("Wirklich löschen? Ja, löschen / Abbrechen").

### Kategorienverwaltung (Einstellungen)

Unter **Einstellungen → Kategorien verwalten** lassen sich die Orts-
Kategorien umbenennen, umfärben, löschen oder neu anlegen. Kategorien gelten
global für die gesamte App (nicht pro Urlaub) und laufen seit Milestone 8
**über das Google Sheet** (neuer Tab `Categories`, siehe Datenmodell) statt
nur in `localStorage` – damit sind sie jetzt geräteübergreifend synchron,
genau wie Trips/Places. Standard sind
Camping/Sport/Sightseeing/Restaurant/Sonstiges. Beim allerersten Laden nach
dem Umstieg werden ein evtl. vorhandener alter `localStorage`-Stand (oder
sonst die Standardkategorien) einmalig ins Sheet übernommen.

**Wichtig:** Das setzt voraus, dass die Apps-Script-Bereitstellung den
`Categories`-Tab bereits kennt (siehe "App mit dem Sheet verbinden" – neue
Version bereitstellen). Erkennt die App eine noch nicht aktualisierte
Bereitstellung (die Antwort enthält kein `categories`-Feld), bleiben
Kategorien automatisch im alten, rein lokalen `localStorage`-Modus – es wird
in dem Fall **nichts** ins Sheet geschrieben, um keine falschen Zeilen in
Trips/Places anzulegen. Änderungen wirken sich sofort auf Plan (Gruppierung/
Filter) und Route (Marker-Farben) aus.

Dateien:
- `index.html`, `css/style.css`, `manifest.webmanifest`, `service-worker.js`
- `js/main.js` – Bootstrap, View-Umschaltung, Einstellungen
- `js/state.js` – kleiner Pub/Sub-Store (aktueller Urlaub, seine Orte, Kategorie-Filter)
- `js/settings.js` – localStorage-Einstellungen (Apps-Script-URL, Gemini-Key)
- `js/theme.js` – Farbschema-Verwaltung
- `js/header-theme.js` – Header-Hintergrundmotiv-Verwaltung (feste
  CSS-Gradient-Auswahl, kein Foto-Zugriff)
- `js/changelog.js` – Text + Dismiss-Status für das "Was ist neu"-Banner
- `js/categories.js` – Kategorie-Definitionen (Name+Farbe) + Chip-Rendering,
  synchron über das Sheet (mit lokalem Fallback, siehe Kategorienverwaltung)
- `js/maps-loader.js` – lädt die Google Maps JavaScript API einmalig nach
  (gemeinsam genutzt von Route für die Karte und Plan für die Orts-Suche)
- `js/places-search.js` – gemeinsame Places-Text-Search-Helper (Foto-URL,
  Sterne-Rendering, Suche), genutzt von `plan.js` und `inspire.js`
- `js/place-details.js` – Detailansicht (Modal) für einen gespeicherten Ort:
  weitere Fotos + Rezensionen via Places-API-"Place Details"
- `js/errors.js` – übersetzt technische API-Fehler in kurze, verständliche
  Statuszeilen-Texte (`friendlyError()`)
- `js/trips.js`, `js/plan.js`, `js/route.js`, `js/inspire.js` – die vier Bereiche
- `js/pull-to-refresh.js` – Pull-to-Refresh-Geste
- `js/api.js` – Client für die Google-Apps-Script-Web-App (Trips/Places CRUD)
- `apps-script/Code.gs` – Code für Google Apps Script (wird manuell ins Google
  Sheet eingefügt, nicht automatisch deployt), legt die Tabs "Trips"/"Places"
  samt Kopfzeile automatisch an, formatiert Zellen vor dem Schreiben als Text
  (sonst wandelt Sheets zahlen-/datumsähnliche Werte wie Koordinaten automatisch um)
- `icons/` – App-Icon-Set

Trip-/Places-Daten werden nach jedem erfolgreichen Laden in `localStorage`
gecacht (`js/api.js`) – offline zeigt die App den zuletzt geladenen Stand
statt nur einen Fehler. Beim Löschen eines Urlaubs werden dessen Orte
automatisch mitgelöscht (kein manuelles Aufräumen nötig).

Die Places-Suche in Plan nutzt die Places API (New) – dafür müssen im
Google-Cloud-Projekt neben der Maps JavaScript API auch **Places API (New)**
aktiviert und beim API-Key sowohl als Anwendungs- (HTTP-Referrer der
GitHub-Pages-Domain) als auch als API-Einschränkung (Places API (New) zur
Liste hinzufügen) freigegeben sein.

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

Die App hat die Web-App-URL des Camper-Sheets bereits als Standardwert
hinterlegt (`js/settings.js`, `DEFAULT_SCRIPT_URL`) – ohne weiteres Zutun
nutzbar. Für ein anderes Sheet: in der App unter **"Einstellungen"** die
eigene Web-App-URL eintragen und speichern (überschreibt den Default nur
lokal im Browser, `localStorage`).

**Sicherheitshinweis:** Die Standard-URL liegt damit im (öffentlichen)
Repo-Code – wer sie kennt, kann Daten in dieses Sheet schreiben/lesen (kein
Login nötig, "Zugriff: Jeder"-Deployment). Bewusste Entscheidung für dieses
private Reise-Sheet ohne sensible Daten.

Bei Änderungen an `Code.gs` muss im Sheet eine **neue Version** der
Bereitstellung erstellt werden (Bereitstellen → Bereitstellungen verwalten →
Bearbeiten → Neue Version) – die `/exec`-URL bleibt dabei gleich.

## Gemini-API-Key (für Inspire)

Kostenlos erstellbar auf [aistudio.google.com](https://aistudio.google.com/apikey),
dann in der App unter **Einstellungen** eintragen (nur lokal gespeichert,
nicht committed). Ohne Key zeigt "Inspire" nur einen Hinweis statt der Suche.

## Farbschema

Unter **Einstellungen → Farbschema** wählbar: Mono (Standard), Seaview,
Sunset, Beach, Citylights, Mountain View, Party, Relax, Crazy. Definiert als
CSS-Variablen pro `[data-color-theme="…"]` in `css/style.css`.

## Header-Hintergrund

Unter **Einstellungen → Header-Hintergrund** wählbar: kein Bild, drei
Meer-Varianten (Türkis, Tiefblau, Sonnenuntergang), Berge, Wald, Wüste,
Sternenhimmel. Reine `linear-/radial-gradient`-Motive in `css/style.css`
(`.app-header[data-header-theme="…"]`) statt echter Fotos – dafür gibt es
keine lizenzfreie Bildquelle im Projekt. Auswahl in `localStorage`
(`js/header-theme.js`), unabhängig vom Farbschema.

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

Wird beim ersten Zugriff automatisch angelegt, falls die Tabs noch fehlen;
fehlende Kopfzeilen-Spalten werden beim nächsten Zugriff automatisch ergänzt
(additive Migration in `getOrCreateSheet`, bestehende Zeilen bleiben unberührt):

- `Trips`: `id, name, startDate, endDate, note, createdAt, updatedAt`
- `Places`: `id, tripId, order, name, lat, lng, address, category, arrivalDate, departureDate, note, placeId, createdAt, photoRef, rating, userRatingCount, status`
- `Categories`: `id, label, color`

`photoRef`/`rating`/`userRatingCount` werden nur bei Orten aus einer
Places-Suche befüllt (Plan-Suche oder Inspire-Vorschau) – manuell angelegte
Orte bleiben dort leer, Listen zeigen dann wie bisher nur Text ohne
Vorschaubild/Sterne. `status` ist `""` (fest eingeplant) oder `"interested"`
("Könnte interessant sein", siehe Wunschliste in Plan). **Nach dem Update
von `Code.gs`** muss im Sheet wie gewohnt eine neue Version der
Apps-Script-Bereitstellung erstellt werden (siehe oben, "App mit dem Sheet
verbinden") – bis dahin bleiben Kategorien lokal (siehe
Kategorienverwaltung), Trips/Places funktionieren unverändert weiter.

## Mögliche nächste Schritte

Echte Rezensions-Volltextsuche/-Filterung, evtl. Offline-Caching der
Foto-URLs (aktuell werden sie live bei jedem Rendern über die Places API
nachgeladen).
