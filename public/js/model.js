// Feldphase (stündlich) und Silierung.
// Einheiten: alles je m² Feldfläche in g (TS = Trockensubstanz, Wasser getrennt
// nach innerem Pflanzenwasser und Oberflächenwasser aus Tau und Regen).
// Trocknungskonstante nach Rotz & Chen (1985); die übrigen Ansätze sind
// vereinfachte Lehrmodelle (Quellen und offene Punkte: README.md).

export const BESTAENDE = {
  graeser: { name: 'Gräserreich (Raigras)', zucker: 170, pk: 42, leg: 0.05, asche: 85 },
  ausgewogen: { name: 'Ausgewogen', zucker: 125, pk: 52, leg: 0.3, asche: 90 },
  klee: { name: 'Kleereich', zucker: 85, pk: 65, leg: 0.6, asche: 95 },
};

export const STADIEN = {
  2: { name: 'Schossen', nel: 6.6, rp: 190, ts: 15 },
  3: { name: 'Ähren-/Rispenschieben', nel: 6.1, rp: 160, ts: 18 },
  4: { name: 'Beginn Blüte', nel: 5.5, rp: 130, ts: 21 },
};

// Trocknungsfaktoren gelten erst für die zweite, langsame Phase (nach dem Schliessen der Stomata);
// kutikula = wie stark Regen/Tau eindringen und auswaschen; broeckel = Blattverlust bei Klee
export const AUFBEREITER = {
  ohne: { name: 'ohne Aufbereiter', gras: 0.85, klee: 0.85, kutikula: 1.0, broeckel: 0 },
  zinken: { name: 'Zinkenaufbereiter', gras: 1.18, klee: 1.05, kutikula: 1.6, broeckel: 1.5 },
  walzen: { name: 'Walzenaufbereiter', gras: 1.12, klee: 1.25, kutikula: 1.3, broeckel: 0.3 },
  doppel: { name: 'Doppelrotor-Aufbereiter', gras: 1.3, klee: 1.12, kutikula: 2.0, broeckel: 2.5, breit: true },
};

// Arbeitshöhe der Zinken (cm über Boden, stufenlos): Erde, liegen gelassenes Futter, Wirkung
export function zinken(cm) {
  return {
    asche: cm >= 4 ? 0.5 : 1 + 10 * clamp((2.5 - cm) / 2.5, 0, 1) ** 1.5,
    verlust: Math.max(0, cm - 4) * 0.8,
    wirkung: clamp(1 - Math.max(0, cm - 4) * 0.1, 0.5, 1),
  };
}

export const SILOARTEN = {
  flachsilo: { name: 'Flachsilo (Ladewagen)', ziel: [30, 40], ernteverlust: 1.0, gaerverlust: 6 },
  ballen: { name: 'Rundballen', ziel: [40, 55], ernteverlust: 1.5, gaerverlust: 5 },
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Zusätzliche Rohasche (g/kg TS) durch die Schnitthöhe und Ertragsfaktor (Ertrag bezieht sich auf 7 cm)
const SCHNITT = { 4: [30, 1.09], 5: [18, 1.06], 6: [8, 1.03], 7: [2, 1.0], 8: [0, 0.96], 9: [0, 0.92], 10: [0, 0.88], 11: [0, 0.84], 12: [0, 0.8] };
export const SCHNITTHOEHEN = Object.keys(SCHNITT).map(Number);

// Ein Feld, das Stunde für Stunde weiterläuft. Arbeitsgänge wirken zu Beginn der
// aktuellen Stunde, danach rechnet `stunde()` das Wetter dieser Stunde.
export class Feld {
  constructor(setup, wetter, start = 0) {
    this.p = setup; this.wetter = wetter; this.t = 0;
    this.b = BESTAENDE[setup.bestand]; this.st = STADIEN[setup.stadium];
    this.auf = AUFBEREITER[setup.aufbereiter]; this.silo = SILOARTEN[setup.siloart];
    this.leg = this.b.leg;
    [this.schnittAsche, this.ertragsF] = SCHNITT[setup.schnitthoehe];
    this.bodenF = setup.boden === 'maulwurf' ? 1.8 : 1;
    this.phase = 'stehend'; // stehend → gemaeht → schwad → geerntet
    this.wo = 0; this.sm = 25;
    this.verlust = { atmung: 0, auswaschung: 0, broeckel: 0, liegen: 0 };
    this.ereignisse = []; this.bodenAsche = []; this.verlauf = []; this.zetten = [];
    this.regenFeld = 0; this.regenStunden = 0; this.tauNaechte = new Set();
    while (this.t < start) this.stunde();
  }

  get ende() { return this.t >= this.wetter.length; }
  tsInnen() { return this.dm / (this.dm + this.wi); }
  ts() {
    if (this.phase === 'stehend') return 100 * this.st.ts / (100 + this.wo / (this.p.ertrag * 10) * this.st.ts);
    return 100 * this.dm / (this.dm + this.wi + this.wo);
  }
  zustand() {
    const w = this.wetter[Math.min(this.t, this.wetter.length - 1)];
    if (this.phase === 'stehend') return { t: this.t, phase: this.phase, w, ts: this.ts(), nass: this.wo / (this.p.ertrag * 10), zucker: this.b.zucker, asche: this.b.asche + this.schnittAsche * this.bodenF, verlust: 0 };
    const v = Object.values(this.verlust).reduce((a, x) => a + x, 0);
    return {
      t: this.t, phase: this.phase, w, ts: this.ts(), nass: this.wo / this.dm, sd: this.sd,
      zucker: 1000 * this.zucker / this.dm, asche: 1000 * this.asche / this.dm, verlust: 100 * v / this.dm0,
    };
  }

  // Verlust an TS; Zucker trägt den Anteil `zAnteil` davon
  verliere(art, g, zAnteil) {
    g = Math.min(g, this.dm * 0.5);
    const z = Math.min(this.zucker, g * zAnteil);
    this.zucker -= z; this.asche -= this.asche / this.dm * (g - z); this.dm -= g; this.verlust[art] += g;
  }
  erde(art, hoehe) {
    const nass = this.sm > 45 ? 1.6 : 1;
    const stoppel = this.p.schnitthoehe <= 5 ? 1.5 : 1;
    const zusatz = zinken(hoehe).asche * this.bodenF * nass * stoppel;
    this.asche += this.dm * zusatz / 1000;
    this.bodenAsche.push({ art, t: this.t, zusatz, nass: nass > 1, stoppel: stoppel > 1 });
  }

  maehen() {
    if (this.phase !== 'stehend') return false;
    const p = this.p, b = this.b, st = this.st;
    this.dm0 = this.dm = p.ertrag * 10 * this.ertragsF; // dt TS/ha -> g/m²
    this.wi = this.dm * (100 - st.ts) / st.ts;
    this.zucker = this.dm * b.zucker / 1000;
    this.asche = this.dm * (b.asche + this.schnittAsche * this.bodenF) / 1000;
    this.tsMahd = this.ts(); this.woMahd = this.wo; this.maehZeit = this.t;
    this.sd = p.breit || this.auf.breit ? 1.0 : 1.7; // Schwadfaktor: g TS je m² Schwad / g TS je m² Feld
    this.locker = 1; // Lockerungsbonus nach Zetten
    this.phase = 'gemaeht';
    this.verliere('broeckel', this.dm * (1 + this.leg * this.auf.broeckel) / 100, 0);
    this.ereignisse.push({ t: this.t, art: 'maehen', text: 'Mähen', ts: this.tsMahd });
    return true;
  }

  zettenJetzt() {
    if (this.phase !== 'gemaeht') return false;
    const h = zinken(this.p.zetterHoehe), leg = this.leg;
    const tsi = 100 * this.tsInnen();
    const f = clamp((tsi - 35) / 25, 0, 1);
    this.verliere('broeckel', this.dm * (0.8 + leg * 6 * f + (1 - leg) * f) / 100, 0.1);
    this.erde('zetten', this.p.zetterHoehe);
    this.sd = h.wirkung < 1 ? 1.3 : 1.0;
    this.locker = 1 + 0.3 * h.wirkung;
    this.zetten.push(this.t);
    this.ereignisse.push({ t: this.t, art: 'zetten', text: 'Zetten', ts: this.ts() });
    return true;
  }

  schwaden() {
    if (this.phase !== 'gemaeht') return false;
    const h = zinken(this.p.schwaderHoehe);
    const f = clamp((100 * this.tsInnen() - 35) / 25, 0, 1);
    this.verliere('broeckel', this.dm * (0.6 + this.leg * 4 * f + 0.5 * f) / 100, 0.1);
    if (h.verlust) this.verliere('liegen', this.dm * h.verlust / 100, 0);
    this.erde('schwaden', this.p.schwaderHoehe);
    this.sd = 5; this.locker = 1;
    this.phase = 'schwad'; this.schwadZeit = this.t;
    this.ereignisse.push({ t: this.t, art: 'schwaden', text: 'Schwaden', ts: this.ts() });
    return true;
  }

  stunde() {
    if (this.ende || this.phase === 'geerntet') return;
    const w = this.wetter[this.t];
    this.sm = bodenfeuchte(this.sm, w);
    if (this.phase === 'stehend') {
      // stehender Bestand: nur Oberflächenwasser (Tau, Regen); dichter Bestand trocknet langsamer ab
      this.wo = Math.min(400, this.wo + tau(w, 1) + w.regen * 300);
      this.wo = Math.max(0, this.wo - 0.5 * verdunstung(w));
      this.t++;
      return;
    }
    const auf = this.auf, leg = this.leg, sd = this.sd;

    // Wasser von aussen: Tau und Regen landen zuerst auf der Oberfläche
    const tauG = tau(w, sd);
    if (tauG > 0 && (w.h >= 20 || w.h < 9)) this.tauNaechte.add(w.h >= 20 ? w.tag : w.tag - 1);
    let regenG = 0;
    if (w.regen > 0) {
      regenG = w.regen * 1000 * 0.25 / sd; this.regenFeld += w.regen; this.regenStunden++;
      const tsi = this.tsInnen();
      if (tsi > 0.25) {
        this.verliere('auswaschung', this.dm * Math.min(0.015, 0.0015 * w.regen * auf.kutikula * (tsi > 0.4 ? 1.5 : 1)), 0.5);
      }
    }
    // Ein Teil des Regens dringt direkt ins Gewebe, bei verletzter Wachsschicht mehr
    this.wi += regenG * 0.1 * auf.kutikula;
    this.wo = Math.min(this.dm * 2, this.wo + tauG + regenG * (1 - 0.1 * auf.kutikula));
    // Aufnahme von Oberflächenwasser ins Gewebe (beschädigte Wachsschicht: schneller)
    const aufnahme = this.wo * 0.05 * auf.kutikula;
    this.wo -= aufnahme; this.wi += aufnahme;
    // Oberflächenwasser verdunstet zuerst, die Schwadoberfläche ist kleiner als das Feld
    this.wo -= Math.min(this.wo, verdunstung(w) / Math.sqrt(sd));

    // Inneres Wasser: Rotz & Chen, gebremst solange die Oberfläche nass ist
    const tag1 = this.t - this.maehZeit < 24 ? 1 : 0;
    const SD = this.dm * sd;
    let dr = (w.rad + 43.8 * w.vpd) / (61.4 * this.sm + SD * (1.82 - 0.83 * tag1) * 1.68 + 2767);
    // Aufbereiter wirkt erst, wenn die Stomata zu sind und das Wasser durch Kutikula und Stängel muss
    const phase2 = clamp((this.tsInnen() - 0.22) / 0.08, 0, 1);
    dr *= 1 + (((1 - leg) * auf.gras + leg * auf.klee) - 1) * phase2;
    dr *= this.locker;
    // Kalibrierung (Rotz & Chen kennt weder Schwadbreite noch Wind): Breitablage erreicht bei
    // gutem Wetter 35 % TS in rund 8–10 h, eine schmale Schwade erst am Folgetag (Univ. Wisconsin)
    dr *= 0.6 * sd ** -0.75 * (1 + 0.05 * (w.wind - 2));
    // Hohe Stoppeln: Futter liegt luftiger
    dr *= 1 + Math.max(0, this.p.schnitthoehe - 7) * 0.02;
    dr *= Math.max(0.2, 1 - this.wo / (0.3 * this.dm));
    const we = this.dm * (0.1 + 0.25 * (w.rh / 100) ** 4); // Gleichgewicht (Trockenbasis)
    this.wi -= (this.wi - we) * (1 - Math.exp(-dr));
    this.locker = 1 + (this.locker - 1) * 0.94;

    // Atmung: läuft, solange die Zellen noch feucht genug sind
    const r = 0.002 * 2 ** ((w.temp - 20) / 10) * clamp((0.6 - this.tsInnen()) / 0.4, 0, 1);
    this.verliere('atmung', this.dm * r, 0.8);

    this.t++;
    this.verlauf.push({ t: this.t, ts: this.ts(), tsInnen: 100 * this.tsInnen(), nass: this.wo / this.dm });
  }

  einfahren() {
    if (this.phase !== 'schwad') return null;
    const { b, st, silo, leg, p } = this;
    const tsErnte = this.ts();
    this.ereignisse.push({ t: this.t, art: 'ernte', text: 'Einfahren', ts: tsErnte });
    this.verliere('liegen', this.dm * silo.ernteverlust / 100, 0);
    const tsiErnte = 100 * this.tsInnen();
    if (tsiErnte > 45) this.verliere('broeckel', this.dm * leg * 4 * clamp((tsiErnte - 45) / 20, 0, 1) / 100, 0);
    this.phase = 'geerntet';

    const dm = this.dm, dm0 = this.dm0;
    const ernte = {
      dm, ts: tsErnte, zucker: 1000 * this.zucker / dm, asche: 1000 * this.asche / dm,
      stunden: this.t - this.maehZeit, regenFeld: this.regenFeld, regenStunden: this.regenStunden, tauNaechte: this.tauNaechte.size,
    };
    const plan = { ...p, maehen: this.maehZeit, zetten: this.zetten, schwaden: this.schwadZeit, ernte: this.t };
    const silage = siliere(ernte, b, silo, plan);

    // --- Energie und Rohprotein
    const v = Object.fromEntries(Object.entries(this.verlust).map(([k, g]) => [k, 100 * g / dm0]));
    const ascheMehr = Math.max(0, ernte.asche - b.asche);
    let nel = st.nel - 0.04 * v.atmung - 0.06 * v.auswaschung - 0.03 * v.broeckel * (0.3 + leg);
    nel *= (1000 - ascheMehr) / 1000;
    nel -= 0.15 * silage.buttersaeure / 10 + (ernte.ts < 25 ? 0.1 : 0);
    const rp = st.rp - v.broeckel * leg * 1.5;
    const tsTrog = dm * (1 - silage.siloverlust / 100);
    const nelHa = tsTrog * 10 * nel; // MJ NEL/ha
    // Wettkampfpunkte: Energie im Trog, abgewertet für Fehlgärung und TS ausserhalb des Zielbereichs
    const gaerFaktor = [1, 0.95, 0.85, 0.7, 0.5][silage.note - 1];
    const [zmin, zmax] = silo.ziel;
    const daneben = Math.max(0, zmin - ernte.ts, ernte.ts - zmax);
    const zielFaktor = 1 - Math.min(0.2, daneben * 0.01);
    const punkte = Math.round(nelHa * gaerFaktor * zielFaktor / 100);

    const res = {
      plan, ernte, silage, verlust: v, dm0, tsMahd: this.tsMahd, woMahd: this.woMahd,
      bodenAsche: this.bodenAsche, ereignisse: this.ereignisse, verlauf: this.verlauf,
      nel, rp, tsTrog, nelHa, punkte, verlustTotal: 100 - 100 * tsTrog / dm0,
    };
    res.faktoren = erklaere(res, this);
    return res;
  }
}

// Ganzer Plan auf einmal (Prognose, Tests)
export function simuliere(plan, wetter) {
  const zetten = [...(plan.zetten ?? [])].sort((x, y) => x - y);
  const fehler = pruefePlan(plan, zetten, wetter.length);
  if (fehler) return { fehler };
  const f = new Feld(plan, wetter, plan.maehen);
  f.maehen();
  while (f.t < plan.ernte) {
    if (zetten.includes(f.t)) f.zettenJetzt();
    if (f.t === plan.schwaden) f.schwaden();
    f.stunde();
  }
  return f.einfahren();
}

function pruefePlan(p, zetten, n) {
  if (!(p.maehen >= 0 && p.ernte <= n)) return 'Zeitpunkte ausserhalb des Wetterzeitraums.';
  if (zetten.some((z) => z <= p.maehen)) return 'Zetten geht erst nach dem Mähen.';
  if (p.schwaden <= p.maehen) return 'Schwaden muss nach dem Mähen kommen.';
  if (zetten.some((z) => z >= p.schwaden)) return 'Nach dem Schwaden wird nicht mehr gezettet.';
  if (p.ernte <= p.schwaden) return 'Einfahren erst nach dem Schwaden.';
  return null;
}

function bodenfeuchte(sm, w) {
  return Math.min(80, sm + w.regen * 3) * (w.rad > 0 ? 0.985 : 0.997) + (w.rad > 0 ? 0.3 : 0.06);
}

// Tau in g/m² Feld je Stunde; liegt das Futter im Schwad, fängt es nur einen Teil
function tau(w, sd) {
  return w.rh >= 90 && w.rad < 30 ? 10 * (w.rh - 88) / sd : 0;
}

// Potenzielle Verdunstung von freiem Wasser, g/m²/h
function verdunstung(w) {
  return (w.rad * 3600 / 2.45e6) * 1000 * 0.5 + w.vpd * 100 * (1 + 0.3 * w.wind);
}

// --- Silierung: Vergärbarkeitskoeffizient nach Weissbach, Gärsäuren als Lehrmodell
export function siliere(e, b, silo, plan) {
  const ts = e.ts;
  const fk = ts + 8 * e.zucker / b.pk;
  const erde = Math.max(0, e.asche - 100);
  let bs = Math.max(0, 45 - fk) * 1.5 + Math.max(0, 28 - ts) * 0.5;
  bs += erde * 0.15 * (ts < 38 ? 1 : ts < 45 ? 0.5 : 0.1);
  bs = Math.min(40, bs); // g/kg TS
  const pHkrit = 0.0257 * ts + 3.71;
  const pH = pHkrit - 0.15 + Math.max(0, 45 - fk) * 0.025 + bs * 0.01;
  const essig = Math.max(5, 18 + Math.max(0, 30 - ts) * 1.2 - Math.max(0, ts - 35) * 0.4 + Math.max(0, 45 - fk) * 0.6);
  const nh3 = 5 + bs * 0.4 + b.leg * 3 + Math.max(0, 30 - ts) * 0.2;

  const dlg = dlgPunkte(bs / 10, essig / 10, pH, pHkrit);
  const note = dlg >= 90 ? 1 : dlg >= 72 ? 2 : dlg >= 52 ? 3 : dlg >= 30 ? 4 : 5;

  let siloverlust = silo.gaerverlust + bs / 10 * 2;
  const sv = { gaerung: siloverlust, nacherwaermung: 0, sickersaft: 0 };
  if (plan.siloart === 'flachsilo') {
    sv.nacherwaermung = Math.max(0, ts - 40) * 0.4;
    sv.sickersaft = Math.max(0, 28 - ts) * 0.8;
  } else {
    sv.nacherwaermung = Math.max(0, ts - 55) * 0.3;
    sv.sickersaft = Math.max(0, 30 - ts) * 0.5;
  }
  siloverlust += sv.nacherwaermung + sv.sickersaft;
  return { fk, buttersaeure: bs, essigsaeure: essig, pH, pHkrit, nh3, dlg, note, siloverlust, sv };
}

// Angelehnt an den DLG-Schlüssel 2006 (Buttersäure, Essigsäure, pH je TS) – Stufen vereinfacht
function dlgPunkte(bsProz, esProz, pH, pHkrit) {
  const bsStufen = [[0.3, 90], [0.4, 80], [0.7, 70], [1.0, 60], [1.3, 50], [1.6, 40], [1.9, 30], [2.6, 20], [3.6, 10]];
  let p = 0;
  for (const [g, pt] of bsStufen) if (bsProz <= g) { p = pt; break; }
  p -= esProz <= 3.0 ? 0 : esProz <= 3.5 ? 10 : esProz <= 4.5 ? 20 : 30;
  const ueber = pH - pHkrit;
  p += ueber <= 0 ? 10 : ueber <= 0.1 ? 5 : ueber <= 0.2 ? 0 : ueber <= 0.3 ? -10 : -20;
  return clamp(p, 0, 100);
}

// --- Erklärungen: jeder Faktor erklärt seine Wirkung selbst
function erklaere(r, c) {
  const f = [];
  const p = r.plan, e = r.ernte, s = r.silage, v = r.verlust;
  const stufe = (gut, mittel) => (gut ? 'gut' : mittel ? 'mittel' : 'schlecht');
  const z = (x, d = 1) => x.toFixed(d).replace('.', ',');

  f.push({
    id: 'schnitthoehe', titel: 'Schnitthöhe', wert: `${p.schnitthoehe} cm`,
    stufe: stufe(p.schnitthoehe >= 7 && p.schnitthoehe <= 8, p.schnitthoehe === 6 || (p.schnitthoehe >= 9 && p.schnitthoehe <= 10)),
    text: `Bei ${p.schnitthoehe} cm kommen ${z(c.schnittAsche * c.bodenF, 0)} g Rohasche/kg TS durch Erde dazu` +
      (c.bodenF > 1 ? ' (Maulwurfshaufen verstärken das stark)' : '') +
      `. Der Ertrag ist ${c.ertragsF >= 1 ? 'um ' + z((c.ertragsF - 1) * 100, 0) + ' % höher' : 'um ' + z((1 - c.ertragsF) * 100, 0) + ' % tiefer'} als bei 7 cm. ` +
      (p.schnitthoehe <= 5 ? 'Tiefe Stoppeln tragen das Schwad nicht: Zetter und Schwader greifen in den Boden, jeder Arbeitsgang bringt so mehr Erde ins Futter. Zudem fehlen Reservestoffe für den Wiederaustrieb. ' : '') +
      (p.schnitthoehe >= 8 ? 'Hohe Stoppeln schonen die Grasnarbe, tragen das Schwad und lassen es luftig liegen, sodass es etwas schneller trocknet. Jeder Zentimeter über 7 cm kostet aber rund 4 % Ertrag. ' : '') +
      'Erde bringt Clostridien-Sporen ins Silo: Diese Bakterien bilden Buttersäure und gefährden die Käsereitauglichkeit der Milch.',
  });

  f.push({
    id: 'tau', titel: 'Mähzeitpunkt und Tau', wert: `${uhr(p.maehen)}, ${z(r.woMahd / r.dm0 * 100, 0)} g Oberflächenwasser/100 g TS`,
    stufe: stufe(r.woMahd < 0.1 * r.dm0, r.woMahd < 0.4 * r.dm0),
    text: r.woMahd > 0.1 * r.dm0
      ? `Beim Mähen war das Futter noch nass (TS ${z(r.tsMahd)} % statt ${c.st.ts} %). Dieses Wasser muss zuerst verdunsten, erst dann trocknet die Pflanze selbst. Auf dem Boden im Schwad trocknet Tau viel langsamer ab als am stehenden Bestand.`
      : `Der Bestand war beim Mähen abgetrocknet (TS ${z(r.tsMahd)} %). Die Trocknung konnte sofort beginnen.`,
  });

  f.push({
    id: 'aufbereiter', titel: 'Aufbereitung', wert: c.auf.name,
    stufe: stufe(p.aufbereiter !== 'ohne' && !(c.auf.broeckel > 1 && c.leg > 0.4), p.aufbereiter !== 'ohne'),
    text: 'Nach dem Schnitt schliessen sich die Spaltöffnungen (Stomata) innerhalb etwa einer Stunde, sobald die Pflanze Wasser verliert. Danach muss das Wasser durch die Wachsschicht (Kutikula) und über die Stängel nach aussen. ' +
      'Der Aufbereiter verletzt Wachsschicht und Stängel. Das beschleunigt genau diese zweite, langsame Phase; die Stomata hält er nicht offen. ' +
      (p.aufbereiter === 'ohne' ? 'Ohne Aufbereiter dauert das Anwelken deutlich länger.' :
        `Die Kehrseite: Die verletzte Oberfläche nimmt Regen und Tau schneller auf, und mehr Zucker wird ausgewaschen (Faktor ${z(c.auf.kutikula)} gegenüber unbehandelt). ` +
        (p.aufbereiter === 'doppel' ? 'Der Doppelrotor bearbeitet das Futter besonders intensiv und verteilt es breit. Er trocknet am schnellsten, ist bei Regen aber am empfindlichsten. ' : '') +
        (c.auf.broeckel > 1 && c.leg > 0.3 ? 'Bei kleereichem Futter schlagen Zinken die Blätter ab; ein Walzenaufbereiter ist schonender.' : '')) +
      ' In der ersten Phase direkt nach dem Mähen hilft der Aufbereiter wenig; die Breitablage ist wichtiger.',
  });

  f.push({
    id: 'breit', titel: 'Ablage', wert: p.breit || c.auf.breit ? 'Breitablage' : 'Schwadablage',
    stufe: stufe(p.breit || c.auf.breit || c.zetten.length > 0 && c.zetten[0] - p.maehen <= 2, c.zetten.length > 0),
    text: p.breit || c.auf.breit
      ? 'Das Futter liegt über die ganze Fläche verteilt. Sonne und Wind erreichen mehr Futter, deshalb ist die Trocknung am ersten Tag am schnellsten. So ist Silage oft am gleichen Tag erntereif.'
      : 'In der Mähschwade liegt das Futter dicht. Die Trocknung wird gebremst, bis gezettet wird. Wird erst spät gezettet, geht wertvolle Trocknungszeit am ersten Tag verloren.',
  });

  const zt = c.zetten.map((t) => uhr(t)).join(', ');
  f.push({
    id: 'zetten', titel: 'Zetten', wert: c.zetten.length ? `${c.zetten.length}× (${zt})` : 'nie',
    stufe: stufe(v.broeckel < 3 && (c.zetten.length > 0 || p.breit), v.broeckel < 5),
    text: (c.zetten.length ? 'Zetten lockert das Futter und dreht die feuchte Unterseite nach oben. Am wirksamsten ist es direkt nach dem Mähen. ' :
      'Ohne Zetten bleibt die Unterseite feucht; bei Breitablage und gutem Wetter reicht das für Silage oft. ') +
      `Bröckelverluste total: ${z(v.broeckel)} % der TS` +
      (c.leg > 0.3 ? '. Klee verliert bei trockenem Futter (über ca. 40 % TS) beim Zetten und Schwaden viele Blätter. Die Blätter sind der eiweissreichste Teil der Pflanze.' : '.'),
  });

  const ba = r.bodenAsche.map((x) => `${x.art === 'zetten' ? 'Zetten' : 'Schwaden'} +${z(x.zusatz, 0)} g`).join(', ');
  const ascheStufe = e.asche <= 100 ? 'gut' : e.asche <= 120 ? 'mittel' : 'schlecht';
  f.push({
    id: 'asche', titel: 'Rohasche / Verschmutzung', wert: `${z(e.asche, 0)} g/kg TS`, stufe: ascheStufe,
    text: `Sauberes Futter hat etwa ${c.b.asche} g Rohasche/kg TS; alles darüber ist meistens Erde. ` +
      (ba ? `Über die Arbeitsgänge kam dazu: ${ba} (g/kg TS). ` : '') +
      (r.bodenAsche.some((x) => x.nass) ? 'Der Boden war nass, darum blieb mehr Erde haften. ' : '') +
      `Zinkenhöhe: Zetter ${z(p.zetterHoehe)} cm, Schwader ${z(p.schwaderHoehe)} cm über Boden. Zetter und Schwader sollen das Futter heben und nicht den Boden kratzen. Unter etwa 2 cm reissen die Zinken Erde mit; über 4 cm bleibt Futter liegen. ` +
      'Ab etwa 100 g/kg TS steigt die Gefahr einer Buttersäuregärung deutlich, besonders bei nassem Futter unter 35 % TS.',
  });

  f.push({
    id: 'wetter', titel: 'Wetter auf dem Feld', wert: e.regenFeld > 0 ? `${z(e.regenFeld)} mm Regen, ${e.tauNaechte} Taunächte` : `kein Regen, ${e.tauNaechte} Taunächte`,
    stufe: stufe(e.regenFeld === 0 && e.tauNaechte === 0, e.regenFeld < 3),
    text: (e.regenFeld > 0 ? `Regen auf angewelktes Futter macht Trocknungsfortschritte zunichte und wäscht Zucker und Mineralstoffe aus (${z(v.auswaschung)} % der TS). Zucker brauchen die Milchsäurebakterien später im Silo. ` : '') +
      (e.tauNaechte > 0 ? 'Nachts nimmt das Futter Tau auf. Am Morgen muss dieses Wasser zuerst verdunsten, bevor die Trocknung weitergeht. Silage, die über Nacht liegt, verliert so Zeit und Zucker. ' : 'Das Futter lag keine Nacht im Tau: ideal für Silage. '),
  });

  f.push({
    id: 'atmung', titel: 'Feldliegezeit und Atmung', wert: `${e.stunden} h, ${z(v.atmung)} % TS veratmet`,
    stufe: stufe(v.atmung < 2, v.atmung < 4),
    text: `Die gemähten Pflanzen leben weiter und veratmen Zucker, bis sie etwa 60 % TS erreichen. Bei Wärme geht das schneller. Verlust: ${z(v.atmung)} % der TS, fast nur Zucker. ` +
      `Der Zuckergehalt sank von ${c.b.zucker} auf ${z(e.zucker, 0)} g/kg TS. Darum: schnell anwelken und kurze Feldliegezeit, ideal unter 24 h.`,
  });

  const [zmin, zmax] = c.silo.ziel;
  f.push({
    id: 'ts', titel: 'TS beim Einfahren', wert: `${z(e.ts)} % (Ziel ${zmin}–${zmax} %)`,
    stufe: stufe(e.ts >= zmin && e.ts <= zmax, e.ts >= zmin - 5 && e.ts <= zmax + 7),
    text: e.ts < zmin
      ? `Zu nass. Unter ${zmin} % TS reicht der Zucker oft nicht, um den pH schnell genug zu senken; Clostridien haben leichteres Spiel` + (p.siloart === 'flachsilo' && e.ts < 28 ? ', zudem fliesst Sickersaft ab.' : '.')
      : e.ts > zmax
        ? `Zu trocken. ${p.siloart === 'flachsilo' ? 'Im Flachsilo lässt sich trockenes Futter schlecht verdichten: Luft bleibt drin, das Silo erwärmt sich beim Öffnen und es kommt zu Schimmel.' : 'Auch Ballen werden bei sehr trockenem Futter schlecht gepresst, und Stängel durchstechen die Folie.'} Zudem steigen die Bröckelverluste.`
        : 'Im Zielbereich: Die Milchsäurebakterien arbeiten gut, und das Futter lässt sich gut verdichten.',
  });

  f.push({
    id: 'fk', titel: 'Vergärbarkeit', wert: `FK ${z(s.fk, 0)}`,
    stufe: stufe(s.fk >= 45, s.fk >= 35),
    text: `Vergärbarkeitskoeffizient FK = TS + 8 × Zucker/Pufferkapazität = ${z(e.ts, 0)} + 8 × ${z(e.zucker, 0)}/${c.b.pk} = ${z(s.fk, 0)}. ` +
      'Ab FK 45 gilt Futter als sicher buttersäurefrei silierbar. ' +
      (c.leg > 0.3 ? 'Klee puffert stark (Eiweiss, Mineralstoffe) und hat wenig Zucker; er braucht deshalb mehr TS. ' : '') +
      (s.fk < 45 ? 'Abhilfe: stärker anwelken, Zucker schonen (kurze Feldliegezeit) oder ein geeignetes Siliermittel.' : ''),
  });

  f.push({
    id: 'gaerung', titel: 'Gärqualität', wert: `${s.dlg} DLG-Punkte, Note ${s.note}`,
    stufe: stufe(s.note <= 2, s.note === 3),
    text: `Buttersäure ${z(s.buttersaeure / 10, 2)} % TS, Essigsäure ${z(s.essigsaeure / 10, 1)} % TS, pH ${z(s.pH, 2)} (kritischer pH bei ${z(e.ts, 0)} % TS: ${z(s.pHkrit, 2)}), NH₃-N ${z(s.nh3, 0)} % vom Gesamt-N. ` +
      'Der DLG-Schlüssel bewertet die Silage im Nachhinein mit Laborwerten. Die Schweizer Praxis schaut eher auf den Prozess: Wurde alles richtig gemacht, damit die Silage gut werden musste? Die übrigen Knöpfe zeigen genau diese Prozessschritte.',
  });

  f.push({
    id: 'siloverlust', titel: 'Verluste im Silo', wert: `${z(s.siloverlust)} % TS`,
    stufe: stufe(s.siloverlust <= 8, s.siloverlust <= 12),
    text: `Gärung ${z(s.sv.gaerung)} %` + (s.sv.nacherwaermung > 0 ? `, Nacherwärmung ${z(s.sv.nacherwaermung)} %` : '') +
      (s.sv.sickersaft > 0 ? `, Sickersaft ${z(s.sv.sickersaft)} %` : '') + '. Schlechte Verdichtung, zu trockenes oder zu nasses Futter und Fehlgärungen erhöhen die Verluste.',
  });

  f.push({
    id: 'bilanz', titel: 'Bilanz Feld bis Trog', wert: `${z(r.verlustTotal, 0)} % Verlust, ${z(r.nel, 2)} MJ NEL/kg TS`,
    stufe: stufe(r.verlustTotal < 15, r.verlustTotal < 22),
    text: `Gemäht: ${z(r.dm0 / 10)} dt TS/ha (Stadium ${c.st.name}, ${z(c.st.nel)} MJ NEL). Im Trog: ${z(r.tsTrog / 10)} dt TS/ha mit ${z(r.nel, 2)} MJ NEL und ${z(r.rp, 0)} g RP/kg TS = ${z(r.nelHa / 1000, 1)} GJ NEL/ha. ` +
      `Verluste: Atmung ${z(v.atmung)} %, Auswaschung ${z(v.auswaschung)} %, Bröckeln ${z(v.broeckel)} %, liegen gelassen ${z(v.liegen)} %, Silo ${z(s.siloverlust)} %.`,
  });
  return f;
}

export function uhr(t) {
  const tag = Math.floor(t / 24) + 1, h = t % 24;
  return `Tag ${tag}, ${String(h).padStart(2, '0')}:00`;
}
