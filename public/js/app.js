import { stundenwetter, zufallswetter } from './weather.js';
import { BESTAENDE, STADIEN, AUFBEREITER, SILOARTEN } from './model.js';
import { bestandBild, stadiumBild, ertragBild, bodenBild } from './wiese.js';
import { schnittBild, aufbereiterBild, ablageBild, zinkenBild } from './maschinen.js';
import { WETTER, PROGNOSEN, GRUNDPLAN } from './scenarios.js';
import { Szene } from './scene.js';
import { Spiel, gespeicherteRunde, vergissRunde } from './game.js';
import { zeichne } from './chart.js';
import { wetterSymbol, STERN } from './icons.js';
import { BEGRIFFE, mitBegriffen } from './begriffe.js';

const $ = (s, el = document) => el.querySelector(s);
const z = (x, d = 1) => x.toFixed(d).replace('.', ',');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const NOTEN = ['sehr gut', 'gut', 'verbesserungsbedürftig', 'schlecht', 'sehr schlecht'];
const lies = (speicher, key) => { try { return JSON.parse(speicher.getItem(key)); } catch { return null; } };
const schreib = (speicher, key, wert) => { try { speicher.setItem(key, JSON.stringify(wert)); } catch { /* privater Modus: geht auch ohne */ } };

// ---------- Bildschirme, Titel, Pfad und Browser-Verlauf
let spiel = null;
let aktuell = 'start';
const TITEL = {
  start: 'Silage-Simulator – Lernspiel Futterkonservierung',
  setup: 'Einsatz planen – Silage-Simulator',
  spiel: 'Auf dem Feld – Silage-Simulator',
  ergebnis: 'Silo öffnen – Silage-Simulator',
  wetten: 'Prognose-Wette – Silage-Simulator',
};
const PFAD = {
  start: [],
  setup: [['Start', 'start'], ['Einsatz planen']],
  spiel: [['Start', 'start'], ['Einsatz planen', 'setup'], ['Auf dem Feld']],
  ergebnis: [['Start', 'start'], ['Einsatz planen', 'setup'], ['Silo öffnen']],
  wetten: [['Start', 'start'], ['Prognose-Wette']],
};

function zeige(id, push = true) {
  spiel?.speichere(); spiel?.stop(); spiel = null; // die Runde bleibt gesichert, auch beim Zurück-Wischen
  document.querySelectorAll('.bildschirm').forEach((b) => { b.hidden = b.id !== id; });
  $('#zum-menu').hidden = id === 'start';
  const teile = PFAD[id];
  $('#pfadnav').hidden = !teile.length;
  $('#pfad').innerHTML = teile.map(([t, ziel], i) => (i === teile.length - 1
    ? `<li aria-current="page">${esc(t)}</li>`
    : `<li><button type="button" data-gehe="${ziel}">${esc(t)}</button></li>`)).join('');
  document.title = TITEL[id];
  const url = id === 'start' ? location.pathname + location.search : `#${id}`;
  try { (push && id !== aktuell ? history.pushState : history.replaceState).call(history, { id }, '', url); } catch { /* egal */ }
  aktuell = id;
  if (id === 'start') { zeigeRangliste(); zeigeFortsetzen(); }
  window.scrollTo({ top: 0 });
  const h1 = $(`#${id} h1`); // Screenreader hört den neuen Bildschirm
  h1?.focus({ preventScroll: true });
}
document.addEventListener('click', (ev) => {
  const g = ev.target.closest('[data-gehe]');
  if (g) zeige(g.dataset.gehe);
});
addEventListener('popstate', (e) => {
  let id = e.state?.id ?? 'start';
  if (spiel?.plan && !spiel.gestoppt && !confirm('Wette abbrechen?')) { history.pushState({ id: 'spiel' }, '', '#spiel'); return; }
  if ((id === 'spiel' || id === 'ergebnis') && !spiel) id = 'start';
  zeige(id, false);
});

// Dialoge pausieren ein laufendes Spiel
function dialogOeffnen(d) {
  if (spiel && !spiel.plan && !spiel.pause) spiel.setzeTempo(0);
  d.showModal();
}

// Startbild: stehendes Gras am Morgen
{
  const s = new Szene($('#startszene'), 6);
  s.zeige({ phase: 'stehend', ts: 18, nass: 0.25, asche: 90 }, { h: 8, sonne: 0.85, regen: 0 }, 0);
}

// ---------- Darstellung "Draussen" (starker Kontrast für Sonnenlicht)
function setzeKontrast(an) {
  const r = document.documentElement;
  if (an) { r.dataset.kontrast = 'hoch'; r.dataset.theme = 'light'; } else { delete r.dataset.kontrast; delete r.dataset.theme; }
  $('#kontrast').setAttribute('aria-pressed', String(an));
  schreib(localStorage, 'drysim-kontrast', an);
}
$('#kontrast').addEventListener('click', () => setzeKontrast($('#kontrast').getAttribute('aria-pressed') !== 'true'));
setzeKontrast(lies(localStorage, 'drysim-kontrast') === true);

// ---------- Begriffe
$('#begriffe-liste').innerHTML = BEGRIFFE.map((b) => `<dt>${esc(b.begriff)} <small>${esc(b.lang)}</small></dt><dd>${esc(b.text)}</dd>`).join('');
$('#begriffe-auf').addEventListener('click', () => dialogOeffnen($('#begriffe')));

// ---------- Einsatz planen: Auswahlkarten und Chips
// Schnitt- und Zinkenhöhen ohne Vorgabe: die Spieler müssen sie selbst einstellen
const PFLICHT = { schnitthoehe: 'cm', zetterHoehe: 'cm über Boden', schwaderHoehe: 'cm über Boden' };
const PFLICHT_NAME = { schnitthoehe: 'Schnitthöhe', zetterHoehe: 'Zinkenhöhe Kreiselzetter', schwaderHoehe: 'Zinkenhöhe Schwader' };
const wahl = { ...GRUNDPLAN, wetter: 'hoch', modus: 'live', schnitthoehe: null, zetterHoehe: null, schwaderHoehe: null };
const setup = $('#setupform');
const BESCHREIBUNG = {
  bestand: {
    graeser: 'Fast nur Gräser – süss und gutmütig.',
    ausgewogen: 'Gräser, Klee und Blumen – die typische Naturwiese.',
    klee: 'Viel Klee – eiweissreich, aber heikel.',
  },
  stadium: {
    2: 'Junges Gras: viel Energie, wenig Futter.',
    3: 'Die Ähren kommen: guter Mittelweg.',
    4: 'Es blüht: viel Futter, weniger Energie.',
  },
  aufbereiter: {
    ohne: 'Schonend, aber langsames Anwelken.',
    zinken: 'Schlägt die Wachsschicht kräftig auf.',
    walzen: 'Quetscht die Stängel, schont die Blätter.',
    buerste: 'Zinkenrotor mit Bürste: raut die Wachsschicht stark auf, verteilt breit.',
  },
  siloart: {
    flachsilo: 'Mit dem Ladewagen ins Silo, gut verdichten.',
    ballen: 'Pressen und wickeln, braucht trockeneres Futter.',
  },
};
const OPTIONEN = {
  wetter: [...WETTER.map((w) => ({ wert: w.id, titel: w.name, text: w.info, extra: `<span class="wetterreihe">${w.tage.map(wetterSymbol).join('')}</span>` })),
    { wert: 'zufall', titel: 'Überraschung', text: 'Zufallswetter – mit Code für die ganze Klasse gleich.' }],
  bestand: Object.entries(BESTAENDE).map(([k]) => ({
    wert: k, titel: { graeser: 'Gräserreich', ausgewogen: 'Ausgewogen', klee: 'Kleereich' }[k], text: BESCHREIBUNG.bestand[k],
    extra: bestandBild(k) + merkmale({ graeser: [3, 1, 3], ausgewogen: [2, 2, 2], klee: [1, 3, 1] }[k]),
  })),
  aufbereiter: Object.entries(AUFBEREITER).map(([k, v]) => ({ wert: k, titel: v.name.replace(/^./, (c) => c.toUpperCase()), text: BESCHREIBUNG.aufbereiter[k], extra: aufbereiterBild(k) })),
  siloart: Object.entries(SILOARTEN).map(([k, v]) => ({ wert: k, titel: v.name, text: `${BESCHREIBUNG.siloart[k]} Ziel ${v.ziel[0]}–${v.ziel[1]} % TS.` })),
  stadium: Object.entries(STADIEN).map(([k, v]) => ({ wert: Number(k), titel: v.name, text: BESCHREIBUNG.stadium[k], extra: stadiumBild(Number(k)) })),
  boden: [{ wert: 'eben', titel: 'Eben und sauber', extra: bodenBild('eben') }, { wert: 'maulwurf', titel: 'Maulwurfshaufen', extra: bodenBild('maulwurf') }],
  breit: [{ wert: true, titel: 'Breitablage', text: 'über die ganze Fläche', extra: ablageBild(true) }, { wert: false, titel: 'Mähschwade', text: 'schmaler Streifen', extra: ablageBild(false) }],
  modus: [{ wert: 'live', titel: 'Live: die Uhr läuft' }, { wert: 'ruhig', titel: 'Ruhig: du bestimmst, wann die Zeit weiterläuft' }],
};

// Kleine Punkteskala für Zucker, Eiweiss und Silierbarkeit
function merkmale([zucker, eiweiss, leicht]) {
  const p = (n) => `<i aria-label="${n} von 3">${'●'.repeat(n)}<b>${'●'.repeat(3 - n)}</b></i>`;
  return `<span class="merkmale"><span>Zucker</span>${p(zucker)}<span>Eiweiss</span>${p(eiweiss)}<span>Silieren</span>${p(leicht)}</span>`;
}

// Jeder Schieberegler bekommt − und + Knöpfe
function plusMinus(input) {
  const name = input.getAttribute('aria-label') || input.closest('label')?.querySelector('span')?.textContent || 'Wert';
  const knopf = (zeichen, richtung) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'plusminus'; b.textContent = zeichen;
    b.setAttribute('aria-label', `${name} ${richtung > 0 ? 'erhöhen' : 'verringern'}`);
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      const min = Number(input.min), max = Number(input.max), step = Number(input.step) || 1;
      const leer = input.closest('.regler')?.classList.contains('leer');
      const basis = leer ? Math.round((min + max) / 2 / step) * step : Number(input.value);
      input.value = Math.min(max, Math.max(min, basis + (leer ? 0 : richtung * step)));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return b;
  };
  input.before(knopf('−', -1));
  input.after(knopf('+', 1));
}
document.querySelectorAll('input[type=range]').forEach(plusMinus);

function baueWahl(box, feld, ziel = wahl, onChange) {
  const ops = OPTIONEN[feld] ?? feld;
  const karten = box.classList.contains('wahl');
  box.replaceChildren(...ops.map((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = karten ? 'wahlkarte' : 'chip';
    b.innerHTML = karten ? `<b>${esc(o.titel)}</b>${o.extra ?? ''}<small>${esc(o.text ?? '')}</small>` : esc(o.titel);
    b.setAttribute('aria-pressed', ziel[box.dataset.feld] === o.wert);
    b.addEventListener('click', () => {
      ziel[box.dataset.feld] = o.wert;
      box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      onChange?.();
    });
    return b;
  }));
}
function maschinenBilder() {
  const stoppel = wahl.schnitthoehe ?? 7;
  $('#bild-schnitt').innerHTML = schnittBild(wahl.schnitthoehe);
  $('#bild-zetter').innerHTML = zinkenBild(wahl.zetterHoehe, 'zetten', stoppel);
  $('#bild-schwader').innerHTML = zinkenBild(wahl.schwaderHoehe, 'schwaden', stoppel);
  $('#bild-ertrag').innerHTML = ertragBild(Number(setup.ertrag.value));
}

// Einstellungen bleiben beim Neuladen oder App-Wechsel erhalten (nur für diese Sitzung, damit
// ein neuer Spieler am selben Gerät die Höhen wieder selbst wählen muss)
const SK = 'drysim-einstellungen';
const GUELTIG = {
  wetter: (v) => v === 'zufall' || WETTER.some((w) => w.id === v),
  bestand: (v) => v in BESTAENDE, stadium: (v) => String(v) in STADIEN, boden: (v) => ['eben', 'maulwurf'].includes(v),
  aufbereiter: (v) => v in AUFBEREITER, breit: (v) => typeof v === 'boolean', siloart: (v) => v in SILOARTEN, modus: (v) => ['live', 'ruhig'].includes(v),
  schnitthoehe: (v) => v === null || (typeof v === 'number' && v >= 4 && v <= 12),
  zetterHoehe: (v) => v === null || (typeof v === 'number' && v >= 0 && v <= 8),
  schwaderHoehe: (v) => v === null || (typeof v === 'number' && v >= 0 && v <= 8),
};
function speichereEinstellungen() {
  schreib(sessionStorage, SK, { v: 1, ...Object.fromEntries(Object.keys(GUELTIG).map((k) => [k, wahl[k]])), ertrag: Number(setup.ertrag.value), name: setup.name.value, code: setup.code.value });
}
{
  const s = lies(sessionStorage, SK);
  if (s?.v === 1) {
    for (const k of Object.keys(GUELTIG)) if (k in s && GUELTIG[k](s[k])) wahl[k] = s[k];
    if (Number.isFinite(s.ertrag) && s.ertrag >= 20 && s.ertrag <= 45) { setup.ertrag.value = s.ertrag; setup.ertragAus.value = `${s.ertrag} dt TS/ha`; }
    if (typeof s.name === 'string') setup.name.value = s.name.slice(0, 30);
    if (typeof s.code === 'string') setup.code.value = s.code.slice(0, 12);
  }
}

// Pflicht-Regler: Anzeige und Hilfstext für Screenreader
function reglerAnzeige(feld) {
  const regler = setup[feld], zeile = regler.closest('.regler');
  if (wahl[feld] == null) { zeile.classList.add('leer'); regler.setAttribute('aria-valuetext', 'nicht eingestellt'); zeile.querySelector('output').value = 'bitte einstellen'; return; }
  const text = `${z(wahl[feld])} ${PFLICHT[feld]}`;
  regler.value = wahl[feld]; zeile.classList.remove('leer');
  zeile.querySelector('output').value = text;
  regler.setAttribute('aria-valuetext', text);
}

function aktualisiereOffen() {
  const fehlt = Object.keys(PFLICHT).filter((k) => wahl[k] == null);
  const o = $('#offen');
  o.textContent = fehlt.length ? `Noch ${fehlt.length} Einstellung${fehlt.length > 1 ? 'en' : ''} offen: ${fehlt.map((k) => PFLICHT_NAME[k]).join(', ')}` : 'Alles eingestellt – los geht’s!';
  o.classList.toggle('fertig', !fehlt.length);
  $('#schritt-maschinen').classList.toggle('fertig', !fehlt.length);
  speichereEinstellungen();
}
const nachWahl = () => {
  $('.code', setup).hidden = wahl.wetter !== 'zufall';
  maschinenBilder();
  aktualisiereOffen();
};
setup.querySelectorAll('[data-feld]').forEach((box) => baueWahl(box, box.dataset.feld, wahl, nachWahl));
for (const feld of Object.keys(PFLICHT)) {
  const regler = setup[feld];
  // auch ein Klick genau auf die Mitte (Startwert des Reglers) zählt als Einstellung
  const setze = () => {
    wahl[feld] = Number(regler.value);
    reglerAnzeige(feld);
    $('#setupfehler').textContent = '';
    maschinenBilder();
    aktualisiereOffen();
  };
  regler.addEventListener('input', setze);
  regler.addEventListener('pointerup', setze);
  regler.addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') setze(); });
  reglerAnzeige(feld);
}
setup.ertrag.addEventListener('input', () => { setup.ertragAus.value = `${setup.ertrag.value} dt TS/ha`; setup.ertrag.setAttribute('aria-valuetext', setup.ertragAus.value); maschinenBilder(); aktualisiereOffen(); });
setup.name.addEventListener('input', speichereEinstellungen);
setup.code.addEventListener('input', speichereEinstellungen);
document.querySelectorAll('[data-sprung]').forEach((b) => b.addEventListener('click', () => {
  document.getElementById(b.dataset.sprung)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

// Wetter aus der Adresse (Lehrperson verschickt z.B. ?wetter=gewitter oder ?code=KLASSE3)
{
  const q = new URLSearchParams(location.search);
  const id = q.get('code') ? 'zufall' : q.get('wetter');
  if (id && (id === 'zufall' || WETTER.some((w) => w.id === id))) {
    wahl.wetter = id;
    if (q.get('code')) setup.code.value = q.get('code').slice(0, 12);
    baueWahl($('[data-feld="wetter"]', setup), 'wetter', wahl, nachWahl);
  }
}
$('.code', setup).hidden = wahl.wetter !== 'zufall';
maschinenBilder();
aktualisiereOffen();

function wetterVon(id, code) {
  if (id === 'zufall') return zufallswetter((code || 'AGFF').trim().toUpperCase());
  return WETTER.find((w) => w.id === id);
}

let letzterStart = null;
function starteSpiel({ einstellungen, sz, wetterRef = null, plan = null, tipp = null, resume = null }) {
  letzterStart = { einstellungen, sz, wetterRef, plan, tipp };
  zeige('spiel');
  spiel = new Spiel($('#spiel'), {
    setup: einstellungen, wetterSzenario: sz, wetterRef, plan, resume,
    onEnde: (res) => zeigeErgebnis(res, sz, tipp, einstellungen),
  });
}

setup.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const fehlt = Object.keys(PFLICHT).filter((k) => wahl[k] == null);
  if (fehlt.length) {
    $('#setupfehler').textContent = `Noch einstellen: ${fehlt.map((k) => PFLICHT_NAME[k]).join(', ')}.`;
    setup.querySelector('.regler.leer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const wetterRef = { id: wahl.wetter, code: setup.code.value.trim().toUpperCase() };
  const einstellungen = { ...wahl, ertrag: Number(setup.ertrag.value), name: setup.name.value.trim() };
  starteSpiel({ einstellungen, sz: wetterVon(wetterRef.id, wetterRef.code), wetterRef });
});

// ---------- Angefangene Runde fortsetzen
function zeigeFortsetzen() {
  const g = gespeicherteRunde();
  $('#fortsetzen').hidden = !g;
  if (!g) return;
  const sz = wetterVon(g.wetterRef?.id, g.wetterRef?.code);
  $('#fortsetzen-text').textContent = `Tag ${Math.floor(g.t / 24) + 1}, ${String(g.t % 24).padStart(2, '0')}:00 · ${sz ? sz.name : 'Wetter unbekannt'}. Die Runde ist auf diesem Gerät gesichert.`;
}
$('#fortsetzen-los').addEventListener('click', () => {
  const g = gespeicherteRunde();
  const sz = g && wetterVon(g.wetterRef?.id, g.wetterRef?.code);
  if (!sz) { vergissRunde(); zeigeFortsetzen(); return; }
  try {
    starteSpiel({ einstellungen: g.einstellungen, sz, wetterRef: g.wetterRef, resume: g });
  } catch {
    vergissRunde(); zeige('start'); // beschädigter Spielstand: sauber neu beginnen
  }
});
$('#fortsetzen-weg').addEventListener('click', () => { vergissRunde(); zeigeFortsetzen(); });

// ---------- Silo öffnen
const dialog = $('#detail');
function sterne(res) {
  const s = res.silage, [a, b] = SILOARTEN[res.plan.siloart].ziel, ts = res.ernte.ts;
  if (s.note >= 5) return 0;
  if (s.note <= 2 && ts >= a && ts <= b && res.verlustTotal < 15 && res.ernte.asche <= 105) return 3;
  if (s.note <= 3 && res.verlustTotal < 22) return 2;
  return 1;
}
function abzeichen(res) {
  const v = res.verlust, e = res.ernte, a = [];
  if (e.asche <= 100) a.push(['Saubere Sache', 'Kaum Erde im Futter']);
  if (v.atmung < 1.5) a.push(['Zuckerbewahrer', 'Wenig veratmet']);
  if (e.stunden <= 12) a.push(['Blitzsilage', 'In unter 12 h im Silo']);
  if (res.plan.bestand === 'klee' && v.broeckel < 4) a.push(['Kleeflüsterer', 'Blätter geschont']);
  if (e.regenFeld > 2) a.push(['Vom Regen erwischt', '', true]);
  if (e.asche > 120) a.push(['Erdsilage', '', true]);
  if (res.silage.buttersaeure > 3) a.push(['Buttersäure-Alarm', '', true]);
  return a;
}

// Erklärtext in kurze Sätze teilen: der erste ist die Aussage, die übrigen sind die Gründe
function saetze(text) {
  const out = [], re = /[.!?]\s+(?=[A-ZÄÖÜ])/g;
  let start = 0, m;
  while ((m = re.exec(text))) { out.push(text.slice(start, m.index + 1)); start = m.index + m[0].length; }
  out.push(text.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}
function zeigeDetail(f) {
  $('#detail-titel').textContent = f.titel;
  $('#detail-wert').textContent = f.wert;
  const [kopf, ...rest] = saetze(f.text);
  $('#detail-text').innerHTML = `<p class="kurz">${mitBegriffen(kopf)}</p>`
    + (rest.length ? `<ul>${rest.map((s) => `<li>${mitBegriffen(s)}</li>`).join('')}</ul>` : '')
    + (f.tipp ? `<p class="tipp"><b>Tipp:</b> ${mitBegriffen(f.tipp)}</p>` : '');
  dialog.showModal();
}
const STUFE_TEXT = { gut: 'Gut gemacht', mittel: 'Geht besser', schlecht: 'Problem' };

function zeigeErgebnis(res, sz, tipp, einstellungen) {
  PFAD.ergebnis = tipp ? [['Start', 'start'], ['Prognose-Wette', 'wetten'], ['Silo öffnen']] : [['Start', 'start'], ['Einsatz planen', 'setup'], ['Silo öffnen']];
  zeige('ergebnis');
  const n = sterne(res);
  $('#sterne').innerHTML = [0, 1, 2].map((i) => STERN(i < n)).join('');
  $('#sterne').setAttribute('aria-label', `${n} von 3 Sternen`);
  const urteile = ['Das Silo stinkt nach Buttersäure – das will keine Kuh fressen.', 'Geht so – da liegt mehr drin.', 'Gute Silage!', 'Perfekte Silage – die Kühe freuen sich!'];
  $('#urteil').textContent = urteile[n];
  // Punkte hochzählen
  const ziel = res.punkte, t0 = performance.now();
  const zaehle = (jetzt) => {
    const f = Math.min(1, (jetzt - t0) / 1200);
    $('#punkte').textContent = Math.round(ziel * (1 - (1 - f) ** 3));
    if (f < 1) requestAnimationFrame(zaehle);
  };
  requestAnimationFrame(zaehle);
  setTimeout(() => { $('#punkte').textContent = ziel; }, 1300); // auch wenn der Tab im Hintergrund drosselt

  const e = res.ernte, s = res.silage;
  $('#kennzahlen').innerHTML = [
    ['TS beim Einfahren', `${z(e.ts)} %`], ['Rohasche', `${z(e.asche, 0)} g/kg TS`], ['Zucker', `${z(e.zucker, 0)} g/kg TS`],
    ['Gärqualität', `Note ${s.note} · ${NOTEN[s.note - 1]}`], ['Energie', `${z(res.nel, 2)} MJ NEL/kg TS`], ['Verlust Feld bis Trog', `${z(res.verlustTotal, 0)} %`],
  ].map(([a, b]) => `<div class="kennzahl"><span>${a}</span><strong>${b}</strong></div>`).join('');
  $('#abzeichen').innerHTML = abzeichen(res).map(([t, d, minus]) => `<span class="${minus ? 'minus' : ''}" title="${esc(d)}">${minus ? '✗' : '★'} ${esc(t)}</span>`).join('');

  // Wette: Tipp gegen Ergebnis
  if (tipp) {
    const bewerte = (diff, eng, weit) => (diff <= eng ? 3 : diff <= weit ? 1 : 0);
    const zeilen = [
      ['TS beim Einfahren', `${tipp.ts} %`, `${z(e.ts)} %`, bewerte(Math.abs(tipp.ts - e.ts), 3, 7)],
      ['Rohasche', `${tipp.asche} g/kg`, `${z(e.asche, 0)} g/kg`, bewerte(Math.abs(tipp.asche - e.asche), 10, 25)],
      ['Gärqualität', `Note ${tipp.note}`, `Note ${s.note}`, bewerte(Math.abs(tipp.note - s.note), 0, 1)],
    ];
    const total = zeilen.reduce((a, r) => a + r[3], 0);
    $('#tipp-vergleich').innerHTML = `<h2>Deine Wette: ${total} von 9 Punkten</h2><table class="vergleich"><thead><tr><th></th><th>Tipp</th><th>Ergebnis</th><th>Punkte</th></tr></thead><tbody>
      ${zeilen.map(([a, b, c, p]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td><td class="${p === 3 ? 'treffer' : p ? '' : 'daneben'}">${p}</td></tr>`).join('')}</tbody></table>`;
    $('.punkte', $('#ergebnis')).hidden = true;
  } else {
    $('#tipp-vergleich').innerHTML = '';
    $('.punkte', $('#ergebnis')).hidden = false;
    if (einstellungen.name) {
      const l = rangliste();
      l.push({ name: einstellungen.name, punkte: res.punkte, wetter: sz.name, ts: e.ts, note: s.note, sterne: n });
      speichereRangliste(l);
    }
  }

  const box = $('#faktoren');
  box.replaceChildren(...res.faktoren.map((f) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `faktor ${f.stufe}`;
    b.innerHTML = `<b><span class="sr-only">${STUFE_TEXT[f.stufe]}: </span>${esc(f.titel)}</b><small>${esc(f.wert)}</small>`;
    b.addEventListener('click', () => zeigeDetail(f));
    return b;
  }));
  zeichne($('#rueckblick'), stundenwetter(sz), { aktionen: res.ereignisse, verlauf: res.verlauf, ziel: SILOARTEN[res.plan.siloart].ziel });
}
$('#nochmals').addEventListener('click', () => {
  if (letzterStart?.plan) zeige('wetten');
  else if (letzterStart) starteSpiel(letzterStart);
});

// ---------- Rangliste (nur lokal im Browser, z.B. Beamer-Rechner der Lehrperson)
const RL = 'drysim-rangliste';
const rangliste = () => lies(localStorage, RL) ?? [];
const speichereRangliste = (l) => schreib(localStorage, RL, l);
function zeigeRangliste() {
  const l = rangliste().sort((a, b) => b.punkte - a.punkte).slice(0, 10);
  $('#rangliste').innerHTML = l.length
    ? l.map((e) => `<li><span>${esc(e.name)}<small>${esc(e.wetter)} · ${z(e.ts, 0)} % TS · Note ${e.note}</small></span><strong>${e.punkte}</strong></li>`).join('')
    : '<li class="leer">Noch niemand. Gib beim Einsatz einen Namen ein, dann erscheinst du hier.</li>';
}
$('#rangliste-leeren').addEventListener('click', () => {
  if (confirm('Rangliste in diesem Browser löschen?')) { speichereRangliste([]); zeigeRangliste(); }
});

// ---------- Prognose-Wette
const tippform = $('#tippform');
const tipp = { note: 2 };
let szenario = null;
$('#szenarien').innerHTML = PROGNOSEN.map((p) => {
  const w = WETTER.find((x) => x.id === p.wetter);
  return `<button type="button" class="wahlkarte" data-id="${p.id}" aria-pressed="false"><b>${p.name}</b><span class="wetterreihe">${w.tage.map(wetterSymbol).join('')}</span><small>${w.name} · ${BESTAENDE[p.plan.bestand].name} · ${SILOARTEN[p.plan.siloart].name}</small></button>`;
}).join('');
function waehleSzenario(id) {
  const gefunden = PROGNOSEN.find((p) => p.id === id);
  if (!gefunden) return;
  document.querySelectorAll('#szenarien .wahlkarte').forEach((x) => x.setAttribute('aria-pressed', x.dataset.id === id));
  szenario = gefunden;
  const w = WETTER.find((x) => x.id === szenario.wetter);
  tippform.hidden = false;
  $('#szenario-titel').textContent = szenario.name;
  $('#szenario-text').textContent = szenario.text;
  $('#szenario-wetter').innerHTML = w.tage.map((d, i) => {
    const mm = (d.regen ?? []).reduce((a, r) => a + r.mm, 0);
    return `<div class="tageskarte"><b>Tag ${i + 1}</b>${wetterSymbol(d)}<span>${Math.round(d.tmax)}° / ${Math.round(d.tmin)}°</span><small>${mm > 0 ? z(mm, 0) + ' mm' : 'trocken'}</small></div>`;
  }).join('');
  tippform.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('#szenarien').addEventListener('click', (ev) => {
  const b = ev.target.closest('.wahlkarte');
  if (b) waehleSzenario(b.dataset.id);
});
baueWahl($('[data-feld="note"]', tippform), [1, 2, 3, 4, 5].map((n) => ({ wert: n, titel: `${n} · ${NOTEN[n - 1]}` })), tipp);
const tippText = () => {
  tippform.tsAus.value = `${tippform.ts.value} % TS`;
  tippform.ascheAus.value = `${tippform.asche.value} g/kg TS`;
  tippform.ts.setAttribute('aria-valuetext', tippform.tsAus.value);
  tippform.asche.setAttribute('aria-valuetext', tippform.ascheAus.value);
};
tippform.addEventListener('input', tippText);
tippText();
tippform.addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (!szenario) return;
  const t = { ts: Number(tippform.ts.value), asche: Number(tippform.asche.value), note: tipp.note };
  const { maehen, zetten, schwaden, ernte, ...einstellungen } = szenario.plan;
  starteSpiel({ einstellungen, sz: WETTER.find((x) => x.id === szenario.wetter), plan: { maehen, zetten, schwaden, ernte }, tipp: t });
});

// ---------- Start: Adresse auswerten, Verlauf aufbauen, offline nutzbar machen
{
  const q = new URLSearchParams(location.search);
  history.replaceState({ id: 'start' }, '', location.pathname + location.search);
  const ziel = q.get('szenario') ? 'wetten' : ['setup', 'wetten'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'start';
  zeige('start', false);
  if (ziel !== 'start') zeige(ziel);
  if (q.get('szenario')) waehleSzenario(q.get('szenario'));
}
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
