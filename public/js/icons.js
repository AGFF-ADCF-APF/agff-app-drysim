// Kleine SVG-Symbole für Wetterbericht und Arbeitsgänge

const svg = (inhalt, vb = '0 0 48 48') => `<svg viewBox="${vb}" aria-hidden="true" class="symbol">${inhalt}</svg>`;
const SONNE = '<circle cx="24" cy="24" r="9" fill="#f6b91a"/><g stroke="#f6b91a" stroke-width="3" stroke-linecap="round"><path d="M24 6v5M24 37v5M6 24h5M37 24h5M11 11l3.5 3.5M33.5 33.5L37 37M11 37l3.5-3.5M33.5 14.5L37 11"/></g>';
const WOLKE = (dx = 0, dy = 0, f = '#c9d3dc') => `<g transform="translate(${dx} ${dy})" fill="${f}"><ellipse cx="24" cy="30" rx="15" ry="8"/><circle cx="18" cy="26" r="8"/><circle cx="28" cy="23" r="10"/></g>`;
const TROPFEN = '<g stroke="#3b82c4" stroke-width="2.5" stroke-linecap="round"><path d="M16 40l-2 5M24 40l-2 5M32 40l-2 5"/></g>';
const BLITZ = '<path d="M26 34l-6 8h5l-3 6 8-10h-5l3-4z" fill="#f6b91a"/>';

export function wetterSymbol(tag) {
  const mm = (tag.regen ?? []).reduce((a, r) => a + r.mm, 0);
  if (mm >= 8) return svg(WOLKE(0, -4, '#8a96a3') + TROPFEN + BLITZ);
  if (mm > 0) return svg(SONNE.replace('cx="24" cy="24"', 'cx="16" cy="16"') + WOLKE(4, -2, '#9aa6b2') + TROPFEN);
  if (tag.sonne >= 0.8) return svg(SONNE);
  if (tag.sonne >= 0.45) return svg(`<g transform="translate(-6 -6)">${SONNE}</g>` + WOLKE(4, 4, '#dfe5ea'));
  return svg(WOLKE(0, 0, '#b6c1cb') + WOLKE(-8, -8, '#d5dce2'));
}

export function stundenSymbol(w) {
  if (w.regen > 0) return svg(WOLKE(0, -4, '#8a96a3') + TROPFEN);
  if (w.rad === 0) return svg('<path d="M30 10a14 14 0 1 0 8 24a12 12 0 0 1-8-24z" fill="#e8e3c8"/>');
  return w.sonne >= 0.7 ? svg(SONNE) : svg(`<g transform="translate(-6 -6)">${SONNE}</g>` + WOLKE(4, 4, '#dfe5ea'));
}

export const AKTION = {
  maehen: svg('<path d="M6 34h36" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M10 34l4-6 4 6 4-6 4 6 4-6 4 6 4-6" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M12 26c2-10 4-14 4-18M22 26c0-8 2-12 5-16M32 26c1-7-1-12-2-16" stroke="#3b8a2e" stroke-width="3" fill="none" stroke-linecap="round"/>'),
  zetten: svg('<g fill="none" stroke="currentColor" stroke-width="3"><circle cx="15" cy="28" r="9"/><circle cx="33" cy="28" r="9"/><path d="M6 28h18M15 19v18M24 28h18M33 19v18" stroke-width="2"/></g><path d="M8 12c4-3 8-3 12 0M28 10c4-3 8-3 12 0" stroke="#a3a843" stroke-width="3" fill="none" stroke-linecap="round"/>'),
  schwaden: svg('<path d="M6 16h30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><g stroke="currentColor" stroke-width="2.5"><path d="M10 16v10M16 16v10M22 16v10M28 16v10M34 16v10"/></g><ellipse cx="24" cy="38" rx="18" ry="5" fill="#a3a843"/>'),
  ernte: svg('<rect x="4" y="14" width="30" height="20" rx="2" fill="currentColor"/><path d="M4 14h30v-5H4z" fill="#a3a843"/><circle cx="12" cy="37" r="5" fill="#333"/><circle cx="26" cy="37" r="5" fill="#333"/><path d="M34 26h10" stroke="currentColor" stroke-width="3"/>'),
};

export const STERN = (voll) => svg(`<path d="M24 4l6 13 14 1.5-10.5 9.5 3 14L24 35l-12.5 7 3-14L4 18.5 18 17z" fill="${voll ? '#f6b91a' : 'none'}" stroke="#f6b91a" stroke-width="2.5" stroke-linejoin="round"/>`);
