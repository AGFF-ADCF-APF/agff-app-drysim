// Musterlösungen für Superuser (Konzept Heubelüftung, Abschnitt 11): Suche deterministisch, nie schlechter als die
// Vorgabe-Runde der Szenarien, Protokoll nachspielbar, Suchmodul nicht im Service-Worker-Cache.
//   docker run --rm --user 1000:1000 -v "$PWD":/app -w /app node:22-alpine node test/muster.mjs
import fs from 'node:fs';
import { suche, rechne, planAusRunde, kennzahlen, erfuelltGuenstig } from '../public/js/muster/suche.js';
import { stundenwetter } from '../public/js/weather.js';
import { WETTER, PROGNOSEN } from '../public/js/scenarios.js';

let fehler = 0;
const pruefe = (name, ok, text = '') => { if (!ok) fehler++; console.log(`${ok ? 'OK     ' : 'FEHLER '} ${name}${text ? ': ' + text : ''}`); };
const ALLES = { anlage: ['luefter', 'dach', 'entfeuchter', 'box'], aufbereiter: true };

for (const p of PROGNOSEN.filter((x) => x.plan.siloart === 'belueftung')) {
  const { maehen, zetten, schwaden, ernte, belueftung, belueftungLog, ...setup } = p.plan;
  const wetter = stundenwetter(WETTER.find((w) => w.id === p.wetter));
  const vorgabe = planAusRunde(p.plan);
  const rv = rechne(setup, wetter, vorgabe), kv = kennzahlen(rv);
  const t0 = Date.now();
  const a = suche({ setup, wetter, erlaubt: ALLES, vorgaben: [vorgabe] });
  const ms = Date.now() - t0;
  const b = suche({ setup, wetter, erlaubt: ALLES, vorgaben: [vorgabe] });
  const gleich = JSON.stringify([a.beste, a.guenstig, a.gerechnet]) === JSON.stringify([b.beste, b.guenstig, b.gerechnet]);
  const nach = rechne(setup, wetter, a.beste.plan);
  pruefe(`${p.id}: deterministisch und nachspielbar`, gleich && JSON.stringify(kennzahlen(nach)) === JSON.stringify(a.beste.k), `${a.gerechnet} Varianten, ${ms} ms`);
  pruefe(`${p.id}: beste nie schlechter als die Vorgabe`, a.beste.k.punkte >= kv.punkte, `${kv.punkte} → ${a.beste.k.punkte} Punkte (${Math.round(a.beste.k.kosten)} Fr./t)`);
  const g = a.guenstig;
  pruefe(`${p.id}: günstigste erfüllt die Bedingung`, !g || erfuelltGuenstig(g.k), g ? `${Math.round(g.k.kosten)} Fr./t, Note ${g.k.note}, ${g.k.punkte} Punkte` : 'keine gefunden');
  if (erfuelltGuenstig(kv)) pruefe(`${p.id}: günstigste nie teurer als die Vorgabe`, g && g.k.kosten <= kv.kosten + 1e-9, `${Math.round(kv.kosten)} → ${Math.round(g.k.kosten)} Fr./t`);
}
// Das Suchmodul steht nicht im Service Worker (wird erst nach bestätigter Sitzung geladen)
const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const dateien = sw.split('\n').find((z) => z.startsWith('const DATEIEN'));
pruefe('Suchmodul nicht im Service-Worker-Cache', !dateien.includes('js/muster/') && sw.includes("basis + 'js/muster/'"));
console.log(fehler ? `${fehler} FEHLER` : 'Alle Prüfungen bestanden');
process.exitCode = fehler ? 1 : 0;
