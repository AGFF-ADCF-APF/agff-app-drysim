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
  flaecheJeHa: 20,  // m² Stockfläche je ha Schnittfläche und Charge (Agroscope 2014: 14–24)
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
export const WAERME = { q0: 1.0, cTs: 1.5, kuehl: 0.01, brennwert: 15600 };
const tempFaktor = (t) => (t <= 40 ? 2 ** ((t - 20) / 10) : 4 * clamp(1 - (t - 40) / 40, 0.05, 1));
// Schimmel (Annahme): wächst, solange die Gleichgewichtsfeuchte einer Schicht über 75 % rF liegt, schneller bei Wärme.
// Index 1 ≈ «leicht muffig», 2 ≈ «schimmlig».
export const SCHIMMEL = { ab: 75, spanne: 20, stunden: 72 };

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

export class Heustock {
  // dm: kg TS je m² Feld (aus der Feldphase: g/m² ÷ 1000), ts: TS beim Einführen in %, t0: Stunde des Einführens
  constructor({ dmFeld, ts, t0, wetter, optionen = OPTIONEN }) {
    const a = ANLAGE;
    this.wetter = wetter; this.t0 = t0; this.t = t0; this.optionen = { ...OPTIONEN, ...optionen };
    this.tsEin = ts;
    this.belegung = dmFeld * 10000 / a.flaecheJeHa; // kg TS je m² Stock
    this.flaeche = a.flaecheJeHa * a.feldHa;         // m² Stock im Spiel
    this.hoehe = this.belegung / a.dichte;            // m
    const w0 = wetter[Math.min(t0, wetter.length - 1)];
    const u = uAusTs(ts);
    this.schichten = Array.from({ length: a.schichten }, () => ({ dm: this.belegung / a.schichten, u, temp: w0.temp + 2, schimmel: 0 }));
    this.dm0 = this.belegung;
    this.kwh = 0; this.kwhLuefter = 0; this.kwhEntf = 0; this.wasser = 0; this.laufStunden = 0;
    this.tempMax = this.schichten[0].temp; this.verlauf = []; this.fertigBei = null; this.hauptBei = null; this.letzteLuft = null;
    this.seitLauf = 0; // Stunden seit dem letzten Lüften (Intervall)
  }

  get n() { return this.schichten.length; }
  tsMittel() { const dm = this.schichten.reduce((s, x) => s + x.dm, 0), w = this.schichten.reduce((s, x) => s + x.dm * x.u, 0); return 100 * dm / (dm + w); }
  tsMin() { return Math.min(...this.schichten.map((x) => tsAusU(x.u))); }
  get lagerfaehig() { return this.tsMin() >= ANLAGE.lagerTs; }
  get ende() { return this.lagerfaehig || this.t - this.t0 >= ANLAGE.maxStunden || this.t >= this.wetter.length; }
  // Wasser, das bis 87 % TS noch weg muss, in Litern für den ganzen Stock
  restWasser() {
    const uz = uAusTs(ANLAGE.zielTs);
    return this.schichten.reduce((s, x) => s + Math.max(0, x.u - uz) * x.dm, 0) * this.flaeche;
  }
  mengeTonnen() { return this.schichten.reduce((s, x) => s + x.dm, 0) * this.flaeche / 1000 / (ANLAGE.zielTs / 100); }

  // Zuluft nach Lüfter, Dach und Entfeuchter (je m² Stock); f = Laufanteil dieser Stunde
  zuluft(w, e) {
    const a = ANLAGE, mL = LUFT.dichte(w.temp, P) * a.luft; // kg Luft/s je m²
    let x = LUFT.x(w.temp, w.rh, P), h = LUFT.h(w.temp, x);
    const dach = e.dach && this.optionen.dach ? a.dachFaktor * a.dachW * clamp(w.rad / 800, 0, 1.2) / 1000 : 0; // kW je m² Stock
    h += (a.luefterKw + dach) / mL; // Lüfterwärme: der Strom endet als Wärme in der Luft
    let entfKg = 0;
    const t1 = LUFT.tAus(h, x);
    if (e.entfeuchter && this.optionen.entfeuchter) {
      entfKg = entfeuchterKgJeKwh(w.temp, w.rh) * a.wpKw; // kg/h je m²
      if (entfKg > 0) { x = Math.max(0.5, x - entfKg / 3.6 / mL); h += a.wpKw / mL; } // Wärmepumpe: Strom als Wärme, Wasser kondensiert
    }
    const t = LUFT.tAus(h, x);
    return { t, rh: LUFT.rh(t, x, P), x, h, mL, dach, entfKg, t1, aussen: { t: w.temp, rh: w.rh } };
  }

  // Wie viel Wasser die Luft der untersten Schicht abnehmen würde (g/m³), ohne etwas zu verändern
  // (wie eine Steuerung, die Zuluft und Abluft vergleicht: Luft durch den ganzen Stock, ohne Wärme)
  wuerdeTrocknen(e) {
    const w = this.wetter[Math.min(this.t, this.wetter.length - 1)];
    const z = this.zuluft(w, e), mAir = z.mL * 3600;
    let x = z.x;
    for (const s of this.schichten) x += austausch(s.u, s.dm, z.h, x, mAir).dx;
    return (x - z.x) * LUFT.dichte(z.t, P);
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

  stunde(e = STANDARD) {
    if (this.ende) return null;
    const a = ANLAGE, w = this.wetter[this.t];
    const f = this.laufanteil(e);
    const z = this.zuluft(w, e);
    let { h, x } = z;
    const mAir = z.mL * 3600 * f; // kg Luft in dieser Stunde je m²
    let wasser = 0;
    for (const s of this.schichten) {
      const c = s.dm * (WAERME.cTs + 4.19 * s.u); // kJ/K
      // Atmungswärme (Annahme), solange das Heu feucht ist
      const nass = clamp((s.u - uAusTs(85)) / (uAusTs(65) - uAusTs(85)), 0, 1.6);
      const q = WAERME.q0 * tempFaktor(s.temp) * nass * s.dm; // kJ/h
      s.temp = Math.min(85, s.temp + q / c);
      s.dm -= q / WAERME.brennwert;
      if (f > 0) {
        // Gespeicherte Wärme geht an die Luft über
        const tLuft = LUFT.tAus(h, x);
        const dq = c * (s.temp - tLuft) * Math.min(1, 0.8 * f);
        h += dq / mAir; s.temp -= dq / c;
        // Feuchteaustausch mit der Schicht, Richtung Sorptionsgleichgewicht
        const { kg, dx } = austausch(s.u, s.dm, h, x, mAir);
        s.u -= kg / s.dm; x += dx; wasser += kg;
        const tNach = LUFT.tAus(h, x);
        s.temp += (tNach - s.temp) * f;
      } else {
        s.temp += (w.temp - s.temp) * WAERME.kuehl;
      }
      // Schimmel (Annahme)
      const r = clamp((rhGleich(s.u, s.temp) - SCHIMMEL.ab) / SCHIMMEL.spanne, 0, 1);
      s.schimmel += r * 2 ** ((clamp(s.temp, 0, 45) - 20) / 10) / SCHIMMEL.stunden;
    }
    const tAb = LUFT.tAus(h, x);
    const rho = LUFT.dichte(z.t, P);
    const gm3 = f > 0 ? (x - z.x) * rho : 0;
    const lh = f > 0 ? gm3 * a.luft * this.flaeche * 3.6 * f : 0;
    const kwL = a.luefterKw * this.flaeche * f, kwE = z.entfKg > 0 ? a.wpKw * this.flaeche * f : 0;
    this.kwhLuefter += kwL; this.kwhEntf += kwE; this.kwh += kwL + kwE;
    this.wasser += wasser * this.flaeche; this.laufStunden += f;
    this.seitLauf = f > 0 ? 0 : this.seitLauf + 1;
    this.t++;
    const temp = Math.max(...this.schichten.map((s) => s.temp));
    this.tempMax = Math.max(this.tempMax, temp);
    const p = {
      t: this.t, f, ts: this.tsMittel(), tsMin: this.tsMin(), temp,
      aussenT: w.temp, aussenRh: w.rh, zuT: z.t, zuRh: z.rh, abT: f > 0 ? tAb : null, abRh: f > 0 ? LUFT.rh(tAb, x, P) : null,
      gm3, lh, kwh: this.kwh, entfLh: z.entfKg > 0 ? z.entfKg * this.flaeche * f : 0, dachK: z.dach > 0 ? z.t1 - w.temp - a.luefterKw / z.mL / 1.006 : 0,
    };
    this.verlauf.push(p); this.letzteLuft = p;
    if (this.lagerfaehig && this.fertigBei == null) this.fertigBei = this.t;
    if (this.tsMin() >= ANLAGE.hauptTs && this.hauptBei == null) this.hauptBei = this.t;
    return p;
  }

  zustand() {
    return {
      t: this.t, stunden: this.t - this.t0, ts: this.tsMittel(), tsMin: this.tsMin(), temp: Math.max(...this.schichten.map((s) => s.temp)),
      schimmel: Math.max(...this.schichten.map((s) => s.schimmel)), kwh: this.kwh, rest: this.restWasser(), luft: this.letzteLuft,
      schichten: this.schichten.map((s) => ({ ts: tsAusU(s.u), temp: s.temp })),
    };
  }

  // Ergebnis für die Bewertung (lagereHeu) und die Erklärkarte
  ergebnis() {
    const tonnen = this.mengeTonnen(), stunden = (this.fertigBei ?? this.t) - this.t0;
    const schimmel = Math.max(...this.schichten.map((s) => s.schimmel));
    return {
      stunden, hauptStunden: this.hauptBei != null ? this.hauptBei - this.t0 : null, lagerfaehig: this.lagerfaehig, tsEin: this.tsEin, tsEnde: this.tsMittel(), tsMinEnde: this.tsMin(),
      tempMax: this.tempMax, schimmel, kwh: this.kwh, kwhLuefter: this.kwhLuefter, kwhEntf: this.kwhEntf, tonnen, kwhJeT: this.kwh / tonnen,
      wasser: this.wasser, laufStunden: this.laufStunden, flaeche: this.flaeche, hoehe: this.hoehe,
      verlust: 100 * (1 - this.schichten.reduce((s, x) => s + x.dm, 0) / this.dm0),
      verlauf: this.verlauf.map(({ t, f, ts, tsMin, temp, gm3, lh }) => ({ t, f, ts, tsMin, temp, gm3, lh })),
      t0: this.t0,
    };
  }
}

// Ganzer Belüftungslauf. log: Entscheidungen [{ t, art: 'luefter' | 'dach' | 'entfeuchter', wert }], gelten ab Stunde t
export function spieleBelueftungNach(start, log = [], tEnde = Infinity, betrieb = STANDARD) {
  const h = new Heustock(start);
  const e = { ...betrieb };
  while (!h.ende && h.t < tEnde) {
    for (const x of log) if (x.t === h.t) e[x.art] = x.wert;
    h.stunde(e);
  }
  return h;
}
