// Bedienung am Heustock: Heusonde, Feuerwehr, Brand und Abbruch; später Kennlinie, Säulen, Eingriffe.
//   docker run --rm --user 1000:1000 -v "$PWD":/app -w /app node:22-alpine node test/bedienung.mjs
import { Heustock, spieleBelueftungNach, STANDARD, ERNSTFALL } from '../public/js/belueftung.js';
import { spieleNach } from '../public/js/model.js';
import { stundenwetter } from '../public/js/weather.js';
import { WETTER, PROGNOSEN } from '../public/js/scenarios.js';

let fehler = 0;
export const pruefe = (name, ok, text = '') => { if (!ok) fehler++; console.log(`${ok ? 'OK     ' : 'FEHLER '} ${name}${text ? ': ' + text : ''}`); };
export const gleich = (a, b) => a.t === b.t && Math.abs(a.tsMittel() - b.tsMittel()) < 1e-9 && Math.abs(a.kwh - b.kwh) < 1e-9 && Math.abs(a.tempJetzt() - b.tempJetzt()) < 1e-9;

// Eingefahrenes Feld eines Szenarios (Feldphase wie in der Wette)
export function feldVon(id, plan = {}) {
  const p = PROGNOSEN.find((x) => x.id === id);
  const pl = { ...p.plan, ...plan };
  const log = [{ t: pl.maehen, art: 'maehen' }, ...pl.zetten.map((t) => ({ t, art: 'zetten' })), ...[pl.schwaden].flat().map((t) => ({ t, art: 'schwaden' }))];
  const f = spieleNach(pl, stundenwetter(WETTER.find((w) => w.id === p.wetter)), log, pl.ernte);
  f.res = f.einfahren();
  return f;
}

// ---------- 1. Ernstfall: Lüfter aus, feuchtes Heu
{
  const f = feldVon('heugewitter'), start = f.heustockStart();
  const aus = [{ t: start.t0, art: 'luefter', wert: 'aus' }];
  const brand = spieleBelueftungNach(start, aus);
  const rb = brand.ergebnis();
  pruefe('Brand ohne Alarm', rb.ende === 'brand' && rb.tempMax >= ERNSTFALL.alarm, `Ende ${rb.ende} nach ${rb.tEnde - rb.t0} h, bis ${rb.tempMax.toFixed(0)} °C`);
  const bew = f.bewerte(rb);
  pruefe('Brand: null Punkte, Karte vorhanden', bew.punkte === 0 && bew.note === 5 && bew.faktoren.some((x) => x.id === 'ernstfall') && bew.faktoren.every((x) => x.tipp && !/undefined|NaN/.test(x.text + x.wert)), `Punkte ${bew.punkte}`);
  const t70 = rb.wendepunkte.find((x) => x.grenze === 70).t, t60 = rb.wendepunkte.find((x) => x.grenze === 60).t;
  pruefe('Wendepunkte 35/40/45/60/70', [35, 40, 45, 60, 70].every((g) => rb.wendepunkte.some((x) => x.grenze === g)), `60 °C nach ${t60 - rb.t0} h, 70 °C nach ${t70 - rb.t0} h`);

  // Messen, vorinformieren, alarmieren: Abbruch statt Brand
  const log = [...aus, { t: t60 + 1, art: 'sonde' }, { t: t60 + 1, art: 'vorinfo' }, { t: t70 + 1, art: 'sonde' }, { t: t70 + 1, art: 'alarm' }];
  const ab = spieleBelueftungNach(start, log), ra = ab.ergebnis();
  pruefe('Abbruch nach Alarm', ra.ende === 'abbruch' && ra.messungen === 2 && ra.vorinfoBei === t60 + 1, `Ende ${ra.ende}, ${ra.messungen} Messungen`);
  const bewA = f.bewerte(ra);
  pruefe('Abbruch: fester kleiner Wert', bewA.punkte > 0 && bewA.punkte <= 20 && bewA.faktoren.every((x) => x.tipp), `Punkte ${bewA.punkte}`);

  // Fehlalarm bei kühlem Stock: Runde läuft weiter
  const fa = spieleBelueftungNach(start, [{ t: start.t0 + 5, art: 'alarm' }]).ergebnis();
  pruefe('Fehlalarm beendet nicht', fa.ende === 'lagerfaehig' || fa.ende === 'zeit', `Ende ${fa.ende}, Fehlalarme ${fa.fehlalarme}`);

  // Fortsetzen: Protokoll bis t nachspielen = direkt gespielter Stand, auch mit Handlungen in der letzten Stunde
  const direkt = new Heustock(start), e = { ...STANDARD };
  const bis = t60 + 1;
  while (direkt.t <= bis) { for (const x of log) if (x.t === direkt.t) { if (['luefter', 'dach', 'entfeuchter'].includes(x.art)) e[x.art] = x.wert; else direkt.handle(x); } if (direkt.t === bis) break; direkt.stunde(e); }
  const nach = spieleBelueftungNach(start, log, bis);
  pruefe('Ernstfall nachspielen identisch', gleich(direkt, nach) && nach.gemessen?.t === bis && nach.vorinfoBei === bis, `t ${nach.t}, gemessen ${nach.gemessen?.t}`);
  // Messen verändert den Stock nicht
  const ohne = spieleBelueftungNach(start, aus, bis);
  pruefe('Messen verändert nichts', gleich(ohne, nach));
}

// ---------- 2. Standardbetrieb bleibt ohne Ernstfall
{
  const r = feldVon('taenikon').res;
  pruefe('Tänikon endet lagerfähig', r.belueftung.ende === 'lagerfaehig' && r.ende === 'lagerfaehig', `${r.belueftung.stunden} h, ${r.punkte} Punkte`);
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('bedienung.mjs')) { console.log(fehler ? `${fehler} FEHLER` : 'Alle Prüfungen bestanden'); process.exitCode = fehler ? 1 : 0; }
