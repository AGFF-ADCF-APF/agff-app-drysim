# Silage-Simulator (drysim)

Lernspiel zur Futterkonservierung für die höhere Berufsschule und die höhere Fachschule.
Läuft unter <https://apps.graswachstum.ch/drysim/>. Der Start ist die Silagebereitung, Heu kommt später dazu.

## Idee (Gespräch vom 12.10.2026)

- **Planen & Wettkampf**: Die Studierenden entscheiden selbst, wann und wie gemäht, gezettet, geschwadet und eingefahren wird (Schnitthöhe, Aufbereiter, Breitablage, Arbeitshöhe von Zetter und Schwader, Siloart). Das Wetter läuft stündlich im Tagesverlauf mit Sonne, Temperatur, Tau und Regen. Am Ende gibt es Punkte für die Energie im Trog × Gärqualität, dazu eine Rangliste.
- **Prognose**: Ein Szenario ist vorgegeben. Die Studierenden tippen zuerst TS, Rohasche und Gärnote, dann läuft die Simulation im Schnelldurchlauf und deckt das Ergebnis auf.
- **Erklär-Knöpfe**: Beim Ergebnis erklärt jeder Faktor, was passiert ist (z.B. „5 cm Schnitthöhe → +18 g Rohasche → Clostridien → Buttersäure“). Das ist näher an der Schweizer Sicht („Hast du alles richtig gemacht, damit es gut werden musste?“). Die DLG-Laborbewertung wird nur als Ergebnis gezeigt.

Für den Wettkampf bekommen alle dasselbe Wetter, entweder eine feste Wetterlage oder ein Zufallswetter mit Code: `…/drysim/?wetter=gewitter` oder `…/drysim/?code=KLASSE3`.

## Aufbau

Statische Seite ohne Build-Schritt (ES-Module), ausgeliefert mit nginx hinter Traefik.

Ablauf im Spiel: Start → Einsatz planen (Wetter, Wiese, Maschinen, Silo) → Spielfeld (die Uhr läuft, Tempo wählbar; Mähen, Zetten, Schwaden und Einfahren per Knopf; Pause bei Regen, Zielbereich, „zu trocken“) → Silo öffnen (Punkte, Sterne, Abzeichen, Erklär-Karten, Rückblick). Die Prognose-Wette nutzt dasselbe Spielfeld im Zeitraffer mit vorgegebenem Plan.

| Datei | Inhalt |
|---|---|
| `public/js/weather.js` | Stündliches Wetter aus Tageswerten (tmin/tmax, Tau über rhmax, Sonne, Wind, Regen); Zufallswetter mit Code |
| `public/js/model.js` | `Feld` (Stunde für Stunde, Arbeitsgänge), `simuliere` (ganzer Plan), Silierung, Punkte, Erklärtexte |
| `public/js/game.js` | Spielablauf: Takt, Arbeitsgänge, Ticker-Meldungen, Anzeigen |
| `public/js/scene.js` | SVG-Feldszene: Himmel im Tagesverlauf, Sonne/Mond, Wolken, Regen, Tau, Futterfarbe nach TS, Erde, Traktor |
| `public/js/icons.js` | Wetter- und Maschinensymbole |
| `public/js/chart.js` | Rückblick-Diagramm Wetter + TS-Verlauf |
| `public/js/app.js` | Bildschirme, Einsatz-Auswahl, Silo öffnen, Wette, lokale Rangliste |
| `public/js/scenarios.js` | Wetterlagen, Grundplan, Prognose-Szenarien |
| `test/run.mjs` | Modell-Durchlauf aller Szenarien auf der Konsole |

```
docker compose up -d --build
docker run --rm -v "$PWD":/app -w /app node:22-alpine node test/run.mjs
```

## Modell (Lehrmodell, vereinfacht)

- **Trocknung**: Trocknungskonstante nach Rotz & Chen (1985) aus Strahlung, Dampfdruckdefizit, Bodenfeuchte und Schwaddichte (am ersten Tag schneller). Kalibriert auf Feldversuche der Univ. Wisconsin (Breitablage ≥ 70 % der Fläche: 35 % TS nach rund 8–10 h bei gutem Wetter; schmale Schwade erst am Folgetag; Breitablage wichtiger als Aufbereitung): Schwadfaktor hoch −0,75 (Breitablage 1, Mähschwade 1,7, Schwad 5), Wind, hohe Stoppeln (+2 %/cm über 7 cm). Der Aufbereiter wirkt erst in der zweiten Phase (ab ca. 22–30 % TS), nach dem Schliessen der Stomata.
- **Maschinen**: Schnitthöhe 4–12 cm (Erde unter 6 cm, Ertrag −4 %/cm über 7 cm). Aufbereiter ohne / Zinken / Walzen / Doppelrotor (intensiv, verteilt breit, bei Regen empfindlicher). Zinkenhöhe von Zetter und Schwader stufenlos 0–8 cm, ohne Vorgabe: unter ca. 2 cm Erde, über 4 cm bleibt Futter liegen bzw. der Zetter wirkt schwächer.
- **Oberflächenwasser** (Tau, Regen) liegt in einem eigenen Speicher. Es verdunstet zuerst und bremst die Trocknung des Gewebes. Ein Teil dringt ins Gewebe ein, bei verletzter Wachsschicht (Aufbereiter) mehr.
- **Atmung**: ca. 0,2 %/h der TS bei 20 °C (Q10 = 2), nimmt bis 60 % TS auf null ab und verbraucht Zucker.
- **Auswaschung** durch Regen: höher bei angewelktem und aufbereitetem Futter, zur Hälfte Zucker.
- **Bröckelverluste** je Arbeitsgang, steigen mit TS und Kleeanteil.
- **Rohasche**: Grundgehalt je Bestand + Schnitthöhe + Arbeitsgänge (Zinkenhöhe). Verstärkt durch Maulwurfshaufen, nassen Boden und tiefe Stoppeln.
- **Silierung**: Vergärbarkeitskoeffizient FK = TS + 8·Z/PK (Weissbach). Buttersäure aus FK-Defizit, Nässe und Erde; pH gegen kritischen pH (0,0257·TS + 3,71). Gärbewertung angelehnt an den DLG-Schlüssel 2006, Siloverluste (Gärung, Nacherwärmung, Sickersaft).
- **Punkte** = MJ NEL/ha im Trog × Gärfaktor (Note 1–5) × Abzug für TS ausserhalb des Zielbereichs, geteilt durch 100.

## Offen / im Büro weiterentwickeln

- [ ] Parameter mit Fachleuten kalibrieren: Trocknung mit Schweizer Messreihen (Gras statt Luzerne, Agroscope/AGFF) prüfen, Atmung, Bröckelverluste, Buttersäure-Ansatz; Doppelrotor-Werte mit Versuchsdaten des Herstellers abgleichen
- [ ] DLG-Punktetabelle mit dem Originalschlüssel 2006 abgleichen (Essigsäure- und pH-Stufen sind vereinfacht); evtl. Schweizer Sinnenprüfung als zweite Sicht
- [ ] Aufbereiter vs. Wachsschicht: Im Modell beschleunigt er die kutikuläre Phase (Stomata sind nach ca. 1 h ohnehin zu), dafür nimmt das Futter mehr Wasser auf und es wird mehr ausgewaschen. Konkrete Maschine (Werbeaussage „zerstört Wachsschicht“) mit Versuchsdaten prüfen
- [ ] Wettkampf über mehrere Geräte: Rangliste ist nur lokal im Browser → Klassenraum mit Code auf dem Server (z.B. über Konto/Kurs aus Futter v2)
- [ ] Weitere Entscheidungen: Häcksellänge, Verdichtung, Siliermittel, Zudecken; Schwadbreite
- [ ] Wetter: echte Vorhersage/Messdaten (MeteoSchweiz) als Szenario-Quelle
- [ ] Grafik: Illustrationen (Feld, Maschinen) – derzeit nur SVG-Diagramm; KI-Bilder oder Grafiker
- [ ] Heu als zweites Modul (Belüftung → Bezug zu drywatch)
