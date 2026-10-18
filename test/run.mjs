import { stundenwetter, zufallswetter } from '../public/js/weather.js';
import { simuliere } from '../public/js/model.js';
import { WETTER, PROGNOSEN, GRUNDPLAN } from '../public/js/scenarios.js';
const zeig = (name, r) => {
  if (r.fehler) return console.log(name, 'FEHLER', r.fehler);
  const s = r.silage, e = r.ernte, v = r.verlust;
  console.log(`${name.padEnd(28)} TSmahd ${r.tsMahd.toFixed(1)} TS ${e.ts.toFixed(1)} Zucker ${e.zucker.toFixed(0)} Asche ${e.asche.toFixed(0)} FK ${s.fk.toFixed(0)} BS ${s.buttersaeure.toFixed(1)} pH ${s.pH.toFixed(2)} DLG ${s.dlg} N${s.note} | Atm ${v.atmung.toFixed(1)} Ausw ${v.auswaschung.toFixed(1)} Br ${v.broeckel.toFixed(1)} Silo ${s.siloverlust.toFixed(1)} tot ${r.verlustTotal.toFixed(1)} NEL ${r.nel.toFixed(2)} Pkt ${r.punkte}`);
};
for (const p of PROGNOSEN) zeig(p.name, simuliere(p.plan, stundenwetter(WETTER.find(w => w.id === p.wetter))));
for (const w of WETTER) {
  const wt = stundenwetter(w);
  zeig('Grundplan/' + w.id, simuliere(GRUNDPLAN, wt));
  zeig('Grund ohne Aufb/' + w.id, simuliere({ ...GRUNDPLAN, aufbereiter: 'ohne' }, wt));
  zeig('Grund schwad/' + w.id, simuliere({ ...GRUNDPLAN, breit: false, zetten: [] }, wt));
  zeig('Grund 24h/' + w.id, simuliere({ ...GRUNDPLAN, zetten: [11, 14], schwaden: 33, ernte: 35 }, wt));
}
const w = stundenwetter(WETTER[0]);
console.log(w.slice(0, 48).map(x => `${x.h}:${x.temp.toFixed(0)}°/${x.rh.toFixed(0)}%/${x.rad.toFixed(0)}`).join(' '));
zeig('zufall', simuliere(GRUNDPLAN, stundenwetter(zufallswetter('ABC'))));
// Trocknungsverlauf Hochdruck: Breitablage+Walzen+Zetten vs. Mähschwade ohne Zetten (TS je 2 h)
for (const [name, p] of [['breit+walzen+zetten', {}], ['schwad ohne zetten', { breit: false, zetten: [] }], ['breit ohne Aufb.', { aufbereiter: 'ohne' }], ['zinken+buerste', { aufbereiter: 'buerste' }]]) {
  const r = simuliere({ ...GRUNDPLAN, maehen: 9, zetten: [10], schwaden: 70, ernte: 71, ...p, ...(p.zetten ? { zetten: p.zetten } : {}) }, stundenwetter(WETTER[0]));
  console.log(name.padEnd(22), r.verlauf.filter((x, i) => i % 2 === 1).slice(0, 18).map(x => `${x.t % 24}h:${x.ts.toFixed(0)}`).join(' '));
}
// Nachspielen: Stand aus dem Protokoll muss dem direkt gespielten Stand entsprechen
import { Feld, spieleNach } from '../public/js/model.js';
{
  const wt = stundenwetter(WETTER[1]);
  const setup = { ...GRUNDPLAN, bestand: 'klee', aufbereiter: 'buerste' };
  const log = [{ t: 12, art: 'maehen' }, { t: 14, art: 'zetten' }, { t: 14, art: 'schwaden' }];
  const a = new Feld(setup, wt, 5);
  while (a.t < 30) { for (const x of log.filter((l) => l.t === a.t)) ({ maehen: () => a.maehen(), zetten: () => a.zettenJetzt(), schwaden: () => a.schwaden() })[x.art](); a.stunde(); }
  const b = spieleNach(setup, wt, log, 30);
  const ok = Math.abs(a.ts() - b.ts()) < 1e-9 && a.t === b.t && Math.abs(a.dm - b.dm) < 1e-9;
  console.log('Nachspielen identisch:', ok, a.t, a.ts().toFixed(2), b.ts().toFixed(2));
  const res = simuliere(GRUNDPLAN, stundenwetter(WETTER[0]));
  console.log('Tipps vorhanden:', res.faktoren.every((f) => f.tipp), res.faktoren.length);
}
