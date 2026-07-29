# Let’s Camp – PWA

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

## UX-Nacharbeit (nach Milestone 8)

- **Fotogalerie im Ortsdetails-Modal reparlert:** `.inspire-photo-gallery`
  (genutzt vom Detail-Modal und von Plans Suchergebnis-Detailkarte) sprengte
  als Flex-Item ohne `min-width: 0` ihre Panel-Breite (Flexbox-Item behält
  ohne diese Angabe seine intrinsische Content-Breite statt zu schrumpfen) –
  Bilder liefen dadurch über das Modal-Layout hinaus statt intern zu
  scrollen. Fix in `css/style.css`.
- **Nachtrag zum Galerie-Fix – Bilder erschienen als dünne, verzerrte
  Farbstreifen:** live auf Produktion reproduziert (lokal wegen der
  Places-API-Referrer-Sperre nicht möglich). Ursache war ein zweiter,
  unabhängiger Flexbox-Bug: `.inspire-photo-gallery` setzt `overflow-x: auto`,
  wodurch der Browser automatisch auch `overflow-y` auf `auto` setzt (Spec-
  Regel: „visible" + „auto" zusammen wird zu „auto" + „auto"). Ein Flex-Item
  mit nicht-„visible" Overflow hat als automatische Minimalgröße 0 statt
  seiner Inhaltsgröße – dadurch durfte `.modal-panel` (Flex-Spalte mit
  `max-height: 85vh`) die Galerie beim Schrumpfen auf quasi 0px Höhe
  zusammendrücken (die 4px verbliebenen Pixel waren nur das `padding-bottom`),
  die 120px hohen Fotos wurden dabei auf einen dünnen Streifen abgeschnitten.
  Fix: `flex-shrink: 0` auf `.inspire-photo-gallery`, damit sie als Flex-Item
  nie unter ihre Bildhöhe schrumpft.
- **Inspire-Buttons mit Icons:** „Zu Plan hinzufügen"/„Könnte interessant
  sein" bekommen ein „✓", der jeweilige Rückgängig-Zustand zeigt jetzt
  „✕ Entfernen" statt des reinen Statustexts „Hinzugefügt"/„Vorgemerkt" –
  macht deutlicher, dass ein erneuter Klick den Ort wieder entfernt. „Neue
  Inspiration" ist jetzt ein gefüllter Button („Neue Inspiration starten")
  statt eines reinen Text-Links.
- **Plan startet standardmäßig in der Datum-Ansicht** (statt Kategorie).
- **Karte beim Ort-Hinzufügen:** Suchergebnisse mit Koordinaten zeigen die
  Karte jetzt automatisch (statt hinter einem Button versteckt); jeder
  Marker öffnet per Klick ein InfoWindow mit Foto/Name/Sterne und einem
  „Zu Plan hinzufügen"-Button, der den Ort direkt von der Karte aus speichert
  (ohne Kategorie/Termine – für die bleibt der bestehende Listen-Flow mit
  Detailkarte). Die bisherige Ergebnisliste mit Kategorie-/Datumsauswahl
  bleibt unverändert bestehen, die Karte ist ein zusätzlicher, schnellerer Weg.

## Stand: Milestone 11 – park4night als zweite Ortsquelle

Zusätzlich zur Google-Places-Suche steht in Plan (Ort hinzufügen) und
Inspire jetzt auch [park4night](https://park4night.com) als Quelle für
Stellplatz-Community-Daten zur Verfügung.

**Wichtig: inoffizielle API.** Es gibt keine offizielle park4night-API. Die
genutzten Endpunkte (`lieuxGetFilter.php`, `commGet.php`) sind unverändert
undokumentiert und die Antwort enthält sogar wörtlich den Hinweis „This
data is not public, STOP your parsing" – die Schnittstelle kann sich
jederzeit ohne Vorwarnung ändern oder gesperrt werden. Deshalb ist jeder
Fehler beim Aufruf **bewusst stillschweigend**: park4night blendet sich bei
einem Ausfall einfach aus (kein Fehler-Banner), Google Places bleibt die
verlässliche Hauptquelle.

- **`apps-script/Code.gs`**: neue `doGet`-Actions `park4nightSearch`
  (Koordinaten → Stellplätze in der Nähe) und `park4nightReviews`
  (Rezensionen zu einem Ort) – Server-zu-Server-Aufruf via `UrlFetchApp`,
  da park4night keine CORS-Header für Browser-Zugriff setzt. **Erfordert
  ein Code.gs-Redeploy**, sonst bleibt diese Quelle einfach leer (kein
  Absturz, siehe oben). `UrlFetchApp` ist der erste externe HTTP-Aufruf in
  diesem Projekt (bisher nur `SpreadsheetApp`) und braucht deshalb einmalig
  die zusätzliche Berechtigung „Externe Anfragen senden"
  (`script.external_request`) – dafür reicht ein einfaches Redeploy
  **nicht immer**: falls `UrlFetchApp`-Aufrufe mit „Sie haben nicht die
  erforderliche Berechtigung" fehlschlagen, hilft eine komplett **neue**
  Bereitstellung (Deploy → New deployment, nicht nur „New version" einer
  bestehenden) – dabei einmal den Autorisierungsdialog bis „Zulassen"
  durchklicken. Das erzeugt eine neue `/exec`-URL, die dann als
  `DEFAULT_SCRIPT_URL` in `js/settings.js` einzutragen ist.
- **Neues `js/park4night.js`**: normalisiert park4night-Orte auf exakt die
  Objekt-Form, die `searchGooglePlaces()` (`js/places-search.js`) liefert
  (`displayName`, `formattedAddress`, `location`, `rating`, `photos[].name`
  usw.) – dadurch verwenden `js/plan.js` und `js/inspire.js` für beide
  Quellen dieselben Render-/Speicherfunktionen, nur punktuelle
  `place.source === "park4night"`-Zweige für die Extras (Ausstattungs-Notiz,
  park4night-Link statt Google-Maps-Link, Default-Kategorie „Camping").
  Gespeicherte Orte bekommen eine `"p4n:"`-präfigierte `placeId`, damit
  `js/place-details.js` beim erneuten Öffnen weiß, welche Detailansicht
  (Google-Refetch vs. park4night-Reviews) zu laden ist – ganz ohne
  Sheet-Schema-Änderung.
- **Plan**: neuer Tab „Google" / „park4night" beim Ort-Hinzufügen.
  park4night sucht nur nach Koordinaten (kein Freitext wie Google) – dafür
  entweder einen Ortsnamen eingeben (wird per Google-Textsuche grob
  geokodet) oder den aktuellen Standort verwenden.
- **Inspire**: sobald ein Gemini-Ortsvorschlag über Google aufgelöst wurde,
  wird zusätzlich in dessen Nähe nach park4night-Stellplätzen gesucht (Top 3
  nach Bewertung) und unter „Stellplätze in der Nähe (park4night)" mit
  denselben Aktionen wie normale Vorschläge angezeigt (keine
  Gemini-Prompt-Änderung nötig – die Koordinate kommt vom bereits
  aufgelösten Google-Ort).

## UX-Nacharbeit (nach Milestone 11)

- **Icons vereinheitlicht:** „Könnte interessant sein"-Überschrift (Plan)
  und „Cache leeren"-Button (Einstellungen) nutzten bisher Emoji (💡/🔄)
  statt der sonst in der App üblichen Strich-SVG-Icons (wie in der
  Bottom-Nav) – jetzt als passende SVGs (Stern, Kreisförmige Pfeile) im
  selben Stil (`stroke-width: 1.8`, `viewBox 0 0 24 24`). `.btn` ist dafür
  jetzt `display: inline-flex` mit `gap`, damit Icon + Text sauber
  ausgerichtet sind.
- **Plan-Ortssuche: Eingabefeld auf voller Breite.** Bei Google (Text +
  Umkreis + Suchen) und park4night (Ort + Suchen) lief bisher alles in
  einer engen Zeile nebeneinander – das Textfeld nimmt jetzt die volle
  Breite ein, Umkreis-Auswahl/Suchen-Button stehen darunter
  (`.inspire-search-wrap`, neue CSS-Klasse, betrifft nur die Plan-Suche,
  nicht Inspires eigene Suchzeile).
- **Plan-Suchergebnisse mit „Details"/„Könnte interessant sein":** die
  Ergebniskarten beim Ort-Hinzufügen zeigten bisher nur „Zu Plan
  hinzufügen" (klappt die Kategorie-/Datums-Auswahl auf). Jetzt zusätzlich
  „Details" (öffnet die Detailansicht direkt, ohne die Auswahl aufzuklappen)
  und „✓ Könnte interessant sein" (speichert sofort mit Status
  `"interested"`, ohne Kategorie/Termine – wie bei Inspires
  Vorschlagskarten). `saveSearchResult()` hat dafür einen optionalen
  `status`-Parameter bekommen; für park4night-Treffer greift dieselbe
  „Camping"-Kategorie-Vorbelegung wie beim regulären Speichern.
- **Kartensuche (Marker-InfoWindow) mit denselben drei Aktionen:** das
  InfoWindow, das beim Klick auf einen Suchergebnis-Marker aufgeht (Google
  wie park4night), hatte bisher nur „Zu Plan hinzufügen". Jetzt zusätzlich
  „Details" und „✓ Könnte interessant sein", identisch zur Listen-Ansicht
  (`buildMapInfoContent()` nutzt dieselben `saveSearchResult()`/
  `detailModalSeed()`-Helfer). „Details" öffnet bewusst dasselbe App-weite
  Modal wie bei Inspire (`openPlaceDetailModal`) statt einer eigenen
  Mini-Ansicht im schmalen InfoWindow – es legt sich als vollflächiges
  Overlay über die ganze App, genau wie überall sonst positioniert.

## Stand: Milestone 22 – "Abschnitt in Google Maps"-Link, Auto-Scroll beim Ziehen

- **Route, Abschnitt-Ansicht:** jede Abschnitts-Überschrift bekommt einen
  "Abschnitt in Google Maps ↗"-Link (nur wenn der Abschnitt mindestens einen
  Ort mit Koordinaten/Adresse enthält), der alle Orte dieses Abschnitts als
  Route öffnet – reine Wiederverwendung der bestehenden
  `fullRouteMapsUrl(places)` (bisher nur für die komplette Route genutzt),
  jetzt zusätzlich pro Abschnitt aufgerufen. Neue `.place-group-heading-link`-
  CSS-Klasse (kompakter Inline-Link statt vollem Button, rechtsbündig in der
  Überschriftenzeile).
- **Plan: Auto-Scroll beim Ziehen von Orten.** `js/drag-reorder.js` (das
  gemeinsame Drag&Drop-Modul für Kategorie-/Abschnitt-/Datum-Modus in Plan
  sowie die Touren-/Kategorien-/Abschnitts-Sortierung in den Einstellungen)
  scrollt jetzt automatisch, wenn beim Ziehen der obere/untere Rand des
  sichtbaren Bereichs erreicht wird (`.place-drag-handle` setzt
  `touch-action: none`, wodurch normales Scrollen während des Ziehens sonst
  komplett blockiert ist – Orte ließen sich dadurch nie in eine nicht
  sichtbare Gruppe ziehen). Positionen der Zeilen werden dafür jetzt
  dokument- statt viewport-relativ erfasst, damit sie beim Auto-Scrollen
  gültig bleiben; die Ziel-Erkennung läuft zusätzlich bei jedem Scroll-Frame
  neu (nicht nur bei Fingerbewegung), da sich das Ziel unter dem Finger auch
  ohne eigene Bewegung ändert, sobald die Seite selbst weiterscrollt.

## Stand: Milestone 21 – Abreise-Default, Drag&Drop in der Datum-Ansicht, order-Kollision behoben

- **Abreise wird beim Setzen der Ankunft automatisch vorbelegt** (falls noch
  leer), damit der Datepicker beim Öffnen direkt dieses Datum zeigt statt
  leer zu sein – bleibt danach frei änderbar. Betrifft `createFormRow()`
  (manuelles Formular) und `buildResultDetailPanel()` (Suchergebnis-
  Speichern-Panel), `js/plan.js`.
- **Plan: Drag&Drop jetzt auch in der Datum-Ansicht.** Ein Ort lässt sich auf
  eine Datums-Überschrift ODER eine Ort-Zeile eines anderen Tages ziehen –
  dabei werden Ankunft UND Abreise automatisch auf diesen einen Tag gesetzt
  (ein Drop ist ein konkreter Tag, kein Zeitraum). Neue `onDateDrop()`,
  gleiches Cross-Gruppen-Drag-Muster wie beim Abschnitt-Modus (Milestone 17):
  Datums-Überschriften sind selbst gültige Drop-Ziele (auch "Ohne Datum" –
  löscht dabei das Datum – und der "Heute"-Marker). `writeChangedPlaces()`
  (Milestone 17b/19b) prüft beim Schreiben jetzt zusätzlich `arrivalDate`/
  `departureDate` mit, nicht mehr nur `order`/`sectionId`.
- **Order-Kollision zwischen zwei Geräten behoben.** Neue Orte bekamen ihren
  `order`-Wert bisher aus `places.length` – dem LOKALEN Stand des jeweiligen
  Geräts. Legen zwei Geräte fast gleichzeitig je einen neuen Ort an, sehen
  beide denselben lokalen Stand und vergeben denselben order-Wert (live
  beobachtet: nach Ort-Hinzufügen auf einem zweiten Gerät gab es einen
  frischen doppelten order-Wert, obwohl der Sync-Mechanismus selbst korrekt
  funktioniert). Neue Orte bekommen jetzt `Date.now()` als order – kollidiert
  praktisch nie, sortiert trotzdem ans Ende, und jede folgende Drag-Aktion
  normalisiert ohnehin wieder auf lückenlose Ganzzahlen. Betrifft
  `onSave()`/`saveSearchResult()` (`js/plan.js`) und `saveSuggestion()`
  (`js/inspire.js`).
- **Apps-Script-Bereitstellung live erneut verifiziert:** vollständiger
  Schreib-Lese-Testlauf für einen Abschnitt (Anlegen → Lesen → Umbenennen →
  Lesen, keine Dopplung → Löschen → Lesen, weg) direkt gegen das produktive
  Sheet – alles korrekt. Die Bereitstellung ist also richtig eingerichtet;
  die weiterhin beobachteten order-Konflikte kamen von der oben behobenen
  Kollision, nicht von einem Deployment-Problem.

## Stand: Milestone 20 – "Könnte interessant sein"-Einträge bearbeitbar

- **Wunschlisten-Einträge** (Plan, "Könnte interessant sein") haben jetzt
  einen Bearbeiten-Button (✎) und öffnen dabei dasselbe Formular wie die
  normalen Plan-Einträge (`createFormRow()`/`onSave()`) – inklusive der
  Ankunft/Abreise-Datumsfelder und der Notiz, die für Wunschlisten-Einträge
  bisher nicht editierbar waren. `onSave()` übernimmt dabei weiterhin erst
  alle vorhandenen Felder (siehe Milestone 18) und überschreibt nur die im
  Formular bearbeiteten – der `status: "interested"` bleibt beim Speichern
  also unangetastet erhalten.
- Die Meta-Zeile in der Wunschlisten-Ansicht zeigt jetzt (wie bei normalen
  Plan-Einträgen) Sterne-Bewertung, Datum/Adresse UND Notiz gemeinsam statt
  nur eins von beidem – vorher verschwand z. B. das Datum, sobald ein Ort
  eine Google-Bewertung hatte.

## Stand: Milestone 19b – Weiterer Rest-Datenverlust bei Orte-Schreibvorgängen behoben

- **Trotz Milestone 17b ging live noch vereinzelt eine Abschnitts-/order-
  Zuordnung verloren** (nachgewiesen: nach mehreren erfolgreichen Drag-
  Aktionen blieb ein einzelner Ort mit dupliziertem/altem `order`-Wert
  zurück, andere `sectionId`-Zuordnungen waren aber korrekt persistiert –
  also kein grundsätzliches Problem mehr, sondern ein seltener Einzel-
  Request-Verlust). Ursache vermutlich: Apps Script verarbeitet bei vielen
  schnell aufeinanderfolgenden Requests einzelne davon ungewöhnlich langsam
  (live beobachtet: ein einzelner Test-Request brauchte über 2 Minuten) oder
  verwirft sie.
- **Fix:** `writeChangedPlaces()` (`js/plan.js`) und `onReorderSections()`
  (`js/sections.js`) versuchen einen fehlgeschlagenen Request jetzt einmal
  erneut (kurze Pause davor) und lassen zwischen allen Requests eine kleine
  Pause (150 ms), damit Apps Script jeden Schreibvorgang sicher abschließen
  kann, bevor der nächste startet.

## Stand: Milestone 19 – Datum-Ansicht zeigt alle Urlaubstage

- **Plan und Route zeigen in der Datum-Ansicht jetzt ALLE Tage des Urlaubs**
  (bei Urlauben mit festem Start-/Enddatum), nicht mehr nur die Tage, an
  denen tatsächlich ein Ort eingeplant ist. Neue `allTripDates(trip)`
  (bewusst dupliziert in `js/plan.js` + `js/route.js`, gleiches Muster wie
  `groupedByDate()`) erzeugt lückenlos jeden Tag von `startDate` bis
  `endDate`; `groupedByDate()` vereinigt diese Tage mit den Tagen, an denen
  tatsächlich Orte liegen (ein Ort mit Datum außerhalb des offiziellen
  Zeitraums geht dadurch nicht verloren, sondern ergänzt die Liste). Leere
  Tage erscheinen als Überschrift ohne Orte darunter.
- **"Heute"-Markierung bleibt dabei erhalten, auch wenn heute leer ist.**
  Bisher wurde "Heute" nur als eigener, synthetischer Zeitachsen-Eintrag
  eingefügt, wenn der Tag noch keine echte Gruppe war – jetzt, wo praktisch
  immer alle Tage als echte Gruppen existieren, markiert `withTodayMarker()`
  stattdessen die schon vorhandene echte Tages-Gruppe (`isTodayReal`, Label
  ergänzt um "· Heute", gleiche Akzent-Optik wie der bisherige Marker) statt
  einen zweiten, doppelten Eintrag für denselben Tag einzufügen.

## Stand: Milestone 18 – Formular-Politur (Datum-Labels, Farb-Picker, Kategorie-Feld)

- **Ankunft/Abreise zeigen jetzt ein festes Label statt eines leeren Felds.**
  Native `type="date"`-Inputs unterstützen kein zuverlässiges
  `placeholder`-Attribut (Safari ignoriert es komplett) – neue
  `createLabeledDateField()` (`js/plan.js`) baut stattdessen ein
  `<label>`-Wrapper mit echtem `<span>Ankunft/Abreise</span>` fest im Feld
  (`.date-field` in `css/style.css`). Betrifft das manuelle Anlegen/
  Bearbeiten-Formular und das "Ort speichern"-Panel bei der Google-/
  park4night-Suche.
- **"+ Hinzufügen"-Farb-Picker jetzt im gleichen Stil wie die
  Bestandszeilen.** Die Farbauswahl beim Neuanlegen einer Kategorie/eines
  Abschnitts war bisher ein unstyled natives `<input type="color">`
  (kleines Browser-Standard-Swatch) statt des gestalteten
  34×34px-Swatches (`.category-settings-color`), den bearbeitbare
  Bestandszeilen schon hatten – jetzt in `js/categories.js` UND
  `js/sections.js` konsistent.
- **Kategorie-Feld im Bearbeiten-Formular war zu schmal.** Die CSS-Regel für
  `.trip-edit-fields` hat bisher nur `input`-Elemente gestylt, das
  Kategorie-`<select>` blieb dadurch mit Browser-Standardbreite (schmales
  Picklist-Feld) statt wie die anderen Felder auf volle Breite gezogen zu
  werden. Regel um `select` erweitert + `width: 100%` ergänzt.

## Stand: Milestone 17b – Bugfix: Abschnittszuordnung ging beim Speichern verloren

- **Ursache (live gegen das echte Sheet nachgewiesen):** `onSectionDrop()`/
  `onReorder()` (`js/plan.js`) haben bei JEDER Aktion ALLE Orte des Urlaubs
  per `updatePlace()` neu geschrieben, nacheinander in einer Schleife. Ein
  einzelner fehlgeschlagener Request mittendrin hat die GESAMTE restliche
  Schleife abgebrochen (`try/catch` um die ganze Schleife statt um jeden
  einzelnen Request) – alle danach folgenden Orte behielten dadurch
  dauerhaft ihren alten `order`/`sectionId`-Wert. Nachgewiesen per direktem
  GET/POST-Test gegen das produktive Sheet: mehrere Orte desselben Urlaubs
  hatten identische `order`-Werte, und alle 29 Orte hatten trotz 4 echter
  Abschnitte durchgängig `sectionId: ""`.
- **Fix:** `writeChangedPlaces()` (neu, `js/plan.js`) schreibt nur noch Orte,
  deren `order`/`sectionId` sich tatsächlich geändert hat (statt immer den
  ganzen Urlaub), UND verarbeitet jeden Request einzeln mit eigenem
  `try/catch` – ein fehlgeschlagener Request blockiert die übrigen nicht
  mehr. Gleiche Behandlung für `onReorderSections()` (`js/sections.js`).
  Reduziert nebenbei auch die Anzahl der Requests pro Aktion deutlich (z. B.
  nur 1 statt N beim Verschieben eines bereits letzten Orts in einen leeren
  Abschnitt).
- **Zusätzlich gefixt:** `onSave()` (manuelles Bearbeiten-Formular in Plan)
  baute den Ort-Datensatz bisher komplett neu auf und verlor dabei Felder,
  die das Formular selbst nicht kennt (`sectionId`, aber auch `photoRef`,
  `rating`, `userRatingCount`, `status`). Jetzt werden erst die
  vorhandenen Felder übernommen und nur die im Formular bearbeiteten
  überschrieben.

## Stand: Milestone 17 – Abschnitte für Plan + Route

- **Neue, benutzerdefinierte Abschnitte** ("Etappe 1", "Küste" o. ä.) zum
  manuellen Gruppieren der Orte innerhalb eines Urlaubs – macht lange Touren
  in Plan/Route übersichtlicher. Neues Sheet `Sections` (`id, tripId, label,
  color, order`, siehe `apps-script/Code.gs`), neue Spalte `sectionId` auf
  `Places`. **Wichtig: Die Apps-Script-Bereitstellung muss dafür neu
  ausgerollt werden** (Erweiterungen → Apps Script → Bereitstellen → Bereit-
  stellungen verwalten → Neue Version), sonst bleiben Abschnitte inaktiv
  (gleiche Schutzlogik wie bei den Kategorien in Milestone 8 – `js/sections.js`
  schreibt erst nach erfolgreichem Redeploy ins Sheet, um ein Fehl-Schreiben
  in ein falsches Sheet bei altem Code.gs zu verhindern).
- **Plan:** neuer 4. Ansicht-Button "Abschnitt" neben Kategorie/Datum/
  Entfernung. Ein einklappbares "Abschnitte verwalten"-Panel (anlegen/
  umbenennen/Farbe ändern/löschen/sortieren, `js/sections.js`, spiegelt fast
  1:1 die bestehende Kategorienverwaltung) sitzt über der gruppierten Liste.
  **Orte lassen sich per Drag zwischen Abschnitten verschieben** – anders als
  bei Kategorie (dort ist Drag bewusst auf Umsortieren INNERHALB der Gruppe
  beschränkt) sind hier auch die Gruppen-Überschriften selbst gültige
  Drop-Ziele, damit sich ein Ort auch in einen noch leeren, frisch
  angelegten Abschnitt ziehen lässt. `js/drag-reorder.js` selbst musste dafür
  nicht angefasst werden (vollständig generisch).
- **Route:** der bisherige automatische Wechsel zwischen Reihenfolge- und
  Datumsansicht ist jetzt ein expliziter 3-Wege-Schalter ("Reihenfolge" /
  "Datum" / "Abschnitt"), Default unverändert (Datum falls der Urlaub einen
  Zeitraum hat, sonst Reihenfolge). Abschnitt-Ansicht ist reine Anzeige ohne
  Drag – Abschnitte werden ausschließlich in Plan verwaltet/befüllt.
- Löschen eines Abschnitts fasst vorhandene Orte NICHT an (kein Bulk-Update
  nötig) – ein Ort mit einer nicht mehr existierenden `sectionId` fällt beim
  Rendern automatisch auf "Ohne Abschnitt" zurück (`sectionInfo()`-Fallback,
  exakt wie beim Löschen einer Kategorie).

## Stand: Milestone 16 – Vorschaubild für hinzugefügte Google-Orte

- **Google-Orte zeigen jetzt auch in der Listenansicht ein Vorschaubild.**
  Seit Milestone 14 liefert die Google-Ergebnisliste bewusst kein Foto mehr
  (Kostengrund, siehe dort) – das führte aber dazu, dass tatsächlich zum
  Plan hinzugefügte Google-Orte dauerhaft ohne Thumbnail blieben (Plan-,
  Wunschlisten- und Route-Listenzeilen lesen `place.photoRef`, das nie
  gesetzt wurde). Neue Funktion `fetchFirstPhotoRef(placeId)`
  (`js/places-search.js`) holt beim tatsächlichen Speichern eines
  Google-Orts (nicht in der Ergebnisliste!) einmalig nur das erste Foto
  nach – ein einzelner, günstiger Zusatz-Call pro gespeichertem Ort statt
  eines "Atmosphere"-Felds in jeder Suche. Eingebaut in `saveSearchResult()`
  (`js/plan.js`) und `saveSuggestion()` (`js/inspire.js`); park4night-Orte
  unverändert, die liefern ihr Foto weiterhin direkt aus der eigenen Suche.

## Stand: Milestone 15 – Echte Build-Kennung im Footer, zuverlässiges "Cache löschen"

- **Footer zeigt jetzt eine echte Build-Kennung statt eines manuell
  gepflegten Versionsstrings.** `initVersionFooter()` (`js/main.js`) fragt
  die öffentliche GitHub-API (`GET /repos/josontag-git/camper-touren/commits/main`)
  ab und zeigt `Build <Kurz-SHA> · <Datum, Uhrzeit>` – da GitHub Pages hier
  im "legacy"-Modus ohne eigenen Build-Schritt läuft, ist der letzte Commit
  auf `main` automatisch der Deploy-Stand, kein manuelles Nachpflegen mehr
  nötig. Kurz in `sessionStorage` gecacht (schont das unauthentifizierte
  API-Rate-Limit), fällt bei Offline/Fehler auf den letzten bekannten Stand
  zurück.
- **"Cache löschen" (Admin) lädt jetzt garantiert die neue Version.** Bisher
  reichte ein einfaches `location.reload()` nach dem Löschen von Service-
  Worker und Cache Storage nicht zuverlässig aus, weil GitHub Pages eigene
  Cache-Control-Header setzt und der Browser die HTML-Seite trotzdem noch
  aus seinem normalen HTTP-Cache bedienen konnte. Der Button navigiert jetzt
  mit einem Cache-Busting-Query-Parameter (`?fresh=<Timestamp>`, wird nach
  dem Laden per `history.replaceState` wieder aus der URL entfernt) und
  erzwingt damit einen echten Netzwerk-Request. Zusätzlich fetcht der neu
  installierende Service Worker (`service-worker.js`) die App-Shell-Dateien
  beim Install jetzt einzeln mit `cache: "reload"` statt per
  `cache.addAll()`, damit auch dort garantiert vom Netz und nicht aus einer
  evtl. noch gültigen HTTP-Cache-Kopie geladen wird. `CACHE_VERSION` auf
  `app-shell-v31` erhöht.

## Stand: Milestone 14 – Maps-API-Kosten gesenkt, "Heute"-Marker auf der Zeitachse

- **Places-Suche auf günstige Felder reduziert.** Die Places-API-(New)-
  Abrechnung richtet sich nach der teuersten angefragten Feld-Kategorie –
  `searchGooglePlaces()` (`js/places-search.js`) fragte bisher auch
  `rating`/`userRatingCount`/`photos`/`googleMapsUri` ab (alles
  "Atmosphere"-Felder, teuerste Stufe), obwohl eine Ergebnisliste nur
  Name/Adresse/Koordinate braucht. Field-Mask jetzt auf `id, displayName,
  formattedAddress, location` beschränkt; `googleMapsUri` wird stattdessen
  clientseitig aus der Place-ID gebaut (kostenloses, öffentlich
  dokumentiertes URL-Schema
  `.../maps/search/?api=1&query=<Name>&query_place_id=<id>`). Google-
  Ergebniskarten in Plan/Inspire zeigen dadurch nur noch Name + Adresse
  (kein Foto/keine Sterne) – Fotos und Rezensionen bleiben unverändert
  Details-only: `fetchPlaceDetails()` (`js/place-details.js`) fragt sie
  weiterhin ab, aber erst einmalig, wenn tatsächlich "Details" angetippt
  wird. park4night ist von alldem nicht betroffen (eigene, kostenlose API).
- **Google-Suchfeld-Platzhalter neutralisiert.** War nie auf Campingplätze
  beschränkt (reiner Freitext, keine Filterung) – der Platzhaltertext
  („z. B. Campingplatz an der Nordsee") erweckte nur diesen Eindruck. Jetzt
  „z. B. Restaurant, Strand, Sehenswürdigkeit …".
- **„Heute"-Marker auf der Zeitachse** (Plan Datum-Ansicht + Route): neue
  `withTodayMarker()` in `js/plan.js`/`js/route.js` (bewusst dupliziert,
  gleiches Muster wie das bestehende `groupedByDate()`) fügt einen
  `Heute`-Eintrag an der chronologisch richtigen Stelle zwischen den
  Datums-Gruppen ein – gefüllter Punkt in der Akzentfarbe statt der hohlen
  Kategorie-Ringe (`.place-group-heading--today`), damit er sich klar von
  echten Etappen abhebt. Erscheint nur, wenn die Zeitachse ohnehin aktiv
  ist; wird übersprungen, falls "heute" bereits ein echter Termin ist.
- **Places-Fotos werden jetzt vom Service Worker gecacht.** Der
  Fetch-Handler (`service-worker.js`) hat bisher jeglichen
  `googleapis.com`/`google.com`-Traffic pauschal vom Caching ausgeschlossen
  (richtig für Live-Daten wie Suche/Details), dadurch aber auch Foto-
  Downloads (`places.googleapis.com/.../media`) bei jedem Rendern/Reload
  erneut kostenpflichtig nachgeladen, obwohl sich ein Foto nie ändert.
  Diese eine Ausnahme (`isPlacesPhoto`) wird jetzt gezielt vom
  API-Ausschluss ausgenommen und normal cache-first behandelt; Suche/
  Details/Maps-JS/Apps-Script bleiben unverändert live. `CACHE_VERSION` auf
  `app-shell-v30` erhöht.

## Stand: Milestone 13 – App-Name „Let’s Camp", park4night-Link, Route-Karte interaktiv, Ortstyp-Filter

- **App umbenannt zu „Let's Camp"** (Titel, Manifest, Header-Fallback,
  Apple-Touch-Titel) und neues App-Icon (`icons/camper_app_icon.png`,
  gleicher PIL-Zuschnitt-Workflow wie beim letzten Icon-Wechsel).
- **park4night-Link in der Detailansicht ergänzt:** gespeicherte
  park4night-Orte hatten bisher keine Möglichkeit, zurück zur
  park4night-Seite zu gelangen (anders als Google-Orte mit „Auf Google Maps
  ansehen ↗"). `renderPark4nightDetail()` in `js/place-details.js` zeigt
  jetzt „Auf park4night ansehen ↗" direkt unter dem Foto.
- **Route-Karte interaktiv:** Marker-Klick öffnet ein InfoWindow (Foto/Name/
  Sterne) mit „Details" (dasselbe App-weite Modal wie überall) und
  „✕ Von Route entfernen" (löscht den Ort, gleicher Pfad wie Plans eigener
  Löschen-Button) – bisher waren die Routen-Marker nicht klickbar.
  `js/route.js` `buildRouteInfoContent()`, gleiche `.map-info-*`-CSS-Klassen
  wie Plans Kartensuche.
- **park4night-Ortstyp-Filter für Plan, Admin-konfigurierbar.** Bisher war
  „nur Campingplätze" (`code === "C"`) fest einprogrammiert. Jetzt Default
  Campingplatz **und** Auf dem Bauernhof/Winzer (`code === "F"`, per
  Live-Test als „réseau bienvenue à la ferme" identifiziert – France-
  Passion-artige Bauernhof-/Winzer-Gastfreundschaft), als zwei weitere
  Checkboxen im „park4night-Einstellungen"-Admin-Bereich neben den
  bestehenden Ausstattungsfiltern (`js/settings.js`
  `getPark4nightPlaceTypes()`/`setPark4nightPlaceTypes()`,
  `js/park4night.js` `ADMIN_PLACE_TYPE_OPTIONS`,
  `searchPark4nightNear(lat, lng, { filterByType: true })`).

## Stand: Milestone 12 – Admin-Umbenennung, park4night-Filter, einklappbare Abschnitte

- **„Einstellungen" → „Admin"**: Bottom-Nav-Label und der Inspire-Hinweistext
  umbenannt, interne IDs/Funktionsnamen unverändert (`settings-view` etc.).
  Die erste Karte heißt jetzt „Allgemein" (sonst stünde „Admin" doppelt).
- **park4night in Plan: nur Campingplätze.** Das `code`-Feld pro Ort
  identifiziert den Typ – `code === "C"` sind zuverlässig echte
  Campingplätze (live gegen eine campingplatzreiche Region getestet: alle
  "C"-Treffer heißen buchstäblich "Camping …", mit Sternebewertung/Preis
  pro Nacht). `searchPark4nightNear(lat, lng, { campingOnly: true })` filtert
  darauf – nur in Plans Kartensuche (`js/plan.js`), Inspires "Stellplätze
  in der Nähe" bleibt bewusst ungefiltert (dort passen auch andere
  Ortstypen).
- **park4night-Ausstattungsfilter im Admin-Bereich.** Die park4night-API
  unterstützt keine Server-seitige Filterung (mehrere Query-Parameter-
  Varianten getestet: `douche=1`, `code=C`, `filtre_douche=1`,
  `services=douche`, `type=camping` – alle wirkungslos, die API liefert
  immer dieselben Treffer). Die Filterung läuft deshalb client-seitig in
  `searchPark4nightNear()` auf den ohnehin in der Antwort enthaltenen
  Ausstattungs-Flags. Sechs alltagsrelevante Merkmale (WC, Dusche, Strom,
  Frischwasser, WLAN, Haustiere erlaubt) als Checkboxen im neuen
  „park4night-Einstellungen"-Admin-Bereich (`js/park4night.js`
  `ADMIN_AMENITY_OPTIONS`, Speicherung in `js/settings.js`
  `getPark4nightRequiredAmenities()`/`setPark4nightRequiredAmenities()`),
  wirkt auf Plan **und** Inspire. Speichert sofort bei jedem Toggle, kein
  separater Speichern-Button (wie die Farbschema-/Header-Selects).
- **Admin-Abschnitte einklappbar.** Alle vier Karten (Allgemein/Urlaube/
  Kategorien/park4night) haben jetzt einen klickbaren Titel mit Chevron;
  Zustand pro Karte in `localStorage`, Default aufgeklappt. Rein visuelles
  CSS-Klassen-Toggle (`.settings-view.is-collapsed`) – die dynamischen
  Listen (Touren/Kategorien) rendern unverändert weiter, auch wenn ihre
  Karte gerade eingeklappt ist.

## Stand: Milestone 10 – Cache-Reset, Zoom-Sperre, echte Header-Fotos, sortierbare Touren/Kategorien

- **Cache-Löschen-Button** in den Einstellungen: meldet den Service Worker
  ab und löscht alle Caches, danach automatischer Reload – hilfreich, wenn
  ein Gerät trotz neuer `CACHE_VERSION` noch am alten Stand hängt.
- **Kein Browser-Zoom mehr:** Viewport-Meta um `maximum-scale=1,
  user-scalable=no` ergänzt (Pinch-Zoom), `touch-action: manipulation` auf
  `html, body` (Doppel-Tap-Zoom).
- **Echte Header-Fotos statt Farbverläufe** (siehe „Header-Hintergrund"
  oben) – 7 vom Nutzer bereitgestellte, lizenzfreie Fotos statt der
  bisherigen CSS-Gradients.
- **Tourenauswahl-Icon im Header verfeinert:** dünnerer, kleinerer Chevron
  (`stroke-width` 2 → 1.5, feste Größe 18×18), passt jetzt besser zu den
  Text-Glyphen ✎/＋ daneben.
- **Touren und Kategorien per Drag&Drop sortierbar** (Einstellungen): neues
  gemeinsames Modul `js/drag-reorder.js` (extrahiert aus der bisherigen
  Orte-Sortierung in `js/plan.js`, jetzt an drei Stellen wiederverwendet).
  Reihenfolge landet im neuen `order`-Feld von `Trips`/`Categories` – siehe
  Datenmodell unten, **erfordert ein Code.gs-Redeploy** (wie bei den
  Kategorien in Milestone 8); ohne Redeploy funktioniert das Sortieren
  weiterhin, bleibt aber nur für die aktuelle Sitzung erhalten statt
  geräteübergreifend gespeichert zu werden.
- **Inspire:** „Details"/„Könnte interessant sein" jetzt als dezent
  eingefärbte Pillen (`.btn-subtle`) statt reinem Text; die
  „Beispiel: …"-Zeile verschwindet nach der ersten Antwort, statt bei jeder
  weiteren Nachricht erneut aufzutauchen.

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

Unter **Einstellungen → Header-Hintergrund** wählbar: kein Bild, Strand
(Karibik), Wüste, Bergsee, Berge, Skyline bei Nacht, Sonnenuntergang,
Unterwasserwelt – echte, lizenzfreie Fotos unter `headers/<theme-id>.jpg`
(Quelldateien in `background/`, mit PIL motiv-optimiert zugeschnitten und
auf max. 1600px Breite verkleinert). Eingebunden über
`.app-header[data-header-theme="…"]` in `css/style.css`
(`background-image: url("../headers/<id>.jpg")` + ein aus dem Foto
gemittelter `background-color`-Fallback für die Ladezeit). Auswahl in
`localStorage` (`js/header-theme.js`), unabhängig vom Farbschema. Weiteres
Foto ergänzen: Datei nach `headers/<neue-id>.jpg` legen und einen Eintrag
in `HEADER_THEMES` (`js/header-theme.js`) + eine passende CSS-Regel
ergänzen.

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

`icons/camper_app_icon.png` ist die Quelldatei (Familie im VW-Bus an der
Küste, 2048×2048). Beim Import mit PIL randlos auf den eigentlichen
Bildinhalt zugeschnitten (Quelldateien kommen mit weißem Rand um die
abgerundete Karte). Daraus generiert: `icon-192.png`, `icon-512.png`
(normale App-Icons), `icon-maskable-192.png`/`icon-maskable-512.png` (mit
Safe-Zone-Rand in der Himmelfarbe des Motivs, damit OS-Masken nichts
Wichtiges abschneiden) sowie `apple-touch-icon.png` (180×180, eckig – iOS
rundet selbst ab).

## Datenmodell (Google Sheet)

Wird beim ersten Zugriff automatisch angelegt, falls die Tabs noch fehlen;
fehlende Kopfzeilen-Spalten werden beim nächsten Zugriff automatisch ergänzt
(additive Migration in `getOrCreateSheet`, bestehende Zeilen bleiben unberührt):

- `Trips`: `id, name, startDate, endDate, note, createdAt, updatedAt, order`
- `Places`: `id, tripId, order, name, lat, lng, address, category, arrivalDate, departureDate, note, placeId, createdAt, photoRef, rating, userRatingCount, status, sectionId`
- `Categories`: `id, label, color, order`
- `Sections`: `id, tripId, label, color, order`

`photoRef`/`rating`/`userRatingCount` werden nur bei Orten aus einer
Places-Suche befüllt (Plan-Suche oder Inspire-Vorschau) – manuell angelegte
Orte bleiben dort leer, Listen zeigen dann wie bisher nur Text ohne
Vorschaubild/Sterne. `status` ist `""` (fest eingeplant) oder `"interested"`
("Könnte interessant sein", siehe Wunschliste in Plan). `sectionId` verweist
auf einen Eintrag in `Sections` (leer = "Ohne Abschnitt", siehe
Abschnittsverwaltung in Plan). `placeId` trägt bei park4night-Orten das
Präfix `"p4n:"` (z. B. `"p4n:582030"`), sonst eine rohe Google-Place-ID –
daran erkennt `js/place-details.js`, welche Detailansicht zu laden ist (kein
eigenes Sheet-Feld nötig). **Nach dem Update von `Code.gs`** muss im Sheet
wie gewohnt eine neue Version der Apps-Script-Bereitstellung erstellt werden
(siehe oben, "App mit dem Sheet verbinden") – bis dahin bleiben
Kategorien/Abschnitte lokal bzw. inaktiv (siehe Kategorien-/
Abschnittsverwaltung) bzw. park4night einfach leer, Trips/Places
funktionieren unverändert weiter.

## Mögliche nächste Schritte

Echte Rezensions-Volltextsuche/-Filterung, evtl. Offline-Caching der
Foto-URLs (aktuell werden sie live bei jedem Rendern über die Places API
nachgeladen).
