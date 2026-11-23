// Heubelüftung im Heustock, Stunde für Stunde (Lehrmodell).
// Luftzustand wie in der App drywatch (Magnus-Formel, Mischungsverhältnis x in g/kg, Dichte, Enthalpie);
// Wasserentzug = (x Abluft − x Zuluft) × Dichte der Zuluft in g/m³, mal Luftmenge in L/h.
// Belegte Richtwerte stehen bei den Konstanten mit Quelle; alles andere ist als Annahme bezeichnet
// (Übersicht: README, Abschnitt «Heubelüftung»). Deterministisch: gleiche Eingaben, gleicher Verlauf.

// Kurzzeichen: Agroscope 2014 = Transfer Nr. 38 «Richtlinien für Heubelüftungsanlagen»;
// FAT 1982 = Baumgartner «ABC der Heubelüftung»; LK Salzburg = «Heutrocknung von A bis Z».
export const ANLAGE = {
  luft: 0.11,       // m³/s je m² Stockfläche (Agroscope 2014: rund 0,11, Spielraum 0,07–0,14; FAT 1982: 0,10–0,12)
  luefterKw: 0.11,  // kW Motorleistung je m² Boxenfläche (Agroscope 2014)
  dichte: 78,       // kg TS je m³ Heustock, Beschickung mit Gebläse oder Verteiler (FAT 1982: Mittel 78, Greifer 65)
  flaecheJeHa: 25,  // m² Box je ha Tagesschlagkraft (LK Salzburg S. 22; Agroscope 2014: 14–24 m² je ha und Charge)
  feldHa: 2,        // Annahme: Grösse der Parzelle im Spiel (nur für die Anzeige in Tonnen, kWh und L/h)
  dachFaktor: 2,    // Dachkollektor mindestens doppelte Stockfläche (Agroscope 2014; FAT 1982)
  dachW: 275,       // nutzbare Wärme in W je m² Dach bei 800 W/m² Einstrahlung (Agroscope 2014: 250–300)
  wpKw: 0.17,       // Kompressor des Entfeuchters in kW je m² (LK Salzburg, Anhangtabelle: 17 kW je 100 m²; Agroscope 2014: ab 1:1 zum Lüfter)
  hoehe: 500,       // m ü. M., bestimmt den Luftdruck (Annahme: Mittelland)
  schichten: 4,     // Rechenschichten von unten nach oben (Annahme)
  hauptTs: 80,      // Haupttrocknung vorbei, wenn die feuchteste Schicht 80 % TS hat: Gutfeuchte 20 %, ab da kein Intervall
                    // gegen Erwärmung mehr nötig (FAT 1982: bis 20–25 %); Abluft 70 % «weit fortgeschritten» (LK Salzburg)
  lagerTs: 85,      // lagerfähig, wenn die feuchteste Schicht 85 % TS hat: Abluft 50 % rF ≙ 85 % TS (Agroscope 2014, Tab. 3)
  zielTs: 87,       // fertiges Heu 87–88 % TS (Agroscope 2014); Restwasser wird bis hierhin gerechnet
  maxStunden: 240,  // Annahme: Spielende nach zehn Tagen
};

// Kalibrierung (test/belueftung.mjs): eta = Annäherung der Luft an das Gleichgewicht je Schicht bei 65 % TS,
// exp = trockeneres Heu gibt das Wasser langsamer ab (eta ∝ (u/u65)^exp), auf = Wiederbefeuchtung langsamer als Trocknung.
// Angepasst an FAT 1982, Abb. 29 (Wasserentzug nach Luftfeuchte und TS) und LK Salzburg (Ausnutzung 50–65 %).
export const KAL_B = { eta: 0.225, exp: 0.5, auf: 0.5 };
const U65 = 35 / 65;
const etaVon = (u) => KAL_B.eta * Math.min(1.6, Math.max(0.05, u / U65)) ** KAL_B.exp;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ---------- Luft (wie drywatch: agff-dry-calc.html, Objekt PHY)
export const LUFT = {
  sat: (t) => 6.1078 * Math.exp((17.08 * t) / (234.2 + t)), // hPa
  p: (hoehe) => 1013.25 * (1 - 2.25e-5 * hoehe) ** 5.25,      // hPa
  dichte: (t, p) => (p * 100) / (287.05 * (t + 273.15)),     // kg/m³
  x: (t, rh, p) => (622 * LUFT.sat(t) * rh / 100) / (p - LUFT.sat(t) * rh / 100), // g Wasser je kg trockene Luft
  rh: (t, x, p) => Math.min(100, (x * p / (622 + x) / LUFT.sat(t)) * 100),
  h: (t, x) => 1.006 * t + x / 1000 * (2501 + 1.86 * t),      // kJ/kg
  tAus: (h, x) => (h - 2.501 * x) / (1.006 + 0.00186 * x),
  // Absolute Feuchte in g/m³ (für die Rechenaufgabe): Sättigungsmenge × rF
  gm3: (t, rh) => 216.7 * LUFT.sat(t) * rh / 100 / (t + 273.15),
};
const P = LUFT.p(ANLAGE.hoehe);

// Zustand auf derselben Enthalpie (adiabatisch), bei dem die Luft die relative Feuchte `ziel` hat
function aufIsenthalpe(h, ziel) {
  let a = -15, b = 70;
  const xVon = (t) => Math.max(0, (h - 1.006 * t) / (2501 + 1.86 * t) * 1000);
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2;
    if (LUFT.rh(m, xVon(m), P) > ziel) a = m; else b = m;
  }
  const t = (a + b) / 2;
  return { t, x: xVon(t) };
}

// ---------- Sorptionsgleichgewicht: Gutfeuchte u (kg Wasser je kg TS) gegen relative Luftfeuchte.
// Form nach Henderson, u = A·e^(−k·(T−20))·(−ln(1−rF))^B, angepasst an die Kurven «Feuchtegleichgewicht» für 20 und 30 °C
// (LK Salzburg S. 32, nach Segler, abgelesen) und an die Abluft-Tabellen (Agroscope 2014, Tab. 3; LK Salzburg S. 45:
// Abluft 90/80/70/60/50 % ≙ 68/74/78/82,5/85 % TS). Abweichung höchstens rund 1 Prozentpunkt TS (test/belueftung.mjs).
export const SORPTION = { A: 0.237, B: 0.728, k: 0.022 };
export const uAusTs = (ts) => (100 - ts) / ts;
export const tsAusU = (u) => 100 / (1 + u);
const aT = (t) => SORPTION.A * Math.exp(-SORPTION.k * (t - 20));
export function rhGleich(u, t = 20) { return 100 * (1 - Math.exp(-((Math.max(u, 0) / aT(t)) ** (1 / SORPTION.B)))); }
export function uGleich(rh, t = 20) { return aT(t) * (-Math.log(1 - clamp(rh, 1, 99.5) / 100)) ** SORPTION.B; }

// ---------- Entfeuchter: Kondensleistung je 10 kW Kompressorleistung in kg/min (Agroscope 2014, Abb. 18, abgelesen)
const ENTF_T = [15, 20, 25, 30, 35], ENTF_RH = [45, 60, 70, 80, 95];
const ENTF = [
  [0.11, 0.165, 0.21, 0.26, 0.345], [0.145, 0.22, 0.28, 0.35, 0.465], [0.195, 0.295, 0.375, 0.465, 0.62],
  [0.26, 0.39, 0.495, 0.61, 0.82], [0.34, 0.51, 0.645, 0.80, 1.07],
];
// kg Wasser je kWh Kompressorstrom; unter 10 °C oder unter 40 % rF wenig wirksam (Agroscope 2014) → 0
export function entfeuchterKgJeKwh(t, rh) {
  if (t < 10 || rh < 40) return 0;
  const idx = (reihe, v) => { const c = clamp(v, reihe[0], reihe[reihe.length - 1]); let i = 0; while (i < reihe.length - 2 && c > reihe[i + 1]) i++; return [i, (c - reihe[i]) / (reihe[i + 1] - reihe[i])]; };
  const [i, fi] = idx(ENTF_T, t), [j, fj] = idx(ENTF_RH, rh);
  const w = (a, b) => ENTF[a][b];
  const v = w(i, j) * (1 - fi) * (1 - fj) + w(i + 1, j) * fi * (1 - fj) + w(i, j + 1) * (1 - fi) * fj + w(i + 1, j + 1) * fi * fj;
  return v * 6; // kg/min je 10 kW → kg je kWh
}

// Annahmen zur Wärme im Stock (keine Messreihe in den Quellen): Feuchtes Heu atmet und erwärmt sich;
// ungelüftet bei 65 % TS und 20 °C um rund 0,3 K je Stunde, bei Wärme schneller (Q10 = 2) bis 40 °C, darüber
// langsamer: Die biologische Erwärmung reicht bis rund 75 °C (LK Salzburg). Wärmekapazität TS 1,5 kJ/(kg·K), Wasser 4,19.
// Die Atmungswärme verbraucht TS (15,6 MJ je kg, Brennwert von Zucker).
// Ab 60 °C kommt die chemische Erwärmung dazu (Selbsterhitzung nach Philipsen 1965, in LK Salzburg S. 23: der chemische
// Prozess setzt in der thermophilen Phase ein, die biologische Erwärmung endet bei rund 75 °C, darüber «pyrophore Phase»
// bis zur Glut). Die Quelle zeigt nur Stufen, keine Zeiten: Stärke und Verdoppelung je 10 K (`chem`) sind Annahmen.
// Unter 60 °C rechnet das Modell unverändert.
export const WAERME = { q0: 1.0, cTs: 1.5, kuehl: 0.01, brennwert: 15600, chemAb: 60, chem: 0.5, tempMax: 100 };
const tempFaktor = (t) => (t <= 40 ? 2 ** ((t - 20) / 10) : 4 * clamp(1 - (t - 40) / 40, 0.05, 1));
// Schimmel (Annahme): wächst, solange die Gleichgewichtsfeuchte einer Schicht über 75 % rF liegt, schneller bei Wärme.
// Index 1 ≈ «leicht muffig», 2 ≈ «schimmlig».
export const SCHIMMEL = { ab: 75, spanne: 20, stunden: 72 };

// Ernstfall. Schwellen nach LK Salzburg («Heutrocknung von A bis Z», Heustocküberwachung): 45–60 °C Gefahr, Kontrollen
// verstärken; 60–70 °C alle fünf Stunden messen, Stock nicht abtragen; ab 70 °C Feuerwehr alarmieren. Die Vorinformation
// der Feuerwehr ab 60 °C ist eine Praxisempfehlung (Lernseite). Annahmen des Spiels (keine Zeitangabe in den Quellen,
// README «Offen»): Brand, wenn der Stock `brandStunden` Stunden über 70 °C bleibt, ohne dass alarmiert wird; sofort, wenn
// ein Stock ab `luftAb` °C geöffnet wird (Umschichten, Abtragen: Luftsauerstoff und Hitze führen zum Brand, LK Salzburg).
// Ein Alarm unter `vorinfo` °C gilt als Fehlalarm (die Runde läuft weiter).
export const ERNSTFALL = { achtung: 45, vorinfo: 60, alarm: 70, luftAb: 60, brandStunden: 12, messenAlle: 5 };
// Schwellen, deren erstes Überschreiten als Wendepunkt im Zeitstrahl des Ergebnisses steht
const WENDE_TEMP = [35, 40, 45, 60, 70];

export const BETRIEB = {
  aus: 'Lüfter aus', dauer: 'Dauerbetrieb', intervall: 'Intervall mit Feuchtesteuerung',
};
// Standardbetrieb (Zeitraffer der Wette, Startwert im Spiel): Intervall, Warmluft vom Dach wenn vorhanden
export const STANDARD = { luefter: 'intervall', dach: true, entfeuchter: false };
// Was die Anlage hat und was der Bildschirm zeigt; später je Niveau festlegbar
export const OPTIONEN = { dach: true, entfeuchter: true, rechnen: true };

// Feuchteaustausch zwischen Luft (Enthalpie h, x in g/kg, mAir kg) und einer Schicht (u, dm kg TS):
// Die Luft nähert sich auf ihrer Enthalpie dem Gleichgewicht mit dem Heu, höchstens bis das Heu im Gleichgewicht mit ihr ist.
function austausch(u, dm, h, x, mAir) {
  const t = LUFT.tAus(h, x);
  const eq = aufIsenthalpe(h, rhGleich(u, t));
  let dx = (eq.x - x) * etaVon(u) * (eq.x < x ? KAL_B.auf : 1);
  let kg = mAir * dx / 1000;
  const uGr = uGleich(LUFT.rh(t, x, P), t);
  if (kg > 0 && u - kg / dm < uGr) { kg = Math.max(0, (u - uGr) * dm); dx = kg * 1000 / mAir; }
  return { kg, dx };
}

// ---------- Anlage: was der Betrieb hat. Wird im Einsatz festgelegt und gilt für die ganze Runde.
// Boxfläche je ha Tagesschlagkraft: 25 m² (LK Salzburg S. 22); 14 m² ist die untere Grenze von Agroscope 2014
// (14–24 m² je ha und Charge); 36 m² ist eine Annahme für eine reichlich bemessene Box.
export const BOX = {
  klein: { name: 'klein', m2JeHa: 14 }, passend: { name: 'passend', m2JeHa: ANLAGE.flaecheJeHa }, gross: { name: 'gross', m2JeHa: 36 },
};
// Standardanlage wie bisher (alles vorhanden); die Bildschirme geben je Niveau vor, was gewählt werden kann
export const ANLAGE_STANDARD = { luefter: 'standard', dach: true, entfeuchter: true, box: 'passend' };
// Einfüllen wie bisher: alles auf einmal, gleichmässig verteilt, Lüfter läuft sofort
export const EINFUELLEN_STANDARD = { lagen: 1, verteilen: true, start: 'sofort' };

// Lüfterkennlinie: statischer Druck (Pa) gegen Luftmenge (m³/s je m² Stockfläche).
// Standardlüfter: Beispiel-Kennlinie aus Agroscope 2014, Abb. 7 (abgelesen, ±5 %), auf die Stockfläche bezogen: Die Grafik
// zeichnet 0,07 m³/s·m² bei 10,5 m³/s ein, also 150 m² Box; höchste Leistungsaufnahme rund 16 kW = 0,11 kW je m².
// Die beiden Endpunkte (0 und 0,147) sind verlängert. Starker Lüfter: derselbe Lüfter mit 20 % höherer Drehzahl nach den
// Proportionalitätsgesetzen (Agroscope 2014 S. 3: Volumenstrom ∝ n, Druck ∝ n², Leistung ∝ n³); die 20 % sind eine Annahme,
// der Höchstdruck von rund 1700 Pa liegt im Bereich «typisch 1300 bis 1900 Pa» (LK Salzburg S. 38).
const KENN = [[0, 1200], [0.0267, 1145], [0.0533, 1060], [0.07, 960], [0.08, 880], [0.0933, 760], [0.1067, 620], [0.12, 460], [0.1267, 370], [0.1333, 290], [0.14, 170], [0.147, 0]];
const N_STARK = 1.2;
export const LUEFTER = {
  standard: { name: 'Standardlüfter', kw: ANLAGE.luefterKw, kennlinie: KENN },
  stark: { name: 'starker Lüfter', kw: ANLAGE.luefterKw * N_STARK ** 3, kennlinie: KENN.map(([v, p]) => [v * N_STARK, p * N_STARK ** 2]) },
};
// Nachrüsten während der Belüftung: Wartezeit, bis der gemietete Lüfter läuft (Annahme)
export const NACHRUESTEN = { warteStunden: 24 };
const interp = (tab, x) => {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [a, pa] = tab[i - 1], [b, pb] = tab[i]; return pa + (pb - pa) * (x - a) / (b - a); }
  return tab[tab.length - 1][1];
};
export const luefterDruck = (typ, v) => (v >= LUEFTER[typ].kennlinie.at(-1)[0] ? 0 : interp(LUEFTER[typ].kennlinie, v));

// Stockwiderstand. Bei der Soll-Luftmenge gilt die Auslegungstabelle der LK Salzburg (S. 38): je Meter Stockhöhe 160 Pa
// (Dauerwiese), 120 Pa (gräser- oder kräuterreich), 240 Pa (kleereich), dazu 120 Pa für die Dachabsaugung und 120 Pa für den
// Entfeuchter. Agroscope 2014 (S. 3) nennt 100–240 Pa je Meter bei 0,11 m³/s·m²; FAT 1982 (Abb. 10) 1,5 mbar je Meter bei 0,10.
// Wie der Druck mit der Luftmenge steigt («überproportional», Agroscope 2014), kommt aus der Grafik «Statischer Druck bei
// Wiesenheu in Boxen» (Agroscope 2014, Abb. 6, gleiche Grafik in LK Salzburg S. 37; abgelesen, ±5 %; 6 m bei 0,16 verlängert):
// Verhältnis des Drucks bei der Luftmenge v zum Druck bei 0,11 auf gleicher Höhe.
export const DRUCK_JE_M = 160;
const DRUCK_H = [0, 1, 2, 3, 4, 5, 6], DRUCK_V = [0, 0.04, 0.07, 0.10, 0.11, 0.13, 0.16];
const DRUCK = [
  [0, 0, 0, 0, 0, 0, 0], [0, 18, 30, 40, 45, 55, 65], [0, 29, 52, 97, 113, 147, 217], [0, 45, 100, 192, 228, 312, 463],
  [0, 61, 165, 327, 390, 553, 815], [0, 90, 250, 503, 605, 842, 1267], [0, 126, 361, 718, 860, 1203, 1800],
];
function druckTabelle(h, v) {
  const lage = (reihe, x) => { let i = 0; while (i < reihe.length - 2 && x > reihe[i + 1]) i++; return [i, (x - reihe[i]) / (reihe[i + 1] - reihe[i])]; }; // über den Rand hinaus: letzte Steigung
  const [i, fi] = lage(DRUCK_H, Math.max(0, h)), [j, fj] = lage(DRUCK_V, Math.max(0, v));
  return Math.max(0, DRUCK[i][j] * (1 - fi) * (1 - fj) + DRUCK[i + 1][j] * fi * (1 - fj) + DRUCK[i][j + 1] * (1 - fi) * fj + DRUCK[i + 1][j + 1] * fi * fj);
}
const druckVerhaeltnis = (h, v) => { const hh = clamp(h, 1, 6); return druckTabelle(hh, v) / druckTabelle(hh, ANLAGE.luft); };
// Futterart: Verhältnis zu 160 Pa je Meter (LK Salzburg S. 38)
export const DRUCK_BESTAND = { ausgewogen: 1, graeser: 0.75, klee: 1.5 };
// Zuschläge der Anlage in Pa bei Soll-Luftmenge (LK Salzburg S. 38; Agroscope 2014 S. 3: Kollektor 75–120, Entfeuchter 70–100)
export const DRUCK_ZUSCHLAG = { dach: 120, entfeuchter: 120 };
// Feuchte und Dichte: Die Quellen sagen nur, dass tiefer TS-Gehalt und hohes Raumgewicht den Druck erhöhen (FAT 1982 S. 8)
// und trockene Schichten wenig Widerstand bieten (LK Salzburg S. 39). Die Stärke ist eine Annahme (README «Offen»):
// Feuchte linear mit der Gutfeuchte um den Bezug 65 % TS, Dichte mit Exponent 1,5 um 78 kg TS/m³.
export const WIDERSTAND = { feuchteMin: 0.5, feuchteMax: 2, dichteExp: 1.5 };
const feuchteFaktor = (u) => clamp(0.5 + 0.5 * u / U65, WIDERSTAND.feuchteMin, WIDERSTAND.feuchteMax);

// Einfüllen. Ungleich abgeladen («wie es kommt»): drei Säulen. Raumgewichte 65 / 78 / 91 kg TS/m³: FAT 1982 S. 4 nennt
// 78 als Mittel bei Gebläse- oder Handverteilung und 65 bis 91 für zwei Drittel der Betriebe; dass diese Spanne auch
// innerhalb eines schlecht verteilten Stocks gilt, und die Höhen 0,8 / 1 / 1,2 des Mittels, sind Annahmen.
// Die dichte, hohe Säule liegt an der Abladestelle (hinten). Umschichten mit dem Greifer lockert auf 65 kg TS/m³ (FAT 1982: Greifer).
export const SAEULEN = ['vorne', 'Mitte', 'hinten'];
const UNGLEICH = (() => { const rho = [65, ANLAGE.dichte, 91], h = [0.8, 1, 1.2], m = rho.map((r, i) => r * h[i]), mittel = m.reduce((a, x) => a + x, 0) / 3; return rho.map((r, i) => ({ rho: r, anteilMasse: m[i] / mittel })); })();
// Annahmen zum Einfüllen und zu den Eingriffen (keine Zahlen in den Quellen, README «Offen»):
// sperre = Stunden ohne Luft, wenn der Lüfter erst nach dem Einfüllen startet; nachfuellenAb = frühestens sinnvoll nach
// zwei bis drei schönen Belüftungstagen (FAT 1982 S. 19) → 48 h; last = Raumgewicht steigt mit der Stockhöhe um rund 4 % je
// Meter (LK Salzburg S. 21: 80 kg/m³ bei 3 m, 90 bei 6 m); broeckel = Verlust beim Umschichten; abkuehlen = Anteil der
// Übertemperatur, der beim Umschichten entweicht.
// warteKuehl = das wartende Heu der zweiten Lage liegt locker und dünn ausgebreitet (LK Salzburg S. 23) und gibt seine
// Wärme viel schneller ab als ein Stock (Anteil der Übertemperatur je Stunde).
export const EINGRIFF = { sperre: 3, nachfuellenAb: 48, last: 0.04, greiferDichte: 65, broeckel: 0.01, abkuehlen: 0.5, warteKuehl: 0.15 };
// Arbeitszeit in Stunden je Handlung (Annahmen, für die Kosten)
export const ARBEIT = { sonde: 0.25, sondeMitte: 0.1, verteilen: 1, umschichten: 1.5, nachfuellen: 1, auslagern: 1, luefterHolen: 1 };
// Richtwerte zur Schütthöhe einer Charge: 1 bis 2 m (Agroscope 2014 S. 7), höchstens 3 m, bei Klee und sehr jungem
// Futter höchstens 2 m (LK Salzburg S. 39); erste Schicht mindestens 1 m (LK Salzburg S. 44).
export const SCHUETTHOEHE = { min: 1, gut: 2, max: 3, kleeMax: 2 };
export function schuetthoeheUrteil(h, bestand = 'ausgewogen') {
  const max = bestand === 'klee' ? SCHUETTHOEHE.kleeMax : SCHUETTHOEHE.max;
  return h > max ? 'zuHoch' : h > SCHUETTHOEHE.gut ? 'hoch' : h < SCHUETTHOEHE.min ? 'niedrig' : 'gut';
}
// Füllhöhe in Metern aus Ertrag (kg TS je m² Feld), Boxgrösse und Dichte; für die Anzeige im Einsatz
export const fuellhoehe = (dmFeld, box = 'passend', dichte = ANLAGE.dichte) => dmFeld * 10000 / BOX[box].m2JeHa / dichte;

// Druckbedarf eines gleichmässigen Stocks bei Soll-Luftmenge und was der Lüfter dann noch bringt (Anzeige im Einsatz, Profi)
export function druckSchaetzung({ hoehe, bestand = 'ausgewogen', ts = 65, dach = true, entfeuchter = false, luefter = 'standard' }) {
  const stock = DRUCK_JE_M * hoehe * (DRUCK_BESTAND[bestand] ?? 1) * feuchteFaktor(uAusTs(ts));
  const anlage = (dach ? DRUCK_ZUSCHLAG.dach : 0) + (entfeuchter ? DRUCK_ZUSCHLAG.entfeuchter : 0);
  return { stock, anlage, bedarf: stock + anlage, luefter: luefterDruck(luefter, ANLAGE.luft), reicht: luefterDruck(luefter, ANLAGE.luft) >= stock + anlage };
}

// Pannen (nur Niveau Profi, abschaltbar): aus dem Wettercode abgeleitet, damit alle in der Klasse dasselbe erleben.
// Zeiten in Stunden nach dem Einfüllen (Annahmen): Stromausfall in der zweiten Nacht oder Sicherung am zweiten Tag.
export function pannenAus(schluessel) {
  let s = 11;
  for (const c of String(schluessel)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return s % 2 === 0 ? [{ nach: 30, art: 'stromausfall', dauer: 8 }] : [{ nach: 40, art: 'sicherung' }];
}

// ---------- Kosten in Franken je Tonne Heu (stehen neben den Punkten, fliessen nicht in sie ein).
// Belegt: Festkosten der Anlage aus «Gesamtkosten Trocknungssysteme» (LK Salzburg S. 43, n. Wirleitner; abgelesen:
// Gesamtkosten minus variable Kosten in € je t Heu: Kaltbelüftung 10, Dachabsaugung 11,5, Entfeuchter 19,3, Dach und
// Entfeuchter 20,8) und der Wert des Heus (LK Salzburg S. 6: Vollkosten 25,40 € je dt TM). Euro werden 1:1 als Franken
// gerechnet (Annahme). Alles andere sind Annahmen, im Niveau Profi sichtbar und änderbar: Strompreis, Stundenansatz,
// Zuschlag für den starken Lüfter (FAT 1982, Tab. 8: Lüfter der nächsten Grösse rund ein Drittel teurer; Anteil an den
// Festkosten angenommen), Miete beim Nachrüsten.
export const PREISE = {
  strom: { name: 'Strom', wert: 0.25, einheit: 'Fr. je kWh', annahme: true },
  arbeit: { name: 'Arbeit', wert: 30, einheit: 'Fr. je Stunde', annahme: true },
  heu: { name: 'Wert des Heus', wert: 25.4, einheit: 'Fr. je dt TS', annahme: false },
  fixKalt: { name: 'Anlage Kaltbelüftung', wert: 10, einheit: 'Fr. je t Heu', annahme: false },
  fixDach: { name: 'Anlage mit Dachabsaugung', wert: 11.5, einheit: 'Fr. je t Heu', annahme: false },
  fixEntf: { name: 'Anlage mit Entfeuchter', wert: 19.3, einheit: 'Fr. je t Heu', annahme: false },
  fixDachEntf: { name: 'Anlage mit Dach und Entfeuchter', wert: 20.8, einheit: 'Fr. je t Heu', annahme: false },
  stark: { name: 'Zuschlag starker Lüfter', wert: 1, einheit: 'Fr. je t Heu', annahme: true },
  miete: { name: 'Lüfter nachrüsten (Miete, Eilzuschlag)', wert: 300, einheit: 'Fr. pauschal', annahme: true },
};
export function kosten(l, preise = {}) {
  const P0 = Object.fromEntries(Object.entries(PREISE).map(([k, v]) => [k, Number.isFinite(preise[k]) ? preise[k] : v.wert]));
  const t = l.tonnenEin, a = l.anlage;
  const fix = (a.dach && a.entfeuchter ? P0.fixDachEntf : a.entfeuchter ? P0.fixEntf : a.dach ? P0.fixDach : P0.fixKalt) * (BOX[a.box] ?? BOX.passend).m2JeHa / BOX.passend.m2JeHa;
  // verlorenes Heu in % der eingefüllten TS: der Lagerverlust aus der Bewertung (lagereHeu), sonst der Verlust während der Belüftung
  const verloren = l.ende === 'brand' || l.ende === 'abbruch' ? 100 : l.lagerverlust ?? l.verlust;
  const teile = {
    strom: l.kwh * P0.strom / t,
    anlage: fix + (a.luefter === 'stark' ? P0.stark : 0),
    miete: l.bestelltBei != null ? P0.miete / t : 0,
    arbeit: l.arbeit * P0.arbeit / t,
    verlust: verloren / 100 * (ANLAGE.zielTs / 100) * 10 * P0.heu, // je t eingefülltes Heu: dt TS × Preis
  };
  return { ...teile, total: Object.values(teile).reduce((s, x) => s + x, 0), preise: P0, tonnen: t };
}

export class Heustock {
  // dmFeld: kg TS je m² Feld (aus der Feldphase: g/m² ÷ 1000), ts: TS beim Einführen in %, t0: Stunde des Einführens.
  // anlage, einfuellen: siehe ANLAGE_STANDARD und EINFUELLEN_STANDARD; bestand: Futterart (Druck); pannen: vorgegebene
  // Ereignisse [{ t, art: 'stromausfall', dauer } | { t, art: 'sicherung' }]; luftFest: Prüfstand mit fester Soll-Luftmenge.
  constructor({ dmFeld, ts, t0, wetter, optionen = OPTIONEN, anlage = ANLAGE_STANDARD, einfuellen = EINFUELLEN_STANDARD, bestand = 'ausgewogen', pannen = [], luftFest = false }) {
    const a = ANLAGE;
    this.wetter = wetter; this.t0 = t0; this.t = t0; this.optionen = { ...OPTIONEN, ...optionen };
    this.anlage = { ...ANLAGE_STANDARD, ...anlage }; this.einfuellen = { ...EINFUELLEN_STANDARD, ...einfuellen };
    // Was die Anlage hat: Warmdach und Entfeuchter lassen sich nur schalten, wenn sie gebaut sind
    this.hat = { dach: !!this.anlage.dach && this.optionen.dach !== false, entfeuchter: !!this.anlage.entfeuchter && this.optionen.entfeuchter !== false };
    this.bestand = bestand; this.pannen = (pannen ?? []).map((p) => ({ ...p, t: p.t ?? t0 + p.nach })); this.luftFest = luftFest;
    this.luefter = LUEFTER[this.anlage.luefter] ? this.anlage.luefter : 'standard';
    this.tsEin = ts;
    const m2JeHa = (BOX[this.anlage.box] ?? BOX.passend).m2JeHa;
    this.belegung = dmFeld * 10000 / m2JeHa; // kg TS je m² Stock (ganze Ernte)
    this.flaeche = m2JeHa * a.feldHa;         // m² Stock im Spiel
    const w0 = wetter[Math.min(t0, wetter.length - 1)];
    const u = uAusTs(ts), temp0 = w0.temp + 2;
    // Säulen nebeneinander (Anteil an der Fläche), jede mit Schichten von unten nach oben. Gleichmässig verteilt genügt
    // eine Säule: Dann rechnet das Modell genau wie vor dem Ausbau.
    const jetzt = this.einfuellen.lagen === 2 ? 0.5 : 1, nS = a.schichten * jetzt;
    const bau = (rho, masse) => ({ rho0: rho, schichten: Array.from({ length: nS }, () => ({ dm: this.belegung * masse / a.schichten, u, temp: temp0, schimmel: 0, rho })) });
    this.verteilung = this.einfuellen.verteilen ? [{ rho: a.dichte, anteilMasse: 1 }] : UNGLEICH;
    this.saeulen = this.verteilung.map((x) => ({ anteil: 1 / this.verteilung.length, ...bau(x.rho, x.anteilMasse) }));
    // Zweite Lage wartet unbelüftet neben der Box, bis nachgefüllt wird (kg TS je m² Stock)
    this.warte = jetzt < 1 ? { dm: this.belegung * (1 - jetzt), u, temp: temp0, schimmel: 0 } : null;
    this.hoehe = this.hoeheJetzt(); this.hoeheMax = this.hoehe;
    this.dm0 = this.belegung;
    this.kwh = 0; this.kwhLuefter = 0; this.kwhEntf = 0; this.wasser = 0; this.laufStunden = 0;
    this.tempMax = temp0; this.verlauf = []; this.fertigBei = null; this.hauptBei = null; this.letzteLuft = null;
    this.seitLauf = 0; // Stunden seit dem letzten Lüften (Intervall)
    // Bedienung: Handlungen (Messen, Eingriffe, Feuerwehr …) und Wendepunkte für den Zeitstrahl, gemessene Sicht, Ernstfall
    this.handlungen = []; this.wendepunkte = []; this.gemessen = { t: null, stellen: [null, null, null] }; this.messungen = 0;
    this.endeArt = null; this.vorinfoBei = null; this.heissStunden = 0; this.fehlalarme = 0;
    this.bestelltBei = null; this.nachgeruestet = false; this.sicherungAus = false;
    this.arbeit = this.einfuellen.verteilen ? ARBEIT.verteilen : 0; // Stunden
    this.ausgelagert = 0; this.broeckel = 0; // kg TS je m² Stock
    this.luftMin = 1; this.luftSumme = 0; this.nutzlos = 0; this.nachgefuelltBei = null; this.umgeschichtet = 0;
    this.nestGemeldet = false; this.luftGemeldet = false;
    if (this.einfuellen.start === 'danach') this.wendepunkte.push({ t: t0, art: 'spaet' });
  }

  // Alle Schichten aller Säulen (bei gleichmässigem Stock: die Schichten der einen Säule)
  get schichten() { return this.saeulen.length === 1 ? this.saeulen[0].schichten : this.saeulen.flatMap((s) => s.schichten); }
  get n() { return this.saeulen[0].schichten.length; }
  alle(fn) { let s = 0; for (const sa of this.saeulen) for (const x of sa.schichten) s += fn(x) * sa.anteil; return s; } // Summe je m² Stock
  dmStock() { return this.alle((x) => x.dm); }
  tsMittel() { const dm = this.dmStock(), w = this.alle((x) => x.dm * x.u); return 100 * dm / (dm + w); }
  tsMin() { return Math.min(...this.schichten.map((x) => tsAusU(x.u))); }
  get lagerfaehig() { return !this.warte && this.tsMin() >= ANLAGE.lagerTs; }
  get ende() { return this.endeArt != null || this.lagerfaehig || this.t - this.t0 >= ANLAGE.maxStunden || this.t >= this.wetter.length; }
  tempJetzt() { return Math.max(...this.schichten.map((x) => x.temp)); }
  hoeheSaeule(sa) { return sa.schichten.reduce((s, x) => s + x.dm / x.rho, 0); }
  hoeheJetzt() { return Math.max(...this.saeulen.map((sa) => this.hoeheSaeule(sa))); }
  // Wasser, das bis 87 % TS noch weg muss, in Litern für den ganzen Stock
  restWasser() {
    const uz = uAusTs(ANLAGE.zielTs);
    return this.alle((x) => Math.max(0, x.u - uz) * x.dm) * this.flaeche;
  }
  mengeTonnen() { return (this.dmStock() + (this.warte?.dm ?? 0)) * this.flaeche / 1000 / (ANLAGE.zielTs / 100); }

  // ---------- Luftmenge: Betriebspunkt aus Lüfterkennlinie und Stockwiderstand
  // Druckbedarf einer Säule bei der Luftmenge v (m³/s je m²)
  druckSaeule(sa, v) {
    const dm = sa.schichten.reduce((s, x) => s + x.dm, 0);
    const u = sa.schichten.reduce((s, x) => s + x.dm * x.u, 0) / dm, rho = dm / this.hoeheSaeule(sa);
    const hS = this.hoeheSaeule(sa);
    return DRUCK_JE_M * hS * druckVerhaeltnis(hS, v) * (DRUCK_BESTAND[this.bestand] ?? 1) * feuchteFaktor(u) * (rho / ANLAGE.dichte) ** WIDERSTAND.dichteExp;
  }
  zuschlag(v) { return ((this.hat.dach ? DRUCK_ZUSCHLAG.dach : 0) + (this.hat.entfeuchter ? DRUCK_ZUSCHLAG.entfeuchter : 0)) * (v / ANLAGE.luft) ** 2; }
  // Luftmenge je Säule beim Druck p unter dem Rost
  vBei(sa, p) { let a = 0, b = 0.4; for (let i = 0; i < 36; i++) { const m = (a + b) / 2; if (this.druckSaeule(sa, m) < p) a = m; else b = m; } return (a + b) / 2; }
  // Ergebnis: v je Säule, Mittel, Anteil am Sollwert, Druck unter dem Rost. Der Lüfter ist auf den Sollwert gedrosselt
  // (zu viel Luft bei wenig Heu führt zu Kaminen und Luftverlust, Agroscope 2014 S. 8): mehr als ANLAGE.luft gibt es nie.
  luftmengen() {
    if (this.luftCache?.t === this.t && this.luftCache.typ === this.luefter) return this.luftCache.wert;
    const soll = ANLAGE.luft, S = this.saeulen, typ = this.luefter;
    let wert;
    if (this.luftFest) wert = { v: S.map(() => soll), mittel: soll, anteil: 1, druck: this.druckSaeule(S[0], soll) };
    else if (S.length === 1) {
      const frei = (v) => luefterDruck(typ, v) - this.zuschlag(v) - this.druckSaeule(S[0], v);
      let v = soll;
      if (frei(soll) < 0) { let a = 0, b = soll; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (frei(m) > 0) a = m; else b = m; } v = (a + b) / 2; }
      wert = { v: [v], mittel: v, anteil: v / soll, druck: this.druckSaeule(S[0], v) };
    } else {
      const total = (p) => S.reduce((s, sa) => s + sa.anteil * this.vBei(sa, p), 0);
      // Druck unter dem Rost, bei dem die Säulen zusammen den Sollwert durchlassen; reicht der Lüfter dafür nicht, der Schnittpunkt
      let a = 0, b = 3000;
      for (let i = 0; i < 36; i++) { const m = (a + b) / 2; if (total(m) < soll) a = m; else b = m; }
      let p = (a + b) / 2;
      if (luefterDruck(typ, soll) - this.zuschlag(soll) < p) {
        a = 0; b = p;
        for (let i = 0; i < 36; i++) { const m = (a + b) / 2, V = total(m); if (luefterDruck(typ, V) - this.zuschlag(V) > m) a = m; else b = m; }
        p = (a + b) / 2;
      }
      const v = S.map((sa) => this.vBei(sa, p)), mittel = v.reduce((s, x, i) => s + x * S[i].anteil, 0);
      wert = { v, mittel, anteil: Math.min(1, mittel / soll), druck: p };
    }
    this.luftCache = { t: this.t, typ, wert };
    return wert;
  }

  // Zuluft nach Lüfter, Dach und Entfeuchter (je m² Stock) bei der mittleren Luftmenge v
  zuluft(w, e, v = ANLAGE.luft) {
    const a = ANLAGE, kw = LUEFTER[this.luefter].kw, mL = LUFT.dichte(w.temp, P) * Math.max(v, 0.005); // kg Luft/s je m²
    let x = LUFT.x(w.temp, w.rh, P), h = LUFT.h(w.temp, x);
    const dach = e.dach && this.hat.dach ? a.dachFaktor * a.dachW * clamp(w.rad / 800, 0, 1.2) / 1000 : 0; // kW je m² Stock
    h += (kw + dach) / mL; // Lüfterwärme: der Strom endet als Wärme in der Luft
    let entfKg = 0;
    const t1 = LUFT.tAus(h, x);
    if (e.entfeuchter && this.hat.entfeuchter) {
      entfKg = entfeuchterKgJeKwh(w.temp, w.rh) * a.wpKw; // kg/h je m²
      if (entfKg > 0) { x = Math.max(0.5, x - entfKg / 3.6 / mL); h += a.wpKw / mL; } // Wärmepumpe: Strom als Wärme, Wasser kondensiert
    }
    const t = LUFT.tAus(h, x);
    return { t, rh: LUFT.rh(t, x, P), x, h, mL, dach, entfKg, t1, kw, aussen: { t: w.temp, rh: w.rh } };
  }

  // Wie viel Wasser die Luft dem Stock abnehmen würde (g/m³), ohne etwas zu verändern
  // (wie eine Steuerung, die Zuluft und Abluft vergleicht: Luft durch den ganzen Stock, ohne Wärme)
  wuerdeTrocknen(e) {
    const w = this.wetter[Math.min(this.t, this.wetter.length - 1)];
    const L = this.luftmengen(), z = this.zuluft(w, e, L.mittel), rho = LUFT.dichte(w.temp, P);
    if (this.saeulen.length === 1) {
      const mAir = z.mL * 3600;
      let x = z.x;
      for (const s of this.saeulen[0].schichten) x += austausch(s.u, s.dm, z.h, x, mAir).dx;
      return (x - z.x) * LUFT.dichte(z.t, P);
    }
    let sx = 0;
    this.saeulen.forEach((sa, i) => {
      const mAir = rho * Math.max(L.v[i], 0.002) * 3600;
      let x = z.x;
      for (const s of sa.schichten) x += austausch(s.u, s.dm, z.h, x, mAir).dx;
      sx += sa.anteil * L.v[i] * x;
    });
    return (sx / Math.max(L.mittel, 1e-6) - z.x) * LUFT.dichte(z.t, P);
  }

  // Laufanteil der Stunde nach Betriebsart. Intervall mit Feuchtesteuerung: die ersten 24 Stunden durchlaufen
  // (LK Salzburg); dann lüften, solange die Luft trocknet; sonst alle 4 Stunden eine halbe Stunde, bis die Gutfeuchte
  // unter rund 22 % ist (FAT 1982: alle 4–6 h 20–30 min bis 20–25 %); über 35 °C im Heu immer (LK Salzburg; Agroscope 2014).
  laufanteil(e) {
    if (e.luefter === 'aus') return 0;
    if (e.luefter === 'dauer') return 1;
    if (this.t - this.t0 < 24) return 1;
    if (Math.max(...this.schichten.map((x) => x.temp)) > 35) return 1;
    if (this.wuerdeTrocknen(e) > 0.2) return 1;
    if (this.tsMittel() < 78 && this.seitLauf >= 3) return 0.5;
    return 0;
  }
  // Warum der Lüfter trotz Schalter nicht läuft: Einfüllen (Start «danach»), Stromausfall, Sicherung
  gesperrt() {
    if (this.einfuellen.start === 'danach' && this.t - this.t0 < EINGRIFF.sperre) return 'einfuellen';
    if (this.sicherungAus) return 'sicherung';
    if (this.pannen.some((p) => p.art === 'stromausfall' && this.t >= p.t && this.t < p.t + p.dauer)) return 'stromausfall';
    return null;
  }

  // Wärme einer ungelüfteten Schicht oder des wartenden Heus: Atmung (Annahme), ab 60 °C chemische Erwärmung
  erwaerme(s, dm) {
    const c = dm * (WAERME.cTs + 4.19 * s.u); // kJ/K
    const nass = clamp((s.u - uAusTs(85)) / (uAusTs(65) - uAusTs(85)), 0, 1.6);
    let q = WAERME.q0 * tempFaktor(s.temp) * nass * dm; // kJ/h
    if (s.temp >= WAERME.chemAb) q += WAERME.chem * 2 ** ((s.temp - WAERME.chemAb) / 10) * Math.min(1, nass) * dm;
    s.temp = Math.min(s.temp >= WAERME.chemAb ? WAERME.tempMax : 85, s.temp + q / c);
    return { c, q };
  }

  stunde(e = STANDARD) {
    if (this.ende) return null;
    const a = ANLAGE, w = this.wetter[this.t];
    // Pannen, die zu dieser Stunde eintreten
    for (const p of this.pannen) if (p.t === this.t) {
      if (p.art === 'sicherung') this.sicherungAus = true;
      this.wendepunkte.push({ t: this.t, art: p.art, dauer: p.dauer });
    }
    if (this.bestelltBei != null && !this.nachgeruestet && this.t >= this.bestelltBei + NACHRUESTEN.warteStunden) {
      this.luefter = 'stark'; this.nachgeruestet = true; this.wendepunkte.push({ t: this.t, art: 'luefterDa' });
    }
    const sperre = this.gesperrt();
    const f = sperre ? 0 : this.laufanteil(e);
    const L = this.luftmengen();
    const z = this.zuluft(w, e, L.mittel);
    const rhoA = LUFT.dichte(w.temp, P), eine = this.saeulen.length === 1;
    let wasser = 0, sx = 0, sh = 0, xAb = z.x, hAb = z.h;
    this.saeulen.forEach((sa, i) => {
      let { h, x } = z;
      const v = L.v[i], rel = v / a.luft;
      const mAir = (eine ? z.mL : rhoA * v) * 3600 * f; // kg Luft in dieser Stunde je m² Säule
      const luft = f > 0 && mAir > 1; // praktisch keine Luft: die Säule bleibt sich selbst überlassen
      let wS = 0;
      for (const s of sa.schichten) {
        const c = s.dm * (WAERME.cTs + 4.19 * s.u); // kJ/K
        // Atmungswärme (Annahme), solange das Heu feucht ist
        const nass = clamp((s.u - uAusTs(85)) / (uAusTs(65) - uAusTs(85)), 0, 1.6);
        let q = WAERME.q0 * tempFaktor(s.temp) * nass * s.dm; // kJ/h
        if (s.temp >= WAERME.chemAb) q += WAERME.chem * 2 ** ((s.temp - WAERME.chemAb) / 10) * Math.min(1, nass) * s.dm;
        s.temp = Math.min(s.temp >= WAERME.chemAb ? WAERME.tempMax : 85, s.temp + q / c);
        s.dm -= q / WAERME.brennwert;
        if (luft) {
          // Gespeicherte Wärme geht an die Luft über; mit weniger Luft als dem Sollwert entsprechend weniger
          const tLuft = LUFT.tAus(h, x);
          const dq = c * (s.temp - tLuft) * Math.min(1, 0.8 * f * rel);
          h += dq / mAir; s.temp -= dq / c;
          // Feuchteaustausch mit der Schicht, Richtung Sorptionsgleichgewicht
          const { kg, dx } = austausch(s.u, s.dm, h, x, mAir);
          s.u -= kg / s.dm; x += dx; wS += kg;
          const tNach = LUFT.tAus(h, x);
          s.temp += (tNach - s.temp) * Math.min(1, f * rel);
        } else {
          s.temp += (w.temp - s.temp) * WAERME.kuehl;
        }
        // Schimmel (Annahme)
        const r = clamp((rhGleich(s.u, s.temp) - SCHIMMEL.ab) / SCHIMMEL.spanne, 0, 1);
        s.schimmel += r * 2 ** ((clamp(s.temp, 0, 45) - 20) / 10) / SCHIMMEL.stunden;
      }
      wasser += eine ? wS : wS * sa.anteil;
      if (eine) { xAb = x; hAb = h; } else { sx += sa.anteil * v * x; sh += sa.anteil * v * h; }
    });
    if (!eine && L.mittel > 1e-6) { xAb = sx / L.mittel; hAb = sh / L.mittel; }
    // Wartende zweite Lage: unbelüftet, atmet und erwärmt sich
    if (this.warte) {
      const s = this.warte, { c, q } = this.erwaerme(s, s.dm);
      s.dm -= q / WAERME.brennwert;
      s.temp += (w.temp - s.temp) * EINGRIFF.warteKuehl;
      const r = clamp((rhGleich(s.u, s.temp) - SCHIMMEL.ab) / SCHIMMEL.spanne, 0, 1);
      s.schimmel += r * 2 ** ((clamp(s.temp, 0, 45) - 20) / 10) / SCHIMMEL.stunden;
      void c;
    }
    const tAb = LUFT.tAus(hAb, xAb);
    const rho = LUFT.dichte(z.t, P);
    const gm3 = f > 0 ? (xAb - z.x) * rho : 0;
    const lh = f > 0 ? gm3 * L.mittel * this.flaeche * 3.6 * f : 0;
    const kwL = z.kw * this.flaeche * f, kwE = z.entfKg > 0 ? a.wpKw * this.flaeche * f : 0;
    this.kwhLuefter += kwL; this.kwhEntf += kwE; this.kwh += kwL + kwE;
    this.wasser += wasser * this.flaeche; this.laufStunden += f;
    if (f > 0) { this.luftMin = Math.min(this.luftMin, L.anteil); this.luftSumme += L.anteil * f; if (gm3 < 0.3) this.nutzlos += f; }
    this.seitLauf = f > 0 ? 0 : this.seitLauf + 1;
    this.t++;
    // Wärmste Stelle; ein Nest ist eine Säule, die deutlich wärmer ist als die kühlste
    const tS = this.saeulen.map((sa) => Math.max(...sa.schichten.map((s) => s.temp)));
    const temp = Math.max(...tS, this.warte?.temp ?? -99), nest = tS.indexOf(Math.max(...tS));
    for (const g of WENDE_TEMP) if (temp > g && this.tempMax <= g) this.wendepunkte.push({ t: this.t, art: 'temp', grenze: g, temp, wo: this.wo(tS, nest) });
    if (!eine && !this.nestGemeldet) {
      // Nest: eine Säule ist deutlich wärmer (über 35 °C und 8 K mehr) oder nach zwei Tagen deutlich feuchter (8 Punkte TS) als die trockenste
      const tsS = this.saeulen.map((sa) => Math.min(...sa.schichten.map((s) => tsAusU(s.u)))), feucht = tsS.indexOf(Math.min(...tsS));
      const warm = Math.max(...tS) - Math.min(...tS) > 8 && Math.max(...tS) > 35, nass = this.t - this.t0 >= 48 && Math.max(...tsS) - Math.min(...tsS) > 8;
      if (warm || nass) { this.nestGemeldet = true; this.wendepunkte.push({ t: this.t, art: 'nest', temp: Math.max(...tS), ts: Math.min(...tsS), feucht: !warm, wo: SAEULEN[warm ? nest : feucht] }); }
    }
    if (f > 0 && !this.luftGemeldet && L.anteil < 0.9) { this.luftGemeldet = true; this.wendepunkte.push({ t: this.t, art: 'luft', anteil: L.anteil }); }
    this.tempMax = Math.max(this.tempMax, temp);
    // Ernstfall: bleibt der Stock über der Alarmschwelle, ohne dass alarmiert wird, brennt er (Annahme zur Dauer)
    this.heissStunden = temp >= ERNSTFALL.alarm ? this.heissStunden + 1 : 0;
    if (this.heissStunden >= ERNSTFALL.brandStunden || temp >= WAERME.tempMax) { this.endeArt = 'brand'; this.wendepunkte.push({ t: this.t, art: 'brand', temp }); }
    const p = {
      t: this.t, f, ts: this.tsMittel(), tsMin: this.tsMin(), temp,
      aussenT: w.temp, aussenRh: w.rh, zuT: z.t, zuRh: z.rh, abT: f > 0 ? tAb : null, abRh: f > 0 ? LUFT.rh(tAb, xAb, P) : null,
      gm3, lh, kwh: this.kwh, entfLh: z.entfKg > 0 ? z.entfKg * this.flaeche * f : 0, dachK: z.dach > 0 ? z.t1 - w.temp - z.kw / z.mL / 1.006 : 0,
      luft: L.anteil, v: L.mittel, druck: L.druck, sperre,
    };
    this.verlauf.push(p); this.letzteLuft = p;
    if (this.lagerfaehig && this.fertigBei == null) { this.fertigBei = this.t; this.wendepunkte.push({ t: this.t, art: 'lagerfaehig' }); }
    if (!this.warte && this.tsMin() >= ANLAGE.hauptTs && this.hauptBei == null) { this.hauptBei = this.t; this.wendepunkte.push({ t: this.t, art: 'haupt' }); }
    return p;
  }
  wo(tS, nest) { return this.warte && this.warte.temp >= Math.max(...tS) ? 'wartendes Heu' : this.saeulen.length > 1 ? SAEULEN[nest] : null; }

  // Schaltung (Lüfter, Dach, Entfeuchter) für den Zeitstrahl vermerken; je Stunde und Schalter gilt die letzte Wahl
  schaltung(x) {
    this.handlungen = this.handlungen.filter((h) => !(h.art === 'schalter' && h.t === x.t && h.was === x.art));
    this.handlungen.push({ t: x.t, art: 'schalter', was: x.art, wert: x.wert });
  }

  // Säule an einer der drei Messstellen (vorne, Mitte, hinten); ein gleichmässiger Stock ist überall gleich
  saeuleAn(i) { return this.saeulen[Math.min(i, this.saeulen.length - 1)]; }
  messe(stellen) {
    for (const i of stellen) this.gemessen.stellen[i] = { t: this.t, schichten: this.saeuleAn(i).schichten.map((s) => ({ ts: tsAusU(s.u), temp: s.temp })) };
    this.gemessen.t = this.t;
  }

  // Handlung aus dem Protokoll ausführen (alles ausser den Schaltern Lüfter, Dach, Entfeuchter).
  // Gibt zurück, was dabei herauskam (für Ticker und Zeitstrahl); verändert den Stock deterministisch.
  handle(x) {
    if (this.ende) return null;
    const temp = this.tempJetzt(), w = this.wetter[Math.min(this.t, this.wetter.length - 1)];
    let h = null;
    // Luft an heisses Heu: Wer einen heissen Stock öffnet, löst den Brand aus (LK Salzburg S. 25)
    const oeffnen = (art) => { if (temp < ERNSTFALL.luftAb) return false; this.endeArt = 'brand'; h = { t: this.t, art: 'brandluft', bei: art, temp }; this.wendepunkte.push({ t: this.t, art: 'brand', temp }); return true; };
    if (x.art === 'sonde') {
      // Heusonde: Temperatur und Feuchte je Schicht an den gewählten Stellen; gilt als Stand von jetzt
      const stellen = x.wert === 'mitte' ? [1] : [0, 1, 2];
      this.messe(stellen);
      this.messungen++; this.arbeit += stellen.length === 1 ? ARBEIT.sondeMitte : ARBEIT.sonde;
      const g = stellen.map((i) => this.gemessen.stellen[i].schichten);
      h = { t: this.t, art: 'sonde', stellen: stellen.length, temp: Math.max(...g.flat().map((s) => s.temp)), tsMin: Math.min(...g.flat().map((s) => s.ts)), wahr: temp, tsWahr: this.tsMin() };
    } else if (x.art === 'vorinfo') {
      if (this.vorinfoBei != null) return null;
      this.vorinfoBei = this.t;
      h = { t: this.t, art: 'vorinfo', temp };
    } else if (x.art === 'alarm') {
      if (temp >= ERNSTFALL.vorinfo) { this.endeArt = 'abbruch'; h = { t: this.t, art: 'alarm', temp }; }
      else { this.fehlalarme++; this.messe([0, 1, 2]); h = { t: this.t, art: 'fehlalarm', temp }; } // die Feuerwehr misst nach
    } else if (x.art === 'umschichten') {
      if (!oeffnen('umschichten')) {
        // Greifer: mischt alle Schichten und Säulen, löst Kamine und Nester auf, lockert, lässt Wärme entweichen
        const n = this.n, dm = this.dmStock(), vorher = { temp, luft: this.luftmengen().anteil };
        const u = this.alle((s) => s.dm * s.u) / dm, tM = this.alle((s) => s.dm * s.temp) / dm, sch = this.alle((s) => s.dm * s.schimmel) / dm;
        const verlust = dm * EINGRIFF.broeckel, t2 = tM - (tM - w.temp) * EINGRIFF.abkuehlen;
        this.broeckel += verlust;
        this.saeulen = [{ anteil: 1, rho0: EINGRIFF.greiferDichte, schichten: Array.from({ length: n }, () => ({ dm: (dm - verlust) / n, u, temp: t2, schimmel: sch, rho: EINGRIFF.greiferDichte })) }];
        this.verteilung = [{ rho: EINGRIFF.greiferDichte, anteilMasse: 1 }];
        this.umgeschichtet++; this.arbeit += ARBEIT.umschichten; this.luftCache = null; this.nestGemeldet = true;
        this.hoeheMax = Math.max(this.hoeheMax, this.hoeheJetzt());
        h = { t: this.t, art: 'umschichten', tempVor: vorher.temp, tempNach: t2, luftVor: vorher.luft, luftNach: this.luftmengen().anteil };
      }
    } else if (x.art === 'nachfuellen') {
      if (!this.warte) return null;
      const s = this.warte, zuFrueh = this.t - this.t0 < EINGRIFF.nachfuellenAb, tsUnten = this.tsMin();
      const hVor = this.hoeheJetzt(), nNeu = ANLAGE.schichten / 2;
      this.saeulen.forEach((sa, i) => {
        const v = this.verteilung[Math.min(i, this.verteilung.length - 1)];
        const neu = Array.from({ length: nNeu }, () => ({ dm: s.dm * v.anteilMasse / nNeu, u: s.u, temp: s.temp, schimmel: s.schimmel, rho: v.rho }));
        const dH = neu.reduce((a, y) => a + y.dm / y.rho, 0);
        for (const y of sa.schichten) y.rho *= 1 + EINGRIFF.last * dH; // die untere Lage wird unter der Last dichter
        sa.schichten.push(...neu);
      });
      this.warte = null; this.nachgefuelltBei = this.t; this.arbeit += ARBEIT.nachfuellen + (this.einfuellen.verteilen ? ARBEIT.verteilen : 0); this.luftCache = null;
      this.hoeheMax = Math.max(this.hoeheMax, this.hoeheJetzt());
      h = { t: this.t, art: 'nachfuellen', zuFrueh, tsUnten, tempLage: s.temp, hoeheVor: hVor, hoeheNach: this.hoeheJetzt(), luftNach: this.luftmengen().anteil };
    } else if (x.art === 'auslagern') {
      if (this.n < 2) return null;
      if (!oeffnen('auslagern')) {
        // oberste Schicht jeder Säule wegnehmen (verfüttern): weniger Höhe, weniger Wasser, aber weniger Lagerheu
        let weg = 0;
        for (const sa of this.saeulen) weg += sa.schichten.pop().dm * sa.anteil;
        this.ausgelagert += weg; this.arbeit += ARBEIT.auslagern; this.luftCache = null;
        h = { t: this.t, art: 'auslagern', kg: weg * this.flaeche, hoeheNach: this.hoeheJetzt(), luftNach: this.luftmengen().anteil };
      }
    } else if (x.art === 'luefterHolen') {
      if (this.luefter === 'stark' || this.bestelltBei != null) return null;
      this.bestelltBei = this.t; this.arbeit += ARBEIT.luefterHolen;
      h = { t: this.t, art: 'luefterHolen', da: this.t + NACHRUESTEN.warteStunden, luft: this.luftmengen().anteil };
    } else if (x.art === 'sicherung') {
      if (!this.sicherungAus) return null;
      this.sicherungAus = false;
      h = { t: this.t, art: 'sicherung' };
    }
    // Nach einem Eingriff liegt das Heu anders: Die alten Messwerte gelten nicht mehr
    if (h && ['umschichten', 'nachfuellen', 'auslagern'].includes(h.art)) this.gemessen = { t: null, stellen: [null, null, null] };
    if (h) this.handlungen.push(h);
    return h;
  }

  zustand() {
    const L = this.luftmengen();
    return {
      t: this.t, stunden: this.t - this.t0, ts: this.tsMittel(), tsMin: this.tsMin(), temp: Math.max(this.tempJetzt(), this.warte?.temp ?? -99),
      schimmel: Math.max(...this.schichten.map((s) => s.schimmel)), kwh: this.kwh, rest: this.restWasser(), luft: this.letzteLuft,
      schichten: this.saeulen[0].schichten.map((s) => ({ ts: tsAusU(s.u), temp: s.temp })),
      // drei Messstellen (wahrer Stand): für die automatische Messung im Einstieg und für Tests
      stellen: [0, 1, 2].map((i) => ({ hoehe: this.hoeheSaeule(this.saeuleAn(i)), schichten: this.saeuleAn(i).schichten.map((s) => ({ ts: tsAusU(s.u), temp: s.temp })) })),
      hoehen: [0, 1, 2].map((i) => this.hoeheSaeule(this.saeuleAn(i))), hoehe: this.hoeheJetzt(),
      gemessen: this.gemessen, vorinfo: this.vorinfoBei != null, endeArt: this.endeArt,
      luftAnteil: L.anteil, luftV: L.mittel, druck: L.druck, luefter: this.luefter, bestellt: this.bestelltBei != null && !this.nachgeruestet,
      luefterDaIn: this.bestelltBei != null && !this.nachgeruestet ? this.bestelltBei + NACHRUESTEN.warteStunden - this.t : null,
      warte: this.warte ? { ts: tsAusU(this.warte.u), temp: this.warte.temp, tonnen: this.warte.dm * this.flaeche / 1000 / (ANLAGE.zielTs / 100) } : null,
      sperre: this.gesperrt(), gleichmaessig: this.saeulen.length === 1,
    };
  }

  // Ergebnis für die Bewertung (lagereHeu) und die Erklärkarte
  ergebnis() {
    const tonnen = this.mengeTonnen(), stunden = (this.fertigBei ?? this.t) - this.t0;
    const schimmel = Math.max(...this.schichten.map((s) => s.schimmel), this.warte?.schimmel ?? 0);
    const dmEnde = this.dmStock() + (this.warte?.dm ?? 0);
    return {
      stunden, hauptStunden: this.hauptBei != null ? this.hauptBei - this.t0 : null, lagerfaehig: this.lagerfaehig, tsEin: this.tsEin, tsEnde: this.tsMittel(), tsMinEnde: Math.min(this.tsMin(), this.warte ? tsAusU(this.warte.u) : 100),
      tempMax: this.tempMax, schimmel, kwh: this.kwh, kwhLuefter: this.kwhLuefter, kwhEntf: this.kwhEntf, tonnen, kwhJeT: this.kwh / tonnen,
      wasser: this.wasser, laufStunden: this.laufStunden, flaeche: this.flaeche, hoehe: this.hoehe, hoeheMax: this.hoeheMax,
      verlust: 100 * (1 - dmEnde / this.dm0),
      verlauf: this.verlauf.map(({ t, f, ts, tsMin, temp, gm3, lh, luft }) => ({ t, f, ts, tsMin, temp, gm3, lh, luft })),
      t0: this.t0, tEnde: this.t,
      // Wie die Runde endete und was dazu führte (Zeitstrahl, Karten «Kontrolle» und «Eingriffe»)
      ende: this.endeArt ?? (this.lagerfaehig ? 'lagerfaehig' : 'zeit'),
      handlungen: this.handlungen.slice(), wendepunkte: this.wendepunkte.slice(), messungen: this.messungen,
      vorinfoBei: this.vorinfoBei, fehlalarme: this.fehlalarme,
      // Anlage, Einfüllen, Luft, Arbeit (Karten «Anlage», «Einfüllen», «Lüften», «Kosten»)
      anlage: { ...this.anlage, dach: this.hat.dach, entfeuchter: this.hat.entfeuchter }, einfuellen: { ...this.einfuellen }, bestand: this.bestand,
      luefterEnde: this.luefter, nachgeruestet: this.nachgeruestet, bestelltBei: this.bestelltBei,
      luftMin: this.luftMin, luftMittel: this.laufStunden > 0 ? this.luftSumme / this.laufStunden : 1, nutzlos: this.nutzlos,
      arbeit: this.arbeit, ausgelagertT: this.ausgelagert * this.flaeche / 1000 / (ANLAGE.zielTs / 100), broeckelT: this.broeckel * this.flaeche / 1000 / (ANLAGE.zielTs / 100),
      tonnenEin: this.dm0 * this.flaeche / 1000 / (ANLAGE.zielTs / 100), nachgefuelltBei: this.nachgefuelltBei, wartetNoch: !!this.warte, umgeschichtet: this.umgeschichtet,
    };
  }
}

// Ganzer Belüftungslauf. log: Schaltungen [{ t, art: 'luefter' | 'dach' | 'entfeuchter', wert }], gelten ab Stunde t,
// und Handlungen [{ t, art: 'sonde' | 'vorinfo' | 'alarm' … }], ausgeführt zur Stunde t in der Reihenfolge des Protokolls.
export const SCHALTER = ['luefter', 'dach', 'entfeuchter'];
// Version des Protokolls am Heustock: gesicherte Runden einer anderen Version lassen sich nicht exakt nachspielen und werden verworfen
export const PROTOKOLL_VERSION = 3;
export function spieleBelueftungNach(start, log = [], tEnde = Infinity, betrieb = STANDARD) {
  const h = new Heustock(start);
  const e = { ...betrieb };
  for (;;) {
    for (const x of log) if (x.t === h.t) { if (SCHALTER.includes(x.art)) { e[x.art] = x.wert; h.schaltung(x); } else h.handle(x); }
    if (h.ende || h.t >= tEnde) break;
    h.stunde(e);
  }
  return h;
}
