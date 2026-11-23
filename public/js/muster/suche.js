// Musterlösungen für angemeldete Superuser (Konzept Heubelüftung, Abschnitt 11): deterministische Suche über die
// Entscheide einer Runde mit Belüftungsheu. Gleiches Wetter, gleiche Wiese, gleiches Niveau; gesucht werden
// Mähzeitpunkt, Aufbereiter, Zetten, Schwaden, Einführen, Anlage (soweit das Niveau sie wählen lässt) und der Betrieb
// des Lüfters. Raster mit Verfeinerung, kein Beweis des Optimums: Die Ergebnisse heissen «beste gefundene Variante».
// Wird erst nach bestätigter Sitzung nachgeladen (app.js) und steht nicht im Service-Worker-Cache (tools/seiten.mjs).
import { spieleNach, SILOARTEN } from '../model.js';
// Wie START in game.js (Tag 1, 05:00); nicht von dort importiert, weil game.js die Seite braucht (kein DOM im Worker)
const START = 5;

// Bedingung für die günstigste Variante (Annahme, Konzept 11: «Qualität mindestens gut»): lagerfähig am Ende der
// Belüftung, kein Schimmel, kein Brand oder Abbruch, Heuqualität Note 1 oder 2.
export const GUENSTIG_BEDINGUNG = { noteMax: 2, schimmel: 'kein' };
export const SUCHE_VERSION = 1;

const AUFBEREITER = ['walzen', 'ohne', 'zinken', 'buerste'];
const SONDE_UM = 8; // Heusonde täglich um 8 Uhr (Messkalender LK Salzburg: in den ersten Tagen täglich)

// Ein Plan ist ein normales Protokoll: Arbeitsgänge auf dem Feld (Stunden ab Tag 1, 00:00) und am Heustock
export function rechne(setup, wetter, plan) {
  const log = [{ t: plan.maehen, art: 'maehen' }, ...plan.zetten.map((t) => ({ t, art: 'zetten' })), { t: plan.schwaden, art: 'schwaden' }];
  const einst = { ...setup, ...plan.einstellungen, belueftung: plan.betrieb, belueftungLog: plan.heustockLog };
  const f = spieleNach(einst, wetter, log, plan.ernte, START);
  if (f.phase !== 'schwad' || f.t !== plan.ernte) return null;
  const res = f.einfahren();
  return res;
}

// Eine Runde (Plan eines Szenarios oder die eigene) als Suchplan: Feldzeiten, Einstellungen, Betrieb und Protokoll am Stock
export function planAusRunde(plan, { betrieb = null, heustockLog = null } = {}) {
  const schwaden = [].concat(plan.schwadZeiten ?? plan.schwaden);
  return {
    maehen: plan.maehen, zetten: [...plan.zetten], schwaden: schwaden[schwaden.length - 1], ernte: plan.ernte,
    einstellungen: { aufbereiter: plan.aufbereiter, schnitthoehe: plan.schnitthoehe, zetterHoehe: plan.zetterHoehe, schwaderHoehe: plan.schwaderHoehe, ablage: plan.ablage,
      ...(plan.anlage ? { anlage: plan.anlage } : {}), ...(plan.einfuellen ? { einfuellen: plan.einfuellen } : {}) },
    betrieb: { luefter: 'intervall', dach: plan.anlage?.dach !== false, entfeuchter: false, ...(plan.belueftung ?? {}), ...(betrieb ?? {}) },
    heustockLog: heustockLog ?? plan.belueftungLog ?? [],
  };
}

export function kennzahlen(res) {
  const l = res.belueftung;
  return {
    punkte: res.punkte, note: res.note, kosten: res.kosten?.total ?? Infinity, ende: l.ende, schimmel: res.heu.schimmel,
    tsEin: res.ernte.ts, verlust: res.verlustTotal, stunden: (res.kosten?.feldStunden ?? 0) + l.arbeit, lagerfaehig: l.lagerfaehig,
  };
}
export const erfuelltGuenstig = (k) => k.ende === 'lagerfaehig' && k.schimmel === GUENSTIG_BEDINGUNG.schimmel && k.note <= GUENSTIG_BEDINGUNG.noteMax;
// Vergleich, deterministisch: bei Gleichstand gewinnt der zuerst gefundene Plan
const besserBeste = (a, b) => !b || a.punkte > b.punkte || (a.punkte === b.punkte && a.kosten < b.kosten - 1e-9);
const besserGuenstig = (a, b) => erfuelltGuenstig(a) && (!b || a.kosten < b.kosten - 1e-9 || (Math.abs(a.kosten - b.kosten) <= 1e-9 && a.punkte > b.punkte));

// Heusonde täglich um 8 Uhr nach dem Einführen bis zum Spielende am Stock (10 Tage)
function sondenLog(ernte) {
  const log = [];
  let t = Math.floor(ernte / 24) * 24 + 24 + SONDE_UM;
  for (; t < ernte + 240; t += 24) log.push({ t, art: 'sonde', wert: 'alle' });
  return log;
}

// Kandidaten für das Einführen: Stunden 10–19 Uhr mit TS im Zielbereich der Belüftung (aus einem Probelauf ohne Schwad)
function ernteKandidaten(setup, wetter, maehen, zetten) {
  const log = [{ t: maehen, art: 'maehen' }, ...zetten.map((t) => ({ t, art: 'zetten' }))];
  const ende = Math.min(wetter.length - 2, maehen + 72);
  const f = spieleNach(setup, wetter, log, ende, START);
  const [zmin] = SILOARTEN.belueftung.ziel, out = [];
  const tage = new Map();
  for (const v of f.verlauf) {
    const t = v.t, h = t % 24;
    if (t < maehen + 6 || h < 10 || h > 19 || v.ts < zmin - 2 || v.ts > 85 || (wetter[t]?.regen ?? 0) > 0) continue;
    const d = Math.floor(t / 24);
    if (!tage.has(d)) tage.set(d, []);
    tage.get(d).push(t);
  }
  for (const liste of tage.values()) for (const i of [0, 2, 4]) if (liste[i] != null) out.push(liste[i]);
  return out.slice(0, 8);
}

// Zettmuster relativ zum Mähen: früh; früh und Nachmittag; dazu am Folgetag um 10 Uhr
function zettMuster(maehen) {
  const folgetag = Math.floor(maehen / 24) * 24 + 34;
  return [[maehen + 1], [maehen + 1, maehen + 5], [maehen + 1, maehen + 5, folgetag]];
}

/**
 * setup: Einstellungen der Runde (Wiese, Maschinen, Anlage, Einfüllen, Pannen); wetter: Stundenwetter der Runde
 * erlaubt: { anlage: ['luefter', 'dach', 'entfeuchter', 'box'] (was das Niveau wählen lässt), aufbereiter: true|false }
 * vorgaben: Pläne, die mindestens erreicht werden müssen (eigene Runde, Vorgabe eines Szenarios)
 * fortschritt(n): Rückmeldung für die Anzeige
 */
export function suche({ setup, wetter, erlaubt = {}, vorgaben = [], fortschritt = () => {} }) {
  const anlageBasis = { luefter: 'standard', dach: true, entfeuchter: false, box: 'passend', ...(setup.anlage ?? {}) };
  const einfBasis = { lagen: 1, verteilen: true, start: 'sofort' };
  const hatDach = (a) => a.dach !== false, hatEntf = (a) => !!a.entfeuchter;
  let n = 0, beste = null, guenstig = null;
  const gesehen = new Set();
  const pruefe = (plan) => {
    const schluessel = JSON.stringify(plan);
    if (gesehen.has(schluessel)) return null;
    gesehen.add(schluessel);
    if (!(plan.zetten.every((t) => t > plan.maehen && t < plan.schwaden) && plan.schwaden > plan.maehen && plan.ernte > plan.schwaden && plan.ernte < wetter.length - 1)) return null;
    const res = rechne(setup, wetter, plan);
    n++;
    if (n % 20 === 0) fortschritt(n);
    if (!res || res.fehler) return null;
    const k = kennzahlen(res), e = { plan, k };
    if (besserBeste(k, beste?.k)) beste = e;
    if (besserGuenstig(k, guenstig?.k)) guenstig = e;
    return e;
  };
  const planVon = (o) => {
    const a = { ...anlageBasis, ...(o.anlage ?? {}) };
    return {
      maehen: o.maehen, zetten: o.zetten, schwaden: o.schwaden ?? o.ernte - 2, ernte: o.ernte,
      einstellungen: { aufbereiter: o.aufbereiter ?? setup.aufbereiter, schnitthoehe: o.schnitthoehe ?? 7, zetterHoehe: 3, schwaderHoehe: 3, ablage: 85, anlage: a, einfuellen: einfBasis },
      betrieb: { luefter: o.luefter ?? 'intervall', dach: hatDach(a), entfeuchter: hatEntf(a) && !!o.entfeuchterEin },
      heustockLog: sondenLog(o.ernte),
    };
  };
  // Vorgaben zuerst: Die Musterlösung ist nie schlechter als sie
  for (const v of vorgaben) pruefe(v);

  // Stufe 1: Raster über Mähzeitpunkt, Aufbereiter, Zetten und Einführen, mit der Basisanlage
  const aufb = erlaubt.aufbereiter === false ? [setup.aufbereiter] : [...new Set([setup.aufbereiter, 'walzen', 'ohne'])];
  const kandidaten = [];
  for (let d = 0; d < 3; d++) {
    for (const h of [9, 10, 11, 13]) {
      const maehen = d * 24 + h;
      if (maehen < START + 1 || (wetter[maehen]?.regen ?? 0) > 0) continue;
      for (const aufbereiter of aufb) {
        for (const zetten of zettMuster(maehen)) {
          const s = { ...setup, aufbereiter, ablage: 85, schnitthoehe: 7, zetterHoehe: 3, schwaderHoehe: 3 };
          for (const ernte of ernteKandidaten(s, wetter, maehen, zetten)) {
            const e = pruefe(planVon({ maehen, aufbereiter, zetten: zetten.filter((t) => t < ernte - 2), ernte }));
            if (e) kandidaten.push(e);
          }
        }
      }
    }
  }

  // Stufe 2: Verfeinerung der besten Kandidaten (Anlage, Betrieb, Aufbereiter, Zeiten), bis nichts mehr besser wird
  const anlageWahl = [];
  const felder = erlaubt.anlage ?? [];
  const opt = { luefter: ['standard', 'stark'], dach: [true, false], entfeuchter: [false, true], box: ['passend', 'klein', 'gross'] };
  const kombis = (i, acc) => {
    if (i === felder.length) { anlageWahl.push(acc); return; }
    for (const w of opt[felder[i]]) kombis(i + 1, { ...acc, [felder[i]]: w });
  };
  kombis(0, {});
  const nachbarn = (plan) => {
    const o = { maehen: plan.maehen, zetten: plan.zetten, ernte: plan.ernte, schwaden: plan.schwaden, aufbereiter: plan.einstellungen.aufbereiter, anlage: plan.einstellungen.anlage,
      luefter: plan.betrieb.luefter, entfeuchterEin: plan.betrieb.entfeuchter, schnitthoehe: plan.einstellungen.schnitthoehe };
    const out = [];
    for (const a of anlageWahl) out.push({ ...o, anlage: { ...o.anlage, ...a } });
    for (const luefter of ['intervall', 'dauer']) for (const entfeuchterEin of [false, true]) out.push({ ...o, luefter, entfeuchterEin });
    for (const dt of [-2, -1, 1, 2]) out.push({ ...o, ernte: o.ernte + dt, schwaden: o.schwaden + dt, zetten: o.zetten.filter((t) => t < o.schwaden + dt) });
    for (const dt of [-1, 1]) out.push({ ...o, schwaden: o.schwaden + dt });
    if (erlaubt.aufbereiter !== false) for (const aufbereiter of AUFBEREITER) out.push({ ...o, aufbereiter });
    out.push({ ...o, schnitthoehe: o.schnitthoehe === 7 ? 8 : 7 });
    return out.map(planVon);
  };
  for (let runde = 0; runde < 4; runde++) {
    const vorher = [beste?.plan, guenstig?.plan].map((p) => JSON.stringify(p));
    const start = [beste, guenstig].filter(Boolean);
    // dazu die besten drei aus Stufe 1 nach Punkten (nur in der ersten Runde), damit nicht ein einziger Ast zählt
    if (runde === 0) start.push(...kandidaten.slice().sort((x, y) => y.k.punkte - x.k.punkte).slice(0, 3));
    for (const e of start) for (const p of nachbarn(e.plan)) pruefe(p);
    if (vorher[0] === JSON.stringify(beste?.plan) && vorher[1] === JSON.stringify(guenstig?.plan)) break;
  }
  fortschritt(n);
  return { beste, guenstig, gerechnet: n, version: SUCHE_VERSION };
}
