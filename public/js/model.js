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
  3: { name: 'Ähren-/Rispen\u00ADschieben', nel: 6.1, rp: 160, ts: 18 },
  4: { name: 'Beginn Blüte', nel: 5.5, rp: 130, ts: 21 },
};

// Trocknungsfaktoren gelten erst für die zweite, langsame Phase (nach dem Schliessen der Stomata);
// kutikula = wie stark Regen/Tau eindringen und auswaschen; broeckel = Blattverlust bei Klee
export const AUFBEREITER = {
  ohne: { name: 'ohne Aufbereiter', gras: 0.85, klee: 0.85, kutikula: 1.0, broeckel: 0 },
  zinken: { name: 'Zinkenaufbereiter', gras: 1.18, klee: 1.05, kutikula: 1.6, broeckel: 1.5 },
  walzen: { name: 'Walzenaufbereiter', gras: 1.12, klee: 1.25, kutikula: 1.3, broeckel: 0.3 },
  buerste: { name: 'Aufbereiter mit Zinken und Bürste', gras: 1.3, klee: 1.12, kutikula: 2.0, broeckel: 2.5, breit: true },
};

// Arbeitshöhe der Zinken: eingestellt in cm über festem, ebenem Boden (stufenlos).
// Auf dem Feld sinken die Räder ein (nass stärker), die Zinken laufen also tiefer.
// Das Schwad liegt auf den Stoppeln, die sich etwa zur Hälfte biegen: Liegen die Zinken
// darüber, bleibt Futter liegen. Hohe Stoppeln erlauben deshalb eine höhere Einstellung.
export function zinken(cm, stoppelCm = 7, nass = false) {
  const effektiv = cm - (nass ? 1.0 : 0.3);
  const schwelle = 0.5 * stoppelCm + 0.5;
  const zuHoch = Math.max(0, cm - schwelle);
  return {
    effektiv, schwelle,
    asche: effektiv >= 4 ? 0.5 : 1 + 10 * clamp((2.5 - effektiv) / 2.5, 0, 1) ** 1.5,
    verlust: zuHoch * 0.8,
    wirkung: clamp(1 - zuHoch * 0.1, 0.5, 1),
  };
}

// Silage (art: silage) oder Heu (art: heu). Heu: grenze = TS, ab der das Futter ohne Erwärmung lagert
// (Belüftung: ab der die Kaltbelüftung sicher nachtrocknet); lagerverlust = Grundverlust im Lager in % TS.
export const SILOARTEN = {
  flachsilo: { name: 'Flachsilo (Ladewagen)', art: 'silage', ziel: [30, 40], ernteverlust: 1.0, gaerverlust: 6 },
  ballen: { name: 'Rundballen (Silage)', art: 'silage', ziel: [40, 55], ernteverlust: 1.5, gaerverlust: 5 },
  belueftung: { name: 'Belüftungsheu', art: 'heu', ziel: [60, 80], ernteverlust: 1.5, lagerverlust: 4, grenze: 60 },
  bodenheu: { name: 'Bodenheu (Heustock)', art: 'heu', ziel: [85, 95], ernteverlust: 2.0, lagerverlust: 5, grenze: 85 },
  heuballen: { name: 'Heuballen', art: 'heu', ziel: [85, 95], ernteverlust: 2.5, lagerverlust: 4, grenze: 85 },
};
export const istHeu = (siloart) => SILOARTEN[siloart]?.art === 'heu';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Zusätzliche Rohasche (g/kg TS) durch die Schnitthöhe und Ertragsfaktor (Ertrag bezieht sich auf 7 cm)
// Stützpunkte [cm, Rohasche-Zuschlag g/kg TS, Ertragsfaktor], dazwischen linear (stufenlos 4–12 cm)
const SCHNITT = [[4, 30, 1.09], [5, 18, 1.06], [6, 8, 1.03], [7, 2, 1.0], [8, 0, 0.96], [12, 0, 0.8]];
export function schnitt(cm) {
  const h = clamp(cm, 4, 12);
  const i = Math.max(1, SCHNITT.findIndex(([x]) => x >= h));
  const [x0, a0, e0] = SCHNITT[i - 1], [x1, a1, e1] = SCHNITT[i];
  const f = (h - x0) / (x1 - x0);
  return [a0 + (a1 - a0) * f, e0 + (e1 - e0) * f];
}

// Ein Feld, das Stunde für Stunde weiterläuft. Arbeitsgänge wirken zu Beginn der
// aktuellen Stunde, danach rechnet `stunde()` das Wetter dieser Stunde.
export class Feld {
  constructor(setup, wetter, start = 0) {
    this.p = setup; this.wetter = wetter; this.t = 0;
    this.b = BESTAENDE[setup.bestand]; this.st = STADIEN[setup.stadium];
    this.auf = AUFBEREITER[setup.aufbereiter]; this.silo = SILOARTEN[setup.siloart];
    this.leg = this.b.leg;
    [this.schnittAsche, this.ertragsF] = schnitt(setup.schnitthoehe);
    this.bodenF = setup.boden === 'maulwurf' ? 1.8 : 1;
    this.phase = 'stehend'; // stehend → gemaeht → schwad → geerntet
    this.wo = 0; this.sm = 25;
    this.verlust = { atmung: 0, auswaschung: 0, broeckel: 0, liegen: 0 };
    this.ereignisse = []; this.bodenAsche = []; this.verlauf = []; this.zetten = [];
    this.regenFeld = 0; this.regenStunden = 0; this.tauNaechte = new Set();
    this.bleiche = 0; this.regenTrocken = 0; // Heu: Sonne auf trockenem Futter (MJ/m²), Regen auf angewelktes Futter (mm)
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
      zucker: 1000 * this.zucker / this.dm, asche: 1000 * this.asche / this.dm, verlust: 100 * v / this.dm0, broeckel: 100 * this.verlust.broeckel / this.dm0,
    };
  }

  // Verlust an TS; Zucker trägt den Anteil `zAnteil` davon
  verliere(art, g, zAnteil) {
    g = Math.min(g, this.dm * 0.5);
    const z = Math.min(this.zucker, g * zAnteil);
    this.zucker -= z; this.asche -= this.asche / this.dm * (g - z); this.dm -= g; this.verlust[art] += g;
  }
  erde(art, hoehe) {
    const nass = this.sm > 45;
    // Bei kurzen Stoppeln liegt das Schwad direkt auf dem Boden
    const stoppel = this.p.schnitthoehe <= 5 ? 1.5 : 1;
    const zusatz = zinken(hoehe, this.p.schnitthoehe, nass).asche * this.bodenF * stoppel;
    this.asche += this.dm * zusatz / 1000;
    this.bodenAsche.push({ art, t: this.t, zusatz, nass, stoppel: stoppel > 1 });
  }

  // Wie spröde das Futter ist (0–1) ab `ab` % TS innen; Tau oder Restfeuchte auf der Oberfläche macht die Blätter zäher
  sproede(ab, spanne) {
    const f = clamp((100 * this.tsInnen() - ab) / spanne, 0, 1);
    return this.wo > 0.05 * this.dm ? f * 0.5 : f;
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

  // Zetten; liegt das Futter im Schwad (z.B. Nachtschwad), streut der Zetter es wieder breit
  zettenJetzt() {
    if (this.phase !== 'gemaeht' && this.phase !== 'schwad') return false;
    const h = zinken(this.p.zetterHoehe, this.p.schnitthoehe, this.sm > 45), leg = this.leg;
    const f = this.sproede(35, 25), g = this.sproede(60, 25);
    this.verliere('broeckel', this.dm * (0.8 + leg * 6 * f + (1 - leg) * f + (leg * 6 + (1 - leg)) * g) / 100, 0.1);
    this.erde('zetten', this.p.zetterHoehe);
    const ausSchwad = this.phase === 'schwad';
    this.phase = 'gemaeht';
    this.sd = h.wirkung < 1 ? 1.3 : 1.0;
    this.locker = 1 + 0.3 * h.wirkung;
    this.zetten.push(this.t);
    this.ereignisse.push({ t: this.t, art: 'zetten', text: ausSchwad ? 'Schwad zetten' : 'Zetten', ts: this.ts() });
    return true;
  }

  schwaden() {
    if (this.phase !== 'gemaeht') return false;
    const h = zinken(this.p.schwaderHoehe, this.p.schnitthoehe, this.sm > 45);
    const f = this.sproede(35, 25), g = this.sproede(60, 25);
    this.verliere('broeckel', this.dm * (0.6 + this.leg * 4 * f + 0.5 * f + (this.leg * 4 + 0.6) * g) / 100, 0.1);
    if (h.verlust) this.verliere('liegen', this.dm * h.verlust / 100, 0);
    this.erde('schwaden', this.p.schwaderHoehe);
    this.sd = 5; this.locker = 1;
    this.phase = 'schwad'; this.schwadZeit = this.t; (this.schwadZeiten ??= []).push(this.t);
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
        this.verliere('auswaschung', this.dm * Math.min(0.02, 0.0015 * w.regen * auf.kutikula * (tsi > 0.6 ? 2 : tsi > 0.4 ? 1.5 : 1)), 0.5);
      }
      if (tsi > 0.4) this.regenTrocken += w.regen;
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
    // Heu: Ab etwa 55 % TS ist das Futter locker und dünn, Stängel und Blätter geben das Restwasser rascher ab
    // (kalibriert: Bodenheu bei gutem Wetter nach rund 2½ Tagen lagerfähig)
    dr *= 1 + clamp((this.tsInnen() - 0.55) / 0.15, 0, 1);
    const we = this.dm * (0.1 + 0.25 * (w.rh / 100) ** 4); // Gleichgewicht (Trockenbasis)
    this.wi -= (this.wi - we) * (1 - Math.exp(-dr));
    this.locker = 1 + (this.locker - 1) * 0.94;

    // Atmung: läuft, solange die Zellen noch feucht genug sind
    const r = 0.002 * 2 ** ((w.temp - 20) / 10) * clamp((0.6 - this.tsInnen()) / 0.4, 0, 1);
    this.verliere('atmung', this.dm * r, 0.8);
    // Sonne bleicht trockenes Futter aus (Carotin, Farbe); im Schwad trifft sie nur die Oberseite
    if (w.rad > 0 && this.tsInnen() > 0.5) this.bleiche += w.rad * 0.0036 / (this.phase === 'schwad' ? 3 : 1);

    this.t++;
    this.verlauf.push({ t: this.t, ts: this.ts(), tsInnen: 100 * this.tsInnen(), nass: this.wo / this.dm });
  }

  einfahren() {
    if (this.phase !== 'schwad') return null;
    const { b, st, silo, leg, p } = this;
    const tsErnte = this.ts();
    this.ereignisse.push({ t: this.t, art: 'ernte', text: 'Einfahren', ts: tsErnte });
    this.verliere('liegen', this.dm * silo.ernteverlust / 100, 0);
    // Aufnehmen und Pressen: trockene Blätter brechen ab (mit Tau weniger)
    this.verliere('broeckel', this.dm * (leg * 4 * this.sproede(45, 20) + (silo.art === 'heu' ? (leg * 3 + 0.5) * this.sproede(70, 15) : 0)) / 100, 0);
    this.phase = 'geerntet';

    const dm = this.dm, dm0 = this.dm0;
    const heu = silo.art === 'heu';
    const ernte = {
      dm, ts: tsErnte, zucker: 1000 * this.zucker / dm, asche: 1000 * this.asche / dm,
      stunden: this.t - this.maehZeit, regenFeld: this.regenFeld, regenStunden: this.regenStunden, tauNaechte: this.tauNaechte.size,
      bleiche: this.bleiche, regenTrocken: this.regenTrocken,
    };
    const plan = { ...p, maehen: this.maehZeit, zetten: this.zetten, schwaden: this.schwadZeit, schwadZeiten: this.schwadZeiten, ernte: this.t };
    const v = Object.fromEntries(Object.entries(this.verlust).map(([k, g]) => [k, 100 * g / dm0]));
    const silage = heu ? null : siliere(ernte, b, silo, plan);
    const lager = heu ? lagereHeu(ernte, silo, v, this.wetter.slice(this.t), leg) : null;
    const q = heu ? lager : silage;
    const lagerverlust = heu ? lager.lagerverlust : silage.siloverlust;

    // --- Energie und Rohprotein
    const ascheMehr = Math.max(0, ernte.asche - b.asche);
    let nel = st.nel - 0.04 * v.atmung - 0.06 * v.auswaschung - 0.03 * v.broeckel * (0.3 + leg);
    nel *= (1000 - ascheMehr) / 1000;
    if (heu) nel -= 0.02 * lager.defizit + (lager.temp > 45 ? (lager.temp - 45) * 0.01 : 0); // Erwärmung zehrt Energie
    else nel -= 0.15 * silage.buttersaeure / 10 + (ernte.ts < 25 ? 0.1 : 0);
    const rp = st.rp - v.broeckel * leg * 1.5;
    const tsTrog = dm * (1 - lagerverlust / 100);
    const nelHa = tsTrog * 10 * nel; // MJ NEL/ha
    // Wettkampfpunkte: Energie im Trog, abgewertet für Fehlgärung bzw. schlechtes Heu und TS ausserhalb des Zielbereichs
    const gaerFaktor = [1, 0.95, 0.85, 0.7, 0.5][q.note - 1];
    const [zmin, zmax] = silo.ziel;
    const daneben = Math.max(0, zmin - ernte.ts, ernte.ts - zmax);
    const zielFaktor = 1 - Math.min(0.2, daneben * 0.01);
    const punkte = Math.round(nelHa * gaerFaktor * zielFaktor / 100);

    const res = {
      plan, ernte, silage, heu: lager, art: silo.art, note: q.note, lagerverlust, verlust: v, dm0, tsMahd: this.tsMahd, woMahd: this.woMahd,
      bodenAsche: this.bodenAsche, ereignisse: this.ereignisse, verlauf: this.verlauf,
      nel, rp, tsTrog, nelHa, punkte, verlustTotal: 100 - 100 * tsTrog / dm0,
    };
    res.faktoren = erklaere(res, this);
    return res;
  }
}

// Ganzer Plan auf einmal (Prognose, Tests). `schwaden` darf eine Liste sein (Heu: Nachtschwad, am Morgen wieder zetten); der letzte Schwad wird eingefahren
export function simuliere(plan, wetter) {
  const zetten = [...(plan.zetten ?? [])].sort((x, y) => x - y);
  const schwaden = [].concat(plan.schwaden).sort((x, y) => x - y);
  const fehler = pruefePlan(plan, zetten, schwaden, wetter.length);
  if (fehler) return { fehler };
  const f = new Feld(plan, wetter, plan.maehen);
  f.maehen();
  while (f.t < plan.ernte) {
    if (zetten.includes(f.t)) f.zettenJetzt();
    if (schwaden.includes(f.t)) f.schwaden();
    f.stunde();
  }
  return f.einfahren();
}

function pruefePlan(p, zetten, schwaden, n) {
  const letzter = schwaden[schwaden.length - 1];
  if (!(p.maehen >= 0 && p.ernte <= n)) return 'Zeitpunkte ausserhalb des Wetterzeitraums.';
  if (zetten.some((z) => z <= p.maehen)) return 'Zetten geht erst nach dem Mähen.';
  if (!schwaden.length || schwaden[0] <= p.maehen) return 'Schwaden muss nach dem Mähen kommen.';
  if (zetten.some((z) => z >= letzter)) return 'Nach dem letzten Schwaden wird nicht mehr gezettet.';
  if (p.ernte <= letzter) return 'Einfahren erst nach dem Schwaden.';
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

// --- Heu lagern: Lagerfähigkeit, Erwärmung, Nachtrocknung (Belüftung) und Qualität nach Sinnen
// Lehrmodell. Bewertung angelehnt an die Sinnenprüfung (Geruch, Farbe, Gefüge, Verunreinigung), Punkte vereinfacht.
export function lagereHeu(e, silo, v, rest, leg) {
  const ts = e.ts;
  const defizit = Math.max(0, silo.grenze - ts);
  let temp, belueftTage = 0;
  if (silo === SILOARTEN.belueftung) {
    // Kaltbelüftung mit Aussenluft: Dauer aus dem Wasser, das noch weg muss, und der Trockenheit der Luft (Tage danach)
    const tag = rest.filter((w) => w.rad > 0);
    const vpd = tag.length ? tag.reduce((a, w) => a + w.vpd, 0) / tag.length : 1.0;
    const wasser = 100 / ts - 100 / 87; // kg Wasser je kg TS bis lagerfähig
    belueftTage = wasser / (0.4 * clamp(vpd, 0.3, 2.5));
    temp = 22 + defizit * 3.5 + Math.max(0, belueftTage - 3) * 5;
  } else {
    temp = 22 + defizit * 4.8 + (silo === SILOARTEN.heuballen ? -3 * Math.min(1, defizit) : 0);
  }
  temp = Math.min(85, temp);
  const sv = {
    grund: silo.lagerverlust,
    erwaermung: defizit * 0.8 + Math.max(0, temp - 45) * 0.25 + Math.max(0, belueftTage - 3) * 1.5,
  };
  const lagerverlust = sv.grund + sv.erwaermung;
  // Sinnenprüfung: Abzüge von 100 Punkten
  const abzug = {
    geruch: Math.min(60, defizit * 5 + Math.max(0, temp - 40) * 0.6 + Math.max(0, belueftTage - 3) * 6),
    // Bodenheu braucht rund zwei Sonnentage auf trockenem Futter (ca. 35 MJ/m²); erst was darüber geht, bleicht sichtbar
    farbe: Math.min(25, Math.max(0, e.bleiche - 35) * 0.6 + e.regenTrocken * 2.5),
    gefuege: Math.min(25, Math.max(0, v.broeckel - 9) * (1 + 2 * leg)),
    verunreinigung: Math.min(30, Math.max(0, e.asche - 100) * 0.8),
  };
  const punkte = Math.round(clamp(100 - Object.values(abzug).reduce((a, x) => a + x, 0), 0, 100));
  const note = temp >= 70 ? 5 : punkte >= 90 ? 1 : punkte >= 72 ? 2 : punkte >= 52 ? 3 : punkte >= 30 ? 4 : 5; // Brandgefahr: verdorben
  const schimmel = defizit > 6 || belueftTage > 5 ? 'stark' : defizit > 2 || belueftTage > 3.5 ? 'leicht' : 'kein';
  return { defizit, temp, belueftTage, lagerverlust, sv, abzug, punkte, note, schimmel };
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
  const p = r.plan, e = r.ernte, s = r.silage, hq = r.heu, v = r.verlust, heu = r.art === 'heu';
  const stufe = (gut, mittel) => (gut ? 'gut' : mittel ? 'mittel' : 'schlecht');
  const z = (x, d = 1) => x.toFixed(d).replace('.', ',');
  const zahl = (x) => String(x).replace('.', ',');

  f.push({
    id: 'schnitthoehe', titel: 'Schnitthöhe', wert: `${zahl(p.schnitthoehe)} cm`,
    stufe: stufe(p.schnitthoehe >= 6.5 && p.schnitthoehe <= 8.5, p.schnitthoehe >= 5.5 && p.schnitthoehe <= 10.5),
    text: `Bei ${zahl(p.schnitthoehe)} cm kommen ${z(c.schnittAsche * c.bodenF, 0)} g Rohasche/kg TS durch Erde dazu` +
      (c.bodenF > 1 ? ' (Maulwurfshaufen verstärken das stark)' : '') +
      (Math.abs(c.ertragsF - 1) < 0.005 ? `. Der Ertrag entspricht dem Normalwert bei 7 cm. ` : `. Der Ertrag ist ${c.ertragsF >= 1 ? 'um ' + z((c.ertragsF - 1) * 100, 0) + ' % höher' : 'um ' + z((1 - c.ertragsF) * 100, 0) + ' % tiefer'} als bei 7 cm. `) +
      (p.schnitthoehe <= 5 ? 'Tiefe Stoppeln tragen das Schwad nicht: Zetter und Schwader greifen in den Boden, jeder Arbeitsgang bringt so mehr Erde ins Futter. Zudem fehlen Reservestoffe für den Wiederaustrieb. ' : '') +
      (p.schnitthoehe >= 8 ? 'Hohe Stoppeln schonen die Grasnarbe, tragen das Schwad und lassen es luftig liegen, sodass es etwas schneller trocknet. Jeder Zentimeter über 7 cm kostet aber rund 4 % Ertrag. ' : '') +
      (heu ? 'Erde macht Heu staubig, belastet die Atemwege der Tiere und bringt Clostridien-Sporen in den Stall, die über den Kot in die Milch gelangen können.'
        : 'Erde bringt Clostridien-Sporen ins Silo: Diese Bakterien bilden Buttersäure und gefährden die Käsereitauglichkeit der Milch.'),
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
        (p.aufbereiter === 'buerste' ? 'Zinkenrotor und Bürste rauen die Wachsschicht besonders stark auf, und das Futter wird breit verteilt. Es trocknet am schnellsten, ist bei Regen und Tau aber am empfindlichsten. ' : '') +
        (c.auf.broeckel > 1 && c.leg > 0.3 ? 'Bei kleereichem Futter schlagen Zinken die Blätter ab; ein Walzenaufbereiter ist schonender.' : '')) +
      ' In der ersten Phase direkt nach dem Mähen hilft der Aufbereiter wenig; die Breitablage ist wichtiger.',
  });

  f.push({
    id: 'breit', titel: 'Ablage', wert: p.breit || c.auf.breit ? 'Breitablage' : 'Schwadablage',
    stufe: stufe(p.breit || c.auf.breit || c.zetten.length > 0 && c.zetten[0] - p.maehen <= 2, c.zetten.length > 0),
    text: p.breit || c.auf.breit
      ? 'Das Futter liegt über die ganze Fläche verteilt. Sonne und Wind erreichen mehr Futter, deshalb ist die Trocknung am ersten Tag am schnellsten. ' +
        (heu ? 'Für Heu braucht es trotzdem zwei bis drei gute Tage; jede Stunde am ersten Tag zählt.' : 'So ist Silage oft am gleichen Tag erntereif.')
      : 'In der Mähschwade liegt das Futter dicht. Die Trocknung wird gebremst, bis gezettet wird. Wird erst spät gezettet, geht wertvolle Trocknungszeit am ersten Tag verloren.',
  });

  const zt = c.zetten.map((t) => uhr(t)).join(', ');
  f.push({
    id: 'zetten', titel: 'Zetten', wert: c.zetten.length ? `${c.zetten.length}× (${zt})` : 'nie',
    stufe: heu ? stufe(v.broeckel < 6 + 10 * c.leg && c.zetten.length > 0, v.broeckel < 10 + 15 * c.leg) : stufe(v.broeckel < 3 && (c.zetten.length > 0 || p.breit), v.broeckel < 5),
    text: (c.zetten.length ? 'Zetten lockert das Futter und dreht die feuchte Unterseite nach oben. Am wirksamsten ist es direkt nach dem Mähen. ' :
      heu ? 'Ohne Zetten bleibt die Unterseite feucht; für Heu reicht das nicht. ' : 'Ohne Zetten bleibt die Unterseite feucht; bei Breitablage und gutem Wetter reicht das für Silage oft. ') +
      (heu ? 'Bei Heu wird anfangs fleissig gezettet. Ab etwa 60 % TS werden die Blätter spröde: dann vorsichtig und lieber am Morgen, solange noch etwas Tau die Blätter zäh hält. ' : '') +
      (heu && (c.schwadZeiten?.length ?? 0) > 1 ? `Du hast ${c.schwadZeiten.length - 1}× einen Nachtschwad gemacht: Im Schwad nimmt das Futter über Nacht weniger Tau auf, jeder zusätzliche Durchgang kostet aber Blätter. ` : '') +
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
      `Zinkenhöhe (gemessen auf festem Boden): Zetter ${z(p.zetterHoehe)} cm, Schwader ${z(p.schwaderHoehe)} cm. Auf dem Feld sinken die Räder ein, auf nassem Boden stärker – die Zinken laufen tiefer als eingestellt. Unter etwa 2 cm reissen sie Erde mit. Das Schwad liegt auf den Stoppeln: Bei ${zahl(p.schnitthoehe)} cm Schnitthöhe bleibt ab etwa ${z(zinken(0, p.schnitthoehe).schwelle)} cm Zinkenhöhe Futter liegen. Hohe Stoppeln erlauben also eine höhere, sauberere Einstellung. ` +
      (heu ? 'Ab etwa 100 g/kg TS ist Heu sichtbar verschmutzt: Es staubt, die Tiere fressen es weniger gern, und Sporen gelangen in den Stall.'
        : 'Ab etwa 100 g/kg TS steigt die Gefahr einer Buttersäuregärung deutlich, besonders bei nassem Futter unter 35 % TS.'),
  });

  f.push({
    id: 'wetter', titel: 'Wetter auf dem Feld', wert: e.regenFeld > 0 ? `${z(e.regenFeld)} mm Regen, ${e.tauNaechte} ${e.tauNaechte === 1 ? 'Taunacht' : 'Taunächte'}` : `kein Regen, ${e.tauNaechte} ${e.tauNaechte === 1 ? 'Taunacht' : 'Taunächte'}`,
    stufe: heu ? stufe(e.regenFeld === 0 && e.bleiche <= 35, e.regenFeld < 3) : stufe(e.regenFeld === 0 && e.tauNaechte === 0, e.regenFeld < 3),
    text: (e.regenFeld > 0 ? `Regen auf angewelktes Futter macht Trocknungsfortschritte zunichte und wäscht Zucker und Mineralstoffe aus (${z(v.auswaschung)} % der TS). ` +
        (heu ? 'Bei fast trockenem Heu ist das am schlimmsten: Es laugt aus, wird grau und verliert Energie. ' : 'Zucker brauchen die Milchsäurebakterien später im Silo. ') : '') +
      (heu ? (e.tauNaechte > 0 ? `Heu liegt fast immer über Nacht (${e.tauNaechte}×). Der Tau feuchtet es wieder an; am Morgen muss er zuerst abtrocknen. Ein Nachtschwad nimmt weniger Tau auf. ` : '')
        + (e.bleiche > 35 ? `Die Sonne hat das trockene Futter lange beschienen (${z(e.bleiche, 0)} MJ/m²): Heu bleicht aus, Farbe und Carotin (Vorstufe von Vitamin A) gehen verloren. `
          : e.regenFeld === 0 ? 'Kein Regen und nicht zu lange an der Sonne: So bleibt Heu grün und aromatisch. ' : '')
        : e.tauNaechte > 0 ? 'Nachts nimmt das Futter Tau auf. Am Morgen muss dieses Wasser zuerst verdunsten, bevor die Trocknung weitergeht. Silage, die über Nacht liegt, verliert so Zeit und Zucker. ' : 'Das Futter lag keine Nacht im Tau: ideal für Silage. '),
  });

  f.push({
    id: 'atmung', titel: 'Feldliegezeit und Atmung', wert: `${e.stunden} h, ${z(v.atmung)} % TS veratmet`,
    stufe: stufe(v.atmung < 2, v.atmung < 4),
    text: `Die gemähten Pflanzen leben weiter und veratmen Zucker, bis sie etwa 60 % TS erreichen. Bei Wärme geht das schneller. Verlust: ${z(v.atmung)} % der TS, fast nur Zucker. ` +
      `Der Zuckergehalt sank von ${c.b.zucker} auf ${z(e.zucker, 0)} g/kg TS. ` +
      (heu ? 'Bei Heu gilt: am ersten Tag rasch über 60 % TS kommen, dann hört die Atmung auf. Danach kosten vor allem Bröckeln, Regen und Sonne.' : 'Darum: schnell anwelken und kurze Feldliegezeit, ideal unter 24 h.'),
  });

  const [zmin, zmax] = c.silo.ziel;
  if (heu) heuKarten(f, r, c, z);
  else f.push({
    id: 'ts', titel: 'TS beim Einfahren', wert: `${z(e.ts)} % (Ziel ${zmin}–${zmax} %)`,
    stufe: stufe(e.ts >= zmin && e.ts <= zmax, e.ts >= zmin - 5 && e.ts <= zmax + 7),
    text: e.ts < zmin
      ? `Zu nass. Unter ${zmin} % TS reicht der Zucker oft nicht, um den pH schnell genug zu senken; Clostridien haben leichteres Spiel` + (p.siloart === 'flachsilo' && e.ts < 28 ? ', zudem fliesst Sickersaft ab.' : '.')
      : e.ts > zmax
        ? `Zu trocken. ${p.siloart === 'flachsilo' ? 'Im Flachsilo lässt sich trockenes Futter schlecht verdichten: Luft bleibt drin, das Silo erwärmt sich beim Öffnen und es kommt zu Schimmel.' : 'Auch Ballen werden bei sehr trockenem Futter schlecht gepresst, und Stängel durchstechen die Folie.'} Zudem steigen die Bröckelverluste.`
        : 'Im Zielbereich: Die Milchsäurebakterien arbeiten gut, und das Futter lässt sich gut verdichten.',
  });

  if (!heu) f.push({
    id: 'fk', titel: 'Vergärbarkeit', wert: `FK ${z(s.fk, 0)}`,
    stufe: stufe(s.fk >= 45, s.fk >= 35),
    text: `Vergärbarkeitskoeffizient FK = TS + 8 × Zucker/Pufferkapazität = ${z(e.ts, 0)} + 8 × ${z(e.zucker, 0)}/${c.b.pk} = ${z(s.fk, 0)}. ` +
      'Ab FK 45 gilt Futter als sicher buttersäurefrei silierbar. ' +
      (c.leg > 0.3 ? 'Klee puffert stark (Eiweiss, Mineralstoffe) und hat wenig Zucker; er braucht deshalb mehr TS. ' : '') +
      (s.fk < 45 ? 'Abhilfe: stärker anwelken, Zucker schonen (kurze Feldliegezeit) oder ein geeignetes Siliermittel.' : ''),
  });

  if (!heu) f.push({
    id: 'gaerung', titel: 'Gärqualität', wert: `${s.dlg} DLG-Punkte, Note ${s.note}`,
    stufe: stufe(s.note <= 2, s.note === 3),
    text: `Buttersäure ${z(s.buttersaeure / 10, 2)} % TS, Essigsäure ${z(s.essigsaeure / 10, 1)} % TS, pH ${z(s.pH, 2)} (kritischer pH bei ${z(e.ts, 0)} % TS: ${z(s.pHkrit, 2)}), NH₃-N ${z(s.nh3, 0)} % vom Gesamt-N. ` +
      'Der DLG-Schlüssel bewertet die Silage im Nachhinein mit Laborwerten. Die Schweizer Praxis schaut eher auf den Prozess: Wurde alles richtig gemacht, damit die Silage gut werden musste? Die übrigen Knöpfe zeigen genau diese Prozessschritte.',
  });

  if (!heu) f.push({
    id: 'siloverlust', titel: 'Verluste im Silo', wert: `${z(s.siloverlust)} % TS`,
    stufe: stufe(s.siloverlust <= 8, s.siloverlust <= 12),
    text: `Gärung ${z(s.sv.gaerung)} %` + (s.sv.nacherwaermung > 0 ? `, Nacherwärmung ${z(s.sv.nacherwaermung)} %` : '') +
      (s.sv.sickersaft > 0 ? `, Sickersaft ${z(s.sv.sickersaft)} %` : '') + '. Schlechte Verdichtung, zu trockenes oder zu nasses Futter und Fehlgärungen erhöhen die Verluste.',
  });

  f.push({
    id: 'bilanz', titel: 'Bilanz Feld bis Trog', wert: `${z(r.verlustTotal, 0)} % Verlust, ${z(r.nel, 2)} MJ NEL/kg TS`,
    stufe: heu ? stufe(r.verlustTotal < 20, r.verlustTotal < 28) : stufe(r.verlustTotal < 15, r.verlustTotal < 22),
    text: `Gemäht: ${z(r.dm0 / 10)} dt TS/ha (Stadium ${c.st.name}, ${z(c.st.nel)} MJ NEL). Im Trog: ${z(r.tsTrog / 10)} dt TS/ha mit ${z(r.nel, 2)} MJ NEL und ${z(r.rp, 0)} g RP/kg TS = ${z(r.nelHa / 1000, 1)} GJ NEL/ha. ` +
      `Verluste: Atmung ${z(v.atmung)} %, Auswaschung ${z(v.auswaschung)} %, Bröckeln ${z(v.broeckel)} %, liegen gelassen ${z(v.liegen)} %, ${heu ? 'Lager' : 'Silo'} ${z(r.lagerverlust)} %.`,
  });
  // Ein Tipp je Karte: was beim nächsten Mal anders sein könnte
  const tipps = {
    schnitthoehe: p.schnitthoehe < 6 ? 'Stell das Mähwerk höher ein. Ab etwa 7 cm kommt kaum noch Erde ins Futter.'
      : p.schnitthoehe > 10 ? 'So hoch bleibt viel Ertrag stehen. 7 bis 8 cm sind meist ein guter Kompromiss.'
        : 'Gut gewählt: 7 bis 8 cm sind meist ein guter Kompromiss aus Ertrag und Sauberkeit.',
    tau: r.woMahd > 0.1 * r.dm0 ? 'Warte mit dem Mähen, bis der Tau abgetrocknet ist. Am Morgen ist das oft erst gegen 9 bis 10 Uhr.' : 'Weiter so: Mähe erst, wenn der Tau weg ist.',
    aufbereiter: c.auf.broeckel > 1 && c.leg > 0.4 ? 'Bei viel Klee den Walzenaufbereiter wählen. Er schont die Blätter.'
      : p.aufbereiter === 'ohne' ? 'Mit Aufbereiter wird das Futter in der zweiten Trocknungsphase schneller trocken, besonders bei Gras.'
        : 'Der Aufbereiter hilft erst nach dem ersten Anwelken. Am Anfang bringt die Breitablage mehr.',
    breit: p.breit || c.auf.breit ? 'Bleib bei der Breitablage, wenn du am gleichen Tag einfahren willst.' : 'Wähle die Breitablage oder zette gleich nach dem Mähen. Sonst bremst die dichte Schwade.',
    zetten: heu ? (v.broeckel > 8 ? 'Zette trockenes Heu (über 60 % TS) nur noch am Morgen mit etwas Tau, oder lass einen Durchgang weg. Die Blätter sind das Beste am Heu.'
      : !c.zetten.length ? 'Heu braucht Zetten: am ersten Tag gleich nach dem Mähen und nochmals am Nachmittag.' : 'Gut dosiert: genug gezettet, und die Blätter blieben dran.')
      : !c.zetten.length && !(p.breit || c.auf.breit) ? 'Zette einmal früh am Tag, damit auch die feuchte Unterseite abtrocknet.'
      : v.broeckel > 5 ? 'Zette nur, solange das Futter noch feucht ist (unter etwa 40 % TS). Trocken bröckelt es.' : 'Ein früher Durchgang genügt meist.',
    asche: e.asche > 100 ? 'Stell die Zinken höher ein (mindestens 3 cm) und mähe nicht tiefer als 6 cm. Auf nassem Boden besonders vorsichtig sein.' : 'Sauber gearbeitet: Die Zinken haben den Boden kaum berührt.',
    wetter: e.regenFeld > 0 ? (heu ? 'Heu braucht ein sicheres Wetterfenster von zwei bis drei Tagen. Reicht es nicht, rettet die Belüftung oder Silage das Futter.' : 'Schau den Wetterbericht an: Mähe später oder fahre früher ein, wenn Regen kommt.')
      : heu ? (e.bleiche > 35 ? 'Fahre ein, sobald das Heu lagerfähig ist. Jede weitere Sonnenstunde bleicht es aus.' : 'Gutes Wetterfenster genutzt.')
      : e.tauNaechte > 0 ? 'Fahre wenn möglich am gleichen Tag ein, dann liegt das Futter keine Nacht im Tau.' : 'Gutes Wetterfenster genutzt.',
    atmung: v.atmung >= 2 ? (heu ? 'Mähe am Morgen nach dem Abtrocknen, lege breit ab und zette gleich: So ist die Atmung am ersten Abend vorbei.' : 'Verkürze die Feldliegezeit: früh mähen, breit ablegen und am Abend einfahren.') : 'Kurze Feldliegezeit: Der Zucker blieb erhalten.',
    ts: heu ? (e.ts < zmin ? (p.siloart === 'belueftung' ? 'Fahre erst ab 60 % TS in die Belüftung ein, sonst schafft die Kaltluft das Nachtrocknen nicht rechtzeitig.' : 'Heu erst ab 85 % TS einlagern, und nie mit Tau: am Nachmittag einfahren. Reicht das Wetter nicht, wähle die Belüftung.')
      : e.ts > zmax ? 'Trockener als nötig: Früher einfahren spart Blätter.' : 'Lagerfähig eingefahren. Merke dir den Ablauf.')
      : e.ts < zmin ? 'Lass das Futter noch ein paar Stunden liegen oder zette einmal mehr.' : e.ts > zmax ? 'Fahre früher ein, sobald der Feuchtemesser den Zielbereich zeigt.' : 'Genau getroffen. Merke dir die Uhrzeit für das nächste Mal.',
    heuqualitaet: hq && hq.note > 2 ? 'Schau, wo die meisten Punkte verloren gingen: Geruch (zu feucht eingelagert), Farbe (Regen, zu lange Sonne), Blätter (zu oft trocken bearbeitet) oder Erde.' : 'Schönes Heu: grün, duftend, blattreich.',
    lager: hq && hq.temp >= 45 ? 'Miss die Temperatur im Heustock mit der Heusonde: ab 45 °C täglich, ab 60 °C die Feuerwehr verständigen.' : 'Kontrolliere frisches Heu in den ersten Wochen trotzdem regelmässig mit der Heusonde.',
    fk: s?.fk < 45 ? 'Welke stärker an und schone den Zucker mit einer kurzen Feldliegezeit.' : 'Gute Voraussetzung für eine saubere Gärung.',
    gaerung: s?.note > 2 ? 'Schau bei den roten Karten nach: Meistens liegt die Ursache bei Erde, zu nassem Futter oder zu wenig Zucker.' : 'Prima Gärung: Die Arbeitsschritte haben gepasst.',
    siloverlust: s?.siloverlust > 8 ? 'Achte auf gute Verdichtung und triff den TS-Zielbereich des Silos.' : 'Niedrige Verluste im Silo.',
    bilanz: r.verlustTotal >= 15 ? 'Die grössten Verluste stehen oben in der Aufstellung. Dort lohnt sich die Verbesserung zuerst.' : 'Wenig Verlust vom Feld bis in den Trog.',
  };
  for (const x of f) x.tipp = tipps[x.id];
  return f;
}

// Heu: TS beim Einlagern, Heuqualität (Sinnenprüfung) und Lagerung
function heuKarten(f, r, c, z) {
  const e = r.ernte, hq = r.heu, p = r.plan, [zmin, zmax] = c.silo.ziel;
  const stufe = (gut, mittel) => (gut ? 'gut' : mittel ? 'mittel' : 'schlecht');
  const belueft = p.siloart === 'belueftung';
  f.push({
    id: 'ts', titel: belueft ? 'TS beim Einführen' : 'TS beim Einlagern', wert: `${z(e.ts)} % (Ziel ${zmin}–${zmax} %)`,
    stufe: stufe(e.ts >= zmin, e.ts >= zmin - 4),
    text: belueft
      ? (e.ts < zmin ? `Zu nass für die Kaltbelüftung. Unter ${zmin} % TS muss die Luft so viel Wasser wegtragen, dass sich das Heu erwärmt und Schimmel bildet, bevor es trocken ist.`
        : e.ts > zmax ? 'Trockener als nötig. Die Belüftung hätte das Nachtrocknen übernommen; das Futter lag länger draussen und hat mehr Blätter verloren.'
          : 'Im Zielbereich: Das Futter ist angewelkt genug, die Belüftung trocknet es im Heustock auf über 85 % TS fertig.')
        + ' Mit der Belüftung kann früher eingeführt werden. Das spart einen Feldtag, Bröckelverluste und Wetterrisiko.'
      : (e.ts < zmin ? `Zu feucht eingelagert. Unter ${zmin} % TS arbeiten Bakterien und Pilze weiter: Das Heu erwärmt sich, wird muffig und schimmlig.` + (e.ts < 80 ? ' Unter 80 % TS kann sich ein Heustock bis zur Selbstentzündung erhitzen.' : '')
        : 'Lagerfähig: Über 85 % TS bleibt Heu ohne Belüftung stabil.')
        + (p.siloart === 'heuballen' ? ' Ballen sind dicht gepresst und geben Wärme schlecht ab; sie brauchen trockenes Futter.' : ''),
  });
  const a = hq.abzug, teile = [['Geruch', a.geruch], ['Farbe', a.farbe], ['Blätter und Gefüge', a.gefuege], ['Erde', a.verunreinigung]];
  f.push({
    id: 'heuqualitaet', titel: 'Heuqualität', wert: `${hq.punkte} Punkte, Note ${hq.note}`,
    stufe: stufe(hq.note <= 2, hq.note === 3),
    text: 'Gutes Heu riecht aromatisch, ist grünlich, blattreich und sauber. ' +
      `Abzüge: ${teile.map(([t, x]) => `${t} −${z(x, 0)}`).join(', ')}. ` +
      (a.geruch > 5 ? 'Muffiger Geruch heisst: Das Heu war beim Einlagern zu feucht oder trocknete zu langsam nach. ' : '') +
      (a.farbe > 5 ? 'Graues oder ausgebleichtes Heu war zu lange der Sonne ausgesetzt oder wurde verregnet. ' : '') +
      (a.gefuege > 5 ? 'Viele Blätter sind abgebrochen; zurück bleiben Stängel mit wenig Eiweiss. ' : '') +
      'Die Bewertung ist angelehnt an die Sinnenprüfung von Heu und für das Spiel vereinfacht.',
  });
  f.push({
    id: 'lager', titel: belueft ? 'Belüftung und Lager' : 'Lagerung und Erwärmung', wert: `${z(r.lagerverlust)} % TS, bis ${z(hq.temp, 0)} °C`,
    stufe: stufe(hq.temp < 40 && hq.schimmel === 'kein', hq.temp < 55),
    text: (belueft ? `Die Kaltbelüftung brauchte etwa ${z(hq.belueftTage, 1)} Tage bis lagerfähig. ${hq.belueftTage > 3 ? 'Das ist lang: Feuchte Luft nach dem Einführen oder zu nasses Futter verlängern die Belüftung, und Schimmel kann sich bilden. ' : 'Trockene Luft und gut angewelktes Futter machen es schnell. '}`
      : '') +
      `Im Lager wurde es bis etwa ${z(hq.temp, 0)} °C warm. ` +
      (hq.temp >= 70 ? 'Akute Brandgefahr! Ein feuchter Heustock kann sich selbst entzünden. ' : hq.temp >= 60 ? 'Ab 60 °C die Feuerwehr verständigen und den Stock nicht öffnen. ' : hq.temp >= 45 ? 'Ab 45 °C täglich mit der Heusonde messen. ' : 'Unbedenklich. ') +
      `Verluste im Lager: ${z(hq.sv.grund)} % normal${hq.sv.erwaermung > 0.05 ? `, ${z(hq.sv.erwaermung)} % durch Erwärmung und Schimmel` : ''}.` +
      (belueft ? ' Mehr zur Heubelüftung zeigt die App «Heutrocknung».' : ''),
  });
}

// Spielstand aus dem Protokoll der Arbeitsgänge wiederherstellen. Das Modell ist
// deterministisch: gleiche Einstellungen, gleiches Wetter, gleiche Arbeitsgänge ergeben denselben Stand.
export function spieleNach(setup, wetter, log, tEnde, start = 5) {
  const f = new Feld(setup, wetter, start);
  for (;;) {
    for (const a of log.filter((x) => x.t === f.t)) {
      if (a.art === 'maehen') f.maehen();
      else if (a.art === 'zetten') f.zettenJetzt();
      else if (a.art === 'schwaden') f.schwaden();
    }
    if (f.t >= tEnde || f.ende) break;
    f.stunde();
  }
  return f;
}

export function uhr(t) {
  const tag = Math.floor(t / 24) + 1, h = t % 24;
  return `Tag ${tag}, ${String(h).padStart(2, '0')}:00`;
}
