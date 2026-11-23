// Feldphase (stündlich) und Silierung.
// Einheiten: alles je m² Feldfläche in g (TS = Trockensubstanz, Wasser getrennt
// nach innerem Pflanzenwasser und Oberflächenwasser aus Tau und Regen).
// Trocknungskonstante nach Rotz & Chen (1985); die übrigen Ansätze sind
// vereinfachte Lehrmodelle (Quellen und offene Punkte: README.md).
import { Heustock, spieleBelueftungNach, STANDARD, ANLAGE, ERNSTFALL, LUEFTER, BOX, BETRIEB, EINGRIFF, NACHRUESTEN, PREISE, kosten, schuetthoeheUrteil } from './belueftung.js';
import { belueftungsWetter } from './weather.js';

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
  belueftung: { name: 'Belüftungsheu', art: 'heu', ziel: [60, 80], ernteverlust: 1.9, lagerverlust: 4, grenze: 60 },
  bodenheu: { name: 'Bodenheu (Heustock)', art: 'heu', ziel: [85, 95], ernteverlust: 2.0, lagerverlust: 5, grenze: 85 },
  heuballen: { name: 'Heuballen', art: 'heu', ziel: [85, 95], ernteverlust: 2.5, lagerverlust: 4, grenze: 85 },
};
export const istHeu = (siloart) => SILOARTEN[siloart]?.art === 'heu';

// Ablagebreite in % der Mähbreite (30–100). Ältere Einstellungen kennen nur breit/Schwade.
// Der Intensivaufbereiter mit Bürste legt immer breit ab (rund 85 %, FAT-Bericht 584).
export function ablageVon(p) {
  const a = p.ablage ?? (p.breit === false ? 35 : 85);
  return AUFBEREITER[p.aufbereiter]?.breit ? Math.max(a, 85) : a;
}
// Schwadfaktor (g TS je m² Ablage / g TS je m² Feld), kalibriert: 85 % → 1,0, Mähschwade 35 % → 1,7
export const schwadfaktor = (ablage) => (85 / ablage) ** KAL.ablage;

// Kalibrierung der Trocknung (siehe README und test/fat.mjs): k = Grundtempo, ablage = Wirkung der
// Ablagebreite, schub = Beschleunigung ab 55 % TS innen (Heu)
// broeckel = Massstab aller Bröckelverluste (FAT 2001: 55–118 kg TS/ha bei 32 dt TS/ha)
export const KAL = { k: 0.78, ablage: 0.9, schub: 0.5, broeckel: 0.4 };

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Zusätzliche Rohasche (g/kg TS) durch die Stoppelhöhe (effektiv, nach dem Mähen) und Ertragsfaktor (Ertrag bezieht sich auf 7 cm)
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
    this.ablage = ablageVon(setup);
    this.tsFrisch = setup.tsFrisch ?? this.st.ts; // TS des stehenden Bestandes (Versuchsnachbau: gemessen)
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
    if (this.phase === 'stehend') return 100 * this.tsFrisch / (100 + this.wo / (this.p.ertrag * 10) * this.tsFrisch);
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
    if (art === 'broeckel') g *= KAL.broeckel;
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
    this.wi = this.dm * (100 - this.tsFrisch) / this.tsFrisch;
    this.zucker = this.dm * b.zucker / 1000;
    this.asche = this.dm * (b.asche + this.schnittAsche * this.bodenF) / 1000;
    this.tsMahd = this.ts(); this.woMahd = this.wo; this.maehZeit = this.t;
    this.sd = schwadfaktor(this.ablage);
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
    dr *= KAL.k * sd ** -0.75 * (1 + 0.05 * (w.wind - 2));
    // Hohe Stoppeln: Futter liegt luftiger
    dr *= 1 + Math.max(0, this.p.schnitthoehe - 7) * 0.02;
    dr *= Math.max(0.2, 1 - this.wo / (0.3 * this.dm));
    // Heu: Ab etwa 55 % TS ist das Futter locker und dünn, Stängel und Blätter geben das Restwasser rascher ab
    // (kalibriert: Bodenheu bei gutem Wetter nach rund 2½ Tagen lagerfähig)
    dr *= 1 + KAL.schub * clamp((this.tsInnen() - 0.55) / 0.15, 0, 1);
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

  // Einfahren; bei Belüftungsheu rechnet der Standardbetrieb (oder plan.belueftung) die Belüftung im Heustock.
  // Nach der Spielphase «Am Heustock» bewertet `bewerte(lauf)` das Ergebnis mit dem gespielten Verlauf neu.
  einfahren() {
    if (this.phase !== 'schwad') return null;
    const { b, st, silo, leg, p } = this;
    const tsErnte = this.ts();
    this.ereignisse.push({ t: this.t, art: 'ernte', text: 'Einfahren', ts: tsErnte });
    this.verliere('liegen', this.dm * silo.ernteverlust / 100, 0);
    // Aufnehmen und Pressen: trockene Blätter brechen ab (mit Tau weniger)
    this.verliere('broeckel', this.dm * (leg * 4 * this.sproede(45, 20) + (silo.art === 'heu' ? (leg * 3 + 0.5) * this.sproede(70, 15) : 0)) / 100, 0);
    this.phase = 'geerntet';

    const dm = this.dm;
    const heu = silo.art === 'heu';
    const ernte = {
      dm, ts: tsErnte, zucker: 1000 * this.zucker / dm, asche: 1000 * this.asche / dm,
      stunden: this.t - this.maehZeit, regenFeld: this.regenFeld, regenStunden: this.regenStunden, tauNaechte: this.tauNaechte.size,
      bleiche: this.bleiche, regenTrocken: this.regenTrocken,
    };
    const plan = { ...p, maehen: this.maehZeit, zetten: this.zetten, schwaden: this.schwadZeit, schwadZeiten: this.schwadZeiten, ernte: this.t };
    this.eingefahren = { ernte, plan };
    let lauf = null;
    if (silo === SILOARTEN.belueftung) lauf = spieleBelueftungNach(this.heustockStart(), p.belueftungLog ?? [], Infinity, { ...STANDARD, ...p.belueftung }).ergebnis();
    return this.bewerte(lauf);
  }

  // Startwerte für den Heustock (Spielphase und Standardbetrieb); Wetter über die vier Tage hinaus verlängert
  heustockStart(optionen) {
    const p = this.p;
    return { dmFeld: this.dm / 1000, ts: this.eingefahren.ernte.ts, t0: this.t, wetter: belueftungsWetter(this.wetter), optionen,
      anlage: p.anlage, einfuellen: p.einfuellen, bestand: p.bestand, pannen: p.pannen };
  }

  // Lager, Energie, Punkte und Erklärungen; lauf = Ergebnis der Belüftung (nur Belüftungsheu)
  bewerte(lauf = null) {
    const { b, st, silo, leg } = this, { ernte, plan } = this.eingefahren;
    const dm = this.dm, dm0 = this.dm0, heu = silo.art === 'heu';
    const v = Object.fromEntries(Object.entries(this.verlust).map(([k, g]) => [k, 100 * g / dm0]));
    const silage = heu ? null : siliere(ernte, b, silo, plan);
    const lager = heu ? lagereHeu(ernte, silo, v, lauf, leg) : null;
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
    // Ernstfall am Heustock: Brand = null Punkte; rechtzeitig alarmiert = fester kleiner Wert (das Heu ist verloren, der Hof steht)
    const ende = lauf?.ende ?? null;
    const punkte = ende === 'brand' ? 0 : ende === 'abbruch' ? ABBRUCH_PUNKTE
      : Math.round(nelHa * GAERFAKTOR[q.note - 1] * zielFaktor(ernte.ts, silo.ziel) / 100);

    const res = {
      plan, ernte, silage, heu: lager, belueftung: lauf, ende, art: silo.art, note: q.note, lagerverlust, verlust: v, dm0, tsMahd: this.tsMahd, woMahd: this.woMahd,
      bodenAsche: this.bodenAsche, ereignisse: this.ereignisse, verlauf: this.verlauf,
      nel, rp, tsTrog, nelHa, punkte, verlustTotal: 100 - 100 * tsTrog / dm0,
    };
    res.faktoren = erklaere(res, this);
    return res;
  }
}

// Wettkampfpunkte = MJ NEL/ha im Trog × Gärfaktor (Note 1–5) × Zielfaktor / 100 (auch für den Rechenweg im Niveau Profi)
export const GAERFAKTOR = [1, 0.95, 0.85, 0.7, 0.5];
export function zielFaktor(ts, [zmin, zmax]) {
  const daneben = Math.max(0, zmin - ts, ts - zmax);
  return 1 - Math.min(0.2, daneben * 0.01);
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
// Belüftungsheu: lauf = simulierter Verlauf im Heustock (belueftung.js): Dauer, höchste Stocktemperatur, Schimmel,
// Strom. Was beim Spielende noch feucht ist, wird wie zu feucht eingelagertes Heu bewertet (Defizit zur Lagergrenze).
export const ABBRUCH_PUNKTE = 10; // Spielwert (keine Fachgrösse): Feuerwehr rechtzeitig alarmiert
export function lagereHeu(e, silo, v, lauf, leg) {
  const ts = e.ts;
  let defizit = Math.max(0, silo.grenze - ts);
  let temp, belueftTage = 0, lang = 0, schimmelIdx = 0;
  if (silo === SILOARTEN.belueftung && lauf) {
    // Haupttrocknung (feuchteste Schicht bis 80 % TS) innert 80 Stunden (LK Salzburg); jede weitere Stunde mit feuchtem Heu ist ein Risiko
    const haupt = lauf.hauptStunden ?? lauf.stunden;
    belueftTage = haupt / 24;
    defizit = lauf.lagerfaehig ? 0 : Math.max(0, ANLAGE.lagerTs - lauf.tsMinEnde);
    lang = Math.max(0, haupt - 80) / 24;
    schimmelIdx = lauf.schimmel;
    // Brand oder Abbruch: Es zählt die gemessene Spitze, nicht eine Hochrechnung für die Wochen danach
    temp = lauf.ende === 'brand' || lauf.ende === 'abbruch' ? lauf.tempMax : Math.max(22, lauf.tempMax, 22 + defizit * 4.8);
  } else {
    temp = 22 + defizit * 4.8 + (silo === SILOARTEN.heuballen ? -3 * Math.min(1, defizit) : 0);
  }
  temp = Math.min(85, temp);
  const sv = {
    grund: silo.lagerverlust,
    erwaermung: defizit * 0.8 + Math.max(0, temp - 45) * 0.25 + lang * 1.5 + Math.min(6, schimmelIdx * 2) + (lauf?.verlust ?? 0),
  };
  const verloren = lauf?.ende === 'brand' || lauf?.ende === 'abbruch'; // Brand oder von der Feuerwehr abgetragen: kein Heu mehr
  const lagerverlust = verloren ? 100 : sv.grund + sv.erwaermung;
  // Sinnenprüfung: Abzüge von 100 Punkten
  const abzug = {
    geruch: Math.min(60, defizit * 5 + Math.max(0, temp - 40) * 0.6 + lang * 6 + Math.max(0, schimmelIdx - 0.5) * 12),
    // Bodenheu braucht rund zwei Sonnentage auf trockenem Futter (ca. 35 MJ/m²); erst was darüber geht, bleicht sichtbar
    farbe: Math.min(25, Math.max(0, e.bleiche - 35) * 0.6 + e.regenTrocken * 2.5),
    gefuege: Math.min(25, Math.max(0, v.broeckel - 4) * (2.5 + 5 * leg)),
    verunreinigung: Math.min(30, Math.max(0, e.asche - 100) * 0.8),
  };
  const punkte = verloren ? 0 : Math.round(clamp(100 - Object.values(abzug).reduce((a, x) => a + x, 0), 0, 100));
  const note = verloren || temp >= 70 ? 5 : punkte >= 90 ? 1 : punkte >= 72 ? 2 : punkte >= 52 ? 3 : punkte >= 30 ? 4 : 5; // Brandgefahr: verdorben
  const schimmel = defizit > 6 || schimmelIdx >= 2 ? 'stark' : defizit > 2 || schimmelIdx >= 1 ? 'leicht' : 'kein';
  return { defizit, temp, belueftTage, lagerverlust, sv, abzug, punkte, note, schimmel, strom: lauf ? { kwh: lauf.kwh, kwhJeT: lauf.kwhJeT } : null };
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
    id: 'schnitthoehe', titel: 'Stoppelhöhe', wert: `${zahl(p.schnitthoehe)} cm`,
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
      ? `Beim Mähen war das Futter noch nass (TS ${z(r.tsMahd)} % statt ${z(c.tsFrisch)} %). Dieses Wasser muss zuerst verdunsten, erst dann trocknet die Pflanze selbst. Auf dem Boden im Schwad trocknet Tau viel langsamer ab als am stehenden Bestand.`
      : `Der Bestand war beim Mähen abgetrocknet (TS ${z(r.tsMahd)} %). Die Trocknung konnte sofort beginnen.`,
  });

  f.push({
    id: 'aufbereiter', titel: 'Aufbereitung', wert: c.auf.name,
    // Ohne Aufbereiter geht es auch (top agrar 2021), darum höchstens «geht besser»
    stufe: stufe(p.aufbereiter !== 'ohne' && !(c.auf.broeckel > 1 && c.leg > 0.4), true),
    text: 'Nach dem Schnitt schliessen sich die Spaltöffnungen (Stomata) innerhalb etwa einer Stunde, sobald die Pflanze Wasser verliert. Danach muss das Wasser durch die Wachsschicht (Kutikula) und über die Stängel nach aussen. ' +
      'Der Aufbereiter verletzt Wachsschicht und Stängel. Das beschleunigt genau diese zweite, langsame Phase; die Stomata hält er nicht offen. ' +
      (p.aufbereiter === 'ohne' ? 'Ohne Aufbereiter dauert das Anwelken länger, in Schweizer Versuchen rund einen Viertel. Mit breiter Ablage und frühem Zetten reicht es bei gutem Wetter trotzdem für Silage am gleichen Tag.' :
        `Die Kehrseite: Die verletzte Oberfläche nimmt Regen und Tau schneller auf, und mehr Zucker wird ausgewaschen (Faktor ${z(c.auf.kutikula)} gegenüber unbehandelt). ` +
        (p.aufbereiter === 'buerste' ? 'Zinkenrotor und Bürste rauen die Wachsschicht besonders stark auf, und das Futter wird breit verteilt. Es trocknet am schnellsten, ist bei Regen und Tau aber am empfindlichsten. ' : '') +
        (c.auf.broeckel > 1 && c.leg > 0.3 ? 'Bei kleereichem Futter schlagen Zinken die Blätter ab; ein Walzenaufbereiter ist schonender.' : '')) +
      ' In der ersten Phase direkt nach dem Mähen hilft der Aufbereiter wenig; die Breitablage ist wichtiger.',
    grafik: 'trocknung',
  });

  // Abwägung: schneller trocken gegen Leistung, Gewicht und Insekten (gemessene Werte, Quellen in versuche.js)
  const mitAuf = p.aufbereiter !== 'ohne';
  f.push({
    id: 'insekten', titel: 'Aufbereiter: Preis und Insekten', wert: mitAuf ? 'mehr Leistung, mehr tote Insekten' : 'insektenschonender',
    stufe: mitAuf ? 'mittel' : 'gut',
    text: (mitAuf ? 'Der Aufbereiter hat seinen Preis. ' : 'Ohne Aufbereiter trocknet das Futter langsamer, dafür schont die Mahd Tiere und Energie. ') +
      'In einem Versuch von Agroscope starben beim Mähen mit Rotationsmähwerk 37 % der Raupen auf der Fläche, mit Aufbereiter 69 %, mit dem Motormäher 20 % (Humbert et al. 2010). ' +
      'Der Aufbereiter quetscht das Futter und mit ihm die Tiere darin. ' +
      'top agrar mass 2021 bei einer 10-m-Kombination ohne Aufbereiter 61 kW, mit Aufbereiter 122 kW Antriebsleistung; die Aufbereiterkombination war zudem 2,1 t schwerer. ' +
      'Dafür verkürzt der Aufbereiter die Feldliegezeit um rund einen Viertel (FAT-Bericht 584). ' +
      'Auf BFF der Qualitätsstufe II und in vielen Vernetzungsprojekten ist der Aufbereiter verboten, zum Beispiel im Kanton Bern auf extensiv genutzten Wiesen in der Vernetzung.',
    grafik: 'insekten',
  });

  const breit = c.ablage >= 80, frueh = c.zetten.length > 0 && c.zetten[0] - p.maehen <= 2;
  f.push({
    id: 'breit', titel: 'Ablage', wert: `${c.ablage} % der Mähbreite`,
    stufe: stufe(breit || frueh, c.ablage >= 60 || c.zetten.length > 0),
    text: (breit
      ? 'Das Futter liegt über fast die ganze Fläche verteilt. Sonne und Wind erreichen mehr Futter, deshalb ist die Trocknung am ersten Tag am schnellsten. ' +
        (heu ? 'Für Heu braucht es trotzdem zwei bis drei gute Tage; jede Stunde am ersten Tag zählt.' : 'So ist Silage oft am gleichen Tag erntereif.')
      : c.ablage >= 60 ? 'Das Futter liegt recht breit, aber noch nicht auf der ganzen Fläche. Wo es dicker liegt, trocknet es langsamer. Früh zetten gleicht das aus.'
        : 'In der Mähschwade liegt das Futter dicht. Die Trocknung wird gebremst, bis gezettet wird. Wird erst spät gezettet, geht wertvolle Trocknungszeit am ersten Tag verloren.') +
      ' Als Breitablage gelten mindestens 80 % der Mähbreite. Im Versuch der FAT legten die Aufbereiter je nach Gerät 55 bis 85 % breit ab; die breiteste und gleichmässigste Ablage trocknete am schnellsten (FAT-Bericht 584).' +
      (frueh || breit ? '' : ' Zwei Stunden nach dem Mähen ist die Oberseite angetrocknet, unten ist das Futter noch so nass wie beim Mähen: Spätestens dann zetten.'),
    grafik: 'ablage',
  });

  const zt = c.zetten.map((t) => uhr(t)).join(', ');
  f.push({
    id: 'zetten', titel: 'Zetten', wert: c.zetten.length ? `${c.zetten.length}× (${zt})` : 'nie',
    stufe: heu ? stufe(v.broeckel < 3 + 4 * c.leg && c.zetten.length > 0, v.broeckel < 5 + 6 * c.leg) : stufe(v.broeckel < 1.5 && (c.zetten.length > 0 || breit), v.broeckel < 2.5),
    grafik: 'feldverluste',
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
    breit: breit ? 'Bleib bei der Breitablage, wenn du am gleichen Tag einfahren willst.' : 'Stell die Ablage auf mindestens 80 % der Mähbreite, oder zette spätestens zwei Stunden nach dem Mähen.',
    insekten: mitAuf ? 'Wäge ab: Wenn das Wetterfenster reicht, geht es auch ohne Aufbereiter – breit ablegen und früh zetten.' : 'Ohne Aufbereiter gilt umso mehr: breit ablegen und früh zetten.',
    zetten: heu ? (v.broeckel > 8 ? 'Zette trockenes Heu (über 60 % TS) nur noch am Morgen mit etwas Tau, oder lass einen Durchgang weg. Die Blätter sind das Beste am Heu.'
      : !c.zetten.length ? 'Heu braucht Zetten: am ersten Tag gleich nach dem Mähen und nochmals am Nachmittag.' : 'Gut dosiert: genug gezettet, und die Blätter blieben dran.')
      : !c.zetten.length && !breit ? 'Zette einmal früh am Tag, damit auch die feuchte Unterseite abtrocknet.'
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
    lager: r.belueftung ? (r.belueftung.lagerfaehig ? 'Kontrolliere den Stock trotzdem noch einige Wochen mit der Heusonde.' : 'Belüfte, bis die Abluft unter 50 % rF bleibt. Feucht eingelagertes Heu erwärmt sich weiter.')
      : hq && hq.temp >= 45 ? 'Miss die Temperatur im Heustock mit der Heusonde nach Messkalender: ab 45 °C erhöhte Aufmerksamkeit, ab 60 °C die örtliche Feuerwehr vorinformieren und alle fünf Stunden messen, ab 70 °C sofort alarmieren.' : 'Kontrolliere frisches Heu in den ersten Wochen trotzdem regelmässig mit der Heusonde: zuerst täglich, später seltener, insgesamt zwölf Wochen lang.',
    anlage: r.belueftung && r.belueftung.luftMin < 0.9 ? 'Wähle für hohe, nasse oder kleereiche Stöcke den starken Lüfter oder eine grössere Box, oder führe trockener ein.'
      : r.belueftung && !r.belueftung.anlage.dach ? 'Ein Warmdach lohnt sich: Die Sonne wärmt die Zuluft gratis vor.' : 'Die Anlage passte zur Menge.',
    einfuellen: r.belueftung && !r.belueftung.einfuellen.verteilen ? 'Verteile das Heu gleichmässig und locker, und löse verdichtete Stellen mit dem Greifer auf.'
      : r.belueftung?.einfuellen.start === 'danach' ? 'Lass den Lüfter schon beim Einfüllen laufen.' : 'Gut eingefüllt: gleichmässig, locker, Lüfter an.',
    lueften: r.belueftung ? (!r.belueftung.lagerfaehig || r.belueftung.hauptStunden == null || r.belueftung.hauptStunden > 80
      ? 'Führe das Futter trockener ein (ab 65 % TS) und lüfte, wenn die Luft trocken ist: am Tag, mit Warmluft vom Dach. Nachts hilft nur der Entfeuchter.'
      : r.belueftung.wasser > 0 && r.belueftung.kwh / r.belueftung.wasser > 0.3 ? 'Spare Strom: Lass den Lüfter nicht durchlaufen, wenn die Luft feucht ist. Im Intervall lüftet die Steuerung nur, wenn es etwas bringt.'
        : 'Gut belüftet: zur rechten Zeit und ohne Strom zu verschwenden.') : '',
    kontrolle: 'Miss in den ersten Tagen jeden Tag an allen Stellen. Ab 45 °C öfter, von 60 bis 70 °C alle fünf Stunden.',
    eingriffe: 'Schichte um, solange der Stock kühl ist (unter 60 °C). Einen heissen Stock öffnet nur die Feuerwehr.',
    kosten: 'Am meisten sparst du mit trocken eingeführtem Futter, Warmluft vom Dach und Lüften nur bei trockener Luft.',
    ernstfall: r.ende === 'brand' ? 'Miss feuchtes Heu jeden Tag mit der Heusonde. Ab 60 °C die Feuerwehr vorinformieren, ab 70 °C sofort alarmieren, und einen heissen Stock nie selbst öffnen.'
      : 'Richtig gehandelt. Damit es gar nicht so weit kommt: trockener einführen, den Lüfter nicht abstellen, solange das Heu feucht ist, und täglich messen.',
    fk: s?.fk < 45 ? 'Welke stärker an und schone den Zucker mit einer kurzen Feldliegezeit.' : 'Gute Voraussetzung für eine saubere Gärung.',
    gaerung: s?.note > 2 ? 'Schau bei den roten Karten nach: Meistens liegt die Ursache bei Erde, zu nassem Futter oder zu wenig Zucker.' : 'Prima Gärung: Die Arbeitsschritte haben gepasst.',
    siloverlust: s?.siloverlust > 8 ? 'Achte auf gute Verdichtung und triff den TS-Zielbereich des Silos.' : 'Niedrige Verluste im Silo.',
    bilanz: r.verlustTotal >= 15 ? 'Die grössten Verluste stehen oben in der Aufstellung. Dort lohnt sich die Verbesserung zuerst.' : 'Wenig Verlust vom Feld bis in den Trog.',
  };
  for (const x of f) x.tipp = tipps[x.id];

  // Niveau: ab welchem Niveau die Karte erscheint (einstieg | praxis | profi, siehe niveau.js). Im Einstieg
  // stehen nur die vier wichtigsten Karten, je mit einem einfachen Satz (kurz) ohne Abkürzungen.
  const ab = { ts: 'einstieg', asche: 'einstieg', wetter: 'einstieg', atmung: heu ? 'praxis' : 'einstieg', lager: 'einstieg', ernstfall: 'einstieg', lueften: 'einstieg', kosten: 'praxis' };
  const belueft = p.siloart === 'belueftung', zuNass = e.ts < zmin, zuTrocken = e.ts > zmax, t = hq?.temp ?? 0;
  const kurz = {
    ts: heu
      ? (zuNass ? (belueft ? 'Das Heu war noch zu feucht für die Belüftung. Es wird im Stock warm und kann schimmeln, bevor es trocken ist.'
        : 'Das Heu war noch zu feucht. Feuchtes Heu wird im Stock warm, riecht muffig und schimmelt.')
        : belueft && zuTrocken ? 'Trockener als nötig: Die Belüftung hätte den Rest getrocknet, und es wären mehr Blätter dran geblieben.'
          : 'Trocken genug eingelagert: So bleibt das Heu im Stock in Ordnung.')
      : zuNass ? 'Das Futter war beim Einfahren noch zu nass. Lass es nächstes Mal etwas länger trocknen, bis die Ampel grün ist.'
        : zuTrocken ? `Das Futter war zu trocken. ${p.siloart === 'flachsilo' ? 'Im Silo lässt es sich dann schlecht festdrücken, Luft bleibt drin und es schimmelt.' : 'Ballen lassen sich dann schlecht pressen.'} Fahre früher ein, sobald die Ampel grün ist.`
          : 'Genau richtig trocken eingefahren: So können die Milchsäurebakterien gut arbeiten.',
    asche: e.asche > 100
      ? (heu ? 'Es kam Erde ins Heu. Das macht es staubig, und die Tiere fressen es weniger gern. Mähe nicht zu tief und stell die Zinken höher.'
        : 'Es kam Erde ins Futter. Mit der Erde kommen Bakterien ins Silo, die stinkende Buttersäure bilden. Mähe nicht zu tief und stell die Zinken höher.')
      : 'Sauber gearbeitet: Es kam kaum Erde ins Futter.',
    wetter: e.regenFeld > 0
      ? `Regen hat das ${heu ? 'fast trockene Heu wieder nass gemacht und ausgewaschen' : 'Futter wieder nass gemacht und Zucker ausgewaschen'}. Schau vor dem Mähen gut auf den Wetterbericht.`
      : heu ? (e.bleiche > 35 ? 'Das Heu lag lange in der Sonne und ist ausgebleicht. Fahre ein, sobald es trocken genug ist.' : 'Kein Regen: So bleibt das Heu grün und duftet.')
        : e.tauNaechte > 0 ? 'Das Futter lag über Nacht im Tau. Am Morgen musste es zuerst wieder abtrocknen. Fahre wenn möglich am gleichen Tag ein.'
          : 'Kein Regen und keine Nacht im Tau: ideal für Silage.',
    atmung: v.atmung >= 2 ? `Das Futter lag ${e.stunden} Stunden auf dem Feld. Solange es liegt, verbraucht es Zucker. Mähe nach dem Tau, lege breit ab und fahre bald ein.`
      : 'Kurz auf dem Feld: Der Zucker blieb im Futter.',
    lueften: !r.belueftung ? '' : r.belueftung.lagerfaehig ? (r.belueftung.wasser > 0 && r.belueftung.kwh / r.belueftung.wasser > 0.3 ? 'Das Heu wurde trocken, aber der Lüfter lief oft bei feuchter Luft. Das kostet nur Strom.' : 'Der Lüfter hat das Heu trocken geblasen. Gut gemacht!')
      : 'Das Heu wurde nicht ganz trocken. Lüfte, wenn die Luft trocken ist, und fahre das Heu trockener ein.',
    ernstfall: r.ende === 'brand' ? 'Der Heustock wurde über 70 Grad heiss und hat gebrannt. Bei so heissem Heu sofort die Feuerwehr rufen und den Stock nie selbst öffnen.'
      : 'Der Heustock wurde gefährlich heiss. Du hast rechtzeitig die Feuerwehr gerufen: Das Heu ist weg, aber Scheune und Tiere sind sicher.',
    lager: t >= 70 ? 'Der Heustock wurde gefährlich heiss: Brandgefahr! Sofort die Feuerwehr alarmieren und den Stock nicht selbst abtragen.'
      : t >= 60 ? 'Der Heustock wurde sehr heiss. Jetzt die örtliche Feuerwehr informieren und alle fünf Stunden messen.'
        : t >= 45 ? 'Der Heustock wurde warm. Jetzt öfter mit der Heusonde messen.'
          : 'Der Heustock blieb kühl. Miss trotzdem regelmässig mit der Heusonde.',
  };
  const titelEinfach = { ts: heu ? 'Wie trocken eingelagert?' : 'Wie trocken eingefahren?', asche: 'Erde im Futter', wetter: 'Wetter', atmung: 'Zeit auf dem Feld', lager: 'Wärme im Heustock', ernstfall: r.ende === 'brand' ? 'Es hat gebrannt' : 'Feuerwehr gerufen', lueften: 'Lüften' };
  for (const x of f) { x.ab = ab[x.id] ?? 'praxis'; if (kurz[x.id]) { x.kurz = kurz[x.id]; x.titelEinfach = titelEinfach[x.id]; } }
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
        : 'Lagerfähig: Ab etwa 85 % TS (im Spiel) bleibt Heu ohne Belüftung stabil; fertig getrocknet ist es ab 87 bis 88 % TS.')
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
  const lauf = r.belueftung;
  if (lauf) belueftungsKarten(f, r, z);
  if (lauf && (lauf.ende === 'brand' || lauf.ende === 'abbruch')) ernstfallKarte(f, lauf, z);
  f.push({
    id: 'lager', titel: belueft ? 'Lager' : 'Lagerung und Erwärmung', wert: `${z(r.lagerverlust)} % Verlust, bis ${z(hq.temp, 0)} °C` + (hq.schimmel !== 'kein' ? `, Schimmel ${hq.schimmel}` : ''),
    stufe: stufe(hq.temp < 40 && hq.schimmel === 'kein' && (!lauf || lauf.lagerfaehig), hq.temp < 55),
    text: `Im Lager wurde es bis etwa ${z(hq.temp, 0)} °C warm. ` +
      (hq.temp >= 70 ? 'Akute Brandgefahr! Ein feuchter Heustock kann sich selbst entzünden: sofort die Feuerwehr alarmieren und den Stock nicht selbst abtragen. ' : hq.temp >= 60 ? 'Ab 60 °C die örtliche Feuerwehr vorinformieren und um Rat fragen, bis 70 °C alle fünf Stunden messen und den Stock nicht abtragen: Luft und Hitze führen zum Brand. Ab 70 °C sofort alarmieren. ' : hq.temp >= 45 ? 'Ab 45 °C erhöhte Aufmerksamkeit: öfter mit der Heusonde messen. ' : 'Unbedenklich. ') +
      (lauf ? (lauf.lagerfaehig ? `Nach ${z(lauf.stunden, 0)} Stunden war das Heu lagerfähig (Abluft unter 50 % rF). ` : lauf.ende === 'zeit' ? `Am Ende war die feuchteste Schicht erst bei ${z(lauf.tsMinEnde, 1)} % TS: Was so eingelagert bleibt, erwärmt sich weiter. ` : '') : '') +
      (hq.schimmel !== 'kein' ? `Schimmel: ${hq.schimmel}. Zu lange zu feucht, die Pilze konnten wachsen. ` : '') +
      (lauf && (lauf.ende === 'brand' || lauf.ende === 'abbruch') ? 'Der Verlust im Lager ist 100 % der Trockensubstanz: Vom Heu bleibt nichts. '
        : `Verlust im Lager (in % der eingelagerten Trockensubstanz): ${z(hq.sv.grund)} % normal${hq.sv.erwaermung > 0.05 ? `, ${z(hq.sv.erwaermung)} % durch Erwärmung, Schimmel${lauf?.ausgelagertT > 0 ? ', ausgelagertes Heu' : ''} und lange Belüftung` : ''}.`) +
      (belueft ? ' Mit eigenen Messwerten rechnet die App «Heutrocknung» (drywatch).' : ''),
  });
}

// ---------- Heubelüftung: Zeitstrahl und aufgeteilte Karten (Anlage, Einfüllen, Lüften, Kontrolle, Eingriffe, Kosten)
const tagZeit = (t) => uhr(t);
// Messkalender: in den ersten Tagen täglich (LK Salzburg S. 24). Gezählt werden die Belüftungstage mit mindestens einer Messung;
// dazu, wann das erste Problem (über 45 °C oder Nest) da war und wann es die Heusonde zeigte.
export function kontrolleVon(l) {
  const sonden = l.handlungen.filter((x) => x.art === 'sonde');
  const tage = Math.max(1, Math.ceil((l.tEnde - l.t0) / 24));
  const mitMessung = new Set(sonden.map((x) => Math.min(tage - 1, Math.floor((x.t - l.t0) / 24)))).size;
  const problem = l.wendepunkte.find((x) => (x.art === 'temp' && x.grenze >= 45) || x.art === 'nest') ?? null;
  // entdeckt: Messung an allen Stellen (ein Nest liegt nicht in der Mitte) oder eine, die die Temperatur zeigt
  const entdeckt = problem ? sonden.find((x) => x.t >= problem.t && (problem.art === 'nest' ? x.stellen === 3 : x.temp >= Math.min(45, problem.temp - 2))) ?? null : null;
  const uebersehen = sonden.filter((x) => x.stellen === 1 && (x.wahr - x.temp > 5 || x.tsMin - x.tsWahr > 5)).length; // nur Mitte gemessen, das Nest war woanders
  return { sonden, tage, mitMessung, problem, entdeckt, uebersehen };
}
// Zeitstrahl: eigene Handlungen und Wendepunkte in der Reihenfolge der Stunden
export function zeitstrahl(l, z = (x, d = 0) => x.toFixed(d).replace('.', ',')) {
  const k = kontrolleVon(l), e = [];
  const ef = l.einfuellen;
  e.push({ t: l.t0, art: 'handlung', stufe: !ef.verteilen || ef.start === 'danach' ? 'schlecht' : 'neutral',
    text: `Eingefüllt: ${z(l.tonnenEin, 1)} t mit ${z(l.tsEin)} % TS, ${ef.lagen === 2 ? 'erste von zwei Lagen, ' : ''}${ef.verteilen ? 'gleichmässig verteilt' : 'abgeladen, wie es kam'}, ${z(l.hoehe, 1)} m hoch. ${LUEFTER[l.anlage.luefter].name}${l.anlage.dach ? ', Warmluft vom Dach' : ', ohne Warmluft'}${l.anlage.entfeuchter ? ', Entfeuchter' : ''}.` });
  for (const h of l.handlungen) {
    const text = {
      schalter: () => (h.was === 'luefter' ? `Lüfter: ${BETRIEB[h.wert]}` : h.was === 'dach' ? `Warmluft vom Dach ${h.wert ? 'ein' : 'aus'}` : `Entfeuchter ${h.wert ? 'ein' : 'aus'}`),
      sonde: () => `Heusonde ${h.stellen === 1 ? 'nur in der Mitte' : 'an drei Stellen'}: wärmste Stelle ${z(h.temp)} °C, feuchteste Schicht ${z(h.tsMin)} % TS` + (h.stellen === 1 && h.wahr - h.temp > 5 ? ` – an einer anderen Stelle waren es ${z(h.wahr)} °C` : h.stellen === 1 && h.tsMin - h.tsWahr > 5 ? ` – an einer anderen Stelle erst ${z(h.tsWahr)} % TS` : ''),
      vorinfo: () => `Feuerwehr vorinformiert${h.temp < ERNSTFALL.vorinfo ? ' (der Stock war unter 60 °C)' : ''}`,
      alarm: () => `Feuerwehr alarmiert bei ${z(h.temp)} °C`,
      fehlalarm: () => `Fehlalarm: Feuerwehr alarmiert, der Stock hatte höchstens ${z(h.temp)} °C`,
      brandluft: () => `Heissen Stock (${z(h.temp)} °C) ${h.bei === 'umschichten' ? 'umgeschichtet' : 'abgetragen'}: Luft kam an das heisse Heu`,
      umschichten: () => `Umgeschichtet: wärmste Stelle ${z(h.tempVor)} → ${z(h.tempNach)} °C${h.luftNach - h.luftVor > 0.03 ? `, Luftmenge ${z(h.luftVor * 100)} → ${z(h.luftNach * 100)} %` : ''}`,
      nachfuellen: () => `Zweite Lage nachgefüllt, Stock ${z(h.hoeheVor, 1)} → ${z(h.hoeheNach, 1)} m${h.zuFrueh ? ` – zu früh, die untere Lage hatte erst ${z(h.tsUnten)} % TS` : ''}`,
      auslagern: () => `Oberste Lage ausgelagert (${z(h.kg / 1000 / (ANLAGE.zielTs / 100), 1)} t Heu)`,
      luefterHolen: () => `Stärkeren Lüfter bestellt (Luftmenge ${z(h.luft * 100)} % vom Soll)`,
      sicherung: () => 'Sicherung wieder eingeschaltet',
    }[h.art]?.();
    if (text) e.push({ t: h.t, art: 'handlung', stufe: ['brandluft', 'fehlalarm'].includes(h.art) || h.zuFrueh ? 'schlecht' : 'neutral', text });
  }
  for (const w of l.wendepunkte) {
    const ort = w.wo ? (w.wo === 'wartendes Heu' ? 'Wartendes Heu' : `Nest ${w.wo}`) : 'Stock';
    // Wurde das Problem gemessen? Nächste Messung nach dem Wendepunkt, die es zeigen konnte
    const gesehen = l.handlungen.find((x) => x.art === 'sonde' && x.t >= w.t && (w.art === 'nest' ? x.stellen === 3 : x.temp >= (w.grenze ?? 45) - 2));
    const mess = l.messenAuto || !(l.gespielt || l.handlungen.some((x) => x.art === 'sonde')) ? '' : gesehen ? `, gemessen ${gesehen.t === w.t ? 'in derselben Stunde' : `nach ${gesehen.t - w.t} h`}` : ', nicht gemessen';
    const text = {
      spaet: () => `Lüfter startet erst nach dem Einfüllen: ${EINGRIFF.sperre} Stunden ohne Luft`,
      temp: () => `${ort} über ${w.grenze} °C${w.grenze >= 45 ? mess : ''}`,
      nest: () => (w.feucht ? `Feuchtes Nest ${w.wo}: erst ${z(w.ts)} % TS, deutlich feuchter als der Rest${mess}` : `Nest ${w.wo}: ${z(w.temp)} °C, deutlich wärmer als der Rest${mess}`),
      luft: () => `Der Lüfter schafft nur ${z(w.anteil * 100)} % der Soll-Luftmenge`,
      luefterDa: () => 'Der stärkere Lüfter läuft',
      stromausfall: () => `Panne: Stromausfall${w.grund === 'gewitter' ? ' durch das Gewitter' : ''}, ${w.dauer} Stunden ohne Lüfter`,
      sicherung: () => 'Panne: Die Sicherung des Lüfters fällt',
      haupt: () => `Haupttrocknung geschafft nach ${w.t - l.t0} Stunden${w.t - l.t0 > 80 ? ' (Richtwert: 80)' : ''}`,
      lagerfaehig: () => `Lagerfähig nach ${w.t - l.t0} Stunden`,
      brand: () => 'Brand',
    }[w.art]?.();
    if (text) e.push({ t: w.t, art: 'wende', stufe: ['haupt', 'lagerfaehig', 'luefterDa'].includes(w.art) ? 'gut' : w.art === 'temp' && w.grenze < 45 ? 'neutral' : 'schlecht', text });
  }
  if (l.ende === 'zeit') e.push({ t: l.tEnde, art: 'wende', stufe: 'schlecht', text: `Zeit um: feuchteste Schicht ${z(l.tsMinEnde)} % TS${l.wartetNoch ? ', die zweite Lage wurde nie eingefüllt' : ''}` });
  return e.sort((a, b) => a.t - b.t).map((x) => ({ ...x, zeit: tagZeit(x.t), k }));
}

function belueftungsKarten(f, r, z) {
  const l = r.belueftung, hq = r.heu, a = l.anlage, ef = l.einfuellen;
  const stufe = (gut, mittel) => (gut ? 'gut' : mittel ? 'mittel' : 'schlecht');
  const urteil = schuetthoeheUrteil(l.hoeheMax, l.bestand), flaeche = l.flaeche;
  const nest = l.wendepunkte.find((x) => x.art === 'nest'), luftW = l.wendepunkte.find((x) => x.art === 'luft');
  // --- Anlage
  f.push({
    id: 'anlage', titel: 'Anlage', wert: `${LUEFTER[a.luefter].name}, ${z(l.luftMin * 100, 0)} % Luft, Box ${z(flaeche, 0)} m²`,
    stufe: stufe(l.luftMin >= 0.95 && (urteil === 'gut' || urteil === 'niedrig'), l.luftMin >= 0.8 && urteil !== 'zuHoch'),
    text: (l.luftMin >= 0.95 ? `Der ${LUEFTER[a.luefter].name} brachte die Soll-Luftmenge von ${z(ANLAGE.luft, 2)} m³/s je m² Stockfläche. `
      : `Der ${LUEFTER[a.luefter].name} schaffte gegen den Stock zeitweise nur ${z(l.luftMin * 100, 0)} % der Soll-Luftmenge (im Mittel ${z(l.luftMittel * 100, 0)} %). `) +
      `Die Box hat ${z(flaeche, 0)} m² für ${z(l.tonnenEin, 1)} t Heu: Der Stock wurde ${z(l.hoeheMax, 1)} m hoch. ` +
      { gut: 'Das liegt im Richtwert von 1 bis 2 m je Charge (Agroscope 2014). ', hoch: 'Das ist über dem Richtwert von 1 bis 2 m je Charge (Agroscope 2014); höchstens 3 m (LK Salzburg). ', zuHoch: 'Das ist zu hoch für eine Charge: höchstens 3 m, bei Klee und sehr jungem Futter 2 m (LK Salzburg). ', niedrig: 'Das ist unter 1 m: Bei so wenig Heu entweicht Luft ungenutzt (LK Salzburg). ' }[urteil] +
      'Je Meter Stockhöhe braucht es rund 160 Pa Druck, bei kleereichem Futter 240 Pa, bei nassem Heu mehr (LK Salzburg). ' +
      (a.dach ? 'Die Dachabsaugung wärmt die Zuluft an sonnigen Stunden vor. ' : 'Ohne Warmdach ist es eine reine Kaltbelüftung: Bei feuchtem Wetter dauert es lange. ') +
      (a.entfeuchter ? (l.kwhEntf > 0 ? `Der Entfeuchter brauchte ${z(l.kwhEntf, 0)} kWh. ` : 'Der Entfeuchter war vorhanden, lief aber nie. ') : '') +
      (l.nachgeruestet ? 'Der stärkere Lüfter wurde während der Belüftung nachgerüstet: Das kostet mehr als die Wahl im Voraus, und er fehlte einen Tag lang. ' : l.bestelltBei != null ? 'Der stärkere Lüfter war bestellt, kam aber nicht mehr rechtzeitig. ' : ''),
  });
  // --- Einfüllen
  f.push({
    id: 'einfuellen', titel: 'Einfüllen', wert: `${z(l.hoehe, 1)} m, ${ef.verteilen ? 'gleichmässig' : 'ungleich'}${ef.lagen === 2 ? ', zwei Lagen' : ''}`,
    stufe: stufe(ef.verteilen && ef.start === 'sofort' && urteil !== 'zuHoch' && urteil !== 'hoch' && !l.wartetNoch && !l.handlungen.some((x) => x.zuFrueh), (ef.verteilen || l.umgeschichtet > 0) && !l.wartetNoch),
    text: (ef.verteilen ? 'Das Heu wurde gleichmässig und locker verteilt: Die Luft geht überall gleich gut durch. '
      : `Das Heu wurde abgeladen, wie es kam: An der Abladestelle lag es höher und dichter. Die Luft nimmt den leichtesten Weg (Kamin), daneben bleibt ein feuchtes Nest${nest ? (nest.feucht ? ` – ${tagZeit(nest.t)} hatte es ${nest.wo} erst ${z(nest.ts, 0)} % TS` : ` – ${tagZeit(nest.t)} war es ${z(nest.temp, 0)} °C warm`) : ''}. ` + (l.umgeschichtet ? 'Das Umschichten hat das wieder ausgeglichen. ' : 'Verdichtete Stellen werden umströmt und verderben leicht (Agroscope 2014). ')) +
      (ef.start === 'danach' ? `Der Lüfter lief erst ${EINGRIFF.sperre} Stunden nach dem Einfüllen: In dieser Zeit atmet das feuchte Heu und erwärmt sich. Beim Beschicken soll der Ventilator schon laufen (Agroscope 2014). ` : 'Der Lüfter lief schon beim Einfüllen. ') +
      (ef.lagen === 2 ? (l.nachgefuelltBei != null ? `Die zweite Lage kam nach ${l.nachgefuelltBei - l.t0} Stunden dazu${l.nachgefuelltBei - l.t0 < EINGRIFF.nachfuellenAb ? ': früh. Nachgefüllt wird nach zwei bis drei schönen Belüftungstagen (FAT 1982)' : ''}. ` : 'Die zweite Lage wurde nie eingefüllt: Sie lag unbelüftet daneben und ist verdorben. ') +
        'Im Spiel muss die zweite Lage warten; in der Praxis mäht man dafür an zwei Tagen. ' : ''),
  });
  // --- Lüften
  const kwhKg = l.wasser > 0 ? l.kwh / l.wasser : 0, nutzlos = l.laufStunden > 0 ? l.nutzlos / l.laufStunden : 0;
  f.push({
    id: 'lueften', titel: 'Lüften', wert: `${z(l.laufStunden, 0)} h, ${z(l.kwhJeT, 0)} kWh/t, ${z(kwhKg, 2)} kWh/kg`,
    stufe: stufe(l.lagerfaehig && l.hauptStunden != null && l.hauptStunden <= 80 && kwhKg <= 0.3, l.lagerfaehig),
    grafik: 'belueftung', grafikDaten: l,
    text: belueftungText(l, hq, z) + (nutzlos > 0.15 ? `In ${z(nutzlos * 100, 0)} % der Laufstunden nahm die Luft kaum Wasser mit (unter 0,3 g je m³): Strom ohne Nutzen. ` : ''),
  });
  // --- Kontrolle (nur wo von Hand gemessen wird)
  const k = kontrolleVon(l);
  if (!l.messenAuto && (l.gespielt || k.sonden.length)) {
    f.push({
      id: 'kontrolle', titel: 'Kontrolle', wert: `${k.sonden.length} Messung${k.sonden.length === 1 ? '' : 'en'} an ${k.mitMessung} von ${k.tage} Tagen`,
      stufe: stufe(k.mitMessung >= k.tage && (!k.problem || k.entdeckt) && !k.uebersehen, k.mitMessung >= k.tage / 2 && (!k.problem || k.entdeckt)),
      text: `Du hast ${k.sonden.length}-mal mit der Heusonde gemessen, an ${k.mitMessung} von ${k.tage} Belüftungstagen. ` +
        'Der Heumesskalender verlangt in den ersten Tagen eine Messung täglich, mit Messstellen höchstens 1,5 m auseinander (LK Salzburg). ' +
        (k.problem ? `Das erste Problem war ${tagZeit(k.problem.t)} da (${k.problem.art === 'nest' ? `Nest ${k.problem.wo}` : `über ${k.problem.grenze} °C`}). ` + (k.entdeckt ? `Die Heusonde zeigte es ${k.entdeckt.t === k.problem.t ? 'sofort' : `${k.entdeckt.t - k.problem.t} Stunden später`}. ` : 'Mit der Heusonde wurde es nie gesehen. ') : 'Es gab nichts Auffälliges zu finden. ') +
        (k.uebersehen ? `${k.uebersehen}-mal wurde nur in der Mitte gemessen, während es an einer anderen Stelle über 5 °C wärmer war: Ein Nest findet nur, wer an genug Stellen misst. ` : '') +
        (l.vorinfoBei != null ? `Die Feuerwehr wurde ${tagZeit(l.vorinfoBei)} vorinformiert. ` : l.tempMax >= ERNSTFALL.vorinfo ? 'Über 60 °C hätte die Feuerwehr vorinformiert werden sollen. ' : '') +
        (l.fehlalarme ? 'Ein Fehlalarm: Vor dem Alarm lohnt sich die Messung. ' : ''),
    });
  }
  // --- Eingriffe (wenn eingegriffen wurde oder es nötig gewesen wäre)
  const ein = l.handlungen.filter((x) => ['umschichten', 'nachfuellen', 'auslagern', 'luefterHolen', 'sicherung', 'brandluft'].includes(x.art));
  const noetig = (nest && !l.umgeschichtet) || (luftW && l.bestelltBei == null && a.luefter !== 'stark');
  if (ein.length || (l.gespielt && noetig)) {
    const namen = { umschichten: 'Umschichten', nachfuellen: 'Nachfüllen', auslagern: 'Auslagern', luefterHolen: 'Lüfter holen', sicherung: 'Sicherung', brandluft: 'heissen Stock geöffnet' };
    f.push({
      id: 'eingriffe', titel: 'Eingriffe', wert: ein.length ? [...new Set(ein.map((x) => namen[x.art]))].join(', ') : 'keiner',
      stufe: stufe(ein.length > 0 && !noetig && !ein.some((x) => x.art === 'brandluft' || x.zuFrueh || (x.art === 'luefterHolen' && x.luft >= 0.95)), !ein.some((x) => x.art === 'brandluft')),
      text: (ein.length ? '' : 'Du hast nicht eingegriffen. ') + ein.map((x) => ({
        umschichten: () => `${tagZeit(x.t)} umgeschichtet: Kamine und Nester waren danach aufgelöst, die wärmste Stelle fiel von ${z(x.tempVor, 0)} auf ${z(x.tempNach, 0)} °C. Das kostet Arbeit und rund 1 % Bröckelverlust (Annahme). `,
        nachfuellen: () => `${tagZeit(x.t)} nachgefüllt, der Stock wuchs auf ${z(x.hoeheNach, 1)} m. ${x.zuFrueh ? 'Das war zu früh: Die untere Lage war noch feucht und trocknet unter der neuen Last langsamer. ' : 'Der Zeitpunkt passte. '}`,
        auslagern: () => `${tagZeit(x.t)} die oberste Lage ausgelagert: ${z(x.kg / 1000 / (ANLAGE.zielTs / 100), 1)} t weniger Lagerheu, dafür weniger Höhe und weniger Wasser im Stock. `,
        luefterHolen: () => `${tagZeit(x.t)} den stärkeren Lüfter geholt (bei ${z(x.luft * 100, 0)} % Luftmenge)${l.nachgeruestet ? `; er lief ${NACHRUESTEN.warteStunden} Stunden später` : '; er kam nicht mehr rechtzeitig'}. ${x.luft >= 0.95 ? 'Nötig war das nicht: Der Standardlüfter brachte die volle Luftmenge. ' : ''}`,
        sicherung: () => `${tagZeit(x.t)} die Sicherung wieder eingeschaltet. `,
        brandluft: () => `${tagZeit(x.t)} den ${z(x.temp, 0)} °C heissen Stock geöffnet: Das hat den Brand ausgelöst. Ab 60 °C darf ein Stock nie selbst abgetragen werden (LK Salzburg). `,
      }[x.art]())).join('') +
        (nest && !l.umgeschichtet ? `Das Nest ${nest.wo} (${tagZeit(nest.t)}) blieb bestehen: Umschichten hätte es aufgelöst, solange der Stock unter 60 °C war. ` : '') +
        (luftW && l.bestelltBei == null && a.luefter !== 'stark' ? `Der Lüfter schaffte ab ${tagZeit(luftW.t)} die Soll-Luftmenge nicht: Ein stärkerer Lüfter oder weniger Höhe hätten geholfen. ` : ''),
    });
  }
  // --- Kosten in Franken je Tonne Heu (neben den Punkten, nicht in ihnen)
  l.lagerverlust = r.lagerverlust; // für die Kosten: verlorenes Heu wie in der Bewertung
  const ko = kosten(l);
  r.kosten = ko;
  f.push({
    id: 'kosten', titel: 'Kosten', wert: `${z(ko.total, 0)} Fr. je t Heu`,
    stufe: stufe(ko.total <= 35, ko.total <= 70),
    text: `Die Belüftung kostete rund ${z(ko.total, 0)} Franken je Tonne eingefülltes Heu. ` +
      `Strom ${z(ko.strom, 0)} Fr. (${z(l.kwh, 0)} kWh zu ${z(ko.preise.strom, 2)} Fr.), Anlage ${z(ko.anlage, 0)} Fr., Arbeit ${z(ko.arbeit, 0)} Fr. (${z(l.arbeit, 1)} Stunden)` +
      (ko.miete > 0 ? `, Miete für den nachgerüsteten Lüfter ${z(ko.miete, 0)} Fr.` : '') + `, verlorenes Heu ${z(ko.verlust, 0)} Fr. ` +
      'Zum Vergleich: Die LK Salzburg rechnet für Kaltbelüftung und Dachabsaugung mit rund 22 bis 24 Euro je Tonne Heu, mit Entfeuchter 36 bis 39 Euro. ' +
      'Die Kosten zählen nicht für die Punkte. Strompreis, Stundenansatz und Miete sind Annahmen.',
  });
}

// Ernstfall: Brand oder Abbruch, mit der Kette der eigenen Handlungen (Messen, Vorinformieren, Alarm)
function ernstfallKarte(f, l, z) {
  const brand = l.ende === 'brand';
  const uhrT = (t) => uhr(t);
  const w70 = l.wendepunkte.find((x) => x.art === 'temp' && x.grenze === 70), w60 = l.wendepunkte.find((x) => x.art === 'temp' && x.grenze === 60);
  const offen = l.handlungen.find((x) => x.art === 'brandluft');
  const sonden = l.handlungen.filter((x) => x.art === 'sonde');
  const gesehen = sonden.find((x) => x.temp >= 60);
  f.push({
    id: 'ernstfall', titel: brand ? 'Brand im Heustock' : 'Abbruch: Feuerwehr alarmiert', wert: `bis ${z(l.tempMax, 0)} °C`,
    stufe: brand ? 'schlecht' : 'mittel',
    text: (brand
      ? (offen ? `Der Stock war ${z(offen.temp, 0)} °C heiss, als er geöffnet wurde: Luft kam an das heisse Heu, und es begann zu brennen. `
        : `Der Stock blieb über ${ERNSTFALL.alarm} °C, ohne dass die Feuerwehr alarmiert wurde: Das Heu hat sich selbst entzündet. `)
        + 'Heu, Scheune und oft auch der Stall sind verloren. '
      : 'Du hast die Feuerwehr gerufen, bevor es brannte. Sie hat den Stock kontrolliert abgetragen: Das Heu ist verloren, das Gebäude steht. ')
      + (w60 ? `Über 60 °C war der Stock ab ${uhrT(w60.t)}. ` : '') + (w70 ? `Über 70 °C ab ${uhrT(w70.t)}. ` : '')
      + (sonden.length ? `Du hast ${sonden.length}-mal mit der Heusonde gemessen${gesehen ? `; ${uhrT(gesehen.t)} zeigte sie ${z(gesehen.temp, 0)} °C` : ', aber nie über 60 °C gesehen'}. ` : 'Du hast nie mit der Heusonde gemessen. ')
      + (l.vorinfoBei != null ? `Die Feuerwehr war seit ${uhrT(l.vorinfoBei)} vorinformiert. ` : 'Die Feuerwehr war nicht vorinformiert. ')
      + 'Regel (LK Salzburg): ab 45 °C öfter messen, von 60 bis 70 °C alle fünf Stunden messen und den Stock nicht abtragen, ab 70 °C oder bei einer Mulde sofort alarmieren.',
  });
}

// Belüftung in Worten: Dauer, Wasser, Strom, Temperatur (Richtwerte: LK Salzburg; Agroscope 2014)
function belueftungText(l, hq, z) {
  const kwhKg = l.wasser > 0 ? l.kwh / l.wasser : 0;
  const haupt = l.hauptStunden;
  return (haupt != null ? `Die Haupttrocknung dauerte ${z(haupt, 0)} Stunden, bis auch die oberste Schicht 80 % TS hatte. ` : 'Die oberste Schicht erreichte nie 80 % TS: Die Haupttrocknung wurde nicht fertig. ') +
    (haupt != null && haupt <= 80 ? 'Das ist innert der 80 Stunden, die die LK Salzburg als Grenze nennt. ' : 'Die LK Salzburg verlangt, dass die Haupttrocknung innert 80 Stunden vorbei ist; was länger feucht bleibt, wird muffig. ') +
    (l.lagerfaehig ? `Nach ${z(l.stunden, 0)} Stunden war das Heu lagerfähig (Abluft unter 50 % rF). ` : `Am Ende hatte die feuchteste Schicht erst ${z(l.tsMinEnde, 1)} % TS. `) +
    `Der Lüfter lief ${z(l.laufStunden, 0)} Stunden und trug rund ${z(Math.round(l.wasser / 10) * 10, 0)} Liter Wasser aus ${z(l.tonnen, 1)} t Heu. ` +
    `Strom: ${z(l.kwh, 0)} kWh, also ${z(l.kwhJeT, 0)} kWh je Tonne Heu oder ${z(kwhKg, 2)} kWh je kg Wasser` + (l.kwhEntf > 0 ? `, davon ${z(l.kwhEntf, 0)} kWh für den Entfeuchter` : '') +
    '. Richtwerte der LK Salzburg: Kaltbelüftung um 0,25 kWh je kg Wasser, mit Dachabsaugung deutlich unter 0,2, mit Entfeuchter 0,26 bis 0,45. ' +
    (l.tempMax > 40 ? `Im Heu wurde es bis ${z(l.tempMax, 0)} °C warm: Über 35 °C muss belüftet werden, und 40 °C dürfen nie überschritten werden (LK Salzburg). ` : l.tempMax > 35 ? `Im Heu wurde es bis ${z(l.tempMax, 0)} °C warm: Ab 35 °C muss belüftet werden (LK Salzburg). ` : '') +
    (hq.schimmel !== 'kein' ? 'Zu lange zu feucht: Schimmelpilze konnten wachsen. ' : '') +
    `Zum Vergleich: Bei ${z(l.tsEin, 0)} % TS mussten je Tonne Heu ${z(1000 * (87 / l.tsEin - 1), 0)} kg Wasser weg (Agroscope 2014); 10 % mehr Feuchte verdoppeln diese Menge. `;
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
