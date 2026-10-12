// Seitenansichten der Maschinen für die Einstellungen (SVG als Text)

const PX = 8; // Pixel je cm
const BODEN = 128;
const fmt = (x) => String(x).replace('.', ',');

function boden(breite = 260) {
  return `<rect x="0" y="${BODEN}" width="${breite}" height="22" fill="#8b6a45"/>
    <path d="M0 ${BODEN} h${breite}" stroke="#6b4f30" stroke-width="2"/>`;
}

function stoppeln(x0, x1, cm, farbe = '#5e9a3a') {
  let s = '';
  for (let x = x0; x <= x1; x += 6) {
    const h = cm * PX * (0.9 + ((x * 37) % 10) / 50);
    s += `<path d="M${x} ${BODEN} l${(x % 3) - 1} ${-h}" stroke="${farbe}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  return s;
}

function lineal(x, bis, markiert) {
  let s = `<path d="M${x} ${BODEN} V${BODEN - bis * PX}" stroke="var(--leise)" stroke-width="1.5"/>`;
  for (let c = 0; c <= bis; c++) {
    const y = BODEN - c * PX;
    s += `<path d="M${x} ${y} h${c % 5 === 0 ? 8 : 4}" stroke="var(--leise)"/>`;
    if (c % 2 === 0) s += `<text x="${x + 11}" y="${y + 3.5}" font-size="9" fill="var(--leise)">${c}</text>`;
  }
  if (markiert != null) {
    const y = BODEN - markiert * PX;
    s += `<path d="M${x - 6} ${y} h18" stroke="var(--rot)" stroke-width="2.5"/>`;
  }
  return s;
}

const staub = (x, y) => [0, 1, 2, 3, 4, 5, 6].map((i) =>
  `<circle cx="${x + Math.cos(i) * (6 + i * 3)}" cy="${y - Math.abs(Math.sin(i * 1.3)) * (4 + i * 2)}" r="${2.6 - i * 0.25}" fill="#8b5e34"/>`).join('');

// Mähwerk von der Seite: Stoppeln in der gewählten Höhe, Messerteller, Lineal
export function schnittBild(cm) {
  const y = BODEN - cm * PX;
  const erde = cm <= 5;
  return `<svg viewBox="0 0 260 150" class="maschinenbild" role="img" aria-label="Mähwerk, Schnitthöhe ${cm} cm">
    ${boden()}
    ${stoppeln(8, 120, cm)}
    ${stoppeln(150, 214, 20, '#4f8f32').replace(/stroke-width="2.4"/g, 'stroke-width="2"')}
    <rect x="118" y="${y - 30}" width="44" height="22" rx="4" fill="#c62828"/>
    <path d="M140 ${y - 30} V${y - 50} H190" stroke="#555" stroke-width="5" fill="none"/>
    <ellipse cx="140" cy="${y - 4}" rx="30" ry="6" fill="#444"/>
    <path d="M110 ${y - 3} l-10 3 M170 ${y - 3} l10 3" stroke="#bbb" stroke-width="3"/>
    ${erde ? staub(120, BODEN - 2) + `<text x="8" y="20" font-size="12" font-weight="700" fill="var(--rot)">Erde im Futter!</text>` : ''}
    ${cm >= 10 ? `<text x="8" y="20" font-size="12" font-weight="700" fill="var(--gelb-dunkel)">Ertrag bleibt stehen</text>` : ''}
    ${lineal(228, 12, cm)}
    <text x="228" y="16" font-size="13" font-weight="700" fill="var(--text)" text-anchor="middle">${cm} cm</text>
  </svg>`;
}

// Aufbereiter-Typen (kleine Prinzipskizzen)
export function aufbereiterBild(typ) {
  const halm = '<path d="M4 58 C30 52 60 60 116 54" stroke="#4f8f32" stroke-width="5" fill="none" stroke-linecap="round"/>';
  const rotor = (cx, cy, r = 16) => {
    let s = `<circle cx="${cx}" cy="${cy}" r="6" fill="#555"/>`;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      s += `<path d="M${cx} ${cy} L${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r} l${Math.cos(a + 0.6) * 5} ${Math.sin(a + 0.6) * 5}" stroke="#e0a020" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
    return s;
  };
  const walze = (cx, cy) => {
    let s = `<circle cx="${cx}" cy="${cy}" r="12" fill="#666"/>`;
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      s += `<rect x="${cx - 2.5}" y="${cy - 16}" width="5" height="6" fill="#666" transform="rotate(${(a * 180) / Math.PI} ${cx} ${cy})"/>`;
    }
    return s;
  };
  // Bürstenwalze: Kern mit dichten Borsten
  const buerste = (cx, cy) => {
    let s = '';
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      s += `<path d="M${cx + Math.cos(a) * 6} ${cy + Math.sin(a) * 6} L${cx + Math.cos(a) * 15} ${cy + Math.sin(a) * 15}" stroke="#3b3b3b" stroke-width="1.6"/>`;
    }
    return s + `<circle cx="${cx}" cy="${cy}" r="6" fill="#777"/>`;
  };
  const inhalt = {
    ohne: `${halm}<ellipse cx="60" cy="66" rx="34" ry="6" fill="#444"/><text x="60" y="24" font-size="11" text-anchor="middle" fill="var(--leise)">nur Mähwerk</text>`,
    zinken: `${rotor(60, 36)}${halm}<path d="M38 18 Q60 4 82 18" stroke="#999" stroke-width="3" fill="none"/>`,
    walzen: `${walze(60, 34)}${walze(60, 76)}<path d="M4 56 C30 52 60 56 116 54" stroke="#4f8f32" stroke-width="5" fill="none"/>`,
    buerste: `${rotor(44, 34, 15)}${buerste(86, 40)}${halm}<path d="M16 64 l-10 6 M104 64 l10 6" stroke="#4f8f32" stroke-width="3"/>`,
  }[typ];
  return `<svg viewBox="0 0 120 90" class="symbol gross" aria-hidden="true">${inhalt}</svg>`;
}

// Ablage von oben: breit über die ganze Fläche oder schmale Schwade
export function ablageBild(breit) {
  let halme = '';
  const x0 = breit ? 8 : 42, x1 = breit ? 112 : 78;
  for (let i = 0; i < 46; i++) {
    const x = x0 + ((i * 37) % 100) / 100 * (x1 - x0), y = 30 + ((i * 53) % 100) / 100 * 52;
    halme += `<path d="M${x} ${y} l${(i % 5) - 2} 7" stroke="#6f9c35" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 120 90" class="symbol gross" aria-hidden="true">
    <rect x="0" y="22" width="120" height="68" fill="#9fb56a" rx="4"/>${halme}
    <rect x="44" y="2" width="32" height="18" rx="3" fill="#2e7d32"/><rect x="6" y="18" width="108" height="5" rx="2" fill="#c62828"/>
  </svg>`;
}

// Zetter oder Schwader von der Seite: Stoppeln, Futter darauf, Zinkenspitze in gewählter Höhe
export function zinkenBild(cm, art, stoppelCm) {
  const leer = cm == null;
  const h = leer ? 4 : cm;
  const spitze = BODEN - h * PX;
  const stY = BODEN - stoppelCm * PX;
  const farbe = leer ? '#aaa' : '#e0a020';
  const kratzt = !leer && cm < 2;
  const liegtLiegen = !leer && cm > 4;
  let futter = '';
  for (let i = 0; i < 26; i++) {
    const x = 10 + ((i * 41) % 100) * 1.9, y = stY - 4 - ((i * 23) % 10) * 1.2;
    futter += `<path d="M${x} ${y} l14 ${(i % 3) - 1.5}" stroke="#a3a843" stroke-width="3" stroke-linecap="round"/>`;
  }
  const geraet = art === 'zetten'
    ? `<circle cx="120" cy="${spitze - 46}" r="8" fill="#555"/>
       <path d="M120 ${spitze - 46} L82 ${spitze - 26} M120 ${spitze - 46} L158 ${spitze - 26}" stroke="#555" stroke-width="4"/>
       <path d="M82 ${spitze - 26} q-4 18 -2 26 M158 ${spitze - 26} q4 18 2 26" stroke="${farbe}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    : `<rect x="70" y="${spitze - 60}" width="100" height="6" rx="3" fill="#555"/>
       ${[78, 98, 118, 138, 158].map((x) => `<path d="M${x} ${spitze - 54} V${spitze}" stroke="${farbe}" stroke-width="3.5" stroke-linecap="round"/>`).join('')}`;
  return `<svg viewBox="0 0 260 150" class="maschinenbild" role="img" aria-label="${art === 'zetten' ? 'Kreiselzetter' : 'Schwader'}, Zinken ${leer ? 'nicht eingestellt' : fmt(cm) + ' cm über Boden'}">
    ${boden()}
    ${stoppeln(8, 205, stoppelCm)}
    ${futter}
    ${geraet}
    ${kratzt ? staub(118, BODEN - 1) + `<text x="8" y="18" font-size="12" font-weight="700" fill="var(--rot)">Zinken kratzen im Boden</text>` : ''}
    ${liegtLiegen ? `<text x="8" y="18" font-size="12" font-weight="700" fill="var(--gelb-dunkel)">Futter bleibt liegen</text>` : ''}
    ${leer ? `<text x="120" y="22" font-size="13" font-weight="700" fill="var(--leise)" text-anchor="middle">Zinkenhöhe einstellen ↓</text>` : ''}
    ${lineal(228, 12, leer ? null : cm)}
    <text x="228" y="16" font-size="13" font-weight="700" fill="var(--text)" text-anchor="middle">${leer ? '?' : fmt(cm) + ' cm'}</text>
  </svg>`;
}
