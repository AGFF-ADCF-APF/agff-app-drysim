# Heureka – Lernspiel Futterkonservierung (früher «Silage-Simulator», Pfad /drysim)

Lernspiel zur Futterkonservierung für die höhere Berufsschule und die höhere Fachschule.
Läuft unter <https://apps.graswachstum.ch/heureka/>. Spielbar sind Silage (Flachsilo, Rundballen) und Heu (Belüftungsheu, Bodenheu, Heuballen).

## Idee (Gespräch vom 12.10.2026)

- **Planen & Wettkampf**: Die Studierenden entscheiden selbst, wann und wie gemäht, gezettet, geschwadet und eingefahren wird (Schnitthöhe, Aufbereiter, Breitablage, Arbeitshöhe von Zetter und Schwader, Siloart). Das Wetter läuft stündlich im Tagesverlauf mit Sonne, Temperatur, Tau und Regen. Am Ende gibt es Punkte für die Energie im Trog × Gärqualität, dazu eine Rangliste.
- **Prognose**: Ein Szenario ist vorgegeben. Die Studierenden tippen zuerst TS, Rohasche und Gärnote, dann läuft die Simulation im Schnelldurchlauf und deckt das Ergebnis auf.
- **Erklär-Knöpfe**: Beim Ergebnis erklärt jeder Faktor, was passiert ist (z.B. „5 cm Schnitthöhe → +18 g Rohasche → Clostridien → Buttersäure“). Das ist näher an der Schweizer Sicht („Hast du alles richtig gemacht, damit es gut werden musste?“). Die DLG-Laborbewertung wird nur als Ergebnis gezeigt.

Für den Wettkampf bekommen alle dasselbe Wetter, entweder eine feste Wetterlage oder ein Zufallswetter mit Code: `…/heureka/?wetter=gewitter` oder `…/heureka/?code=KLASSE3`.

## Aufbau

Statische Seite ohne Build-Schritt (ES-Module), ausgeliefert mit nginx hinter Traefik.

Ablauf im Spiel: Start → Einsatz planen (Wetter, Wiese, Maschinen, Silo) → Spielfeld (die Uhr läuft, Tempo wählbar; Mähen, Zetten, Schwaden und Einfahren per Knopf; Pause bei Regen, Zielbereich, „zu trocken“) → bei Belüftungsheu «Am Heustock» → Silo öffnen (Punkte, Sterne, Abzeichen, Erklär-Karten, Rückblick). Die Prognose-Wette nutzt dasselbe Spielfeld im Zeitraffer mit vorgegebenem Plan.

| Datei | Inhalt |
|---|---|
| `public/js/weather.js` | Stündliches Wetter aus Tageswerten (tmin/tmax, Tau über rhmax, Sonne, Wind, Regen); Zufallswetter mit Code |
| `public/js/model.js` | `Feld` (Stunde für Stunde, Arbeitsgänge), `simuliere` (ganzer Plan), Silierung, Punkte, Erklärtexte |
| `public/js/game.js` | Spielablauf: Takt, Arbeitsgänge (Halten zum Bestätigen), Tastenkürzel, Autopause, Sicherung und Fortsetzen, ruhiger Modus |
| `public/js/scene.js` | SVG-Feldszene: Himmel im Tagesverlauf, Sonne/Mond, Wolken, Regen, Tau, Futterfarbe nach TS, Erde, Traktor |
| `public/js/icons.js` | Wetter- und Maschinensymbole |
| `public/js/chart.js` | Rückblick-Diagramm Wetter + TS-Verlauf |
| `public/js/niveau.js` | Niveaus Einstieg, Praxis, Profi: eine Tabelle, was jedes Niveau zeigt |
| `public/js/app.js` | Bildschirme mit Browser-Verlauf und Titeln, Einsatz-Auswahl (gespeichert pro Sitzung), Silo öffnen, Wette, lokale Rangliste, Kontrastmodus |
| `public/js/begriffe.js` | Fachbegriffe für Tipp-Erklärungen und Begriffe-Dialog (auch Quelle der Lernseite) |
| `public/js/wiese.js`, `maschinen.js` | Bilder für Wiese, Maschinen und Einstellungen |
| `tools/seiten.mjs` | Erzeugt `lernen.html`, `szenario/*.html`, `sitemap.xml` und `sw.js` aus den Spieldaten |
| `public/manifest.webmanifest`, `img/` | Installierbare App, Symbole, Vorschaubild für Links |
| `public/js/scenarios.js` | Wetterlagen, Grundplan, Prognose-Szenarien |
| `public/js/belueftung.js` | Heubelüftung im Heustock, Stunde für Stunde (Luft wie drywatch, Sorption, Lüfter, Dach, Entfeuchter, Wärme, Schimmel, Strom) |
| `public/js/heustock.js`, `css/heustock.css` | Spielphase «Am Heustock» nach dem Einführen von Belüftungsheu, Rechenaufgabe |
| `public/js/belueftung-vergleich.js` | Belüftung unter festen Bedingungen nachrechnen (Tests, Lernseite) |
| `public/js/superuser.js`, `public/js/muster/` | Musterlösungen für angemeldete Superuser: Sitzungsabfrage, Suche (`suche.js`), Web Worker, Anzeige; nur nach bestätigter Sitzung geladen, nicht im Service-Worker-Cache |
| `test/muster.mjs` | Prüfungen der Musterlösungen: deterministisch, nie schlechter als die Vorgabe-Runde, nachspielbar, nicht im Cache |
| `test/bedienung.mjs` | Prüfungen zur Bedienung am Heustock: Ernstfall, Kennlinie, Säulen, Eingriffe, Pannen, Nachspielen |
| `test/run.mjs` | Modell-Durchlauf aller Szenarien auf der Konsole |

```
docker compose up -d --build
docker run --rm -v "$PWD":/app -w /app node:22-alpine node test/run.mjs
```

## Bedienung, Zugänglichkeit und Suchmaschinen

Umgesetzt nach zwei UX-Gutachten (Handy/Beamer, Lesbarkeit/SEO):

- **Handy:** feste Daumenleiste unten mit den vier Arbeitsgängen, dichte Anzeigen, Touch-Ziele mindestens 48 px, grosse Regler-Griffe mit +/−-Knöpfen.
- **Bedienung ohne Halten:** Alle Knöpfe lösen mit einem Klick oder einer Taste aus, auch Mähen, Einfahren, die Eingriffe am Heustock und der Feueralarm (Entscheid des Auftraggebers vom 23.11.2026; vorher mussten unumkehrbare Handlungen 0,7 s gedrückt gehalten werden).
- **Tastatur (Beamer):** Leertaste Pause, `1`–`3` Tempo, `+` eine Stunde weiter, `M` `Z` `S` `E` Arbeitsgänge.
- **Datensicherheit:** Die Runde wird als Protokoll der Arbeitsgänge im Browser gesichert (12 h) und lässt sich exakt nachspielen („Runde fortsetzen“). Einstellungen bleiben pro Sitzung erhalten. Beim Wechsel in den Hintergrund pausiert das Spiel.
- **Ruhiger Modus:** Die Zeit läuft nur auf Knopfdruck (+1 h, +3 h), ohne Zeitdruck.
- **Lesbarkeit:** Schrift mindestens 15 px, Kontraste mindestens WCAG AA, Symbole zusätzlich zur Farbe, Darstellungsumschalter wie in Futter v2 (ein Knopf mit Symbol schaltet reihum Normal → Draussen mit starkem Kontrast und grossen Zielen → Nacht; gemerkt im Browser unter `drysimTheme`/`drysimOutdoor`, gesetzt von `js/boot.js` vor dem ersten Zeichnen), Erklärkarten als Aussage / Gründe / Tipp, Fachbegriffe mit Erklärung.
- **Orientierung:** Browser-Verlauf (Zurück-Knopf bleibt in der App), Titel und Pfad je Bildschirm, Schrittband mit Sprungmarken, Zähler offener Einstellungen.
- **Suchmaschinen:** Lernseite und Szenarioseiten als eigene Adressen (`lernen.html`, `szenario/<id>.html`), Meta-Daten, Open-Graph-Vorschau, Sitemap. Nach Änderungen an Szenarien oder Begriffen neu erzeugen:

```
docker run --rm -v "$PWD":/app -w /app node:22-alpine node tools/seiten.mjs
```

- **Offline:** Service Worker (aus `tools/seiten.mjs`) lädt alle Dateien vorab; die App startet auch ohne Netz.
- `sitemap.xml` liegt unter `/heureka/`. Ein `robots.txt` müsste auf `apps.graswachstum.ch` im Wurzelverzeichnis liegen (gehört nicht zu dieser App).

## Niveaus: Einstieg, Praxis, Profi (seit 22.11.2026)

Drei Niveaus von EBA bis Hochschule. **Das Rechenmodell ist für alle gleich**, Punkte und Ranglisten bleiben vergleichbar. Unterschiedlich ist nur, wie viel man einstellt, wie viel Text und Zahlen man sieht und welche Aufgaben gestellt werden.

- **Einstieg** (EBA, 1. Lehrjahr EFZ): Im Einsatz nur Wetter und Silage/Heu; Wiese und Maschinen sind voreingestellt (Grundplan: 7 cm Stoppelhöhe, Zinken 3 cm) und hinter «Mehr einstellen» erreichbar. Ruhiger Modus als Standard. Auf dem Feld eine Ampel mit Worten («noch zu nass / genau richtig / zu trocken») statt Zahlen, der Traktor schlägt den nächsten Schritt vor (Regeln aus den Assistententexten) und hebt den passenden Knopf hervor. Im Ergebnis nur die vier wichtigsten Karten mit je einem einfachen Satz, ohne Abkürzungen.
- **Praxis** (EFZ, Betriebsleiterschule): wie bisher, Standard.
- **Profi** (HF, Hochschule): zusätzliche Werte auf dem Feld (Strahlung, Dampfdruckdefizit, Wind, TS innen, Oberflächenwasser), im Ergebnis Rechenwege (Punkte, FK, kritischer pH, DLG bzw. Sinnenprüfung, Wasserentzug bei Belüftung), Verlustbilanz, Kalibrierparameter `KAL`, Link «Modell gegen Messung», CSV-Export der Runde (Ergebniswerte, Arbeitsgänge, stündlicher Verlauf; Semikolon, Dezimalpunkt, UTF-8) und Aufgaben zum Begründen. Der Traktor meldet sich nur auf Wunsch.

Bedienung: Wahl auf dem Startbildschirm und jederzeit über den Knopf «Niveau» im Kopf; gemerkt unter `drysim-niveau`. Per Adresse: `?niveau=einstieg|praxis|profi`, kombinierbar mit `?wetter=`, `?code=` und `?szenario=`. Die Rangliste speichert das Niveau mit.

Aufbau: `public/js/niveau.js` enthält **eine Tabelle**, was jedes Niveau zeigt (`einsatz`, `feld`, `ergebnis`, `assistent`, `belueftung`); die übrigen Module fragen mit `zeigt('feld.ampel')` usw. nach. Erklärkarten tragen in `model.js` die Kennzeichnung `ab` (ab welchem Niveau sie erscheinen), die Einstiegskarten zusätzlich `kurz` und `titelEinfach`. Der Eintrag `belueftung` legt fest, was am Heustock je Niveau gewählt, gemessen und getan werden kann (Tabelle im Abschnitt «Heubelüftung bedienen»).

Für Lehrpersonen erzeugt `tools/seiten.mjs` die Seite `unterricht.html`: je Niveau drei Aufträge mit Lernziel, Zeitbedarf und fertigem Link, dazu Hinweise zum Klassenwettkampf.

## Traktor-Assistent (Lerninhalte im Spiel)

Wie in Futter v2 gibt ein Traktor unten rechts kurze Lerntipps (`public/js/assistent.js`, Texte in `assistent-texte.js`, feste Texte, keine KI):

- **Wo:** auf der Startseite, im Einsatz (je Abschnitt beim Scrollen und als Rückmeldung zu Wahl und Reglern, z. B. «Sehr tief gemäht», «Zinken im Boden»), auf dem Feld (je Phase: stehend, gemäht, im Schwad; dazu Ereignisse wie Regen, Zielbereich, Abend, spröde Blätter, über 35 Stunden, zu viel Erde, erstes Zetten und Schwaden) und beim Ergebnis (Silage bzw. Heustock-Kontrolle).
- **Bedienung:** meldet sich beim ersten Mal von selbst mit einer kleinen Blase, die beim Antippen aufgeht; Warnungen kommen bei jedem Mal. Texte «einfach» oder «fachlich» (mit Zahlen und Quellen), «Mehr dazu» führt in die Lernseite. «Ruhe, bitte» schickt den Traktor schlafen, auf der Startseite lassen sich die Tipps aus- und wieder einschalten oder neu starten.
- **Spiel:** Öffnet man eine Blase im laufenden Spiel, pausiert es. In der Wette (Zeitraffer) gibt es nur den Hinweis auf den Zeitraffer.
- **Zettvorgänge nach LK Salzburg:** 1. Schnitt ohne Aufbereiter drei Durchgänge (540 → 400 → 320 U/min), mit Aufbereiter zwei (er ersetzt das Zetten), Folgeschnitte zwei (540 → 320).
- **Feuerwehr bei Heu:** Ab 60 °C die örtliche Feuerwehr vorinformieren und um Rat fragen (Praxisempfehlung), bei 60 bis 70 °C alle fünf Stunden messen, ab 70 °C oder bei Mulde sofort alarmieren (LK Salzburg).

## Modell (Lehrmodell, vereinfacht)

- **Trocknung**: Trocknungskonstante nach Rotz & Chen (1985) aus Strahlung, Dampfdruckdefizit, Bodenfeuchte und Schwaddichte (am ersten Tag schneller). Kalibriert auf Feldversuche der Univ. Wisconsin (Breitablage ≥ 70 % der Fläche: 35 % TS nach rund 8–10 h bei gutem Wetter; schmale Schwade erst am Folgetag; Breitablage wichtiger als Aufbereitung): Schwadfaktor hoch −0,75 (Breitablage 1, Mähschwade 1,7, Schwad 5), Wind, hohe Stoppeln (+2 %/cm über 7 cm). Der Aufbereiter wirkt erst in der zweiten Phase (ab ca. 22–30 % TS), nach dem Schliessen der Stomata.
- **Maschinen**: Stoppelhöhe 4–12 cm (effektiv, was nach dem Mähen stehen bleibt; intern weiterhin `schnitthoehe`) (Erde unter 6 cm, Ertrag −4 %/cm über 7 cm). Aufbereiter ohne / Zinken / Walzen / Zinken mit Bürste (raut die Wachsschicht stark auf, verteilt breit, bei Regen empfindlicher). Zinkenhöhe von Zetter und Schwader stufenlos 0–8 cm, ohne Vorgabe: unter ca. 2 cm Erde, über 4 cm bleibt Futter liegen bzw. der Zetter wirkt schwächer.
- **Oberflächenwasser** (Tau, Regen) liegt in einem eigenen Speicher. Es verdunstet zuerst und bremst die Trocknung des Gewebes. Ein Teil dringt ins Gewebe ein, bei verletzter Wachsschicht (Aufbereiter) mehr.
- **Atmung**: ca. 0,2 %/h der TS bei 20 °C (Q10 = 2), nimmt bis 60 % TS auf null ab und verbraucht Zucker.
- **Auswaschung** durch Regen: höher bei angewelktem und aufbereitetem Futter, zur Hälfte Zucker.
- **Bröckelverluste** je Arbeitsgang, steigen mit TS und Kleeanteil.
- **Rohasche**: Grundgehalt je Bestand + Stoppelhöhe + Arbeitsgänge (Zinkenhöhe). Verstärkt durch Maulwurfshaufen, nassen Boden und tiefe Stoppeln.
- **Silierung**: Vergärbarkeitskoeffizient FK = TS + 8·Z/PK (Weissbach). Buttersäure aus FK-Defizit, Nässe und Erde; pH gegen kritischen pH (0,0257·TS + 3,71). Gärbewertung angelehnt an den DLG-Schlüssel 2006, Siloverluste (Gärung, Nacherwärmung, Sickersaft).
- **Punkte** = MJ NEL/ha im Trog × Gärfaktor bzw. Heufaktor (Note 1–5) × Abzug für TS ausserhalb des Zielbereichs, geteilt durch 100.

### Heu (seit 7.11.2026)

- **Lagerarten**: Belüftungsheu (Einführen ab 60 % TS, Ziel 60–80 %), Bodenheu und Heuballen (ab 85 % TS). In der Einsatzplanung unter «4 · Silage oder Heu?».
- **Trocknung**: Ab 55 % TS innen trocknet das lockere Futter schneller (Schub, siehe Kalibrierung). Mit Aufbereiter und Breitablage ist Bodenheu bei Hochdruck ab dem Abend des zweiten Tages lagerfähig. Nachts nimmt Heu über Tau und Gleichgewichtsfeuchte wieder Wasser auf.
- **Nachtschwad**: Zetten ist auch aus dem Schwad möglich (Knopf heisst dann «Breit streuen»). Im Schwad fällt weniger Tau an. Pläne dürfen mehrere Schwadzeiten haben (`schwaden: [19, 62]`).
- **Bröckeln**: Zusätzlicher Verlust ab 60 % TS beim Zetten, Schwaden und Pressen, bei Klee stark. Tau oder Restfeuchte auf der Oberfläche halbiert die Sprödigkeit.
- **Regen und Sonne**: Auswaschung bei über 60 % TS doppelt. Sonne auf Futter über 50 % TS bleicht (MJ/m², im Schwad ein Drittel).
- **Lager** (`lagereHeu`): TS-Defizit unter der Grenze → Erwärmung (Temperatur im Stock), Schimmel, Lagerverlust und Energieabzug. Belüftung: Dauer aus dem Restwasser und dem Dampfdruckdefizit der Folgetage; über 3 Tage gibt es Abzüge. Ab 70 °C Note 5.
- **Heuqualität**: 100 Punkte minus Abzüge für Geruch (Defizit, Temperatur, lange Belüftung), Farbe (Bleiche über 35 MJ/m², Regen auf trockenes Futter), Gefüge (Bröckeln über 4 %) und Erde. Angelehnt an die Sinnenprüfung, Punkte vereinfacht. Notenstufen wie bei der Silage.
- **Szenarien**: Wetterlage «Heuwetter, Juli»; Prognosen Bodenheu wie im Bilderbuch, Heu am Morgen eingefahren, Föhn mit Belüftung vor dem Regen, Kleeheu zu oft gezettet.


### Kalibrierung an Schweizer Messungen (seit 22.11.2026)

- **Modell gegen Messung**: `public/js/versuche.js` enthält die Messwerte des FAT-Versuchs 2001 (FAT-Bericht 584: TS-Verläufe, TS beim Einführen, Aufnahme- und Bröckelverluste je Verfahren, Ablagebreiten), dazu Humbert et al. 2010 (Insekten) und top agrar 12/2021 (Leistungsbedarf). `public/js/vergleich.js` rechnet die Verfahren mit dem Spielmodell nach (Wetterlage `taenikon`, `FAT_PLAN` in `scenarios.js`).
- **Kalibrierung** (`KAL` in `model.js`): Grundtempo 0,78 (vorher 0,6), Wirkung der Ablagebreite 0,9, Schub ab 55 % TS 0,5, alle Bröckelverluste ×0,4. Mittlere Abweichung zur Messung rund 3,5 Prozentpunkte TS; vorher 11. Ohne Aufbereiter und nie gewendet trocknet das Modell etwas zu langsam. Der top-agrar-Versuch (ein Tag, Ackergras) wird nicht getroffen: dort wirkte der Aufbereiter stärker als im Modell.

```
docker run --rm -v "$PWD":/app -w /app node:22-alpine node test/fat.mjs          # Vergleich je Verfahren
docker run --rm -v "$PWD":/app -w /app node:22-alpine node test/kalibrierung.mjs # Parametersuche
```

- **Ablagebreite**: Regler 30–100 % der Mähbreite statt breit/Schwade (Schwadfaktor `(85/Ablage)^0,9`). Der Aufbereiter mit Bürste legt immer auf 85 % ab. Alte Einstellungen (`breit`) werden umgerechnet.
- **Aufbereiter-Abwägung**: Erklärkarte «Aufbereiter: Preis und Insekten», Abzeichen «Insektenschoner». Ohne Aufbereiter ist die Aufbereitungskarte höchstens «geht besser» (es geht auch ohne).
- **Zwei-Stunden-Hinweis**: Zwei Stunden nach dem Mähen meldet der Ticker, dass die Unterseite noch nass ist (Beratungsregel, ohne Messdaten).
- **Grafiken** (`public/js/grafik.js`): Trocknung Spiel gegen Messung, Feldverluste, Ablagebreite, Insekten und Leistung, Zucker nach dem Mähen. In den Erklärkarten (Feld `grafik`) und auf der Lernseite (Abschnitte «Mit oder ohne Aufbereiter?» und «Spiel gegen Messung»).
- **Szenario** «Tänikon 2001: echter Versuch»: Die Wette zeigt zusätzlich die gemessene TS.
- Nicht übernommen: die Aussage, der Zucker nehme nach dem Schnitt durch Photosynthese zu (Beratung Kilcer/Puckhaber, ohne gesicherte Versuche). Die Lernseite erklärt das.

### Heubelüftung (seit 22.11.2026, Branch feature/belueftung)

- **Spielphase «Am Heustock»** (`heustock.js`): Nach dem Einführen von Belüftungsheu läuft die Uhr stündlich weiter (Tempo, Pause, ruhiger Modus mit +1 h/+6 h, Tasten A/D/I Lüfter, W Dach, E Entfeuchter, R Nachrechnen). Lüfter aus, Dauer oder Intervall mit Feuchtesteuerung; Warmluft vom Dach; Entfeuchter. Anzeigen: Zuluft und Abluft (°C, % rF), Wasserentzug g/m³ und L/h, Restwasser bis 87 % TS, TS (Mittel und feuchteste Schicht), Stocktemperatur, Strom. Ticker-Hinweise (feuchte Nachtluft, über 35/40 °C, Haupttrocknung fertig, 80 Stunden, Dach). «Steuerung übernimmt» spielt den Rest im Intervall im Zeitraffer. Ende, wenn lagerfähig oder nach zehn Tagen. Gesichert wird das Protokoll der Schaltungen (`drysim-runde` mit Feld `heustock`), Fortsetzen spielt Feld und Heustock exakt nach.
- **Optionen für Niveaus**: `setup.belueftungOptionen = { dach, entfeuchter, rechnen }` (Standard: alles an, `OPTIONEN` in `belueftung.js`). Ausgeschaltetes wird im Modell nicht gerechnet und im Bildschirm ausgeblendet.
- **Modell** (`belueftung.js`): Stock in vier Schichten, Luft von unten nach oben. Luftzustand wie drywatch (Magnus, x in g/kg, Dichte, Enthalpie), Wasserentzug = (x Abluft − x Zuluft) × Dichte. Jede Schicht bringt die Luft auf ihrer Enthalpie ein Stück zum Sorptionsgleichgewicht des Heus (Abkühlung beim Verdunsten); ist die Luft feuchter, nimmt das Heu Wasser auf. Lüfterstrom und Dachwärme wärmen die Zuluft, der Entfeuchter kondensiert Wasser (Kondensleistung nach Agroscope 2014, Abb. 18) und gibt seinen Strom als Wärme ab.
- **Belegt** (Quellen in `versuche.js` und auf der Lernseite): Luftmenge 0,11 m³/s je m², Lüfter 0,11 kW je m², Dach 2× Stockfläche mit 275 W/m² (Agroscope 2014); Raumgewicht 78 kg TS/m³ (FAT 1982); Box 25 m² je ha Tagesschlagkraft, Entfeuchter 17 kW je 100 m², ersten 24 h durchlüften, über 35 °C belüften, Haupttrocknung innert 80 h (LK Salzburg); Intervall alle 4 h eine halbe Stunde bis Gutfeuchte rund 22 % (FAT 1982: 4–6 h, 20–30 min, bis 20–25 %); Entfeuchter unter 10 °C oder 40 % rF unwirksam (Agroscope 2014). Sorptionsgleichgewicht angepasst an die Kurven für 20 und 30 °C (LK Salzburg) und die Abluft-Tabellen (Agroscope 2014, Tab. 3; LK Salzburg), höchstens rund 2 Punkte TS daneben.
- **Kalibrierung** (`KAL_B`): Annäherung je Schicht 0,225, mit der Gutfeuchte abnehmend (Exponent 0,5), Wiederbefeuchtung halb so schnell; angepasst an FAT 1982, Abb. 29 (Wasserentzug nach Luftfeuchte und TS, mittlere Abweichung 0,18 g/m³) und die Ausnutzung des Sättigungsdefizits von 50–65 % (LK Salzburg). Geprüft (nicht angepasst) an LK Salzburg S. 42: Kaltluft 0,23/0,27 kWh je kg Wasser (LK 0,24/0,28), Dach 0,15 (LK unter 0,2), Entfeuchter 0,49 mit Lüfter (LK 0,26–0,45). Tänikon 2001 (67,6 % TS) im Standardbetrieb: Haupttrocknung 72 h, 60 kWh/t.

```
docker run --rm --user 1000:1000 -v "$PWD":/app -w /app node:22-alpine node test/belueftung.mjs              # Vergleich mit den Richtwerten
docker run --rm --user 1000:1000 -v "$PWD":/app -w /app node:22-alpine node test/belueftung-kalibrierung.mjs  # Parametersuche
docker run --rm --user 1000:1000 -v "$PWD":/app -w /app node:22-alpine node test/bedienung.mjs               # Bedienung: Ernstfall, Kennlinie, Säulen, Eingriffe
```

- **Ergebnis**: `Feld.einfahren()` rechnet Belüftungsheu mit dem Standardbetrieb (Intervall, Dach; Wette und Zeitraffer) oder mit `plan.belueftung`; nach der Spielphase bewertet `Feld.bewerte(lauf)` neu. `lagereHeu` nutzt Haupttrocknung (Abzüge über 80 h), höchste Stocktemperatur, Schimmelindex, Restfeuchte am Ende, Atmungsverlust im Stock und Strom. Erklärkarte «Belüftung und Lager» mit Verlaufsgrafik, Kennzahl «Belüftung» und Abzeichen «Stromsparer» (höchstens 0,25 kWh je kg Wasser).
- **Rechenaufgabe** «Nachrechnen»: Aus Zuluft und Abluft mit einer Sättigungstabelle g/m³, Wasserentzug und L/h berechnen (Toleranz 12 %), Auflösung mit Rechenweg, Vergleich mit der genaueren Rechnung des Spiels und h,x-Diagramm (`grafikHx`).
- **Szenarien**: «Belüftung: Lüfter Tag und Nacht» (Dauerbetrieb ohne Dach) und «Belüftung: vor dem Gewitter» (Kaltbelüftung, 63 % TS).
- **Wetter**: `belueftungsWetter` verlängert die vier Tage der Wetterlage reproduzierbar auf 14 Tage (Spielwetter aus dem Mittel der Wetterlage, keine Klimastatistik). Die ersten vier Tage bleiben unverändert, die Feldphase rechnet weiter mit dem Original.

### Heubelüftung bedienen (seit 23.11.2026, Branch feature/belueftung-bedienung)

Umsetzung des Konzepts `docs/konzept-heubelueftung-bedienung.md`: Die Lernenden wählen die Anlage, füllen ein, lüften, messen und greifen ein; dabei kann vieles schiefgehen.

- **Anlage** (Einsatz planen, Abschnitt 5, sobald Belüftungsheu gewählt ist): Lüfter Standard oder stark, Warmdach ja/nein, Entfeuchter ja/nein, Boxfläche klein/passend/gross. Die Anlage gilt für die ganze Runde (`einstellungen.anlage`, in der Wette `plan.anlage`); ohne Warmdach gibt es keinen Schalter dafür. Die **Füllhöhe** in Metern (Ertrag × 2 ha ÷ Boxfläche ÷ Raumgewicht) wird im Einsatz angezeigt und beim Einfüllen mit der tatsächlichen Menge nachgeführt, je mit dem Urteil nach den Richtwerten zur Schütthöhe.
- **Luftmenge**: Betriebspunkt aus Lüfterkennlinie und Stockwiderstand statt fester 0,11 m³/s je m². Der Lüfter ist auf den Sollwert gedrosselt; reicht sein Druck nicht, sinkt die Luftmenge (Anzeige «Luftmenge: … % vom Soll», Druck in Pa). Stärkeren Lüfter während der Belüftung holen: läuft nach 24 Stunden, kostet Arbeitsstunden und einen höheren laufenden Ansatz.
- **Einfüllen** (Dialog zwischen Einfahren und Belüften, `einstellungen.einfuellen`): alles auf einmal oder in zwei Lagen, gleichmässig verteilen oder abladen, wie es kommt, Lüfter sofort oder erst nach dem Einfüllen. Ungleich abgeladen ergibt drei **Säulen** (vorne locker und niedrig = Kamin, hinten hoch und dicht = Nest) mit eigener Luftmenge; gleichmässig gefüllt ist es eine Säule, und das Modell rechnet genau wie vor dem Ausbau.
- **Messen**: Stocktemperatur und Schichtfeuchte sind nur nach dem Stecken der Heusonde sichtbar (drei Stellen; Profi auch «nur Mitte»), mit dem Alter der Messung. Dauernd sichtbar sind Zuluft, Abluft, Wasserentzug, Luftmenge und Strom. Einstieg: automatisch mit Ampel.
- **Eingriffe** (ein Klick): Umschichten (mischt alles, löst Kamine und Nester auf, lockert auf 65 kg TS/m³), Nachfüllen der zweiten Lage, oberste Lage auslagern, stärkeren Lüfter holen, Sicherung einschalten.
- **Ernstfall**: Feuerwehr vorinformieren (Taste F), alarmieren (Knopf). Alarm ab 60 °C beendet die Runde mit «Abbruch» (10 Punkte, Abzeichen «Rechtzeitig gehandelt»), darunter ist es ein Fehlalarm. Bleibt der Stock 12 Stunden über 70 °C, oder wird er ab 60 °C umgeschichtet oder abgetragen, endet die Runde mit «Brand» (null Punkte, eigener Schluss). Die Rangliste trägt beide Enden mit Vermerk ein.
- **Pannen** (nur Profi, abschaltbar mit `?pannen=aus`): Stromausfall in der zweiten Nacht oder gefallene Sicherung, aus Wetterlage und Code abgeleitet, für alle in der Klasse gleich.
- **Panne «Wetterrisiko – Gewitter»** (nur Profi, mit den anderen Pannen abschaltbar; `gewitterAus`, `mitGewitter` in `scenarios.js`): Der Wetterbericht zeigt am ersten Tag ab Tag 2 ohne Regen «Gewitterrisiko am Nachmittag». Ob es eintritt, folgt fest aus Wetterlage und Code. Tritt es ein, regnet es wie in der Wetterlage «Gewitter am Tag 2» (16–18 Uhr, 9/5/1 mm) bei schwüler Luft, und am Heustock fällt der Strom zwei Stunden aus (Annahme). Gilt für alle Lagerarten auf dem Feld.
- **Ergebnis**: Zeitstrahl mit den eigenen Handlungen und den Wendepunkten («Feuchtes Nest hinten … nicht gemessen»), Karten Anlage, Einfüllen, Lüften, Kontrolle, Eingriffe, Lager (Wert als «% Verlust») und Kosten. Kosten in Franken je Tonne Heu stehen neben den Punkten und zählen nicht für sie; im Profi mit Rechenweg und änderbaren Preisen, CSV mit Handlungen und stündlichem Verlauf am Heustock.
- **Wetten**: «Standardlüfter bei 55 % TS», «zu hoch gefüllt», «Nest übersehen» (`plan.anlage`, `plan.einfuellen`, `plan.belueftungLog`).
- **Protokoll**: Alle Schaltungen und Handlungen (`sonde`, `vorinfo`, `alarm`, `umschichten`, `nachfuellen`, `auslagern`, `luefterHolen`, `sicherung`) stehen mit ihrer Stunde im Protokoll; Fortsetzen und Wette spielen exakt nach (`spieleBelueftungNach`). Gesicherte Runden am Heustock tragen `heustock.v` (`PROTOKOLL_VERSION`, jetzt 3); ältere werden verworfen. Runden der Feldphase bleiben gültig.

| | Einstieg | Praxis | Profi |
|---|---|---|---|
| Anlage | vorgegeben (Standardlüfter, Warmdach, passende Box) | Lüfter, Warmluft und Entfeuchter wählen | dazu Boxfläche, Kennlinie und Kosten sichtbar |
| Einfüllen | automatisch richtig | Höhe sehen, Verteilen, Lüfterstart | dazu zwei Lagen und Nachfüllen |
| Messen | automatisch, Ampel | Heusonde (drei Stellen) | dazu «nur Mitte»; Messkalender in der Karte «Kontrolle» |
| Eingriffe | Lüfter, Feuerwehr | dazu Umschichten, Lüfter holen | dazu Auslagern, Pannen |
| Ernstfall | Warnung mit Handlungsvorschlag | Warnung beim Messen, Anzeichen (Geruch) | nur die Messwerte |
| Ergebnis | Karten Lüften, Wärme, Ernstfall in einfachen Sätzen | alle Karten, laufende Kosten | dazu Rechenweg der Kosten, Ansätze änderbar |

Abweichung zum Konzept (Entscheid des Auftraggebers vom 23.11.2026): Der Entfeuchter ist auch im Niveau Praxis wählbar. Er gehört zur Anlagewahl im Einsatz (Vorgabe: ohne); wer ihn wählt, hat am Heustock den Schalter «Entfeuchter» (Taste E) wie bisher. Szenarien ohne `plan.anlage` rechnen mit der bisherigen Standardanlage und liefern dieselben Zahlen wie vor dem Ausbau (`test/run.mjs`, `test/belueftung.mjs` unverändert).

**Belegt** (Quelle bei den Konstanten in `belueftung.js`):

- Druckbedarf je Meter Stockhöhe 160 Pa (Dauerwiese), 120 Pa (gräser-/kräuterreich), 240 Pa (kleereich), Dachabsaugung und Entfeuchter je 120 Pa (LK Salzburg S. 38; Agroscope 2014 S. 3: 100–240 Pa je Meter bei 0,11 m³/s·m²). Anstieg mit der Luftmenge aus «Statischer Druck bei Wiesenheu in Boxen» (Agroscope 2014, Abb. 6, abgelesen).
- Kennlinie des Standardlüfters: Beispiel aus Agroscope 2014, Abb. 7 (abgelesen, auf 150 m² Box bezogen; 0,11 kW je m²). Starker Lüfter: Proportionalitätsgesetze (Agroscope 2014 S. 3), Höchstdruck im Bereich 1300–1900 Pa (LK Salzburg S. 38).
- Schütthöhe einer Charge 1–2 m (Agroscope 2014 S. 7), höchstens 3 m, Klee und sehr junges Futter 2 m, erste Schicht mindestens 1 m (LK Salzburg S. 39, 44). Box 25 m² je ha (LK Salzburg), 14 m² als untere Grenze (Agroscope 2014).
- Raumgewicht 78 kg TS/m³ (Gebläse, Verteiler; zwei Drittel der Betriebe 65–91), Greifer 65 (FAT 1982 S. 4); Zunahme mit der Stockhöhe rund 4 % je Meter (LK Salzburg S. 21: 80 kg/m³ bei 3 m, 90 bei 6 m).
- Nachfüllen nach zwei bis drei schönen Belüftungstagen (FAT 1982 S. 19). Umschichten in der Haupttrocknung, Nester mit dem Greifer beseitigen (LK Salzburg S. 40; FAT 1982 S. 18). Lüfter läuft beim Beschicken (Agroscope 2014 S. 7).
- Temperaturstufen 45/60/70 °C, alle fünf Stunden messen, heissen Stock nie selbst abtragen, Anzeichen Schwitzwasser und süsslicher Geruch, Messkalender (LK Salzburg S. 24–25); chemische Erwärmung in der thermophilen Phase, biologisches Ende bei rund 75 °C (Philipsen 1965, in LK Salzburg S. 23).
- **Laufende Kosten** (Konzept 10.1: angestellte Betriebsleitung, kein Budget, kein Kaufpreis; `ANSAETZE` in `belueftung.js`). Quelle, wo nicht anders vermerkt: Agroscope, Kostenkatalog 2025 (Transfer Nr. 598/2025, gültig bis September 2026), Ansätze ohne MWST, Maschinen ohne Bedienung:
  - Arbeit 32 Fr./h (Vorgabe des Auftraggebers; gleich dem Lohnansatz innerlandwirtschaftlich, S. 8, Tab. 6), Strom 0,29 Fr./kWh (S. 4, Tab. 1).
  - Traktor 65–74 kW 43 Fr./h (Pos. 1005, S. 10); Mähwerk Heck 2,1–2,6 m 27 Fr./ha, mit Aufbereiter 49 Fr./ha, je 1,72 ha/h (Pos. 9021, 9022, S. 34); Kreiselheuer 3,5–4,5 m 15 Fr./ha, 2,80 ha/h (Pos. 9041); Kreiselschwader 2,8–3,3 m 15 Fr./ha, 1,39 ha/h (Pos. 9061); Ladewagen 15 m³ 27 Fr./Fuder, 2,7 Fuder/h (Pos. 9083, alle S. 36).
  - Radialventilator 4 / 7,5 / 11 / 30 kW: 707 / 836 / 1 110 / 1 497 Fr./Jahr (Pos. 24001, 24002, 24004, 24005); Heugebläse 10–15 kW 1 249 Fr./Jahr (Pos. 24010; alle S. 56, Hoftechnik ohne Strom). Gewählt wird der kleinste Ventilator mit der nötigen Motorleistung.
  - Nicht im Kostenkatalog: Dachabsaugung und Entfeuchter. Zuschlag aus «Gesamtkosten Trocknungssysteme» (LK Salzburg S. 43, abgelesen, Festkosten): Dach +1,5, Entfeuchter +9,3, beides +10,8 je t Heu. Wert des Heus 25,40 je dt TM (LK Salzburg S. 6).

### Musterlösungen für Superuser (seit 23.11.2026, Konzept Heubelüftung Abschnitt 11)

- **Wer:** Wer in Futter v2 eine Admin-Sitzung hat (zentrale Anmeldung graswachstum.ch, Recht `admin` oder `apps_admin`). `superuser.js` fragt `GET /futter/v2/api/admin/ich` mit `credentials: 'same-origin'` ab (Zeitlimit 4 s). Ohne Sitzung, ohne Netz oder bei Fehler erscheint nichts. Auf `unterricht.html` steht ein unauffälliger Link «Anmelden» (`/futter/v2/anmelden`). In Futter v2 wurde nichts geändert.
- **Was:** Am Ergebnis jeder Runde mit Belüftungsheu eine Karte «Musterlösungen»: günstigste gefundene Variante (tiefste laufende Kosten je t, Bedingung lagerfähig, kein Schimmel, kein Brand, Heuqualität mindestens Note 2: `GUENSTIG_BEDINGUNG`, Annahme) und beste gefundene Variante (höchste Punktzahl). Sind beide gleich, steht sie einmal da. Diagramm (TS vom Mähen bis zum Lagerende, eigene Runde und Varianten, Handlungen als Kreise, Regen als Band) und Tabelle (Punkte, Note, TS beim Einführen, Verlust, Kosten je t, Arbeitsstunden, Ende).
- **Suche** (`muster/suche.js`, im Web Worker): Raster über Mähzeitpunkt (Tag 1–3, 9/10/11/13 Uhr), Aufbereiter, drei Zettmuster und Einführzeiten im Zielbereich (aus einem Probelauf), dann Verfeinerung (Anlage soweit das Niveau sie wählen lässt, Lüfter Intervall oder Dauer, Entfeuchter, Zeiten ±1–2 h, alle Aufbereiter, Stoppelhöhe 7/8 cm), bis nichts mehr besser wird. Fest: gleichmässig verteilt, Lüfter beim Einfüllen an, Heusonde täglich um 8 Uhr. Wiese, Wetter (mit Gewitter und Pannen) und Niveau wie in der Runde. Die Feldzeiten der eigenen Runde sind ein Startpunkt. Rund 100 bis 800 Varianten, unter 2 s. Ergebnis je Runde im Browser gespeichert (`drysim-muster:…`).
- **Abspielen:** Das Protokoll läuft im normalen Spielbild im Zeitraffer durch (Feld, dann Heustock), mit Pause und Tempo; nichts wird gesichert, danach zurück zum Ergebnis.
- **Schutz, ehrlich benannt:** Der Code ist öffentlich und rechnet im Browser. Die Anmeldung verhindert nur, dass Lernende die Musterlösung angeboten bekommen. `js/muster/` wird erst nach bestätigter Sitzung nachgeladen, steht nicht im Service-Worker-Cache, und der Service Worker lässt die Sitzungsabfrage und `js/muster/` durch. Musterlösungen kommen nie in die Rangliste.
- **Geprüft:** `test/muster.mjs` (alle Szenarien mit Belüftungsheu). Im Browser nur mit einer Attrappe der Sitzungsabfrage (Playwright, Service Worker dafür gesperrt): angemeldet, nicht angemeldet, Netzfehler, und ohne Attrappe gegen den lokalen nginx (404). Die echte Abfrage gegen Futter v2 auf apps.graswachstum.ch ist nicht geprüft.

## Offen / im Büro weiterentwickeln

- [ ] Musterlösungen: Kursleitende ohne Admin-Sitzung sehen sie nicht (braucht ein eigenes Recht in der zentralen Anmeldung, Konzept 11). Die Suche ist kein Beweis des Optimums; Eingriffe (Umschichten, Nachfüllen) und zwei Lagen werden nicht gesucht. Lokal hinter dem Proxy meldet der Browser einen 404 auf die Sitzungsabfrage in der Konsole, auf apps.graswachstum.ch nicht.

- [ ] Betriebe, Fläche und Arbeitszeit: Konzept in `docs/konzept-betriebe-flaeche-arbeit.md` (Stand 23.11.2026), offene Entscheide in Abschnitt 13

- [ ] Parameter mit Fachleuten kalibrieren: Trocknung mit Schweizer Messreihen (Gras statt Luzerne, Agroscope/AGFF) prüfen, Atmung, Bröckelverluste, Buttersäure-Ansatz; Werte des Aufbereiters mit Zinken und Bürste mit Versuchsdaten abgleichen
- [ ] DLG-Punktetabelle mit dem Originalschlüssel 2006 abgleichen (Essigsäure- und pH-Stufen sind vereinfacht); evtl. Schweizer Sinnenprüfung als zweite Sicht
- [ ] Aufbereiter vs. Wachsschicht: Im Modell beschleunigt er die kutikuläre Phase (Stomata sind nach ca. 1 h ohnehin zu), dafür nimmt das Futter mehr Wasser auf und es wird mehr ausgewaschen. Konkrete Maschine (Werbeaussage „zerstört Wachsschicht“) mit Versuchsdaten prüfen
- [ ] Wettkampf über mehrere Geräte: Rangliste ist nur lokal im Browser → Klassenraum mit Code auf dem Server (z.B. über Konto/Kurs aus Futter v2). Offene Entscheidung: Datenschutz (Namen), Missbrauchsschutz bei öffentlichem Schreibzugriff, Aufbewahrung
- [ ] Weitere Entscheidungen: Häcksellänge, Verdichtung, Siliermittel, Zudecken; Schwadbreite
- [ ] Wetter: echte Vorhersage/Messdaten (MeteoSchweiz) als Szenario-Quelle
- [ ] Grafik: Illustrationen (Feld, Maschinen) – derzeit nur SVG-Diagramm; KI-Bilder oder Grafiker
- [x] Heu als zweites Modul (Belüftungsheu, Bodenheu, Heuballen; Nachtschwad; Lager und Heuqualität)
- [ ] Heu-Parameter mit Fachleuten prüfen: Trocknungsschub ab 55 % TS, Bröckelverluste nach TS und Kleeanteil, Erwärmung und Lagerverluste, Punkteschema der Heuqualität (Sinnenprüfung)
- [x] Heubelüftung als zweite Spielphase, Rechnung wie drywatch (Wasserentzug g/m³ und L/h, h,x-Diagramm)
- [ ] Belüftung mit einer echten Messreihe prüfen: Die Unterlagen (FAT 1982, Agroscope 2014, LK Salzburg) enthalten keinen vollständigen Verlauf mit Stockfläche, Heumenge, Luftzustand, Dauer und Strom. Geprüft ist nur gegen Richtwerte und abgelesene Grafiken. Kandidaten: Messkurve Entfeuchtertrocknung LK Salzburg S. 40 (ohne Masse und Luftmenge), FAT-Berichte 406/407 (Baumgartner, Nydegger 1991), Nydegger & Wirleitner 2014; drywatch-Messdaten von Betrieben
- [ ] Belüftung, Annahmen ohne Beleg: Erwärmung von ungelüftetem Heu (0,3 K/h bei 65 % TS und 20 °C, Q10 = 2 bis 40 °C, darüber abnehmend), Schimmelindex (Gleichgewichtsfeuchte über 75 % rF, 72 h bis «leicht»), Wärmekapazität, Abzüge in der Heuqualität, Parzelle 2 ha, vier Schichten, Lagerfähigkeit an der feuchtesten Schicht (85 % TS), Temperatur der Abb. 29 (20 °C angenommen), Zuordnung der TS-Klassen in Abb. 29 zu Vertreterwerten. Nicht gerechnet: Umluftbetrieb des Entfeuchters, Luftverlust bei sehr niedrigem Stock, Setzen des Stocks
- [ ] Heubelüftung bedienen, Annahmen ohne Beleg (Fachleuten vorlegen; für Ernstfall und Messreihen GVB und Betreiber von drywatch):
  - Ernstfall: Brand nach 12 Stunden über 70 °C ohne Alarm; chemische Erwärmung ab 60 °C (Stärke, Verdoppelung je 10 K, Obergrenze 100 °C); Fehlalarm unter 60 °C; Anzeichen «süsslicher Geruch» ab 50 °C im Spiel. Die Quellen nennen Stufen, keine Zeiten.
  - Luft: Einfluss von Feuchte (linear mit der Gutfeuchte, Faktor 0,5 bis 2) und Dichte (Exponent 1,5) auf den Druck; Drosselung des Lüfters auf den Sollwert; starker Lüfter = 20 % höhere Drehzahl; Leistungsaufnahme unabhängig vom Betriebspunkt; Widerstand von Rost und Kanälen nicht gerechnet.
  - Einfüllen: ungleich abgeladen = drei Säulen mit Raumgewicht 65/78/91 kg TS/m³ und Höhen 0,8/1/1,2 des Mittels; drei Stunden ohne Luft bei spätem Lüfterstart; zweite Lage wartet locker ausgebreitet und kühlt rasch aus (15 % der Übertemperatur je Stunde); Box «gross» 36 m² je ha.
  - Eingriffe: Umschichten mischt den ganzen Stock (Quelle: obersten Meter), 1 % Bröckelverlust, die Hälfte der Übertemperatur entweicht; Wartezeit Lüfter 24 h; Arbeitszeiten (Sonde 0,25 h, Verteilen 1 h, Umschichten 1,5 h, Nachfüllen 1 h, Auslagern 1 h).
  - Kosten: 12 Einfuhrtage dieser Grösse je Jahr, auf die die Jahreskosten von Lüfter und Gebläse verteilt werden; 1 170 kg TS je Fuder (15 m³ × 78 kg TS/m³); Euro 1:1 als Franken (LK Salzburg); 4 Arbeitsstunden für das Nachrüsten des Lüfters; Beschickung mit dem Heugebläse (der Kran für das Umschichten ist nicht eingerechnet); Stufen der Karte «Kosten» (verlorenes Heu und Strom bis 25 / bis 50 Fr./t) und 10 Punkte beim Abbruch sind Spielwerte. Arbeitszeit am Stock (Sonde 0,25 h usw.) wie oben. Neuere Ansätze: Agroscope hat für 2026 nur Excel-Rohdaten veröffentlicht (Traktor und Feldgeräte gleich oder bis 2 Fr. höher, Hoftechnik fehlt dort); beim nächsten Kostenkatalog nachführen.
  - Pannen: Zeitpunkt und Dauer (Stromausfall 8 h nach 30 h, Sicherung nach 40 h). Die «Regenwoche» aus dem Konzept ist nicht umgesetzt.
- [ ] Heubelüftung bedienen, bekannte Grenzen: In zwei Lagen einzufüllen lohnt sich im Modell kaum (die zweite Lage muss warten, weil die Parzelle schon gemäht ist; in der Praxis mäht man an zwei Tagen). Die Luftmenge bricht erst bei hohen, kleereichen oder nassen Stöcken ein (z. B. 3,9 m Kleeheu: rund 80 % vom Soll); ein normaler Stock von 1,5 m liegt weit unter dem Druck des Standardlüfters. Die Tabelle «Anzahl Ladewagen je 100 m²» (FAT 1982, Tab. 12) ist im Scan nicht sicher lesbar und nicht verwendet.
- [ ] Entscheide des Auftraggebers (umgesetzt nach den Vorschlägen des Konzepts): Anlage kostet nur im Ergebnis (kein Budget); Brand wird mit null Punkten und Vermerk in die Rangliste eingetragen; Pannen nur im Profi, abschaltbar per Link.
- [ ] Wetter nach dem vierten Tag ist erfunden; besser echte Messreihen (MeteoSchweiz) für die Belüftungsphase


## Lizenz

Code: © 2026 AGFF – Arbeitsgemeinschaft zur Förderung des Futterbaues, lizenziert unter der EUPL-1.2 (Datei `LICENSE`; amtliche
Fassungen auch auf Deutsch, Französisch und Italienisch: https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12). Nicht unter
die Lizenz fallen die Inhalte (Merkblätter, Zeichnungen, Fotos, Tabellen); die Rechte liegen bei der jeweiligen Quelle, meist bei der
AGFF. Die Lizenz wird zentral gepflegt in `entwicklungsumgebung/lizenz`.
