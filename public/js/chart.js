// Wetter- und Trocknungsdiagramm als SVG (wird bei jeder Animationsstunde neu gezeichnet)

const B = 960, H = 380, L = 44, R = 44;
const O1 = 14, U1 = 150;   // Wetterfeld
const O2 = 186, U2 = 340;  // TS-Feld
const TS_MIN = 10, TS_MAX = 75;

const FARBEN = { maehen: 'var(--text)', zetten: 'var(--gelb)', schwaden: 'var(--blau)', ernte: 'var(--gruen)' };
const KURZ = { maehen: 'Mähen', zetten: 'Zetten', schwaden: 'Schwaden', ernte: 'Einfahren' };

export function zeichne(el, wetter, { aktionen = [], verlauf = [], ziel = null, bis = null } = {}) {
  const n = wetter.length;
  const x = (t) => L + (t / n) * (B - L - R);
  const yT = (v) => U1 - (v / 35) * (U1 - O1);
  const yS = (v) => U1 - (v / 1000) * (U1 - O1);
  const yR = (mm) => O1 + Math.min(mm, 15) / 15 * (U1 - O1) * 0.6;
  const yTS = (v) => U2 - ((v - TS_MIN) / (TS_MAX - TS_MIN)) * (U2 - O2);
  const s = [];

  // Nächte
  let start = null;
  wetter.forEach((w, i) => {
    const dunkel = w.rad === 0;
    if (dunkel && start === null) start = i;
    if ((!dunkel || i === n - 1) && start !== null) {
      const ende = dunkel ? i + 1 : i;
      s.push(`<rect x="${x(start)}" y="${O1}" width="${x(ende) - x(start)}" height="${U2 - O1}" fill="var(--nacht)"/>`);
      start = null;
    }
  });

  // Tagesgrenzen und Achsen
  for (let d = 0; d <= n / 24; d++) {
    const xx = x(d * 24);
    s.push(`<line x1="${xx}" x2="${xx}" y1="${O1}" y2="${U2}" stroke="var(--linie)"/>`);
    if (d < n / 24) {
      s.push(`<text x="${xx + 4}" y="${U2 + 16}" style="font-weight:600">Tag ${d + 1}</text>`);
      for (const h of [6, 12, 18]) s.push(`<text x="${x(d * 24 + h)}" y="${U2 + 30}" text-anchor="middle">${h}</text>`);
    }
  }
  for (const y of [U1, U2]) s.push(`<line x1="${L}" x2="${B - R}" y1="${y}" y2="${y}" stroke="var(--linie)"/>`);

  // Strahlung (Fläche), Regen (Balken von oben), Temperatur (Linie)
  const flaeche = wetter.map((w, i) => `${x(i + 0.5)},${yS(w.rad)}`).join(' ');
  s.push(`<polygon points="${x(0.5)},${U1} ${flaeche} ${x(n - 0.5)},${U1}" fill="var(--sonne)" opacity=".28"/>`);
  wetter.forEach((w, i) => {
    if (w.regen > 0) s.push(`<rect x="${x(i) + 1}" y="${O1}" width="${x(1) - x(0) - 2}" height="${yR(w.regen) - O1}" fill="var(--blau)" opacity=".75"><title>${w.regen} mm</title></rect>`);
  });
  s.push(`<polyline points="${wetter.map((w, i) => `${x(i + 0.5)},${yT(w.temp)}`).join(' ')}" fill="none" stroke="var(--temp)" stroke-width="2"/>`);
  for (const v of [0, 10, 20, 30]) s.push(`<text x="${L - 6}" y="${yT(v) + 4}" text-anchor="end">${v}°</text>`);
  s.push(`<text x="${B - R + 6}" y="${O1 + 10}">Regen</text><text x="${B - R + 6}" y="${U1}">Sonne</text>`);

  // TS-Feld
  if (ziel) s.push(`<rect x="${L}" y="${yTS(ziel[1])}" width="${B - L - R}" height="${yTS(ziel[0]) - yTS(ziel[1])}" fill="var(--ziel)"/>`,
    `<text x="${B - R + 6}" y="${(yTS(ziel[0]) + yTS(ziel[1])) / 2 + 4}" fill="var(--gruen)">Ziel</text>`);
  for (const v of [20, 30, 40, 50, 60, 70]) {
    s.push(`<line x1="${L}" x2="${B - R}" y1="${yTS(v)}" y2="${yTS(v)}" stroke="var(--linie)" stroke-dasharray="2 4"/>`);
    s.push(`<text x="${L - 6}" y="${yTS(v) + 4}" text-anchor="end">${v}%</text>`);
  }
  s.push(`<text x="${L}" y="${O2 - 6}" style="font-weight:600">TS-Gehalt des Futters</text>`);

  const sichtbar = bis == null ? verlauf : verlauf.filter((p) => p.t <= bis);
  if (sichtbar.length) {
    const start0 = aktionen.find((a) => a.art === 'maehen');
    const pts = (start0 ? [`${x(start0.t)},${yTS(start0.ts ?? sichtbar[0].ts)}`] : [])
      .concat(sichtbar.map((p) => `${x(p.t)},${yTS(Math.min(TS_MAX, p.ts))}`));
    s.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="var(--ts)" stroke-width="3" stroke-linejoin="round"/>`);
    const letzt = sichtbar[sichtbar.length - 1];
    s.push(`<circle cx="${x(letzt.t)}" cy="${yTS(Math.min(TS_MAX, letzt.ts))}" r="5" fill="var(--ts)"/>`,
      `<text x="${x(letzt.t) + 8}" y="${yTS(Math.min(TS_MAX, letzt.ts)) - 8}" style="font-weight:700;fill:var(--text)">${letzt.ts.toFixed(0)} %</text>`);
  }

  // Arbeitsgänge
  aktionen.forEach((a, k) => {
    const xx = x(a.t);
    const farbe = FARBEN[a.art];
    s.push(`<line x1="${xx}" x2="${xx}" y1="${O1}" y2="${U2}" stroke="${farbe}" stroke-width="1.5" stroke-dasharray="5 3"/>`);
    s.push(`<text x="${xx + 3}" y="${O2 + 12 + (k % 3) * 13}" style="fill:${farbe};font-weight:600">${KURZ[a.art]}</text>`);
  });
  if (bis != null) s.push(`<line x1="${x(bis)}" x2="${x(bis)}" y1="${O1}" y2="${U2}" stroke="var(--text)" stroke-width="2"/>`);

  el.innerHTML = `<svg viewBox="0 0 ${B} ${H}" role="img" aria-label="Wetter und TS-Verlauf">${s.join('')}</svg>`;
}
