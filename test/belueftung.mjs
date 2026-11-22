// Belüftungsmodell gegen Richtwerte aus FAT 1982, Agroscope 2014 und LK Salzburg (Werte in versuche.js)
import { konstant } from '../public/js/belueftung-vergleich.js';
const r = (x, d = 2) => x.toFixed(d);
console.log('Abb. 29 (FAT 1982) g/m³, Spalten rF 40/50/60/70/80/90:');
for (const ts of [52, 60, 70, 80]) console.log(`  TS ${ts}`, [40, 50, 60, 70, 80, 90].map((rh) => r(konstant({ ts, rh }).gm3)).join(' '));
for (const ts of [60, 65, 70]) { const k = konstant({ ts, rh: 60 }); console.log(`Ausnutzung TS ${ts}, 20 °C/60 %: ${r(k.ausnutzung * 100, 0)} %, Abluft ${r(k.abT, 1)} °C ${r(k.abRh, 0)} %`); }
for (const [rh, dach] of [[65, false], [70, false], [65, true]]) { const k = konstant({ ts: 65, rh, stunden: 12, dach }); console.log(`20 °C/${rh} % ${dach ? 'Dach' : 'kalt'}: ${r(k.gm3)} g/m³, ${r(k.kgJeTh)} kg/h je t, ${r(k.kwhJeKg)} kWh/kg`); }
const e = konstant({ ts: 65, temp: 20, rh: 80, stunden: 12, entfeuchter: true }); console.log(`Entfeuchter 20 °C/80 %: ${r(e.gm3)} g/m³, ${r(e.kwhJeKg)} kWh/kg, Zuluft ${r(e.zuT, 1)} °C ${r(e.zuRh, 0)} %`);
