// Traktor-Assistent: kurze Lernhilfe je Schritt und je Ereignis im Spiel (feste Texte, keine KI).
// Gleiches Muster wie in Futter v2:
// - meldet sich beim ersten Besuch eines Schritts mit einer kleinen Blase, die sich beim Antippen öffnet
// - «Ruhe, bitte» schickt ihn schlafen (zZ); Antippen weckt ihn wieder
// - Texte «einfach» (Alltagssprache) oder «fachlich» (Zahlen und Quellen)
// Zustand nur auf diesem Gerät (localStorage, reine Bequemlichkeit).
import { T } from './assistent-texte.js';

const KEY = 'drysimAssistent';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function lade() {
  let z = null;
  try { z = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { z = null; }
  z = z && typeof z === 'object' ? z : {};
  return {
    ruhe: z.ruhe === true,
    stufe: z.stufe === 'fachlich' ? 'fachlich' : 'einfach',
    gesehen: Array.isArray(z.gesehen) ? z.gesehen.filter((x) => typeof x === 'string').slice(-200) : [],
  };
}
let Z = lade();
const merken = () => { try { localStorage.setItem(KEY, JSON.stringify(Z)); } catch { /* privater Modus: dann eben jedes Mal */ } };

const TRAKTOR = '<svg viewBox="0 0 64 56" width="58" height="51" aria-hidden="true">'
  + '<rect x="4" y="22" width="34" height="16" rx="4" fill="#2f9e5f"/><rect x="30" y="8" width="20" height="24" rx="4" fill="#1f7a49"/>'
  + '<rect x="33" y="11" width="14" height="11" rx="2" fill="#dff3ff"/><circle class="aug" cx="37" cy="16.5" r="1.8" fill="#17221e"/><circle class="aug" cx="43" cy="16.5" r="1.8" fill="#17221e"/>'
  + '<path class="mund" d="M37 20 q3 2.4 6 0" stroke="#17221e" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
  + '<rect x="9" y="12" width="3" height="11" rx="1" fill="#4b5a54"/><circle cx="46" cy="40" r="12" fill="#2b2f2d"/><circle cx="46" cy="40" r="5" fill="#f6c35b"/>'
  + '<circle cx="14" cy="44" r="8" fill="#2b2f2d"/><circle cx="14" cy="44" r="3.4" fill="#f6c35b"/><rect x="2" y="27" width="5" height="5" rx="1" fill="#f6c35b"/></svg>';

let el = null, bubble = null, btn = null;
let aktKey = null, aktDyn = null; // zuletzt gemeldeter Schritt oder Ereignis
let angezeigt = null;             // Schlüssel der gerade sichtbaren Blase
let offen = false;                // grosse Blase offen
let teaserTimer = null;
const wartend = [];               // weitere Blasen, die noch warten (höchstens drei)

/** Einträge können zur Laufzeit überschrieben werden (z. B. Lernziel eines Szenarios). */
const eintrag = (key, dyn) => (dyn ? { ...(T[key] || {}), ...dyn, roh: false } : { ...T[key], roh: true });

function baue() {
  if (el) return;
  el = document.createElement('div');
  el.className = 'assist';
  el.hidden = true;
  el.innerHTML = '<div class="assist-bubble" role="dialog" aria-live="polite" tabindex="-1" hidden></div>'
    + `<button type="button" class="assist-btn" aria-label="Traktor-Assistent: Tipp zu diesem Schritt">${TRAKTOR}<span class="zz" aria-hidden="true">zZ</span></button>`;
  document.body.appendChild(el);
  bubble = el.querySelector('.assist-bubble');
  btn = el.querySelector('.assist-btn');
  el.addEventListener('click', klick);
  // Tippen ausserhalb schliesst die grosse Blase (der Tipp wirkt trotzdem auf das Ziel)
  document.addEventListener('pointerdown', (e) => { if (offen && !el.contains(e.target)) schliesse(false); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && offen) { schliesse(true); } });
}

const textVon = (e) => {
  const t = Z.stufe === 'fachlich' ? e.fachlich : e.einfach;
  return e.roh ? t : esc(t);
};

function volltext(key, dyn) {
  const e = eintrag(key, dyn);
  const fach = Z.stufe === 'fachlich';
  const titel = esc(e.titel || '');
  return `<div class="assist-head"><b>${titel}</b><button type="button" class="assist-x" data-as="zu" aria-label="Schliessen">×</button></div>`
    + `<div class="assist-text">${textVon(e)}</div>`
    + (e.lernen !== undefined ? `<p class="assist-link"><a href="lernen.html${e.lernen ? '#' + e.lernen : ''}" target="_blank" rel="noopener">Mehr dazu auf der Lernseite</a></p>` : '')
    + '<div class="assist-foot"><div class="seg" role="group" aria-label="Textstufe">'
    + `<button type="button" data-as="stufe" data-v="einfach" aria-pressed="${!fach}">Einfach</button>`
    + `<button type="button" data-as="stufe" data-v="fachlich" aria-pressed="${fach}">Fachlich</button></div>`
    + '<button type="button" class="leise-knopf" data-as="ruhe">Ruhe, bitte</button></div>';
}

function merkeGesehen(key) {
  if (!Z.gesehen.includes(key)) { Z.gesehen.push(key); merken(); }
}

/** Kleine Blase: nur ein Angebot, verdeckt nichts. Öffnet sich beim Antippen. */
function teaser(key, dyn, vorrang = false) {
  baue();
  if (offen) return;                       // wer gerade liest, wird nicht unterbrochen
  if (angezeigt && !bubble.hidden && bubble.classList.contains('kurz') && !vorrang) {
    if (!wartend.some((w) => w.key === key)) { wartend.push({ key, dyn }); wartend.splice(0, Math.max(0, wartend.length - 3)); }
    return;
  }
  const e = eintrag(key, dyn);
  angezeigt = key; clearTimeout(teaserTimer);
  bubble.classList.add('kurz');
  bubble.innerHTML = `<button type="button" class="assist-teaser" data-as="mehr" data-key="${esc(key)}"><b>${esc(e.titel || '')}</b><span>Tipp mich an für mehr.</span></button>`;
  bubble.hidden = false;
  el.classList.add('offen');
  // als gesehen gilt eine Blase erst, wenn sie kurz stehen blieb (wird sie sofort ersetzt, kommt sie später nochmals)
  setTimeout(() => { if (angezeigt === key) merkeGesehen(key); }, 1200);
  teaserTimer = setTimeout(() => { if (bubble.classList.contains('kurz')) zuTeaser(); }, 9000);
}
/** Eine neue Station macht alte Blasen und Wartende hinfällig. */
function verwerfeTeaser() {
  wartend.length = 0;
  if (bubble && !offen && !bubble.hidden && bubble.classList.contains('kurz')) {
    clearTimeout(teaserTimer); bubble.hidden = true; bubble.classList.remove('kurz'); el.classList.remove('offen'); angezeigt = null;
  }
}
function zuTeaser() {
  clearTimeout(teaserTimer);
  bubble.hidden = true; bubble.classList.remove('kurz'); el.classList.remove('offen'); angezeigt = null;
  const n = wartend.shift();
  if (n && !Z.ruhe) setTimeout(() => teaser(n.key, n.dyn), 400);
}

function oeffne(key, dyn) {
  baue(); clearTimeout(teaserTimer);
  angezeigt = key; offen = true; wartend.length = 0;
  bubble.classList.remove('kurz');
  bubble.innerHTML = volltext(key, dyn);
  bubble.hidden = false; el.classList.add('offen');
  merkeGesehen(key);
  Assistent.beiOeffnen?.();
  bubble.focus({ preventScroll: true });
}
function schliesse(zumKnopf) {
  if (!el) return;
  clearTimeout(teaserTimer); offen = false; angezeigt = null;
  bubble.hidden = true; bubble.classList.remove('kurz'); el.classList.remove('offen');
  if (zumKnopf) btn.focus({ preventScroll: true });
}

function klick(e) {
  const t = e.target.closest('[data-as], .assist-btn');
  if (!t) return;
  if (t.classList.contains('assist-btn')) {
    if (Z.ruhe) { Z.ruhe = false; merken(); el.classList.remove('schlaeft'); }
    if (offen) { schliesse(false); return; }
    const key = angezeigt ?? aktKey;
    if (key) oeffne(key, aktDyn?.key === key ? aktDyn.dyn : null);
    return;
  }
  const a = t.dataset.as;
  if (a === 'zu') schliesse(true);
  if (a === 'mehr') { const key = t.dataset.key; oeffne(key, aktDyn?.key === key ? aktDyn.dyn : null); }
  if (a === 'stufe') { Z.stufe = t.dataset.v === 'fachlich' ? 'fachlich' : 'einfach'; merken(); oeffne(angezeigt, aktDyn?.key === angezeigt ? aktDyn.dyn : null); }
  if (a === 'ruhe') { Z.ruhe = true; merken(); schliesse(false); wartend.length = 0; el.classList.add('schlaeft'); }
}

export const Assistent = {
  /** Wird aufgerufen, wenn die grosse Blase aufgeht (das Spiel pausiert dann). */
  beiOeffnen: null,

  /** Neuer Schritt (Bildschirm, Abschnitt, Phase). Meldet sich beim ersten Besuch von selbst. */
  kontext(key, dyn = null) {
    baue();
    if (!key || (!T[key] && !dyn)) { el.hidden = true; schliesse(false); aktKey = null; return; }
    el.hidden = false; el.classList.toggle('schlaeft', Z.ruhe);
    if (key === aktKey && !dyn) return;
    aktKey = key; aktDyn = dyn ? { key, dyn } : null;
    if (offen) schliesse(false);
    verwerfeTeaser();
    if (!Z.ruhe && !Z.gesehen.includes(key)) teaser(key, dyn);
  },

  /** Ereignis (Regen, Zielbereich …) oder Rückmeldung zu einer Einstellung. Warnungen («immer») kommen bei jedem Mal. */
  hinweis(key, dyn = null) {
    baue();
    const e = T[key];
    if (!e && !dyn) return;
    const neu = !!(e && e.immer) || !Z.gesehen.includes(key);
    if (!neu) return;
    el.hidden = false; el.classList.toggle('schlaeft', Z.ruhe);
    aktKey = key; aktDyn = dyn ? { key, dyn } : null;
    if (!Z.ruhe) teaser(key, dyn, true);
  },

  schliessen() { schliesse(false); },
  get ruhe() { return Z.ruhe; },
  set ruhe(v) { Z.ruhe = !!v; merken(); if (el) { el.classList.toggle('schlaeft', Z.ruhe); if (Z.ruhe) { schliesse(false); wartend.length = 0; } } },
  get stufe() { return Z.stufe; },
  zuruecksetzen() { Z.gesehen = []; merken(); },
};
