// Kleine Grafiken aus Messwerten und Modell: Balken als HTML (Schrift bleibt auf dem Handy lesbar),
// Verläufe als SVG. Farben über CSS-Variablen, damit Nacht- und Kontrastmodus mitziehen.
// Genutzt in den Erklärkarten des Spiels und auf der Lernseite (tools/seiten.mjs).
import { FAT_VERFAHREN, FAT_ABLAGE, INSEKTEN, LEISTUNG, QUELLE_FAT, QUELLE_HUMBERT, QUELLE_TOPAGRAR } from './versuche.js';
import { rechneVerfahren } from './vergleich.js';
import { Feld } from './model.js';
import { stundenwetter } from './weather.js';
import { WETTER, GRUNDPLAN } from './scenarios.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const zahl = (x, d = 0) => x.toFixed(d).replace('.', ',');
const FARBEN = ['var(--gruen)', 'var(--blau)', 'var(--gelb-dunkel)', 'var(--temp)'];

function figur(titel, inhalt, quelle, extra = '') {
  return `<figure class="grafik"><figcaption><b>${esc(titel)}</b>${extra}</figcaption>${inhalt}` +
    (quelle ? `<p class="grafik-quelle">Quelle: ${quelle}</p>` : '') + '</figure>';
}
const legende = (eintraege) => `<span class="grafik-legende">${eintraege.map(([t, f, art]) => `<span><i class="${art ?? ''}" style="--f:${f}"></i>${esc(t)}</span>`).join('')}</span>`;

// Waagrechte Balken; zeilen: [label, wert | [teilwerte], text?]
export function balken({ titel, zeilen, max, einheit = '', teile = null, quelle = '', hervor = null }) {
  const gross = max ?? Math.max(...zeilen.map(([, w]) => [].concat(w).reduce((a, x) => a + x, 0)));
  const html = zeilen.map(([label, w, text], i) => {
    const werte = [].concat(w), summe = werte.reduce((a, x) => a + x, 0);
    const stuecke = werte.map((x, k) => `<i style="width:${(100 * x / gross).toFixed(1)}%;--f:${FARBEN[teile ? k : 0]}"></i>`).join('');
    return `<div class="gb-zeile${hervor === i ? ' hervor' : ''}"><span class="gb-label">${esc(label)}</span><span class="gb-balken" role="img" aria-label="${esc(label)}: ${zahl(summe)} ${esc(einheit)}">${stuecke}</span><b>${esc(text ?? `${zahl(summe)} ${einheit}`)}</b></div>`;
  }).join('');
  return figur(titel, `<div class="gb">${html}</div>`, quelle, teile ? legende(teile.map((t, k) => [t, FARBEN[k]])) : '');
}

// Verlauf als SVG: reihen [{ name, punkte: [[x, y]], farbe, art: 'linie' | 'punkte' }]
export function verlauf({ titel, reihen, x, y, quelle = '', legendeEintraege = null }) {
  const B = 470, H = 270, L = 46, R = 10, O = 24, U = 236; // schmal, damit die Schrift auf dem Handy lesbar bleibt
  const px = (v) => L + (v - x.min) / (x.max - x.min) * (B - L - R);
  const py = (v) => U - (v - y.min) / (y.max - y.min) * (U - O);
  const s = [];
  for (const [v, t] of y.ticks) s.push(`<line x1="${L}" x2="${B - R}" y1="${py(v)}" y2="${py(v)}" stroke="var(--linie)"/><text x="${L - 6}" y="${py(v) + 5}" text-anchor="end">${esc(t)}</text>`);
  for (const [v, t] of x.ticks) s.push(`<line x1="${px(v)}" x2="${px(v)}" y1="${O}" y2="${U}" stroke="var(--linie)" stroke-dasharray="2 4"/><text x="${px(v)}" y="${U + 20}" text-anchor="middle">${esc(t)}</text>`);
  // Tage: Trennlinie und Datum oben
  for (const [a, b, t] of x.bereiche ?? []) s.push(`<line x1="${px(a)}" x2="${px(a)}" y1="${O - 18}" y2="${U}" stroke="var(--leise)"/><text x="${(px(a) + px(b)) / 2}" y="${O - 8}" text-anchor="middle" class="leise">${esc(t)}</text>`);
  if (y.titel) s.push(`<text x="4" y="${O - 8}" class="leise">${esc(y.titel)}</text>`);
  for (const r of reihen) {
    if (r.art === 'punkte') for (const [a, b] of r.punkte) s.push(`<circle cx="${px(a)}" cy="${py(b)}" r="5.5" fill="var(--karte)" stroke="${r.farbe}" stroke-width="3"><title>${esc(r.name)}: ${zahl(b, 1)}</title></circle>`);
    else s.push(`<polyline points="${r.punkte.map(([a, b]) => `${px(a).toFixed(1)},${py(b).toFixed(1)}`).join(' ')}" fill="none" stroke="${r.farbe}" stroke-width="2.5"${r.strich ? ' stroke-dasharray="6 4"' : ''}/>`);
  }
  const svg = `<svg class="gv" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(titel)}">${s.join('')}</svg>`;
  return figur(titel, svg, quelle, legendeEintraege ? legende(legendeEintraege) : '');
}

const qFAT = `<a href="${QUELLE_FAT.url}" rel="noopener">${esc(QUELLE_FAT.titel)}</a>`;
const qHumbert = `<a href="${QUELLE_HUMBERT.url}" rel="noopener">${esc(QUELLE_HUMBERT.titel)}</a>`;
const qTopagrar = `<a href="${QUELLE_TOPAGRAR.url}" rel="noopener">${esc(QUELLE_TOPAGRAR.titel)}</a>`;

// Uhrzeit-Achse für den Tänikon-Versuch (t = Stunden ab 24.7. 00:00)
const ACHSE_FAT = { min: 30, max: 65, ticks: [[33, '9 h'], [39, '15 h'], [45, '21 h'], [57, '9 h'], [63, '15 h']], bereiche: [[30, 48, '25. Juli'], [48, 65, '26. Juli']] };

// Modell gegen Messung: Trocknungsverläufe der Verfahren mit Breitablage
export function grafikTrocknung(ids = ['fella-breit', 'k618-breit', 'twin-2x']) {
  const reihen = [], leg = [];
  ids.forEach((id, i) => {
    const v = FAT_VERFAHREN.find((x) => x.id === id), m = rechneVerfahren(v), f = FARBEN[i];
    reihen.push({ name: `${v.name}, Modell`, punkte: m.verlauf.filter(([t]) => t >= 30), farbe: f });
    reihen.push({ name: `${v.name}, gemessen`, punkte: v.punkte, farbe: f, art: 'punkte' });
    leg.push([v.name, f]);
  });
  leg.push(['Linie = Spiel, Kreis = gemessen', 'var(--leise)', 'nur-text']);
  return verlauf({ titel: 'Trocknung: Spiel gegen Messung (Tänikon, Juli 2001)', reihen, x: ACHSE_FAT,
    y: { min: 10, max: 80, titel: 'TS', ticks: [[20, '20 %'], [40, '40 %'], [60, '60 %'], [80, '80 %']] }, quelle: qFAT, legendeEintraege: leg });
}

export function grafikFeldverluste() {
  return balken({
    titel: 'Feldverluste je Verfahren (kg TS pro ha, Ertrag 32 dt TS/ha)',
    zeilen: FAT_VERFAHREN.map((v) => [v.name, [v.verlust.aufnahme, v.verlust.broeckel]]),
    teile: ['Aufnahmeverluste (Halme)', 'Bröckelverluste (Blätter)'], einheit: 'kg', quelle: qFAT,
  });
}

export function grafikAblage() {
  const abend = { 'Fella KC 270 D': 33.2, 'Vicon TK 300': 33.0, 'Kurmann K 618': 40.2, 'Kurmann K 618 Twin': 47.4 };
  return balken({
    titel: 'Ablagebreite und TS am ersten Abend (18 Uhr)',
    zeilen: FAT_ABLAGE.map(([g, p]) => [`${g}: ${p} % der Mähbreite`, abend[g], `${zahl(abend[g], 1)} % TS`]),
    max: 50, quelle: `${qFAT}. Die Geräte unterscheiden sich auch in der Aufbereitung; der Twin hat zusätzlich eine Bürste.`,
  });
}

export function grafikInsekten() {
  return balken({ titel: 'Getötete oder verletzte Raupen beim Mähen', zeilen: INSEKTEN.map(([t, w]) => [t, w, `${w} %`]), max: 100, hervor: 2, quelle: qHumbert }) +
    balken({ titel: 'Antriebsleistung einer 10-m-Mähkombination', zeilen: LEISTUNG.map(([t, w]) => [t, w, `${w} kW`]), max: 130, hervor: 1, quelle: qTopagrar });
}

// Modell: Zucker im Futter bei Mähschwade und bei Breitablage mit frühem Zetten (Hochdruck, gemäht um 9 Uhr)
export function grafikZucker() {
  const wetter = stundenwetter(WETTER.find((w) => w.id === 'hoch'));
  const lauf = (ablage, zetten) => {
    const f = new Feld({ ...GRUNDPLAN, ablage, schnitthoehe: 7, zetterHoehe: 3, schwaderHoehe: 3 }, wetter, 9);
    f.maehen();
    const p = [[0, f.zustand().zucker]];
    while (f.t < 9 + 30) { if (zetten.includes(f.t)) f.zettenJetzt(); f.stunde(); p.push([f.t - 9, f.zustand().zucker]); }
    return p;
  };
  return verlauf({
    titel: 'Zucker im Futter nach dem Mähen (Spielmodell)',
    reihen: [{ name: 'Mähschwade, nicht gezettet', punkte: lauf(35, []), farbe: FARBEN[2] }, { name: 'Breitablage, nach 1 h gezettet', punkte: lauf(85, [10]), farbe: FARBEN[0] }],
    x: { min: 0, max: 30, ticks: [[0, '0 h'], [6, '6 h'], [12, '12 h'], [18, '18 h'], [24, '24 h'], [30, '30 h']] },
    y: { min: 100, max: 130, titel: 'Zucker, g/kg TS', ticks: [[100, '100'], [110, '110'], [120, '120'], [130, '130']] },
    legendeEintraege: [['Mähschwade, nicht gezettet', FARBEN[2]], ['Breitablage, nach 1 h gezettet', FARBEN[0]]],
    quelle: 'Rechnung des Spiels (Atmung nach Lehrmodell). Dass der Zucker nach dem Schnitt durch Photosynthese zunimmt, rechnet das Spiel nicht: Das ist eine Beratungsaussage ohne gesicherte Versuche.',
  });
}

// Grafiken für die Erklärkarten im Spiel (Schlüssel aus model.js, Feld «grafik»)
export const KARTEN_GRAFIK = { trocknung: () => grafikTrocknung(), ablage: grafikAblage, feldverluste: grafikFeldverluste, insekten: grafikInsekten };
