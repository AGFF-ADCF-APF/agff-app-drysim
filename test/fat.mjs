// Modell gegen Messung (FAT-Bericht 584): TS-Verläufe und Feldverluste
import { vergleicheAlle, tsBei } from '../public/js/vergleich.js';
const r1 = (x) => x.toFixed(1);
for (const v of vergleicheAlle()) {
  const m = v.modell;
  console.log(`${v.name.padEnd(42)} Ende ${r1(v.ende)} → Modell ${r1(m.tsEnde)} | Verlust Aufnahme ${v.verlust.aufnahme}/${m.verlust.aufnahme.toFixed(0)} Bröckel ${v.verlust.broeckel}/${m.verlust.broeckel.toFixed(0)} kg` +
    (v.punkte ? ` | Punkte ${v.punkte.map(([t, ts]) => `${r1(ts)}/${r1(tsBei(m.verlauf, t))}`).join(' ')} | RMSE ${r1(v.mittel)}` : ''));
}
