// Bedienung am Heustock: Heusonde, Feuerwehr, Brand und Abbruch; später Kennlinie, Säulen, Eingriffe.
//   docker run --rm --user 1000:1000 -v "$PWD":/app -w /app node:22-alpine node test/bedienung.mjs
import { Heustock, spieleBelueftungNach, STANDARD, ERNSTFALL, ANLAGE, EINGRIFF, NACHRUESTEN, luefterDruck, druckSchaetzung, kosten, pannenAus } from '../public/js/belueftung.js';
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

// ---------- 3. Lüfterkennlinie und Stockwiderstand
{
  const A = { luefter: 'standard', dach: true, entfeuchter: false, box: 'passend' };
  pruefe('Kennlinie fällt mit der Luftmenge', [0.02, 0.05, 0.08, 0.11, 0.14].every((v, i, a) => i === 0 || luefterDruck('standard', v) < luefterDruck('standard', a[i - 1])) && luefterDruck('stark', 0.11) > luefterDruck('standard', 0.11),
    `Standard ${luefterDruck('standard', 0.11).toFixed(0)} Pa, stark ${luefterDruck('stark', 0.11).toFixed(0)} Pa bei 0,11 m³/s·m²`);
  const d = druckSchaetzung({ hoehe: 3, bestand: 'ausgewogen', ts: 65, dach: false });
  pruefe('Druckbedarf 160 Pa je Meter (LK Salzburg)', Math.abs(d.stock - 480) < 1 && Math.abs(druckSchaetzung({ hoehe: 3, bestand: 'klee', ts: 65, dach: true }).bedarf - (720 + 120)) < 1, `${d.stock.toFixed(0)} Pa bei 3 m`);
  // Standardfall: volle Soll-Luftmenge, exakt wie bisher
  const f = feldVon('heugewitter'), s0 = f.heustockStart();
  const std = new Heustock({ ...s0, anlage: A });
  pruefe('Standardstock: Soll-Luftmenge', std.luftmengen().mittel === ANLAGE.luft && Math.abs(std.hoehe - s0.dmFeld * 10000 / 25 / 78) < 1e-9, `${std.hoehe.toFixed(2)} m, ${std.luftmengen().druck.toFixed(0)} Pa`);
  // Kleine Box, viel kleereiches Futter: Der Standardlüfter schafft den Sollwert nicht, der starke schon eher
  const fk = feldVon('heugewitter', { ertrag: 45, bestand: 'klee' }), sk = fk.heustockStart();
  const klein = new Heustock({ ...sk, anlage: { ...A, box: 'klein' } }), stark = new Heustock({ ...sk, anlage: { ...A, box: 'klein', luefter: 'stark' } });
  pruefe('Hoher Kleestock: Luftmenge bricht ein', klein.luftmengen().anteil < 0.9 && stark.luftmengen().anteil > klein.luftmengen().anteil,
    `${klein.hoehe.toFixed(1)} m: Standard ${(klein.luftmengen().anteil * 100).toFixed(0)} %, stark ${(stark.luftmengen().anteil * 100).toFixed(0)} % vom Soll`);
  // Betriebspunkt liegt auf der Kennlinie
  const L = klein.luftmengen();
  pruefe('Betriebspunkt auf der Kennlinie', Math.abs(luefterDruck('standard', L.mittel) - klein.zuschlag(L.mittel) - L.druck) < 2, `${L.druck.toFixed(0)} Pa bei ${L.mittel.toFixed(3)} m³/s·m²`);
  // Nachrüsten: Der starke Lüfter läuft erst nach der Wartezeit
  const log = [{ t: sk.t0 + 2, art: 'luefterHolen' }];
  const vor = spieleBelueftungNach({ ...sk, anlage: { ...A, box: 'klein' } }, log, sk.t0 + 2 + NACHRUESTEN.warteStunden);
  const nachher = spieleBelueftungNach({ ...sk, anlage: { ...A, box: 'klein' } }, log, sk.t0 + 3 + NACHRUESTEN.warteStunden);
  pruefe('Lüfter nachrüsten mit Wartezeit', vor.luefter === 'standard' && nachher.luefter === 'stark' && nachher.luftmengen().anteil > vor.luftmengen().anteil, `${(vor.luftmengen().anteil * 100).toFixed(0)} % → ${(nachher.luftmengen().anteil * 100).toFixed(0)} %`);
  const rk = nachher.ergebnis(), k = kosten({ ...spieleBelueftungNach({ ...sk, anlage: { ...A, box: 'klein' } }, log).ergebnis() });
  pruefe('Kosten: Miete und Strom ausgewiesen', k.miete > 0 && k.strom > 0 && k.total > k.anlage && rk.bestelltBei === sk.t0 + 2, `${k.total.toFixed(0)} Fr./t, davon Miete ${k.miete.toFixed(0)}`);
  // Ohne Warmdach lässt sich keines zuschalten
  const ohne = spieleBelueftungNach({ ...s0, anlage: { ...A, dach: false } }, [], Infinity, { ...STANDARD, dach: true }).ergebnis();
  const mit = spieleBelueftungNach({ ...s0, anlage: A }, [], Infinity, { ...STANDARD, dach: true }).ergebnis();
  pruefe('Kein Dach, kein Schalter', ohne.stunden > mit.stunden && ohne.anlage.dach === false, `${mit.stunden} h mit, ${ohne.stunden} h ohne Warmdach`);
}

// ---------- 4. Einfüllen und Säulen
{
  const A = { luefter: 'standard', dach: true, entfeuchter: false, box: 'passend' };
  const f = feldVon('taenikon'), s0 = { ...f.heustockStart(), anlage: A };
  const gleichm = new Heustock(s0), ungleich = new Heustock({ ...s0, einfuellen: { verteilen: false } });
  pruefe('Gleichmässig: eine Säule; ungleich: drei', gleichm.saeulen.length === 1 && ungleich.saeulen.length === 3 && Math.abs(ungleich.dmStock() - gleichm.dmStock()) < 1e-9, `Höhen ${ungleich.zustand().hoehen.map((x) => x.toFixed(2)).join(' / ')} m`);
  const Lu = ungleich.luftmengen();
  pruefe('Kamin: mehr Luft durch die lockere Säule', Lu.v[0] > Lu.v[1] && Lu.v[1] > Lu.v[2] && Math.abs(Lu.mittel - ANLAGE.luft) < 1e-4, Lu.v.map((v) => (v / ANLAGE.luft * 100).toFixed(0) + ' %').join(' / '));
  const ru = spieleBelueftungNach({ ...s0, einfuellen: { verteilen: false } }), rg = spieleBelueftungNach(s0);
  const eu = ru.ergebnis(), eg = rg.ergebnis();
  pruefe('Nest: dichte Säule bleibt feucht', eu.schimmel > eg.schimmel * 2 && eu.stunden > eg.stunden, `Schimmelindex ${eg.schimmel.toFixed(2)} → ${eu.schimmel.toFixed(2)}, ${eg.stunden} h → ${eu.stunden} h`);
  // Sonde nur in der Mitte sieht das Nest hinten nicht
  const h = spieleBelueftungNach({ ...s0, einfuellen: { verteilen: false } }, [{ t: s0.t0 + 60, art: 'sonde', wert: 'mitte' }], s0.t0 + 60);
  const m = h.gemessen.stellen;
  pruefe('Sonde Mitte misst nur eine Stelle', m[0] === null && m[2] === null && m[1].schichten.length === 4 && Math.min(...m[1].schichten.map((x) => x.ts)) > h.tsMin(), `Mitte feuchteste ${Math.min(...m[1].schichten.map((x) => x.ts)).toFixed(0)} %, wahr ${h.tsMin().toFixed(0)} %`);
  // Lüfter erst nach dem Einfüllen: die ersten Stunden ohne Luft
  const spaet = spieleBelueftungNach({ ...s0, einfuellen: { start: 'danach' } }, [], s0.t0 + EINGRIFF.sperre);
  pruefe('Lüfterstart nach dem Einfüllen', spaet.laufStunden === 0 && spaet.tempJetzt() > new Heustock(s0).tempJetzt(), `${spaet.tempJetzt().toFixed(1)} °C nach ${EINGRIFF.sperre} h ohne Luft`);
}

// ---------- 5. Eingriffe
{
  const A = { luefter: 'standard', dach: true, entfeuchter: false, box: 'passend' };
  const f = feldVon('taenikon'), s0 = { ...f.heustockStart(), anlage: A }, un = { ...s0, einfuellen: { verteilen: false } };
  // Umschichten löst Nester auf, kostet Bröckelverlust
  const um = spieleBelueftungNach(un, [{ t: s0.t0 + 24, art: 'umschichten' }]).ergebnis(), ohne = spieleBelueftungNach(un).ergebnis();
  pruefe('Umschichten hilft', um.ende === 'lagerfaehig' && um.schimmel < ohne.schimmel && um.verlust > 0.9 && um.umgeschichtet === 1, `Schimmelindex ${ohne.schimmel.toFixed(2)} → ${um.schimmel.toFixed(2)}, Verlust ${um.verlust.toFixed(1)} %`);
  // Zwei Lagen: nachfüllen erhöht den Stock; zu früh wird vermerkt
  const zwei = { ...s0, einfuellen: { lagen: 2 } };
  const h0 = new Heustock(zwei);
  const nf = spieleBelueftungNach(zwei, [{ t: s0.t0 + 12, art: 'nachfuellen' }], s0.t0 + 12);
  pruefe('Nachfüllen: mehr Höhe, zu früh vermerkt', h0.n === 2 && !!h0.warte && nf.n === 4 && !nf.warte && nf.hoeheJetzt() > h0.hoehe * 1.9 && nf.handlungen[0].zuFrueh === true && Math.abs(nf.dmStock() - new Heustock(s0).dmStock()) < 0.5, `${h0.hoehe.toFixed(2)} m → ${nf.hoeheJetzt().toFixed(2)} m`);
  const nie = spieleBelueftungNach(zwei).ergebnis();
  pruefe('Nie nachgefüllt: nicht lagerfähig', nie.ende === 'zeit' && nie.wartetNoch && !nie.lagerfaehig, `Schimmelindex ${nie.schimmel.toFixed(1)}`);
  // Auslagern nimmt die oberste Lage weg
  const au = spieleBelueftungNach(s0, [{ t: s0.t0 + 10, art: 'auslagern' }]).ergebnis(), voll = spieleBelueftungNach(s0).ergebnis();
  pruefe('Auslagern: weniger Heu, schneller trocken', au.verlust > 20 && au.stunden < voll.stunden && au.ausgelagertT > 1, `${au.ausgelagertT.toFixed(1)} t weg, ${voll.stunden} h → ${au.stunden} h`);
  // Heissen Stock öffnen: Brand
  const aus = [{ t: s0.t0, art: 'luefter', wert: 'aus' }];
  const fg = feldVon('heugewitter'), sg = { ...fg.heustockStart(), anlage: A };
  const t60 = spieleBelueftungNach(sg, aus).ergebnis().wendepunkte.find((x) => x.grenze === 60).t;
  for (const art of ['umschichten', 'auslagern']) {
    const b = spieleBelueftungNach(sg, [...aus, { t: t60 + 2, art }]).ergebnis();
    pruefe(`Heissen Stock ${art}: Brand`, b.ende === 'brand' && b.tEnde === t60 + 2 && b.handlungen.at(-1).art === 'brandluft' && fg.bewerte(b).punkte === 0, `bei ${b.handlungen.at(-1).temp.toFixed(0)} °C`);
  }
  const kuehl = spieleBelueftungNach(sg, [...aus, { t: sg.t0 + 30, art: 'umschichten' }], sg.t0 + 31);
  pruefe('Kühlen Stock umschichten: kein Brand', kuehl.endeArt == null);
  // Pannen: Stromausfall und Sicherung
  const pa = spieleBelueftungNach({ ...s0, pannen: [{ nach: 5, art: 'stromausfall', dauer: 6 }] }, [], s0.t0 + 12);
  pruefe('Stromausfall: sechs Stunden ohne Luft', Math.abs(pa.laufStunden - 6) < 1e-9, `${pa.laufStunden} Laufstunden in 12 h`);
  const si = { ...s0, pannen: [{ nach: 5, art: 'sicherung' }] };
  const s1 = spieleBelueftungNach(si, [], s0.t0 + 20), s2 = spieleBelueftungNach(si, [{ t: s0.t0 + 8, art: 'sicherung' }], s0.t0 + 20);
  pruefe('Sicherung: steht, bis sie eingeschaltet wird', s1.laufStunden === 5 && s2.laufStunden === 17 && pannenAus('hochX').length === 1, `${s1.laufStunden} h / ${s2.laufStunden} h`);

  // Alles zusammen nachspielen: Protokoll bis t = direkt gespielter Stand
  const alles = { ...un, einfuellen: { verteilen: false, lagen: 2, start: 'danach' }, anlage: { ...A, box: 'klein' }, pannen: [{ nach: 30, art: 'stromausfall', dauer: 8 }] };
  const log = [{ t: s0.t0 + 6, art: 'sonde', wert: 'mitte' }, { t: s0.t0 + 20, art: 'luefter', wert: 'dauer' }, { t: s0.t0 + 26, art: 'umschichten' }, { t: s0.t0 + 26, art: 'luefterHolen' },
    { t: s0.t0 + 50, art: 'nachfuellen' }, { t: s0.t0 + 52, art: 'sonde', wert: 'alle' }, { t: s0.t0 + 70, art: 'auslagern' }, { t: s0.t0 + 75, art: 'vorinfo' }, { t: s0.t0 + 80, art: 'luefter', wert: 'intervall' }];
  const direkt = new Heustock(alles), e = { ...STANDARD }, bis = s0.t0 + 90;
  for (;;) { for (const x of log) if (x.t === direkt.t) { if (['luefter', 'dach', 'entfeuchter'].includes(x.art)) e[x.art] = x.wert; else direkt.handle(x); } if (direkt.t >= bis) break; direkt.stunde(e); }
  const nach = spieleBelueftungNach(alles, log, bis), nochmal = spieleBelueftungNach(alles, log, bis);
  pruefe('Eingriffe nachspielen identisch', gleich(direkt, nach) && gleich(nach, nochmal) && nach.handlungen.length === 7 && nach.luefter === 'stark' && JSON.stringify(nach.ergebnis()) === JSON.stringify(direkt.ergebnis()), `t ${nach.t}, ${nach.handlungen.map((x) => x.art).join(', ')}`);
  // Wette: plan.belueftungLog und plan.anlage ergeben denselben Verlauf wie das Nachspielen
  const fw = feldVon('taenikon', { anlage: alles.anlage, einfuellen: alles.einfuellen, pannen: alles.pannen, belueftungLog: log });
  pruefe('Wette mit Protokoll identisch', JSON.stringify(fw.res.belueftung) === JSON.stringify(spieleBelueftungNach(fw.heustockStart(), log).ergebnis()) && fw.res.faktoren.every((x) => x.tipp && !/undefined|NaN/.test(x.text + x.wert)), `Ende ${fw.res.belueftung.ende}, ${fw.res.punkte} Punkte`);
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('bedienung.mjs')) { console.log(fehler ? `${fehler} FEHLER` : 'Alle Prüfungen bestanden'); process.exitCode = fehler ? 1 : 0; }
