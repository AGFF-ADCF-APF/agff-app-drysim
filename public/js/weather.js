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
        t: i * 24 + h, tag: i + 1, h, temp: t, rh, rad, wind: tag.wind, regen: mm,
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
