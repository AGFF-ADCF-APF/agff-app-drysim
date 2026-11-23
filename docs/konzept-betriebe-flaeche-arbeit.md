# Konzept: Betriebe, Fläche und Arbeitszeit

Stand 23.11.2026. Auftrag: Ab Niveau Praxis soll die Futtermenge wählbar sein, damit die Lernenden am Anfang mehr oder weniger Risiko eingehen. Dazu kommen zwei Betriebe mit festen Gebäuden, ein Traktor mit passenden Anbaugeräten, Arbeitszeit auf dem Feld und ein Lohnunternehmer für das Pressen. Das Konzept wird in einer eigenen Sitzung umgesetzt.

Kennzeichnung:

- **[Annahme]**: Vorschlag von mir, ohne Vorgabe des Auftraggebers; lässt sich ändern, ohne das Konzept umzubauen.
- **[Offen]**: Entscheid des Auftraggebers nötig, bevor gebaut wird.
- **[Zu belegen]**: Fachzahl, die aus einer Quelle kommen muss. Keine Zahl wird erfunden; bis zum Beleg steht im Code keine.

## 1. Was heute fehlt

- Die Parzelle ist fest 2 ha (`ANLAGE.feldHa`). Wer mehr Futter einbringen will, kann das nicht.
- Arbeitsgänge dauern null Zeit: Die ganze Parzelle ist in derselben Stunde gemäht, gezettet, geschwadet und eingefahren. Das grösste Risiko der Praxis fehlt damit: Die letzte Fuhre kommt später, feuchter oder in den Regen.
- Gebäude gibt es nicht. Die Boxfläche wächst mit der Parzelle mit (25 m² je ha), Ballen haben kein Lager.
- Die Punkte zählen Energie je Hektare. Mehr Fläche würde sich nie lohnen, sie wäre nur Risiko.

## 2. Ziele

1. Die Lernenden wählen am Anfang einen Betrieb und eine Fläche und gehen damit bewusst ein Risiko ein.
2. Der Betrieb setzt harte Grenzen (Boxfläche, Wandhöhe, Ballenplätze), die mit der Menge spürbar werden.
3. Arbeit braucht Zeit: ein Traktor, nacheinander, je nach Gerät schneller oder langsamer.
4. Pressen macht der Lohnunternehmer, auf Bestellung und nicht sofort.
5. Das Rechenmodell bleibt deterministisch und nachspielbar; mit einem Teilstück und Arbeitszeit null rechnet es wie heute (Kalibrierung Tänikon bleibt gültig).

## 3. Zwei Betriebe

Vorgabe des Auftraggebers in **fett**, Rest wie gekennzeichnet.

| | Bauernhaus | Heulagerhalle |
|---|---|---|
| Heustock | **1 Box, 100 m², Boxenwände 5 m** | **2 Boxen à 100 m², bis 6 m Füllhöhe** |
| Beschickung | **Heukran** | **Kran, Abladeplatz** |
| Belüftung | **kalt** (kein Warmdach, kein Entfeuchter) | Warmdach, Entfeuchter wählbar [Annahme, Offen] |
| Lüfter | Standardlüfter, stärkerer wählbar [Annahme] | Standardlüfter je Box, stärkerer wählbar [Annahme] |
| Dürrfutterballen | **Wagenschopf**, Platz für … Ballen [Offen] | keine [Annahme, Offen] |
| Silage | **Rundballenlager, höchstens 200 Ballen** | keine: reiner Heubetrieb [Annahme, Offen] |
| Flachsilo | keines | keines [Offen, siehe Abschnitt 8] |

Folgen im Spiel:

- **Raumgewicht mit dem Kran:** 65 kg TS/m³ (FAT 1982, S. 4: Greifereinlagerung im Mittel 65, Bereich 54 bis 76). Heute rechnet das Spiel mit 78 (Gebläse). Das ist belegt und macht den Stock bei gleicher Menge höher.
- **Wandhöhe als harte Grenze:** Mehr Heu, als die Box fasst, geht nicht hinein. Was nicht Platz hat, bleibt auf dem Abladeplatz (Halle) oder muss als Ballen gepresst oder verkauft werden (Bauernhaus) [Annahme].
- **Zwei Boxen (Halle):** Die Lernenden teilen die Ernte auf. Zwei halbe Stöcke trocknen schneller als ein voller; dafür laufen zwei Lüfter.
- **Abladeplatz (Halle):** Hier wartet die zweite Lage, bis sie nachgefüllt wird. Das macht das Einfüllen in Lagen sinnvoll; bisher wartete sie «neben der Box», was im Modell kaum Nutzen brachte.
- **Anlagewahl:** Der Betrieb ersetzt die heutige Wahl von Boxfläche und Warmluft. Wählbar bleiben nur der Lüfter und (in der Halle) der Entfeuchter [Annahme].
- **200 Rundballen:** Wer mehr Silage presst, hat keinen Platz; die übrigen Ballen gehen verloren oder werden verkauft [Annahme, Offen: verkaufen zu welchem Preis, oder einfach verloren].

**Vorrat im Stock [Annahme, Offen]:** Der Betrieb startet wählbar mit leerer Box (erster Schnitt) oder mit Heu vom ersten Schnitt darin (Folgeschnitt), zum Beispiel 1,5 m im Bauernhaus. Erst mit Vorrat wird der Stock wirklich hoch, und der Lüfter kommt an seine Grenze (bisher brach die Luftmenge nur bei sehr hohen Kleestöcken ein). Das trockene Heu darunter hat wenig Widerstand (LK Salzburg S. 39); das Modell muss dafür eine trockene Unterschicht kennen.

## 4. Fläche als Risiko

- **Wahl ab Praxis:** Fläche zum Beispiel 2, 4, 6 oder 8 ha [Annahme]. Einstieg: fest 2 ha im Bauernhaus wie heute [Annahme].
- **Klassenwettkampf:** Fläche und Betrieb per Link vorgeben, wie heute das Wetter: `?betrieb=bauernhaus&flaeche=4` [Annahme].

Füllhöhe im Bauernhaus (1 Box, 100 m², Kran 65 kg TS/m³), 30 dt TS/ha, nach rund 6 % Feldverlusten wie in der heutigen Anzeige:

| Fläche | Heu in der Box | Füllhöhe | gegen Richtwert |
|---|---|---|---|
| 2 ha | 5,6 t TS | 0,9 m | unter der Mindesthöhe von 1 m (LK Salzburg) |
| 4 ha | 11,3 t TS | 1,7 m | im Richtwert 1 bis 2 m je Charge (Agroscope 2014) |
| 6 ha | 16,9 t TS | 2,6 m | über dem Richtwert, unter 3 m (LK Salzburg) |
| 8 ha | 22,6 t TS | 3,5 m | über 3 m je Charge: zu hoch |

Rechnung: Fläche × 2 820 kg TS/ha ÷ 100 m² ÷ 65 kg TS/m³. Mit Vorrat kommt dessen Höhe dazu; 5 m Wand sind dann schnell erreicht.

## 5. Ein Traktor und die Anbaugeräte

- **Ein Traktor, 100 PS, 4 t** (Vorgabe). Er macht einen Arbeitsgang nach dem anderen. Kein zweiter Traktor, kein Helfer [Annahme].
- **Je Arbeitsgang zwei bis drei Geräte** (Mähwerk mit und ohne Aufbereiter, Zetter, Schwader, Ladewagen), die zu 100 PS passen. Sie unterscheiden sich in Arbeitsbreite, Flächenleistung, Leistungsbedarf und Kosten.
- **Leistungsbedarf:** Im Spiel liegt die Messung «61 kW ohne, 122 kW mit Aufbereiter» (top agrar 12/2021). Sie gilt für eine 10-m-Mähkombination, weit über 100 PS; übertragbar ist nur die Aussage, dass der Aufbereiter den Leistungsbedarf etwa verdoppelt. Ein Gerät, das mehr braucht, als der Traktor hat, ist nicht wählbar [Annahme].
- **[Zu belegen]** Arbeitsbreite, Flächenleistung (ha/h) und Leistungsbedarf je Gerät. Kandidaten: Agroscope «Arbeitsvoranschlag» (Arbeitszeitbedarf je Arbeitsgang), Agroscope «Maschinenkosten» (Kosten und Leistungsbedarf). Beide liegen nicht in den drywatch-Unterlagen. [Offen: Hat der Auftraggeber sie, oder soll ich sie suchen?]
- Der Aufbereiter bleibt wie heute im Modell (Ablagebreite, Wirkung auf die Trocknung).

## 6. Arbeitszeit auf dem Feld

Kern des Ausbaus. Vorschlag:

- **Teilstücke:** Die Parzelle wird in Teilstücke gleicher Grösse geteilt (z. B. je 1 ha) [Annahme]. Jedes Teilstück ist ein eigenes `Feld` mit eigener Zeit des Mähens, Zettens, Schwadens und Einfahrens. Die Physik je m² bleibt unverändert.
- **Ein Arbeitsgang dauert:** Fläche ÷ Flächenleistung des Geräts. Der Traktor bearbeitet die Teilstücke nacheinander; das erste ist um 9 Uhr gemäht, das letzte vielleicht erst um 13 Uhr. Damit trocknet das zuletzt gemähte Stück später ab und kommt später an die Reihe beim Einfahren.
- **Bedienung:** Ein Knopf startet den Arbeitsgang für die ganze Parzelle; der Traktor ist danach beschäftigt (Anzeige «Traktor mäht noch 3 Stunden»), die Uhr läuft weiter. Ein Arbeitsgang lässt sich abbrechen, dann bleiben die übrigen Teilstücke liegen [Annahme].
- **Einfahren:** Fuhre um Fuhre (Ladewagen bzw. bei Heu ins Gebäude). Jede Fuhre hat ihre eigene TS und Uhrzeit. Kommt Regen, ist ein Teil drin und ein Teil draussen. Das ist das neue Risiko bei viel Fläche.
- **Protokoll:** Start (und Abbruch) jedes Arbeitsgangs mit Stunde und Gerät. Daraus ergibt sich der Ablauf je Teilstück deterministisch; Fortsetzen und Wette bleiben exakt.
- **Gleichheit mit heute:** Ein Teilstück und Arbeitszeit null ergeben genau das heutige Feld. Die Wette und der Tänikon-Vergleich laufen so weiter, `test/run.mjs` und `test/fat.mjs` bleiben unverändert.
- **[Zu belegen]** Ladevolumen, Fahrzeit je Fuhre und Abladezeit; Hofdistanz als Annahme je Betrieb.

## 7. Lohnunternehmer: Pressen

- **Zwei Pressen zur Wahl** (Vorgabe): eine «Kuhn Bio-Tarrupp» und eine grössere Kombipresse (Pressen und Wickeln in einem Zug). [Offen: genaue Modelle bzw. Datenblätter; die Bezeichnung «Bio-Tarrupp» konnte ich nicht zuordnen.]
- **Bestellen:** Der Lohnunternehmer wird für eine Uhrzeit bestellt und kommt dann, nicht vorher. Wer zu früh bestellt, presst zu nass; wer zu spät bestellt, verliert Zeit und Wetter. Umbestellen kostet eine Wartezeit [Annahme].
- **Wirkung:** Durchsatz (Ballen je Stunde) bestimmt, wie lange das Pressen dauert; die Teilstücke werden nacheinander gepresst wie in Abschnitt 6. Pressdichte und Ballengewicht bestimmen, wie viele Ballen es gibt (Rundballenlager 200 Plätze).
- **Kosten:** Preis je Ballen nach Tarif. Fliesst in die Kosten je Tonne wie bei der Belüftung.
- **[Zu belegen]** Durchsatz, Ballengewicht und -grösse, Tarif je Ballen. Kandidaten: Datenblätter der Hersteller, Schweizer Lohnunternehmer-Tarife (Agrotec Suisse), Agroscope Maschinenkosten.

## 8. Flachsilo: vereinfacht statt ganzer Kette

Keiner der beiden Betriebe hat ein Flachsilo. [Offen: Fällt das Flachsilo weg, oder bleibt es als dritter Betrieb oder als Möglichkeit ohne Betrieb (Einstieg, Wetten)?]

Falls es bleibt, keine ganze Silierkette, sondern ein Engpass:

- Mit einem Traktor geht nur eines: Ladewagen fahren oder walzen. Jede Stunde, die er walzt, fährt er nicht ein.
- Verdichtung = Walzzeit je Tonne. Wer schnell einfährt und wenig walzt, ist früher fertig (vor dem Regen), aber das Silo ist lockerer: mehr Nacherwärmung. Den Verlust durch Nacherwärmung rechnet das Silagemodell schon (`siloverlust`).
- Anzeige wie bei der Luftmenge: «Verdichtung: … % vom Ziel».
- **[Zu belegen]** Richtwert für die Walzzeit oder das Walzgewicht je Tonne Frischmasse und Stunde (Kandidaten: LfL Bayern, DLG-Merkblätter zur Siliertechnik), Zusammenhang Verdichtung und Nacherwärmung.

## 9. Punkte und Kosten

- **Punkte auf die ganze Ernte:** Energie im Trog total (MJ NEL), nicht mehr je Hektare. Mehr Fläche lohnt sich, wenn sie gelingt. Auf alte Ranglisten muss keine Rücksicht genommen werden (Auftraggeber 23.11.2026); die lokale Rangliste wird beim Umstellen einmal geleert.
- **Massstab [Annahme]:** Punkte = MJ NEL ÷ 1000 (heute je ha ÷ 100), damit die Zahlen in einer ähnlichen Grösse bleiben.
- **Kosten** (Lohnunternehmer, Strom, Arbeit, verlorenes Futter) in Franken je Tonne daneben wie bei der Belüftung, nicht in den Punkten [Annahme, Offen: Jetzt, wo alte Ranglisten nicht zählen, könnten sie auch abgezogen werden. Ich würde sie daneben lassen, solange Preise Annahmen sind.]

## 10. Niveaus

| | Einstieg | Praxis | Profi |
|---|---|---|---|
| Betrieb | Bauernhaus, vorgegeben | wählen | wählen |
| Fläche | 2 ha, vorgegeben | wählen | wählen |
| Vorrat im Stock | leer | wählen | wählen |
| Geräte | vorgegeben (Grundplan) | wählen | wählen, Leistung und Kosten sichtbar |
| Arbeitszeit | ein Teilstück, ohne Arbeitszeit (wie heute) | mit Arbeitszeit | mit Arbeitszeit, Teilstücke einzeln sichtbar |
| Lohnunternehmer | vorgegeben, kommt zur Zeit des Vorschlags | bestellen | bestellen, Presse wählen, Tarif sichtbar |

[Annahme] Ob der Einstieg ohne Arbeitszeit bleiben soll, ist eine Frage der Lernziele: ohne ist einfacher, mit ist näher an der Praxis.

## 11. Modell und Protokoll

1. `Betrieb` (Gebäude, Boxen, Wandhöhe, Lager) und `Flaeche` in den Einstellungen; `ANLAGE.feldHa` und `ANLAGE.flaecheJeHa` werden durch den Betrieb ersetzt.
2. Heustock mit mehreren Boxen und trockener Unterschicht (Vorrat); die Säulen aus der Belüftung bleiben.
3. Feld aus Teilstücken; Arbeitsgänge mit Dauer; ein Traktor als Ressource.
4. Lohnunternehmer als Ereignis mit Bestellzeit.
5. Ballenzähler und Lagerplätze.
6. Protokoll: Arbeitsgänge mit Gerät und Dauer, Bestellungen, Aufteilung auf die Boxen. Version erhöhen, alte gesicherte Runden verwerfen.
7. Gleichheit: Ein Teilstück, Arbeitszeit null und die heutige Box ergeben die heutigen Zahlen.

## 12. Etappen

1. **Betrieb, Fläche, Punkte:** zwei Betriebe mit Box, Wandhöhe und Kran-Raumgewicht; Fläche wählbar; Punkte auf die ganze Ernte; Vorrat im Stock. Kleiner Eingriff, die Belüftung wird sofort spannender.
2. **Arbeitszeit:** Teilstücke, ein Traktor, Geräte mit Flächenleistung. Grösster Brocken; braucht die belegten Flächenleistungen.
3. **Lohnunternehmer und Lager:** Pressen bestellen, zwei Pressen, Ballenlager und Wagenschopf.
4. **Flachsilo** (falls es bleibt): Engpass Einfahren gegen Walzen.
5. **Niveaus, Wetten, Lernseite, Unterrichtsblatt** je Etappe mitziehen.

## 13. Offene Entscheide (Auftraggeber)

1. Heulagerhalle: Warmdach und Entfeuchter vorhanden oder wählbar? Gibt es dort auch Ballen oder Silage?
2. Wagenschopf: wie viele Dürrfutterballen?
3. Flachsilo: weglassen, als dritter Betrieb, oder nur ohne Betrieb?
4. Vorrat im Stock: als Wahl (erster Schnitt oder Folgeschnitt), und wie hoch?
5. Einstieg: mit oder ohne Arbeitszeit?
6. Pressen: welche Modelle genau (Datenblätter), und woher die Tarife?
7. Was geschieht mit Futter, das keinen Platz hat (Ballen über 200, Heu über der Wandhöhe): verloren, verkauft, oder darf man gar nicht so viel mähen?
8. Quellen für Flächenleistungen und Maschinenkosten: vorhanden, oder soll ich suchen?
