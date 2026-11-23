// Sucht eta, exp und auf (KAL_B in belueftung.js) gegen FAT 1982, Abb. 29 und die Ausnutzung nach LK Salzburg
import { KAL_B } from '../public/js/belueftung.js';
import { konstant } from '../public/js/belueftung-vergleich.js';
import { ABB29 } from '../public/js/versuche.js';
export function fehler() {
  let s = 0, n = 0;
  for (const k of ABB29.kurven) for (const [rh, g] of k.punkte) { const d = konstant({ ts: k.ts, rh }).gm3 - g; s += d * d; n++; }
  // LK Salzburg: Ausnutzung des Sättigungsdefizits 50–65 % (Belüftungsheu 65 % TS, 20 °C / 60 %)
  const a = konstant({ ts: 65, rh: 60 }).ausnutzung, ziel = 0.575; s += 4 * ((a - ziel) / 0.1) ** 2 * 0.1; n += 4;
  return Math.sqrt(s / n);
}
const alt = { ...KAL_B };
let best = [1e9];
for (let eta = 0.1; eta <= 0.5; eta += 0.025) for (const exp of [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5]) for (const auf of [0.15, 0.3, 0.5]) {
  Object.assign(KAL_B, { eta, exp, auf });
  const f = fehler();
  if (f < best[0]) best = [f, { eta: +eta.toFixed(3), exp, auf }];
}
Object.assign(KAL_B, alt);
console.log(`jetzt: Fehler ${fehler().toFixed(3)} bei`, alt, `| beste: Fehler ${best[0].toFixed(3)} bei`, best[1]);
