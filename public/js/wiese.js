// Bilder für die Wiese: Pflanzenmischung, Entwicklungsstadium, Ertrag, Boden (SVG als Text)

const rnd = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

function gras(x, y, h, r, aehre = false) {
  const g = ['#3f8a2e', '#4f9a38', '#5fa843'][Math.floor(r() * 3)];
  let s = '';
  for (const [dx, k] of [[-6, -0.9], [1, 0.1], [7, 0.8]]) {
    const hh = h * (0.75 + r() * 0.3);
    s += `<path d="M${x} ${y} Q${x + dx * 0.3} ${y - hh * 0.6} ${x + dx + k * 3} ${y - hh}" stroke="${g}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  }
  if (aehre) {
    // Rispe: dünner Halm mit kleinen Ährchen
    const ty = y - h * 1.08;
    s += `<path d="M${x} ${y} Q${x + 2} ${y - h * 0.6} ${x + 1} ${ty}" stroke="#6f9a3a" stroke-width="1.2" fill="none"/>`;
    for (let i = 0; i < 4; i++) s += `<ellipse cx="${x + 1 + (i % 2 ? 2.5 : -2.5)}" cy="${ty + 2 + i * 3}" rx="1.8" ry="1.1" fill="#a9b55a"/>`;
  }
  return s;
}

function klee(x, y, h, r, bluete) {
  const top = y - h * (0.55 + r() * 0.3);
  let s = `<path d="M${x} ${y} Q${x - 2} ${(y + top) / 2} ${x} ${top}" stroke="#4a8a3a" stroke-width="1.6" fill="none"/>`;
  for (const a of [-90, 30, 150]) {
    const rad = (a * Math.PI) / 180;
    s += `<ellipse cx="${x + Math.cos(rad) * 5.4}" cy="${top + Math.sin(rad) * 5.4}" rx="5.6" ry="4.6" transform="rotate(${a + 90} ${x + Math.cos(rad) * 5.4} ${top + Math.sin(rad) * 5.4})" fill="#2f7a3a"/>`;
  }
  s += `<path d="M${x - 2} ${top - 2} l2 2 l2 -2" stroke="#9fd39a" stroke-width="0.9" fill="none"/>`;
  if (bluete) {
    const bx = x + 8, by = top - 13;
    s += `<path d="M${x} ${top} Q${x + 4} ${top - 4} ${bx} ${by + 4}" stroke="#4a8a3a" stroke-width="1.4" fill="none"/>`;
    const farbe = r() > 0.5 ? ['#f7f4f8', '#e2dde6'] : ['#e9a6c8', '#c9739f'];
    s += `<circle cx="${bx}" cy="${by}" r="6" fill="${farbe[1]}"/>` +
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<circle cx="${bx + Math.cos(i * 0.8) * 3.6}" cy="${by + Math.sin(i * 0.8) * 3.6 - 1}" r="2.4" fill="${farbe[0]}"/>`).join('');
  }
  return s;
}

function kraut(x, y, h, r) {
  const top = y - h * (0.8 + r() * 0.25);
  const gelb = r() > 0.4;
  let s = `<path d="M${x} ${y} Q${x + 3} ${(y + top) / 2} ${x} ${top}" stroke="#4a8a3a" stroke-width="1.6" fill="none"/>`;
  s += `<path d="M${x} ${y} q-10 -4 -14 -2 q6 -1 7 -4 q-5 0 -6 -3 q8 1 13 9" fill="#4f9a38"/>`;
  if (gelb) {
    s += Array.from({ length: 10 }, (_, i) => {
      const a = (i * Math.PI) / 5;
      return `<ellipse cx="${x + Math.cos(a) * 5}" cy="${top + Math.sin(a) * 5}" rx="3.4" ry="1.6" transform="rotate(${(a * 180) / Math.PI} ${x + Math.cos(a) * 4} ${top + Math.sin(a) * 4})" fill="#f4c20d"/>`;
    }).join('') + `<circle cx="${x}" cy="${top}" r="3" fill="#e09a00"/>`;
  } else {
    s += [[-4, 0], [0, -3], [4, 0], [-2, 3], [2, 3], [0, 1]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${top + dy}" r="2" fill="#fbfaf4" stroke="#ddd" stroke-width="0.5"/>`).join('');
  }
  return s;
}

const ANTEILE = { graeser: [0.9, 0.05, 0.05], ausgewogen: [0.5, 0.3, 0.2], klee: [0.25, 0.68, 0.07] };

export function bestandBild(typ) {
  const r = rnd(typ.length * 31 + 7);
  const [g, k] = ANTEILE[typ];
  let pflanzen = '';
  for (let x = 10; x <= 190; x += 8.5) {
    const y = 96 + r() * 6, wahl = r();
    pflanzen += wahl < g ? gras(x, y, 52 + r() * 22, r, r() > 0.7) : wahl < g + k ? klee(x, y, 40, r, r() > 0.35) : kraut(x, y, 46, r);
  }
  return `<svg viewBox="0 0 200 110" class="wiesenbild" aria-hidden="true">
    <rect x="0" y="0" width="200" height="110" rx="10" fill="#e6f1f8"/>
    <path d="M0 70 Q60 58 120 66 T200 62 V110 H0 Z" fill="#b9d89a"/>
    <path d="M0 92 Q100 84 200 92 V110 H0 Z" fill="#7fae55"/>
    ${pflanzen}
  </svg>`;
}

// Ein Grashalm im Entwicklungsstadium 2 (Schossen), 3 (Ähren-/Rispenschieben), 4 (Beginn Blüte)
export function stadiumBild(st) {
  const hoehe = { 2: 50, 3: 66, 4: 76 }[st];
  const y0 = 112, top = y0 - hoehe;
  let s = `<path d="M40 ${y0} C41 ${y0 - 30} 39 ${top + 30} 40 ${top + 14}" stroke="#4f9a38" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  // Blätter abwechselnd
  [[0.25, -1], [0.45, 1], [0.65, -1]].forEach(([f, seite]) => {
    const y = y0 - hoehe * f;
    s += `<path d="M40 ${y} Q${40 + seite * 16} ${y - 6} ${40 + seite * 28} ${y + 6}" stroke="#5fa843" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
    s += `<circle cx="40" cy="${y}" r="2.2" fill="#3f7f2e"/>`;
  });
  // Fahnenblatt
  s += `<path d="M40 ${top + 26} Q${52} ${top + 18} 60 ${top + 4}" stroke="#5fa843" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  if (st === 2) {
    s += `<path d="M40 ${top + 26} q-1 -10 0 -16" stroke="#4f9a38" stroke-width="5" stroke-linecap="round"/>`;
  } else {
    const sichtbar = st === 3 ? 0.55 : 1;
    const laenge = 30 * sichtbar;
    s += `<path d="M40 ${top + 22} q-2 -6 0 -10" stroke="#4f9a38" stroke-width="6" stroke-linecap="round"/>`;
    for (let i = 0; i < 7 * sichtbar; i++) {
      const y = top + 10 - i * 4.2;
      s += `<ellipse cx="${40 + (i % 2 ? 3 : -3)}" cy="${y}" rx="3" ry="2.4" fill="${st === 4 ? '#a7b44a' : '#8fb84a'}"/>`;
      if (st === 4 && i % 2 === 0) s += `<path d="M${40 + (i % 4 ? 6 : -6)} ${y} l${i % 4 ? 3 : -3} 4" stroke="#c9b100" stroke-width="1"/><circle cx="${40 + (i % 4 ? 9 : -9)}" cy="${y + 5}" r="1.5" fill="#f2d21b"/>`;
    }
    s += `<path d="M40 ${top + 12} V${top + 12 - laenge}" stroke="#7aa040" stroke-width="1.2"/>`;
  }
  return `<svg viewBox="0 0 80 120" class="pflanzenbild" aria-hidden="true">
    <path d="M10 ${y0} H70" stroke="#8b6a45" stroke-width="4" stroke-linecap="round"/>${s}</svg>`;
}

// Bestandesdichte: mehr Ertrag = mehr und höhere Halme
export function ertragBild(dt) {
  const r = rnd(5);
  const n = Math.round(10 + dt * 1.1), h = 18 + dt * 0.9;
  let s = '';
  for (let i = 0; i < n; i++) s += gras(6 + (i / n) * 228 + r() * 3, 66, h, r, false);
  return `<svg viewBox="0 0 240 72" class="wiesenbild" aria-hidden="true">
    <rect x="0" y="0" width="240" height="72" rx="10" fill="#e6f1f8"/>
    <path d="M0 64 H240 V72 H0 Z" fill="#8b6a45"/>${s}</svg>`;
}

export function bodenBild(typ) {
  const r = rnd(3);
  let s = '';
  for (let x = 4; x < 120; x += 6) s += gras(x, 60, 14 + r() * 6, r);
  if (typ === 'maulwurf') {
    for (const [x, b] of [[26, 20], [70, 26], [102, 16]]) {
      s += `<path d="M${x - b / 2} 62 Q${x - b / 4} ${62 - b * 0.7} ${x} ${62 - b * 0.75} Q${x + b / 4} ${62 - b * 0.7} ${x + b / 2} 62 Z" fill="#7a5532"/>`;
      s += `<circle cx="${x - 3}" cy="${62 - b * 0.5}" r="1.6" fill="#5c3d22"/><circle cx="${x + 4}" cy="${62 - b * 0.35}" r="1.3" fill="#5c3d22"/>`;
    }
  }
  return `<svg viewBox="0 0 120 70" class="symbol gross" aria-hidden="true">
    <rect x="0" y="0" width="120" height="70" rx="8" fill="#e6f1f8"/>
    <path d="M0 60 H120 V70 H0 Z" fill="#8b6a45"/>${s}</svg>`;
}
