# Konzept: Heubelüftung bedienen statt zuschauen

Stand 23.11.2026. Auftrag: Die Spielphase «Am Heustock» ist zu pauschal. Die Lernenden sollen die Anlage wirklich bedienen, und dabei soll vieles schiefgehen können. Dieses Konzept beschreibt den Ausbau; umgesetzt wird es in einer eigenen Sitzung.

## 1. Was heute fehlt

Heute (`public/js/belueftung.js`, `heustock.js`):

- Die Anlage ist fest: ein Lüfter mit 0,11 m³/s je m², der immer gleich viel Luft bringt, egal wie hoch und wie nass der Stock ist.
- Der Stock ist gleichmässig: vier Rechenschichten, überall gleich dicht, keine Nester, keine Kamine.
- Bedienen heisst: Lüfter Aus/Dauer/Intervall, Dach, Entfeuchter. Befüllen, Messen, Umschichten und Abbrechen gibt es nicht.
- Stocktemperatur und TS jeder Schicht sind immer sichtbar. Niemand muss messen.
- Wird der Stock heiss, läuft das Spiel einfach weiter. Am Schluss steht eine Sammelkarte «Belüftung und Lager: 19,8 % TS, bis 67 °C». Die Zahl ist der Lagerverlust, liest sich aber wie ein TS-Gehalt, und die Karte sagt nicht, welcher Entscheid den Schaden verursacht hat.

## 2. Ziele

1. Jede wichtige Handlung am Heustock ist eine Entscheidung der Lernenden: Anlage wählen, einfüllen, lüften, messen, eingreifen.
2. Typische Fehler aus der Praxis sind spielbar und haben sichtbare, erklärte Folgen.
3. Es gibt einen Ernstfall: Der Stock erhitzt sich, und man muss rechtzeitig richtig handeln.
4. Das Ergebnis zeigt die Kette von Ursache und Folge («Was ging schief?») statt einer Sammelnote.
5. Das Rechenmodell bleibt für alle Niveaus gleich und deterministisch (nachspielbar, Wette, Klassenwettkampf).

## 3. Neue Entscheidungen und was dabei schiefgehen kann

### 3.1 Anlage wählen (vor der Runde)

Neuer Abschnitt im Einsatz, sobald «Belüftungsheu» gewählt ist:

| Wahl | Optionen | Was schiefgehen kann |
|---|---|---|
| Lüfter | Standardlüfter / stärkerer Lüfter (mehr Druck, mehr kW, teurer) | Der Standardlüfter «mag nicht»: Bei hohem oder sehr nassem Stock bricht die Luftmenge ein. |
| Warmluft | ohne / Dachabsaugung | Ohne Warmluft dauert es bei feuchtem Wetter zu lang. |
| Entfeuchter | ohne / mit | Falsch eingesetzt (kalt, trockene Luft) kostet er nur Strom. |
| Boxfläche | klein / passend / gross im Verhältnis zur Parzelle | Zu kleine Box ergibt einen zu hohen Stock. |

Die Anlage wird **am Anfang festgelegt und gilt für die ganze Runde**: Ein Warmdach, das der Betrieb nicht hat, lässt sich während der Belüftung nicht zuschalten. Heute ist die Dachabsaugung immer vorhanden und nur ein Schalter; neu ist «ohne Warmdach» eine echte Ausgangslage (reine Kaltbelüftung).

**Füllhöhe:** Aus Ertrag, Parzellenfläche, Boxfläche und Dichte ergibt sich die Füllhöhe in Metern. Sie wird schon bei der Wahl der Anlage angezeigt («Diese Ernte ergibt in dieser Box rund … m») und beim Einfahren mit der tatsächlichen Menge und Feuchte nachgeführt. Die Füllhöhe bestimmt den Widerstand des Stocks und damit, ob der Lüfter genug Luft bringt (Abschnitt 4). Heute rechnet das Spiel mit einer festen Boxfläche je Hektare, die Höhe spielt keine Rolle.

Jede Wahl hat einen Preis (Investition als Jahreskosten, Strom). Im Niveau Einstieg ist die Anlage vorgegeben.

Zusätzlich während der Belüftung als Notmassnahme: **stärkeren Lüfter nachrüsten oder mieten**. Er ist nicht sofort da (Wartezeit) und kostet mehr als die Wahl im Voraus. Das ist die vom Auftraggeber genannte Option «stärkeren Lüfter kaufen, wenn der Standardlüfter bei sehr nassem Futter nicht mag».

### 3.2 Einfüllen

Neuer Schritt zwischen Einfahren und Belüften:

- **Schütthöhe der Charge:** alles auf einmal oder in Lagen (zweite Lage erst, wenn die erste angetrocknet ist).
- **Verteilen:** gleichmässig verteilen (braucht Zeit) oder abladen, wie es kommt.
- **Sofort einschalten:** Der Lüfter läuft schon während des Einfüllens oder erst danach.

Fehler: zu hoch gefüllt (Luft kommt nicht durch), ungleich verteilt (Luft nimmt den leichtesten Weg, es entstehen Kamine und daneben feuchte Nester), Lüfter zu spät gestartet (das feuchte Heu erwärmt sich in den ersten Stunden).

### 3.3 Lüften

Wie heute (Aus, Dauer, Intervall, Dach, Entfeuchter), neu mit Folgen für die Luftmenge: Die Anzeige zeigt, wie viel Luft der Lüfter gegen den Widerstand des Stocks tatsächlich bringt («Lüfter schafft 60 % der Soll-Luftmenge»).

### 3.4 Messen

- Stocktemperatur und Feuchte der Schichten sind nicht mehr dauernd sichtbar. Sichtbar sind nur Zuluft, Abluft und Strom.
- **Heusonde stecken** ist eine Handlung: Sie zeigt die Temperatur an mehreren Stellen und braucht Zeit. Ein heisses Nest findet nur, wer an genug Stellen misst.
- Der Messkalender (zuerst täglich, später seltener) steht auf der Lernseite. Wer ihn einhält, entdeckt Probleme früh; im Ergebnis wird das ausgewiesen.
- Niveau Einstieg: Die Messung läuft automatisch, mit Ampel.

### 3.5 Eingreifen

| Eingriff | Wirkung im Modell | Preis und Risiko |
|---|---|---|
| Nachfüllen (zweite Lage) | mehr Heu, mehr Höhe, mehr Widerstand | Zu früh nachgefüllt: Die untere Lage trocknet nicht mehr fertig. |
| Umschichten mit dem Greifer | mischt die Schichten, löst Kamine und Nester auf, lässt Wärme entweichen | Arbeitszeit, Bröckelverluste. Über der Alarmschwelle verboten (siehe unten). |
| Teil auslagern oder verfüttern | nimmt die oberste Lage weg, weniger Höhe | Verlust an Lagerheu, Arbeitszeit. |
| Stärkeren Lüfter holen | mehr Luft nach Wartezeit | teurer als im Voraus. |
| Feuerwehr vorinformieren | keine Wirkung auf den Stock, zählt für die Bewertung | keine. |
| Abbruch: Feuerwehr alarmieren | beendet die Runde kontrolliert | Das Heu ist verloren, das Gebäude bleibt stehen. |

**Ernstfall:** Die Schwellen stehen schon auf der Lernseite (ab 45 °C erhöhte Aufmerksamkeit, ab 60 °C Feuerwehr vorinformieren und alle fünf Stunden messen, ab 70 °C oder bei einer Mulde im Stock sofort alarmieren; einen heissen Stock nie selbst abtragen). Neu werden sie spielbar:

- Wer über 70 °C nicht alarmiert, riskiert das Ende «Brand»: Runde verloren, eigener Schlussbildschirm, null Punkte.
- Wer einen heissen Stock umschichtet oder abträgt, löst den Brand selbst aus (Luft an heisses Heu).
- Wer rechtzeitig alarmiert, verliert das Heu, aber nicht die Runde: wenige Punkte, Abzeichen «Rechtzeitig gehandelt».

### 3.6 Pannen (nur Niveau Profi, abschaltbar)

Vorgegebene Ereignisse je Szenario oder aus dem Wettercode abgeleitet, damit alle in der Klasse dasselbe erleben: Stromausfall über Nacht, Sicherung des Lüfters fällt, Regenwoche, Wetterrisiko Gewitter (siehe 10.3). Keine echten Zufallswerte.

## 4. Was das Modell dafür neu können muss

1. **Luftmenge aus Lüfterkennlinie und Stockwiderstand:** Der Widerstand steigt mit Stockhöhe, Dichte und Feuchte; der Lüfter liefert die Luftmenge, bei der sein Druck dem Widerstand entspricht. Zwei Kennlinien (Standard, stark). Die feste Grösse `ANLAGE.luft` wird zum Sollwert.
2. **Säulen statt nur Schichten:** Der Stock besteht aus zwei bis drei Säulen nebeneinander mit eigener Höhe und Dichte. Bei ungleicher Befüllung strömt mehr Luft durch die lockere Säule (Kamin), die dichte bleibt feucht und erwärmt sich (Nest). Gleichmässig gefüllt sind alle Säulen gleich, und das Modell verhält sich wie heute.
3. **Befüllung in Lagen:** Schichten können nachträglich dazukommen; Dichte der unteren Schichten steigt unter Last.
4. **Eingriffe als Protokoll:** Umschichten, Nachfüllen, Auslagern, Lüfterwechsel, Messen und Alarm stehen wie die Lüfterschaltungen im Protokoll, damit Fortsetzen, Nachspielen und die Wette weiter exakt stimmen.
5. **Sichtbarkeit:** Der Zustand hat eine «gemessene» Sicht (letzte Messung je Stelle mit Zeitpunkt) neben der wahren.
6. **Brand:** Zustand «Brand» ab einer Schwelle und Dauer, oder sofort bei Luftzutritt an heisses Heu. Die Erwärmung über 40 °C ist heute eine Annahme ohne Messreihe; sie muss für den Ernstfall neu geprüft werden (siehe 8).
7. **Kosten:** laufende Kosten aus Sicht des angestellten Betriebsleiters (siehe 10.1): Arbeit CHF 32.–/h, Maschinen und feste Einrichtungen gemäss maschinenkosten.ch, Strom, verlorenes Heu; zusammen als Franken je Tonne. Ansätze sichtbar und änderbar (Profi).

## 5. Ablauf im Spiel

1. Einsatz planen → neu «Anlage» (Lüfter, Warmluft, Entfeuchter, Box).
2. Feld wie heute.
3. Einfüllen: Höhe, Verteilen, Lüfter an.
4. Am Heustock: Zeit läuft; Schalter wie heute, dazu Knöpfe «Heusonde», «Umschichten», «Nachfüllen», «Lüfter holen», «Feuerwehr». Unumkehrbare Handlungen gedrückt halten wie beim Mähen.
5. Ende: lagerfähig, Zeit um, Abbruch oder Brand.
6. Ergebnis: Zeitstrahl der Belüftung mit den eigenen Handlungen und den Wendepunkten («Tag 3, 02:00: Nest in der hinteren Säule über 45 °C, nicht gemessen»), dazu getrennte Karten.

## 6. Ergebnis und Bewertung

Die Sammelkarte wird aufgeteilt:

| Karte | Inhalt |
|---|---|
| Anlage | Passte der Lüfter zur Menge und Feuchte? Kosten. |
| Einfüllen | Höhe, Verteilung, Start des Lüfters. |
| Lüften | Laufstunden, Strom, Wasserentzug, Anteil nutzloser Stunden (feuchte Luft). |
| Kontrolle | Wie oft und wo gemessen, wann das Problem sichtbar gewesen wäre. |
| Eingriffe | Was getan wurde und ob es half. |
| Lager | Verlust in % der TS (klar als Verlust beschriftet), höchste Temperatur, Schimmel. |
| Kosten | Franken je Tonne Heu. |

Sofort zu korrigieren, unabhängig vom Ausbau: Der Wert der heutigen Karte heisst «19,8 % Verlust, bis 67 °C» statt «19,8 % TS».

Punkte: wie bisher aus Energie im Trog und Qualität; neu null bei Brand und ein fester kleiner Wert bei rechtzeitigem Abbruch. Kosten fliessen nicht in die Punkte, sondern stehen daneben (sonst sind alte Ranglisten nicht mehr vergleichbar).

## 7. Niveaus

| | Einstieg | Praxis | Profi |
|---|---|---|---|
| Anlage | vorgegeben | Lüfter und Warmluft wählen | alles wählen, Kennlinie und Kosten sichtbar |
| Einfüllen | automatisch richtig | Höhe und Verteilen | dazu Lagen und Nachfüllen |
| Messen | automatisch, Ampel | Heusonde als Handlung | dazu Messraster und Messkalender bewertet |
| Eingriffe | Lüfter, Feuerwehr | dazu Umschichten, Lüfter holen | dazu Auslagern, Pannen |
| Ernstfall | deutliche Warnung mit Handlungsvorschlag | Warnung | nur die Messwerte |
| Ergebnis | 3 Karten, einfache Sätze | alle Karten | dazu Kosten und Rechenwege |

Die Zuordnung gehört in die Tabelle in `public/js/niveau.js` (Abschnitt `belueftung`).

## 8. Fachliche Grundlagen: was belegt werden muss

Keine Zahl erfinden. Vor dem Bau in den Unterlagen unter `agff-drywatch/public/knowledge/files/` nachschlagen (LK Salzburg «Heutrocknung von A bis Z», Agroscope Transfer 38/2014, FAT 1982 «ABC der Heubelüftung») und mit Quelle im Code vermerken:

- Druckbedarf des Stocks je Meter Höhe nach Feuchte und Dichte; Lüfterkennlinien (Radial gegen Axial), Luftmenge 0,07–0,14 m³/s je m².
- Zulässige Schütthöhe je Charge und insgesamt, nach Einfuhrfeuchte.
- Regel für das Nachfüllen (wann darf die nächste Lage drauf?).
- Dichte nach Beschickungsart (heute 78 kg TS/m³ Gebläse, 65 Greifer) und unter Last.
- Umschichten: wann empfohlen, wann verboten.
- Erwärmung und Selbstentzündung: Verlauf über 40 °C, Zeiträume, Ablauf im Ernstfall (heute Annahmen; Grafik «Prozesse Selbsterhitzung Heu, Philipsen 1965» liegt in drywatch).
- Kosten: Ansätze für Maschinen und feste Einrichtungen aus maschinenkosten.ch (Agroscope, Ausgabejahr vermerken); Strompreis; ergänzend Grafik «Gesamtkosten Trocknungssysteme» in drywatch. Arbeit CHF 32.–/h ist Vorgabe des Auftraggebers.

Was sich nicht belegen lässt, bleibt als Annahme gekennzeichnet (README, offene Punkte) und wird Fachleuten vorgelegt. Die GVB (Brandschutz) und die Betreiber von drywatch wären die naheliegenden Ansprechstellen für Ernstfall und Messreihen.

## 9. Umsetzung in Etappen

1. **Sofort:** Beschriftung der Karte («Verlust»), Ernstfall spielbar (Feuerwehr vorinformieren, alarmieren, Enden «Abbruch» und «Brand»), Heusonde als Handlung. Kleiner Eingriff, grosser Lerneffekt.
2. **Luftmenge und Lüfterwahl:** Kennlinie, Widerstand, Standard- und starker Lüfter, Nachrüsten mit Wartezeit, Anzeige der tatsächlichen Luftmenge.
3. **Einfüllen und Säulen:** Höhe, Verteilen, Kamine und Nester, Umschichten, Nachfüllen, Auslagern.
4. **Ergebnis:** Zeitstrahl, aufgeteilte Karten, Kosten.
5. **Niveaus, Szenarien, Lernseite, Unterrichtsblatt:** je Etappe mitziehen; zwei bis drei neue Wetten («Standardlüfter bei 55 % TS», «Zu hoch gefüllt», «Nest übersehen»).

Randbedingungen: Tests in `test/run.mjs` und `test/belueftung.mjs` bleiben grün; gleichmässig gefüllter Stock mit Standardanlage ergibt dieselben Zahlen wie heute; gespeicherte Runden alter Version werden erkannt und verworfen oder umgerechnet; Silage und Feldphase bleiben unverändert.

## 10. Entscheide des Auftraggebers (23.11.2026)

1. **Kosten, kein Budget.** Die Spielerin oder der Spieler ist **angestellte Betriebsleiterin bzw. angestellter Betriebsleiter**. Es gibt kein Budget und keinen Kaufpreis; es zählen die **laufenden Kosten**:
   - Arbeit: **CHF 32.–/h** (Vorgabe des Auftraggebers), für alle Arbeitsstunden auf dem Feld und am Stock (Einfüllen, Kontrollgänge, Umschichten, Nachfüllen, Auslagern).
   - Maschinen und feste Einrichtungen (Lüfter, Warmdach, Entfeuchter, Kran/Gebläse, Feldmaschinen): Ansätze gemäss **maschinenkosten.ch** (Agroscope), mit Ausgabejahr im Code vermerkt. Fehlt dort ein Ansatz (z. B. für eine feste Einrichtung), wird der Wert aus den Fachunterlagen genommen oder klar als Annahme gekennzeichnet; keine Zahl erfinden.
   - Strom und verlorenes Heu wie in Abschnitt 4.7.
   - Ein «stärkerer Lüfter» ist damit kein Kauf, sondern ein höherer Ansatz je Jahr bzw. je Stunde; das Nachrüsten während der Belüftung kostet zusätzlich Arbeitsstunden und Wartezeit.
   - Die Kosten stehen als Franken je Tonne Heu (bzw. je dt TS) im Ergebnis, neben den Punkten.
2. **Brand in der Rangliste:** wird mit null Punkten und Vermerk eingetragen.
3. **Pannen:** nur Niveau Profi, per Link abschaltbar. Zusätzlich die Panne **«Wetterrisiko – Gewitter»**: ein im Wetterbericht nur als Risiko angekündigtes Gewitter, das je Szenario bzw. Wettercode fest eintritt oder ausbleibt (kein echter Zufall, alle in der Klasse erleben dasselbe). Folgen auf dem Feld (Regen auf Heu kurz vor dem Einführen, Zwang zum feuchteren Einführen) und am Stock (schwüle Zuluft, allenfalls kurzer Stromausfall). Im Wetterbericht als Gewitterrisiko sichtbar, damit der Entscheid «früher und feuchter einführen oder warten» eine echte Abwägung ist.
