// Kleine Grafiken aus Messwerten und Modell: Balken als HTML (Schrift bleibt auf dem Handy lesbar),
// Verläufe als SVG. Farben über CSS-Variablen, damit Nacht- und Kontrastmodus mitziehen.
// Genutzt in den Erklärkarten des Spiels und auf der Lernseite (tools/seiten.mjs).
import { FAT_VERFAHREN, FAT_ABLAGE, INSEKTEN, LEISTUNG, QUELLE_FAT, QUELLE_HUMBERT, QUELLE_TOPAGRAR, ABB29, QUELLE_FAT1982 } from './versuche.js';
import { LUFT, ANLAGE } from './belueftung.js';
import { konstant } from './belueftung-vergleich.js';
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
export function verlauf({ titel, reihen, x, y, quelle = '', legendeEintraege = null, baender = [] }) {
  const B = 470, H = 270, L = 46, R = 10, O = 24, U = 236; // schmal, damit die Schrift auf dem Handy lesbar bleibt
  const px = (v) => L + (v - x.min) / (x.max - x.min) * (B - L - R);
  const py = (v) => U - (v - y.min) / (y.max - y.min) * (U - O);
  const s = [];
  for (const [v, t] of y.ticks) s.push(`<line x1="${L}" x2="${B - R}" y1="${py(v)}" y2="${py(v)}" stroke="var(--linie)"/><text x="${L - 6}" y="${py(v) + 5}" text-anchor="end">${esc(t)}</text>`);
  for (const [v, t] of x.ticks) s.push(`<line x1="${px(v)}" x2="${px(v)}" y1="${O}" y2="${U}" stroke="var(--linie)" stroke-dasharray="2 4"/><text x="${px(v)}" y="${U + 20}" text-anchor="middle">${esc(t)}</text>`);
  // Tage: Trennlinie und Datum oben
  for (const [a, b, t] of x.bereiche ?? []) s.push(`<line x1="${px(a)}" x2="${px(a)}" y1="${O - 18}" y2="${U}" stroke="var(--leise)"/><text x="${(px(a) + px(b)) / 2}" y="${O - 8}" text-anchor="middle" class="leise">${esc(t)}</text>`);
  if (y.titel) s.push(`<text x="4" y="${O - 8}" class="leise">${esc(y.titel)}</text>`);
  // Bänder hinter den Linien, z. B. Regenstunden: [von, bis, Farbe, Titel]
  for (const [a, b, farbe, t] of baender) s.push(`<rect x="${px(a).toFixed(1)}" y="${O}" width="${Math.max(1.5, px(b) - px(a)).toFixed(1)}" height="${U - O}" fill="${farbe}" fill-opacity="0.22">${t ? `<title>${esc(t)}</title>` : ''}</rect>`);
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

// ---------- Heubelüftung
// Kleines h,x-Diagramm wie in drywatch: Temperatur gegen absolute Feuchte (g/m³), Linien gleicher relativer Feuchte.
// aussen, zu, ab: { t, rh }; aussen ist optional
export function grafikHx({ aussen = null, zu, ab }) {
  const ymax = Math.max(25, Math.ceil((Math.max(LUFT.gm3(zu.t, 100), LUFT.gm3(ab.t, 100)) + 3) / 5) * 5);
  const kurve = (rh) => Array.from({ length: 81 }, (_, i) => [i / 2, LUFT.gm3(i / 2, rh)]).filter(([, y]) => y <= ymax);
  const pkt = (z) => [z.t, LUFT.gm3(z.t, z.rh)];
  const reihen = [
    { name: '100 % rF', punkte: kurve(100), farbe: 'var(--blau)' },
    { name: '80 % rF', punkte: kurve(80), farbe: 'var(--leise)', strich: true },
    { name: '60 % rF', punkte: kurve(60), farbe: 'var(--leise)', strich: true },
    { name: '40 % rF', punkte: kurve(40), farbe: 'var(--leise)', strich: true },
    { name: 'Weg der Luft', punkte: [...(aussen ? [pkt(aussen)] : []), pkt(zu), pkt(ab)], farbe: 'var(--text)' },
    ...(aussen ? [{ name: 'Aussenluft', punkte: [pkt(aussen)], farbe: 'var(--leise)', art: 'punkte' }] : []),
    { name: 'Zuluft', punkte: [pkt(zu)], farbe: 'var(--gelb-dunkel)', art: 'punkte' },
    { name: 'Abluft', punkte: [pkt(ab)], farbe: 'var(--gruen)', art: 'punkte' },
  ];
  const leg = [['Zuluft', 'var(--gelb-dunkel)'], ['Abluft', 'var(--gruen)'], ...(aussen ? [['Aussenluft', 'var(--leise)']] : []), ['100 % rF (gesättigt)', 'var(--blau)'], ['gestrichelt: 80, 60, 40 % rF', 'var(--leise)']];
  return verlauf({
    titel: 'Die Luft im h,x-Diagramm: Wassergehalt gegen Temperatur', reihen,
    x: { min: 0, max: 40, ticks: [[0, '0 °C'], [10, '10'], [20, '20'], [30, '30'], [40, '40 °C']] },
    y: { min: 0, max: ymax, titel: 'Wasser, g/m³', ticks: Array.from({ length: ymax / 5 + 1 }, (_, i) => [i * 5, String(i * 5)]) },
    legendeEintraege: leg,
    quelle: 'Im Heu kühlt sich die Luft ab, während sie Wasser aufnimmt: Sie wandert nach links oben, Richtung Sättigung. Je weiter, desto mehr Wasser trägt sie fort.',
  });
}

// Verlauf einer Belüftung (Ergebnis von Heustock.ergebnis()): TS und Stocktemperatur
export function grafikBelueftung(lauf) {
  if (!lauf?.verlauf?.length) return '';
  const v = lauf.verlauf, t0 = lauf.t0, max = Math.max(24, Math.ceil((v[v.length - 1].t - t0) / 24) * 24);
  const ticks = []; for (let h = 0; h <= max; h += max > 120 ? 48 : 24) ticks.push([h, `${h} h`]);
  const x = { min: 0, max, ticks };
  const ts = verlauf({
    titel: 'Belüftung: TS im Heustock', x,
    reihen: [
      { name: 'Ziel', punkte: [[0, ANLAGE.lagerTs], [max, ANLAGE.lagerTs]], farbe: 'var(--gruen)', strich: true },
      { name: 'Mittel', punkte: [[0, lauf.tsEin], ...v.map((p) => [p.t - t0, p.ts])], farbe: FARBEN[0] },
      { name: 'feuchteste Schicht (oben)', punkte: [[0, lauf.tsEin], ...v.map((p) => [p.t - t0, p.tsMin])], farbe: FARBEN[1] },
    ],
    y: { min: 50, max: 95, titel: 'TS', ticks: [[50, '50 %'], [60, '60 %'], [70, '70 %'], [80, '80 %'], [90, '90 %']] },
    legendeEintraege: [['Mittel des Stocks', FARBEN[0]], ['feuchteste Schicht', FARBEN[1]], [`lagerfähig ab ${ANLAGE.lagerTs} %`, 'var(--gruen)']],
  });
  const temp = verlauf({
    titel: 'Stocktemperatur (wärmste Schicht)', x,
    reihen: [
      { name: '35 °C', punkte: [[0, 35], [max, 35]], farbe: 'var(--rot)', strich: true },
      { name: 'Stock', punkte: v.map((p) => [p.t - t0, p.temp]), farbe: FARBEN[3] },
    ],
    y: { min: 10, max: Math.max(50, Math.ceil(lauf.tempMax / 10) * 10 + 10), titel: '°C', ticks: [[10, '10'], [20, '20'], [30, '30'], [40, '40'], [50, '50'], ...(lauf.tempMax > 45 ? [[60, '60'], [70, '70']] : [])] },
    legendeEintraege: [['Stock', FARBEN[3]], ['über 35 °C muss belüftet werden', 'var(--rot)']],
    quelle: 'Rechnung des Spiels. Grenzwerte: LK Salzburg (35 °C belüften, nie über 40 °C).',
  });
  return ts + temp;
}

// Modell gegen Richtwert: Wasserentzug je m³ Luft nach Luftfeuchte und TS (FAT 1982, Abb. 29)
export function grafikAbb29() {
  const reihen = [], leg = [];
  ABB29.kurven.forEach((k, i) => {
    const f = FARBEN[i];
    reihen.push({ name: `${k.name}, Spiel`, punkte: [35, 45, 55, 65, 75, 85, 95].map((rh) => [rh, konstant({ ts: k.ts, rh }).gm3]), farbe: f });
    reihen.push({ name: `${k.name}, FAT 1982`, punkte: k.punkte, farbe: f, art: 'punkte' });
    leg.push([k.name, f]);
  });
  reihen.push({ name: 'null', punkte: [[30, 0], [100, 0]], farbe: 'var(--leise)', strich: true });
  leg.push(['Linie = Spiel (20 °C), Kreis = FAT 1982', 'var(--leise)', 'nur-text']);
  return verlauf({
    titel: 'Wasserentzug je m³ Luft: Spiel gegen FAT 1982', reihen,
    x: { min: 30, max: 100, ticks: [[40, '40 %'], [60, '60 %'], [80, '80 %'], [100, '100 % rF']] },
    y: { min: -1, max: 4.5, titel: 'g Wasser je m³', ticks: [[-1, '−1'], [0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4']] },
    legendeEintraege: leg,
    quelle: `<a href="${QUELLE_FAT1982.url}" rel="noopener">${esc(QUELLE_FAT1982.titel)}</a>, Abb. 29 (aus der Grafik abgelesen). Unter null nimmt das Heu Wasser aus der Luft auf.`,
  });
}

// Grafiken für die Erklärkarten im Spiel (Schlüssel aus model.js, Feld «grafik»; daten = Feld «grafikDaten»)
export const KARTEN_GRAFIK = {
  belueftung: (lauf) => grafikBelueftung(lauf),
  trocknung: () => grafikTrocknung(), ablage: grafikAblage, feldverluste: grafikFeldverluste,
  insekten: () => grafikInsekten() + '<p><a class="knopflink" href="lernen.html#bff">Exkurs: Biodiversitätsförderflächen und schlau mähen</a></p>',
};
