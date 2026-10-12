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
for (const [name, p] of [['breit+walzen+zetten', {}], ['schwad ohne zetten', { breit: false, zetten: [] }], ['breit ohne Aufb.', { aufbereiter: 'ohne' }], ['doppelrotor', { aufbereiter: 'doppel' }]]) {
  const r = simuliere({ ...GRUNDPLAN, maehen: 9, zetten: [10], schwaden: 70, ernte: 71, ...p, ...(p.zetten ? { zetten: p.zetten } : {}) }, stundenwetter(WETTER[0]));
  console.log(name.padEnd(22), r.verlauf.filter((x, i) => i % 2 === 1).slice(0, 18).map(x => `${x.t % 24}h:${x.ts.toFixed(0)}`).join(' '));
}
