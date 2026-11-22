// Sucht die Trocknungsparameter (KAL in model.js), die die FAT-Messungen am besten treffen.
//   docker run --rm -v "$PWD":/app -w /app node:22-alpine node test/kalibrierung.mjs
import { KAL } from '../public/js/model.js';
import { vergleicheAlle } from '../public/js/vergleich.js';
// Fehlermass: Messpunkte und doppelt gewichtete Endwerte (TS beim Einführen), in Prozentpunkten TS
export const fehler = () => {
  let s = 0, n = 0;
  for (const v of vergleicheAlle()) {
    for (const a of v.abweichung) { s += a * a; n++; }
    const e = v.modell.tsEnde - v.ende; s += 2 * e * e; n += 2;
  }
  return Math.sqrt(s / n);
};
const alt = { ...KAL };
let best = [1e9];
for (let k = 0.6; k <= 0.95; k += 0.025) for (const ablage of [0.3, 0.45, 0.6, 0.75, 0.9]) for (const schub of [0.5, 0.75, 1, 1.25, 1.5]) {
  Object.assign(KAL, { k, ablage, schub });
  const f = fehler();
  if (f < best[0]) best = [f, { k, ablage, schub }];
}
Object.assign(KAL, alt);
console.log(`jetzt: Fehler ${fehler().toFixed(2)} bei`, alt, `| beste: Fehler ${best[0].toFixed(2)} bei`, best[1]);
