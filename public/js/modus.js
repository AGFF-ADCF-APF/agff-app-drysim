// Darstellungsumschalter: ein Knopf mit Symbol, schaltet reihum Normal → Draussen → Nacht → Normal
// (gleiches Muster wie Futter v2). Die Wahl wird im Browser gemerkt (siehe boot.js).
const SONNE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
const KONTRAST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>';

export function modus() {
  const d = document.documentElement.dataset;
  return d.outdoor === '1' ? 'draussen' : d.theme === 'dark' ? 'nacht' : 'normal';
}
function setzen(m) {
  const d = document.documentElement.dataset;
  if (m === 'draussen') { d.outdoor = '1'; d.theme = 'light'; } else { delete d.outdoor; if (m === 'nacht') d.theme = 'dark'; else delete d.theme; }
  try { localStorage.setItem('drysimOutdoor', m === 'draussen' ? '1' : '0'); localStorage.setItem('drysimTheme', d.theme || ''); } catch { /* egal */ }
}
const TEXT = {
  normal: 'Darstellung: Normal (tippen: Draussen)',
  draussen: 'Darstellung: Draussen, hoher Kontrast (tippen: Nacht)',
  nacht: 'Darstellung: Nacht (tippen: Normal)',
};
const MELDUNG = {
  normal: 'Normale Darstellung',
  draussen: 'Modus «Draussen»: hoher Kontrast, grosse Schaltflächen',
  nacht: 'Nachtmodus: dunkle Darstellung',
};
let toastEl = null, toastTimer = null;
function toast(text) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.append(toastEl); }
  toastEl.textContent = text; toastEl.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
}
function zeichnen(b) {
  const m = modus();
  b.innerHTML = m === 'nacht' ? MOND : m === 'draussen' ? KONTRAST : SONNE;
  b.title = TEXT[m]; b.setAttribute('aria-label', TEXT[m]);
}
export function initModus(b) {
  zeichnen(b);
  b.addEventListener('click', () => {
    const n = { normal: 'draussen', draussen: 'nacht', nacht: 'normal' }[modus()];
    setzen(n); zeichnen(b); toast(MELDUNG[n]);
  });
}
const knopf = document.getElementById('modus');
if (knopf) initModus(knopf);
