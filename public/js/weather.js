// Stündliches Wetter aus wenigen Tageswerten.
// Jeder Tag: tmin, tmax (°C), rhmax (% in der Nacht, bestimmt den Tau),
// sonne (0–1, Anteil wolkenlos), wind (m/s), regen: [{h, mm}] (h = Stunde 0–23).
// Die Simulation startet am Tag 1 um 00:00, Stunde t = (tag-1)*24 + h.

export const MONATE = {
  5: { name: 'Mai', aufgang: 5.9, untergang: 20.9, spitze: 850 },
  6: { name: 'Juni', aufgang: 5.5, untergang: 21.4, spitze: 880 },
  7: { name: 'Juli', aufgang: 5.8, untergang: 21.3, spitze: 860 },
  8: { name: 'August', aufgang: 6.5, untergang: 20.5, spitze: 780 },
  9: { name: 'September', aufgang: 7.2, untergang: 19.5, spitze: 650 },
};

// Sättigungsdampfdruck in kPa (Magnus)
export const es = (t) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3));

export function stundenwetter(szenario) {
  const m = MONATE[szenario.monat] ?? MONATE[5];
  const stunden = [];
  szenario.tage.forEach((tag, i) => {
    const naechster = szenario.tage[i + 1] ?? tag;
    // Dampfdruck des Tages: nachts nahe Sättigung bei tmin
    const ea = es(tag.tmin) * (tag.rhmax / 100);
    const regen = new Map((tag.regen ?? []).map((r) => [r.h, r.mm]));
    for (let h = 0; h < 24; h++) {
      const t = temperatur(h, szenario.tage[i - 1] ?? tag, tag, naechster, m);
      const mm = regen.get(h) ?? 0;
      let rad = 0;
      if (h + 0.5 > m.aufgang && h + 0.5 < m.untergang) {
        const x = (h + 0.5 - m.aufgang) / (m.untergang - m.aufgang);
        rad = m.spitze * Math.sin(Math.PI * x) * (0.25 + 0.75 * tag.sonne);
      }
      if (mm > 0) rad *= 0.2;
      let rh = Math.min(100, (100 * ea) / es(t));
      if (mm > 0) rh = Math.max(rh, 97);
      stunden.push({
        t: i * 24 + h, tag: i + 1, h, temp: t, rh, rad, wind: tag.wind, regen: mm, sonne: tag.sonne, monat: szenario.monat,
        vpd: Math.max(0, es(t) * (1 - rh / 100)),
      });
    }
  });
  return stunden;
}

// Minimum bei Sonnenaufgang, Maximum um 15 Uhr, nachts Abkühlung auf tmin des Folgetags
function temperatur(h, vorher, tag, naechster, m) {
  const tauf = m.aufgang, tmax = 15, nacht = 24 + tauf - tmax;
  const abkuehlung = (spitze, ziel, x) => ziel + (spitze - ziel) * (1 + Math.cos(Math.PI * x)) / 2;
  if (h < tauf) return abkuehlung(vorher.tmax, tag.tmin, (h + 24 - tmax) / nacht);
  if (h <= tmax) return tag.tmin + (tag.tmax - tag.tmin) * (1 - Math.cos(Math.PI * (h - tauf) / (tmax - tauf))) / 2;
  return abkuehlung(tag.tmax, naechster.tmin, (h - tmax) / nacht);
}

// Reproduzierbares Zufallswetter (für Wettkampf: alle bekommen dasselbe Wetter über den Code)
export function zufallswetter(code, monat = 5) {
  let s = 0;
  for (const c of String(code)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const tage = [];
  let lage = rnd(); // 0 = Tiefdruck, 1 = Hochdruck
  for (let i = 0; i < 4; i++) {
    lage = Math.min(1, Math.max(0, lage + (rnd() - 0.5) * 0.6));
    const tmax = 14 + lage * 13 + rnd() * 3;
    const regen = [];
    if (rnd() > 0.35 + lage * 0.6) {
      const start = rnd() > 0.5 ? 14 + Math.floor(rnd() * 6) : Math.floor(rnd() * 24);
      const dauer = 1 + Math.floor(rnd() * (lage > 0.5 ? 2 : 6));
      for (let k = 0; k < dauer && start + k < 24; k++) regen.push({ h: start + k, mm: +(0.5 + rnd() * (lage > 0.5 ? 8 : 3)).toFixed(1) });
    }
    tage.push({
      tmin: +(tmax - 9 - lage * 4 + rnd() * 2).toFixed(1), tmax: +tmax.toFixed(1),
      rhmax: Math.round(88 + rnd() * 12), sonne: +(0.2 + lage * 0.75 * (0.8 + rnd() * 0.2)).toFixed(2),
      wind: +(1 + rnd() * 3).toFixed(1), regen,
    });
  }
  return { id: 'zufall-' + code, name: `Zufallswetter «${code}»`, monat, tage };
}

// Wetter für die Heubelüftung: Die Wetterlagen haben nur vier Tage, belüftet wird länger.
// Die ersten Stunden bleiben unverändert; die Folgetage entstehen reproduzierbar aus dem Stundenwetter selbst
// (gleiches Wetter, gleiche Folgetage). Sie schwanken um das Mittel der vorhandenen Tage, mit einer langsam
// wechselnden «Lage» (0 = trüb, 1 = schön). Das ist Spielwetter, keine Klimastatistik.
export function belueftungsWetter(stunden, tageTotal = 14) {
  const nTage = Math.floor(stunden.length / 24);
  if (nTage >= tageTotal) return stunden;
  const tage = [];
  for (let d = 0; d < nTage; d++) {
    const h = stunden.slice(d * 24, d * 24 + 24);
    const tmin = Math.min(...h.map((x) => x.temp)), tmax = Math.max(...h.map((x) => x.temp));
    const kalt = h.reduce((a, x) => (x.temp < a.temp ? x : a));
    tage.push({ tmin, tmax, rhmax: kalt.rh, sonne: h[12].sonne, wind: h[12].wind });
  }
  let s = 7;
  for (const x of stunden) s = (s * 31 + Math.round(x.temp * 10 + x.rh)) >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const mittel = (k) => tage.reduce((a, d) => a + d[k], 0) / tage.length;
  const m = { tmin: mittel('tmin'), tmax: mittel('tmax'), rhmax: mittel('rhmax'), wind: mittel('wind') };
  const neu = [tage[nTage - 1]];
  let lage = tage[nTage - 1].sonne;
  while (nTage + neu.length - 1 < tageTotal) {
    lage = Math.min(1, Math.max(0, lage + (rnd() - 0.45) * 0.7));
    const regen = [];
    if (rnd() > 0.3 + lage * 0.7) {
      const start = lage > 0.5 ? 15 + Math.floor(rnd() * 5) : Math.floor(rnd() * 20);
      const dauer = 1 + Math.floor(rnd() * (lage > 0.5 ? 2 : 5));
      for (let k = 0; k < dauer && start + k < 24; k++) regen.push({ h: start + k, mm: +(0.5 + rnd() * 4).toFixed(1) });
    }
    const tmax = m.tmax + (lage - 0.6) * 8 + (rnd() - 0.5) * 2;
    neu.push({
      tmin: +Math.min(tmax - 5, m.tmin + (lage - 0.6) * 2 + (rnd() - 0.5) * 2).toFixed(1), tmax: +tmax.toFixed(1),
      rhmax: Math.round(Math.min(100, m.rhmax + (0.6 - lage) * 8 + (regen.length ? 3 : 0))),
      sonne: +Math.min(0.95, Math.max(0.15, 0.2 + lage * 0.75)).toFixed(2), wind: +(m.wind + (rnd() - 0.5)).toFixed(1),
      regen,
    });
  }
  const monat = stunden[0].monat ?? 7;
  const folge = stundenwetter({ monat, tage: neu }).slice(24).map((x) => ({ ...x, t: x.t - 24 + nTage * 24, tag: x.tag - 1 + nTage }));
  return stunden.slice(0, nTage * 24).concat(folge);
}
