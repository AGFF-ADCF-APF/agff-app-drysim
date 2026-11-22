// Modell gegen Messung: die Verfahren des FAT-Versuchs 2001 mit dem Spielmodell nachrechnen.
import { Feld } from './model.js';
import { stundenwetter } from './weather.js';
import { WETTER, FAT_PLAN } from './scenarios.js';
import { FAT_VERFAHREN } from './versuche.js';

// Liefert den TS-Verlauf (stündlich) und die Feldverluste in kg TS/ha
export function rechneVerfahren(v) {
  const wetter = stundenwetter(WETTER.find((w) => w.id === 'taenikon'));
  const zetten = v.zetten.map(Math.round), schwaden = Math.round(v.schwaden), ende = 64;
  const f = new Feld({ ...FAT_PLAN, aufbereiter: v.aufbereiter, ablage: v.ablage }, wetter, FAT_PLAN.maehen);
  f.maehen();
  const verlauf = [[f.t, f.ts()]];
  while (f.t < ende) {
    if (zetten.includes(f.t)) f.zettenJetzt();
    if (f.t === schwaden) f.schwaden();
    f.stunde();
    verlauf.push([f.t, f.ts()]);
  }
  const res = f.einfahren();
  const kg = (art) => res.verlust[art] / 100 * res.dm0 * 10;
  return { verlauf, tsEnde: res.ernte.ts, verlust: { aufnahme: kg('liegen'), broeckel: kg('broeckel') } };
}

// TS des Modells zu einer beliebigen Zeit (linear zwischen den Stunden)
export function tsBei(verlauf, t) {
  for (let i = 1; i < verlauf.length; i++) {
    const [t0, a] = verlauf[i - 1], [t1, b] = verlauf[i];
    if (t <= t1) return a + (b - a) * (t - t0) / (t1 - t0);
  }
  return verlauf[verlauf.length - 1][1];
}

export function vergleicheAlle() {
  return FAT_VERFAHREN.map((v) => {
    const m = rechneVerfahren(v);
    const abw = (v.punkte ?? []).map(([t, ts]) => tsBei(m.verlauf, t) - ts);
    return { ...v, modell: m, abweichung: abw, mittel: abw.length ? Math.sqrt(abw.reduce((a, x) => a + x * x, 0) / abw.length) : null };
  });
}
