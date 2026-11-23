import { stundenwetter, zufallswetter } from './weather.js';
import { BESTAENDE, STADIEN, AUFBEREITER, SILOARTEN, zinken, ablageVon, KAL, GAERFAKTOR, zielFaktor } from './model.js';
import { bestandBild, stadiumBild, ertragBild, bodenBild } from './wiese.js';
import { schnittBild, aufbereiterBild, ablageBild, zinkenBild } from './maschinen.js';
import { WETTER, PROGNOSEN, GRUNDPLAN } from './scenarios.js';
import { Szene } from './scene.js';
import { Spiel, gespeicherteRunde, vergissRunde } from './game.js';
import { zeichne } from './chart.js';
import { wetterSymbol, STERN } from './icons.js';
import { BEGRIFFE, mitBegriffen } from './begriffe.js';
import { Assistent } from './assistent.js';
import { KARTEN_GRAFIK } from './grafik.js';
import { HeustockSpiel, feldAusRunde } from './heustock.js';
import { niveau, info as niveauInfo, gueltig as niveauGueltig, zeigt, karteSichtbar, beiWechsel, baueNiveauWahl, setzeNiveau } from './niveau.js';

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
  start: 'Heureka – Lernspiel Futterkonservierung',
  setup: 'Einsatz planen – Heureka',
  spiel: 'Auf dem Feld – Heureka',
  heustock: 'Am Heustock – Heureka',
  ergebnis: 'Silo öffnen – Heureka',
  wetten: 'Prognose-Wette – Heureka',
};
const PFAD = {
  start: [],
  setup: [['Start', 'start'], ['Einsatz planen']],
  spiel: [['Start', 'start'], ['Einsatz planen', 'setup'], ['Auf dem Feld']],
  heustock: [['Start', 'start'], ['Einsatz planen', 'setup'], ['Am Heustock']],
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
  document.documentElement.dataset.screen = id;
  assistentFuer(id);
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
  if ((id === 'spiel' || id === 'heustock' || id === 'ergebnis') && !spiel) id = 'start';
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
    belueftung: 'Angewelkt einführen, die Kaltbelüftung trocknet im Heustock fertig.',
    bodenheu: 'Auf dem Feld ganz trocknen, braucht zwei bis drei schöne Tage.',
    heuballen: 'Quader- oder Rundballen pressen, nur ganz trockenes Heu.',
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
  siloart: Object.entries(SILOARTEN).map(([k, v]) => ({
    wert: k, titel: v.name, text: `${BESCHREIBUNG.siloart[k]} ${v.art === 'heu' && v.ziel[1] >= 95 ? `Ab ${v.ziel[0]}` : `Ziel ${v.ziel[0]}–${v.ziel[1]}`} % TS.`, textEinfach: BESCHREIBUNG.siloart[k],
    extra: `<span class="art-marke ${v.art}">${v.art === 'heu' ? 'Heu' : 'Silage'}</span>`,
  })),
  stadium: Object.entries(STADIEN).map(([k, v]) => ({ wert: Number(k), titel: v.name, text: BESCHREIBUNG.stadium[k], extra: stadiumBild(Number(k)) })),
  boden: [{ wert: 'eben', titel: 'Eben und sauber', extra: bodenBild('eben') }, { wert: 'maulwurf', titel: 'Maulwurfshaufen', extra: bodenBild('maulwurf') }],
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
    const text = zeigt('feld.zahlen') ? o.text : o.textEinfach ?? o.text;
    b.innerHTML = karten ? `<b>${esc(o.titel)}</b>${o.extra ?? ''}<small>${esc(text ?? '')}</small>` : esc(o.titel);
    b.setAttribute('aria-pressed', ziel[box.dataset.feld] === o.wert);
    b.addEventListener('click', () => {
      ziel[box.dataset.feld] = o.wert;
      box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      onChange?.(box.dataset.feld, o.wert);
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
  // Ablagebreite: der Intensivaufbereiter mit Bürste legt immer breit ab
  const a = ablageVon(wahl), fest = a !== wahl.ablage;
  $('#bild-ablage').innerHTML = ablageBild(a);
  setup.ablage.value = wahl.ablage;
  setup.ablageAus.value = `${a} % der Mähbreite${fest ? ' (Bürste)' : ''}`;
  setup.ablage.setAttribute('aria-valuetext', setup.ablageAus.value);
  $('#ablage-hinweis').textContent = fest ? 'Der Aufbereiter mit Zinken und Bürste legt das Futter selbst breit ab, auf rund 85 % der Mähbreite.'
    : 'Ab 80 % der Mähbreite gilt es als Breitablage. Eine Mähschwade ist etwa ein Drittel so breit.';
}

// Einstellungen bleiben beim Neuladen oder App-Wechsel erhalten (nur für diese Sitzung, damit
// ein neuer Spieler am selben Gerät die Höhen wieder selbst wählen muss)
const SK = 'drysim-einstellungen';
const GUELTIG = {
  wetter: (v) => v === 'zufall' || WETTER.some((w) => w.id === v),
  bestand: (v) => v in BESTAENDE, stadium: (v) => String(v) in STADIEN, boden: (v) => ['eben', 'maulwurf'].includes(v),
  aufbereiter: (v) => v in AUFBEREITER, ablage: (v) => typeof v === 'number' && v >= 30 && v <= 100, siloart: (v) => v in SILOARTEN, modus: (v) => ['live', 'ruhig'].includes(v),
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
    if (!('ablage' in s) && typeof s.breit === 'boolean') wahl.ablage = s.breit ? 85 : 35; // Einstellung aus der Zeit vor dem Regler
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
const nachWahl = (feld, wert) => {
  $('.code', setup).hidden = wahl.wetter !== 'zufall';
  maschinenBilder();
  aktualisiereOffen();
  if (feld) lerntipp(feld, wert);
};
setup.querySelectorAll('[data-feld]').forEach((box) => baueWahl(box, box.dataset.feld, wahl, nachWahl));
for (const feld of Object.keys(PFLICHT)) {
  const regler = setup[feld];
  // auch ein Klick genau auf die Mitte (Startwert des Reglers) zählt als Einstellung
  const setze = () => {
    voreingestellt.delete(feld);
    wahl[feld] = Number(regler.value);
    reglerAnzeige(feld);
    $('#setupfehler').textContent = '';
    maschinenBilder();
    aktualisiereOffen();
    reglerTipp(feld);
  };
  regler.addEventListener('input', setze);
  regler.addEventListener('pointerup', setze);
  regler.addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') setze(); });
  reglerAnzeige(feld);
}
setup.ablage.addEventListener('input', () => { wahl.ablage = Number(setup.ablage.value); maschinenBilder(); aktualisiereOffen(); reglerTipp('ablage'); });
setup.ertrag.addEventListener('input', () => { setup.ertragAus.value = `${setup.ertrag.value} dt TS/ha`; setup.ertrag.setAttribute('aria-valuetext', setup.ertragAus.value); maschinenBilder(); aktualisiereOffen(); });
setup.name.addEventListener('input', speichereEinstellungen);
setup.code.addEventListener('input', speichereEinstellungen);
document.querySelectorAll('[data-sprung]').forEach((b) => b.addEventListener('click', () => {
  document.getElementById(b.dataset.sprung)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

// ---------- Niveau im Einsatz: Einstieg wählt nur Wetter und Silage/Heu, der Rest ist sinnvoll voreingestellt
const voreingestellt = new Set(); // Regler, die das Niveau gesetzt hat und die der Spieler nicht angefasst hat
function einsatzNiveau(wechsel = false) {
  const kurz = zeigt('einsatz.kurz');
  if (zeigt('einsatz.voreinstellen')) {
    for (const k of Object.keys(PFLICHT)) if (wahl[k] == null) { wahl[k] = GRUNDPLAN[k]; voreingestellt.add(k); }
  } else {
    for (const k of voreingestellt) wahl[k] = null; // Praxis und Profi: Höhen wieder selbst wählen
    voreingestellt.clear();
  }
  if (wechsel) wahl.modus = zeigt('einsatz.modus');
  Object.keys(PFLICHT).forEach(reglerAnzeige);
  setup.classList.toggle('kurz', kurz);
  $('#mehr-einstellen').hidden = !kurz;
  if (!kurz) { setup.classList.remove('mehr-offen'); $('#mehr-knopf').setAttribute('aria-expanded', 'false'); }
  ['siloart', 'modus'].forEach((f) => baueWahl($(`[data-feld="${f}"]`, setup), f, wahl, nachWahl));
  maschinenBilder();
  aktualisiereOffen();
}
$('#mehr-knopf').addEventListener('click', () => {
  const offen = !setup.classList.contains('mehr-offen');
  setup.classList.toggle('mehr-offen', offen);
  $('#mehr-knopf').setAttribute('aria-expanded', String(offen));
  $('#mehr-knopf').textContent = offen ? 'Weniger einstellen' : 'Mehr einstellen';
  if (offen) $('#s-wiese').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
// Erster Besuch ohne gesicherte Einstellungen: Spielart nach Niveau (Einstieg: ruhig)
einsatzNiveau(!lies(sessionStorage, SK));

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

// ---------- Traktor-Assistent: Lernhilfe je Schritt, Abschnitt und Einstellung
const ABSCHNITT = { 's-wetter': 'setup.wetter', 's-wiese': 'setup.wiese', 's-maschinen': 'setup.maschinen', 's-silo': 'setup.silo' };
let letzterAbschnitt = null;
function assistentFuer(id) {
  const k = { start: 'start', wetten: 'wetten' }[id];
  if (id === 'setup') { letzterAbschnitt = 'setup.wetter'; Assistent.kontext(letzterAbschnitt); } else if (k) Assistent.kontext(k);
  else if (id !== 'spiel' && id !== 'ergebnis') Assistent.kontext(null); // Spielfeld und Ergebnis setzen ihren Schritt selbst
}
{
  // Im Einsatz begleitet der Traktor beim Scrollen: der Abschnitt mit der grössten sichtbaren Höhe gilt
  const hoehe = new Map();
  const io = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) hoehe.set(e.target.id, e.isIntersecting ? e.intersectionRect.height : 0);
    if (aktuell !== 'setup') return;
    const best = [...hoehe].sort((a, b) => b[1] - a[1])[0];
    const key = best && best[1] > 80 ? ABSCHNITT[best[0]] : null;
    if (key && key !== letzterAbschnitt) { letzterAbschnitt = key; Assistent.kontext(key); }
  }, { threshold: [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1] });
  Object.keys(ABSCHNITT).forEach((id) => io.observe(document.getElementById(id)));
}
Assistent.beiOeffnen = () => { if (spiel && !spiel.plan && !spiel.pause && !spiel.gestoppt) spiel.setzeTempo(0); };

// Rückmeldung zu einer Wahl (Karte oder Knopf)
function lerntipp(feld, wert) {
  const key = {
    aufbereiter: `setup.aufb.${wert}`, siloart: `setup.silo.${wert}`,
    bestand: `setup.bestand.${wert}`, stadium: `setup.stadium.${wert}`, boden: wert === 'maulwurf' ? 'setup.boden.maulwurf' : null,
  }[feld];
  if (key) Assistent.hinweis(key);
}
// Rückmeldung zu den Reglern, erst wenn der Regler zur Ruhe gekommen ist
let reglerTimer = null;
function reglerTipp(feld) {
  clearTimeout(reglerTimer);
  reglerTimer = setTimeout(() => {
    const h = wahl[feld];
    if (h == null) return;
    let key;
    if (feld === 'ablage') key = ablageVon(wahl) >= 80 ? 'setup.ablage.breit' : ablageVon(wahl) >= 60 ? 'setup.ablage.mittel' : 'setup.ablage.schwade';
    else if (feld === 'schnitthoehe') key = h < 5 ? 'setup.schnitt.tief' : h > 9 ? 'setup.schnitt.hoch' : 'setup.schnitt.gut';
    else key = h < 2 ? 'setup.zinken.tief' : h > zinken(0, wahl.schnitthoehe ?? 7).schwelle ? 'setup.zinken.hoch' : 'setup.zinken.gut';
    Assistent.hinweis(key);
  }, 700);
}
// Steuerung auf der Startseite
function zeigeAssistentSteuerung() {
  const still = zeigt('assistent.nurAufWunsch');
  $('#assist-an').textContent = Assistent.ruhe ? 'Traktor-Tipps: aus' : still ? 'Traktor-Tipps: nur auf Wunsch' : 'Traktor-Tipps: an';
  $('#assist-an').setAttribute('aria-pressed', String(!Assistent.ruhe));
}
function assistentNiveau(wechsel) {
  Assistent.nurAufWunsch = zeigt('assistent.nurAufWunsch');
  if (wechsel && zeigt('assistent.stufe')) Assistent.stufe = zeigt('assistent.stufe');
}
assistentNiveau(new URLSearchParams(location.search).has('niveau'));
$('#assist-an').addEventListener('click', () => { Assistent.ruhe = !Assistent.ruhe; zeigeAssistentSteuerung(); });
$('#assist-neu').addEventListener('click', () => { Assistent.zuruecksetzen(); Assistent.ruhe = false; zeigeAssistentSteuerung(); $('#assist-neu').textContent = 'Alle Tipps kommen wieder ✓'; });
zeigeAssistentSteuerung();

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
    onEnde: (res, feld, feldLog) => (res.plan.siloart === 'belueftung' && !plan && feld
      ? starteHeustock({ feld, einstellungen, sz, wetterRef, feldLog })
      : zeigeErgebnis(res, sz, tipp, einstellungen)),
  });
}

// ---------- Belüftungsheu: zweite Phase «Am Heustock» (js/heustock.js); die Wette rechnet den Standardbetrieb
function starteHeustock({ feld, einstellungen, sz, wetterRef, feldLog, resume = null }) {
  zeige('heustock');
  spiel = new HeustockSpiel($('#heustock'), {
    // Was der Heustock je Niveau zeigt (Tabelle in niveau.js): Einstieg ohne Entfeuchter, Rechenaufgabe nur wo vorgesehen
    feld, setup: { ...einstellungen, belueftungOptionen: { entfeuchter: zeigt('belueftung.steuerung') !== 'ein-aus', rechnen: !!zeigt('belueftung.aufgabe'), ampel: zeigt('belueftung.anzeige') === 'ampel' } },
    wetterSzenario: sz, wetterRef, feldLog, resume,
    onEnde: (lauf) => zeigeErgebnis(feld.bewerte(lauf), sz, null, einstellungen),
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
  const einstellungen = { ...wahl, ertrag: Number(setup.ertrag.value), name: setup.name.value.trim(), niveau: niveau() };
  starteSpiel({ einstellungen, sz: wetterVon(wetterRef.id, wetterRef.code), wetterRef });
});

// ---------- Angefangene Runde fortsetzen
function zeigeFortsetzen() {
  const g = gespeicherteRunde();
  $('#fortsetzen').hidden = !g;
  if (!g) return;
  const sz = wetterVon(g.wetterRef?.id, g.wetterRef?.code);
  $('#fortsetzen-text').textContent = `${g.heustock ? 'Am Heustock, ' : ''}Tag ${Math.floor(g.t / 24) + 1}, ${String(g.t % 24).padStart(2, '0')}:00 · ${sz ? sz.name : 'Wetter unbekannt'}. Die Runde ist auf diesem Gerät gesichert.`;
}
$('#fortsetzen-los').addEventListener('click', () => {
  const g = gespeicherteRunde();
  const sz = g && wetterVon(g.wetterRef?.id, g.wetterRef?.code);
  if (!sz) { vergissRunde(); zeigeFortsetzen(); return; }
  try {
    if (g.heustock) {
      letzterStart = { einstellungen: g.einstellungen, sz, wetterRef: g.wetterRef };
      starteHeustock({ feld: feldAusRunde(g, sz), einstellungen: g.einstellungen, sz, wetterRef: g.wetterRef, feldLog: g.log, resume: g.heustock });
      return;
    }
    starteSpiel({ einstellungen: g.einstellungen, sz, wetterRef: g.wetterRef, resume: g });
  } catch {
    vergissRunde(); zeige('start'); // beschädigter Spielstand: sauber neu beginnen
  }
});
$('#fortsetzen-weg').addEventListener('click', () => { vergissRunde(); zeigeFortsetzen(); });

// ---------- Silo öffnen
const dialog = $('#detail');
function sterne(res) {
  const [a, b] = SILOARTEN[res.plan.siloart].ziel, ts = res.ernte.ts, heu = res.art === 'heu';
  const [v3, v2] = heu ? [22, 30] : [15, 22]; // Heu hat auf dem Feld unvermeidlich höhere Verluste
  if (res.note >= 5) return 0;
  if (res.note <= 2 && ts >= a && ts <= b && res.verlustTotal < v3 && res.ernte.asche <= 105) return 3;
  if (res.note <= 3 && res.verlustTotal < v2) return 2;
  return 1;
}
function abzeichen(res) {
  const v = res.verlust, e = res.ernte, a = [];
  if (e.asche <= 100) a.push(['Saubere Sache', 'Kaum Erde im Futter']);
  if (v.atmung < 1.5) a.push(['Zuckerbewahrer', 'Wenig veratmet']);
  if (res.plan.aufbereiter === 'ohne') a.push(['Insektenschoner', 'Ohne Aufbereiter gemäht']);
  if (res.art === 'heu') {
    const h = res.heu;
    if (h.abzug.farbe < 1 && e.regenFeld === 0) a.push(['Grünes Heu', 'Nicht verregnet, nicht ausgebleicht']);
    if (v.broeckel < (res.plan.bestand === 'klee' ? 5 : 3.5)) a.push(['Blattschoner', 'Wenig Bröckelverluste']);
    if (res.plan.siloart === 'belueftung' && h.belueftTage <= 80 / 24 && res.ernte.ts >= 60) a.push(['Belüftungsprofi', 'Haupttrocknung innert 80 Stunden']);
    const b = res.belueftung;
    if (b?.lagerfaehig && b.wasser > 0 && b.kwh / b.wasser <= 0.25) a.push(['Stromsparer', 'Höchstens 0,25 kWh je kg Wasser']);
    if (h.temp >= 70) a.push(['Heustock heiss', 'Ab 70 °C: Feuerwehr alarmieren!', true]);
    else if (h.temp >= 60) a.push(['Heustock sehr warm', 'Feuerwehr vorinformieren, alle fünf Stunden messen', true]);
    else if (h.schimmel !== 'kein') a.push(['Muffig', 'Zu feucht eingelagert', true]);
  } else {
    if (e.stunden <= 12) a.push(['Blitzsilage', 'In unter 12 h im Silo']);
    if (res.plan.bestand === 'klee' && v.broeckel < 1.6) a.push(['Kleeflüsterer', 'Blätter geschont']);
    if (res.silage.buttersaeure > 3) a.push(['Buttersäure-Alarm', '', true]);
  }
  if (e.regenFeld > 2) a.push(['Vom Regen erwischt', '', true]);
  if (e.asche > 120) a.push([res.art === 'heu' ? 'Staubiges Heu' : 'Erdsilage', 'Viel Erde im Futter', true]);
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
// Bild zur Karte im Einstieg (wo vorhanden)
const KARTEN_BILD = { asche: (p) => schnittBild(p.schnitthoehe) };
function zeigeDetail(f, plan) {
  $('#detail-titel').textContent = f.titel;
  if (zeigt('ergebnis.kurz') && f.kurz) {
    $('#detail-titel').textContent = f.titelEinfach ?? f.titel;
    $('#detail-wert').textContent = STUFE_TEXT[f.stufe];
    $('#detail-text').innerHTML = `<p class="kurz">${esc(f.kurz)}</p>` + (KARTEN_BILD[f.id] ? `<div class="bild">${KARTEN_BILD[f.id](plan)}</div>` : '');
    dialog.showModal();
    return;
  }
  $('#detail-wert').textContent = f.wert;
  const [kopf, ...rest] = saetze(f.text);
  $('#detail-text').innerHTML = `<p class="kurz">${mitBegriffen(kopf)}</p>`
    + (rest.length ? `<ul>${rest.map((s) => `<li>${mitBegriffen(s)}</li>`).join('')}</ul>` : '')
    + (f.tipp ? `<p class="tipp"><b>Tipp:</b> ${mitBegriffen(f.tipp)}</p>` : '')
    + (KARTEN_GRAFIK[f.grafik]?.(f.grafikDaten) ?? '');
  dialog.showModal();
}
const STUFE_TEXT = { gut: 'Gut gemacht', mittel: 'Geht besser', schlecht: 'Problem' };

function zeigeErgebnis(res, sz, tipp, einstellungen) {
  const heu = res.art === 'heu', schluss = heu ? 'Heustock prüfen' : 'Silo öffnen';
  PFAD.ergebnis = tipp ? [['Start', 'start'], ['Prognose-Wette', 'wetten'], [schluss]] : [['Start', 'start'], ['Einsatz planen', 'setup'], [schluss]];
  TITEL.ergebnis = `${schluss} – Heureka`;
  zeige('ergebnis');
  Assistent.kontext(heu ? 'ergebnis.heu' : 'ergebnis.silage');
  $('#ergebnis-titel').textContent = heu ? 'Heustock geprüft: dein Ergebnis' : 'Silo geöffnet: dein Ergebnis';
  $('#ergebnis .ueber').textContent = heu
    ? (res.plan.siloart === 'belueftung' ? 'Sechs Wochen später – die Belüftung ist längst aus, das Heu wird geprüft …' : 'Sechs Wochen später – das Heu wird geprüft …')
    : 'Sechs Wochen später – das Silo wird geöffnet …';
  const n = sterne(res);
  $('#sterne').innerHTML = [0, 1, 2].map((i) => STERN(i < n)).join('');
  $('#sterne').setAttribute('aria-label', `${n} von 3 Sternen`);
  const urteile = heu
    ? [res.heu.temp >= 60 ? 'Der Heustock ist heiss geworden – Brandgefahr! Dieses Heu ist verdorben.' : 'Muffig und staubig – dieses Heu frisst keine Kuh gern.', 'Geht so – da liegt mehr drin.', 'Gutes Heu!', 'Duftendes, grünes Heu – die Kühe freuen sich!']
    : ['Das Silo stinkt nach Buttersäure – das will keine Kuh fressen.', 'Geht so – da liegt mehr drin.', 'Gute Silage!', 'Perfekte Silage – die Kühe freuen sich!'];
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

  letztesErgebnis = { res, sz, tipp };
  const e = res.ernte;
  ergebnisNiveau();
  $('#abzeichen').innerHTML = abzeichen(res).map(([t, d, minus]) => `<span class="${minus ? 'minus' : ''}" title="${esc(d)}">${minus ? '✗' : '★'} ${esc(t)}</span>`).join('');

  // Wette: Tipp gegen Ergebnis
  if (tipp) {
    const bewerte = (diff, eng, weit) => (diff <= eng ? 3 : diff <= weit ? 1 : 0);
    const tsName = zeigt('feld.zahlen') ? 'TS beim Einfahren' : 'Trockensubstanz beim Einfahren';
    const zeilen = [
      [tsName, `${tipp.ts} %`, `${z(e.ts)} %`, bewerte(Math.abs(tipp.ts - e.ts), 3, 7)],
      [zeigt('feld.zahlen') ? 'Rohasche' : 'Erde im Futter (Rohasche)', `${tipp.asche} g/kg`, `${z(e.asche, 0)} g/kg`, bewerte(Math.abs(tipp.asche - e.asche), 10, 25)],
      [heu ? 'Heuqualität' : 'Gärqualität', `Note ${tipp.note}`, `Note ${res.note}`, bewerte(Math.abs(tipp.note - res.note), 0, 1)],
    ];
    const total = zeilen.reduce((a, r) => a + r[3], 0);
    $('#tipp-vergleich').innerHTML = `<h2>Deine Wette: ${total} von 9 Punkten</h2><table class="vergleich"><thead><tr><th></th><th>Tipp</th><th>Ergebnis</th><th>Punkte</th></tr></thead><tbody>
      ${zeilen.map(([a, b, c, p]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td><td class="${p === 3 ? 'treffer' : p ? '' : 'daneben'}">${p}</td></tr>`).join('')}</tbody></table>` +
      (tipp.messung ? `<p class="messung"><b>Im echten Versuch gemessen:</b> ${z(tipp.messung.ts)} % TS beim Einführen, das Spiel rechnet ${z(e.ts)} %. ${esc(tipp.messung.text)} (${esc(tipp.messung.quelle)}). <a href="lernen.html#versuch">Spiel und Messung vergleichen</a></p>` : '');
    $('.punkte', $('#ergebnis')).hidden = true;
  } else {
    $('#tipp-vergleich').innerHTML = '';
    $('.punkte', $('#ergebnis')).hidden = false;
    if (einstellungen.name) {
      const l = rangliste();
      l.push({ name: einstellungen.name, punkte: res.punkte, wetter: sz.name, ts: e.ts, note: res.note, sterne: n, art: res.art, niveau: einstellungen.niveau ?? niveau() });
      speichereRangliste(l);
    }
  }
}

// Teile des Ergebnisses, die vom Niveau abhängen (werden beim Umstellen neu gezeichnet)
let letztesErgebnis = null;
function ergebnisNiveau() {
  if (!letztesErgebnis) return;
  const { res, sz, tipp } = letztesErgebnis, e = res.ernte, heu = res.art === 'heu';
  const zahlen = zeigt('ergebnis.zahlen');
  if (!zahlen) {
    const [a, b] = SILOARTEN[res.plan.siloart].ziel;
    const trocken = e.ts < a ? 'noch zu nass' : e.ts > b ? 'zu trocken' : 'genau richtig';
    $('#kennzahlen').innerHTML = [
      ['Wie trocken beim Einfahren?', trocken], ['Erde im Futter', e.asche <= 100 ? 'wenig' : 'viel'],
      [heu ? 'Heuqualität' : 'Gärqualität', `Note ${res.note} · ${NOTEN[res.note - 1]}`],
      heu ? ['Heustock', res.heu.temp < 45 ? 'blieb kühl' : res.heu.temp < 60 ? 'wurde warm' : 'wurde heiss'] : ['Zeit auf dem Feld', `${e.stunden} Stunden`],
    ].map(([x, y]) => `<div class="kennzahl"><span>${x}</span><strong>${y}</strong></div>`).join('');
  } else $('#kennzahlen').innerHTML = (heu ? [
    ['TS beim Einlagern', `${z(e.ts)} %`], ['Rohasche', `${z(e.asche, 0)} g/kg TS`], ['Heustock bis', `${z(res.heu.temp, 0)} °C`],
    ['Heuqualität', `Note ${res.note} · ${NOTEN[res.note - 1]}`], ['Energie', `${z(res.nel, 2)} MJ NEL/kg TS`], ['Verlust Feld bis Trog', `${z(res.verlustTotal, 0)} %`],
    ...(res.belueftung ? [['Belüftung', `${z(res.belueftung.stunden, 0)} h · ${z(res.belueftung.kwhJeT, 0)} kWh/t`]] : []),
  ] : [
    ['TS beim Einfahren', `${z(e.ts)} %`], ['Rohasche', `${z(e.asche, 0)} g/kg TS`], ['Zucker', `${z(e.zucker, 0)} g/kg TS`],
    ['Gärqualität', `Note ${res.note} · ${NOTEN[res.note - 1]}`], ['Energie', `${z(res.nel, 2)} MJ NEL/kg TS`], ['Verlust Feld bis Trog', `${z(res.verlustTotal, 0)} %`],
  ]).map(([a, b]) => `<div class="kennzahl"><span>${a}</span><strong>${b}</strong></div>`).join('');

  // Erklärkarten: nur die, die das Niveau zeigt (Kennzeichnung `ab` in model.js)
  const kurz = zeigt('ergebnis.kurz');
  $('#faktoren').replaceChildren(...res.faktoren.filter((f) => karteSichtbar(f)).map((f) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `faktor ${f.stufe}`;
    b.innerHTML = `<b><span class="sr-only">${STUFE_TEXT[f.stufe]}: </span>${esc(kurz ? f.titelEinfach ?? f.titel : f.titel)}</b><small>${esc(kurz ? STUFE_TEXT[f.stufe] : f.wert)}</small>`;
    b.addEventListener('click', () => zeigeDetail(f, res.plan));
    return b;
  }));
  $('#rueckblick-karte').hidden = !zeigt('ergebnis.rueckblick');
  if (zeigt('ergebnis.rueckblick')) zeichne($('#rueckblick'), stundenwetter(sz), { aktionen: res.ereignisse, verlauf: res.verlauf, ziel: SILOARTEN[res.plan.siloart].ziel });
  $('#profi').hidden = !zeigt('ergebnis.rechenweg');
  if (zeigt('ergebnis.rechenweg')) $('#rechenweg').innerHTML = rechenweg(res, sz, tipp);
}

// ---------- Profi: Rechenwege, Kalibrierung, Modell gegen Messung, Datenexport und Begründungsaufgaben
function rechenweg(res, sz, tipp) {
  const e = res.ernte, heu = res.art === 'heu', silo = SILOARTEN[res.plan.siloart], v = res.verlust;
  const gf = GAERFAKTOR[res.note - 1], zf = zielFaktor(e.ts, silo.ziel);
  const zeile = (a, b) => `<tr><th scope="row">${a}</th><td>${b}</td></tr>`;
  let html = '<h3>Punkte</h3><table class="rechnung"><tbody>'
    + zeile('Energie im Trog je ha', `${z(res.tsTrog * 10, 0)} kg TS/ha × ${z(res.nel, 2)} MJ NEL/kg TS = ${z(res.nelHa, 0)} MJ NEL/ha`)
    + zeile(heu ? 'Heufaktor (Note)' : 'Gärfaktor (Note)', `Note ${res.note} → ${z(gf, 2)}`)
    + zeile('Zielfaktor', `1 − min(0,2; 0,01 × Abstand zum Zielbereich ${silo.ziel[0]}–${silo.ziel[1]} % TS) = ${z(zf, 2)}`)
    + zeile('Punkte', `${z(res.nelHa, 0)} × ${z(gf, 2)} × ${z(zf, 2)} / 100 = <b>${res.punkte}</b>`)
    + '</tbody></table>';
  if (!heu) {
    const s = res.silage, pk = BESTAENDE[res.plan.bestand].pk;
    html += '<h3>Silierung</h3><table class="rechnung"><tbody>'
      + zeile('Vergärbarkeitskoeffizient (Weissbach)', `FK = TS + 8 × Zucker/Pufferkapazität = ${z(e.ts)} + 8 × ${z(e.zucker, 0)}/${pk} = <b>${z(s.fk)}</b> (ab 45 sicher silierbar)`)
      + zeile('Kritischer pH', `pH<sub>krit</sub> = 0,0257 × TS + 3,71 = 0,0257 × ${z(e.ts)} + 3,71 = ${z(s.pHkrit, 2)}; Modell-pH ${z(s.pH, 2)}`)
      + zeile('DLG-Schlüssel (vereinfacht)', `Buttersäure ${z(s.buttersaeure / 10, 2)} % TS, Essigsäure ${z(s.essigsaeure / 10, 1)} % TS, pH ${z(s.pH, 2)} → ${s.dlg} Punkte → Note ${s.note}`)
      + '</tbody></table>';
  } else {
    const h = res.heu, wasser = Math.max(0, 100 / e.ts - 100 / 87);
    html += '<h3>Lagerung</h3><table class="rechnung"><tbody>'
      + zeile('TS-Defizit', `Grenze ${silo.grenze} % − ${z(e.ts)} % = ${z(h.defizit)} Prozentpunkte`)
      + (res.plan.siloart === 'belueftung'
        ? zeile('Wasser bis lagerfähig (87 % TS)', `100/TS − 100/87 = 100/${z(e.ts)} − 100/87 = ${z(wasser, 2)} kg Wasser je kg TS`)
          + zeile('Belüftungsdauer (Lehrmodell)', `Wasser / (0,4 × mittleres Dampfdruckdefizit tagsüber) ≈ ${z(h.belueftTage, 1)} Tage`)
        : '')
      + zeile('Sinnenprüfung', `100 − Geruch ${z(h.abzug.geruch, 0)} − Farbe ${z(h.abzug.farbe, 0)} − Gefüge ${z(h.abzug.gefuege, 0)} − Erde ${z(h.abzug.verunreinigung, 0)} = ${h.punkte} Punkte → Note ${h.note}`)
      + '</tbody></table>';
  }
  html += '<h3>Verluste vom Feld bis zum Trog (% der gemähten TS)</h3><table class="rechnung"><tbody>'
    + [['Atmung', v.atmung], ['Auswaschung', v.auswaschung], ['Bröckeln', v.broeckel], ['Liegen gelassen', v.liegen], [heu ? 'Lager' : 'Silo', res.lagerverlust]].map(([a, b]) => zeile(a, `${z(b)} %`)).join('')
    + zeile('Total', `<b>${z(res.verlustTotal)} %</b>`) + '</tbody></table>';
  html += '<h3>Kalibrierung des Modells (KAL in model.js)</h3><table class="rechnung"><tbody>'
    + zeile('Grundtempo der Trocknung (k)', z(KAL.k, 2))
    + zeile('Wirkung der Ablagebreite', `${z(KAL.ablage, 2)} (Schwadfaktor = (85/Ablage)<sup>${z(KAL.ablage, 2)}</sup>)`)
    + zeile('Schub ab 55 % TS innen (Heu)', z(KAL.schub, 2))
    + zeile('Massstab der Bröckelverluste', `× ${z(KAL.broeckel, 2)}`)
    + '</tbody></table><p class="hinweis">Kalibriert am FAT-Versuch Tänikon 2001 (FAT-Bericht 584); mittlere Abweichung rund 3,5 Prozentpunkte TS. Trocknung nach Rotz &amp; Chen (1985).</p>'
    + '<div class="knopfreihe"><a class="knopflink" href="lernen.html#versuch" target="_blank" rel="noopener">Modell gegen Messung</a>'
    + '<button type="button" class="leise-knopf" data-export>Daten als CSV herunterladen</button></div>';
  html += `<h3>Aufgaben zum Begründen</h3><ol class="aufgaben">${aufgaben(res, tipp).map((a) => `<li>${a}</li>`).join('')}</ol>`;
  return html;
}

function aufgaben(res, tipp) {
  const e = res.ernte, heu = res.art === 'heu', v = res.verlust, a = [];
  if (tipp?.messung) a.push(`Erkläre die Abweichung zwischen Spiel (${z(e.ts)} % TS) und Messung (${z(tipp.messung.ts)} % TS). Welche Annahmen des Modells oder der Kalibrierung könnten sie verursachen?`);
  else a.push('Erkläre die Abweichung zwischen Spiel und Messung im Versuch Tänikon (Knopf «Modell gegen Messung»): Bei welchen Verfahren liegt das Modell daneben, und warum?');
  if (!heu) a.push(`Begründe die Gärnote ${res.note} mit dem Vergärbarkeitskoeffizienten: Welche Grösse in FK = TS + 8 × Zucker/Pufferkapazität hat dein Ergebnis am stärksten bestimmt?`);
  else a.push(`Rechne nach: Wie viel Wasser je kg TS hätte nach dem Einlagern noch weg müssen (100/TS − 100/87)? Was hätte eine um 10 Prozentpunkte tiefere TS bedeutet?`);
  const [art, wert] = [['Atmung', v.atmung], ['Auswaschung', v.auswaschung], ['Bröckeln', v.broeckel], ['Liegen gelassen', v.liegen], [heu ? 'Lager' : 'Silo', res.lagerverlust]].sort((x, y) => y[1] - x[1])[0];
  a.push(`Der grösste Verlustposten war «${art}» mit ${z(wert)} % der TS. Welche Entscheidung hätte ihn verringert, und was hätte sie gekostet (Zeit, Wetterrisiko, Leistung, Insekten)?`);
  a.push('Lade die Daten als CSV herunter und stelle den TS-Verlauf zusammen mit Strahlung und Dampfdruckdefizit dar. Wann trocknete das Futter am schnellsten, und warum?');
  return a;
}

// CSV (Semikolon, Dezimalpunkt, UTF-8 mit BOM): Ergebniswerte, Arbeitsgänge, stündlicher Verlauf
function csvRunde() {
  const { res, sz } = letztesErgebnis, e = res.ernte, wetter = stundenwetter(sz), f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '');
  const q = (x) => (/[;"\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x));
  const zeilen = [['Heureka – Datenexport der Runde'], ['Niveau', niveauInfo().name], ['Wetter', sz.name], ['Lager', SILOARTEN[res.plan.siloart].name], [],
    ['Ergebnis', 'Wert', 'Einheit'],
    ['TS beim Einfahren', f(e.ts), '%'], ['Rohasche', f(e.asche, 1), 'g/kg TS'], ['Zucker', f(e.zucker, 1), 'g/kg TS'],
    ['Note', res.note, ''], ['Energie', f(res.nel), 'MJ NEL/kg TS'], ['Energie im Trog', f(res.nelHa, 0), 'MJ NEL/ha'],
    ['Verlust Feld bis Trog', f(res.verlustTotal), '%'], ...Object.entries(res.verlust).map(([k, x]) => [`Verlust ${k}`, f(x), '% TS']), ['Verlust Lager/Silo', f(res.lagerverlust), '% TS'],
    ...(res.silage ? [['FK', f(res.silage.fk, 1), ''], ['pH', f(res.silage.pH), ''], ['pH kritisch', f(res.silage.pHkrit), ''], ['Buttersäure', f(res.silage.buttersaeure / 10), '% TS'], ['DLG-Punkte', res.silage.dlg, '']] : []),
    ...(res.heu ? [['Heustock bis', f(res.heu.temp, 0), '°C'], ['Belüftungstage', f(res.heu.belueftTage, 1), 'd'], ['Heuqualität', res.heu.punkte, 'Punkte']] : []),
    ['Punkte', res.punkte, ''], [],
    ['Arbeitsgänge'], ['Stunde', 'Tag', 'Uhrzeit', 'Arbeitsgang', 'TS %'],
    ...res.ereignisse.map((x) => [x.t, Math.floor(x.t / 24) + 1, `${String(x.t % 24).padStart(2, '0')}:00`, x.text, f(x.ts)]), [],
    ['Stündlicher Verlauf'], ['Stunde', 'Tag', 'Uhrzeit', 'Temperatur °C', 'rel. Luftfeuchte %', 'Strahlung W/m2', 'Dampfdruckdefizit kPa', 'Wind m/s', 'Regen mm', 'TS %', 'TS innen %', 'Oberflächenwasser g/g TS'],
  ];
  const nachT = new Map(res.verlauf.map((x) => [x.t, x]));
  for (const w of wetter.filter((x) => x.t <= res.plan.ernte)) {
    const m = nachT.get(w.t);
    zeilen.push([w.t, w.tag, `${String(w.h).padStart(2, '0')}:00`, f(w.temp, 1), f(w.rh, 1), f(w.rad, 0), f(w.vpd, 3), f(w.wind, 1), f(w.regen, 1), m ? f(m.ts) : '', m ? f(m.tsInnen) : '', m ? f(m.nass, 3) : '']);
  }
  return '\ufeff' + zeilen.map((r) => r.map(q).join(';')).join('\r\n');
}
$('#profi').addEventListener('click', (ev) => {
  if (!ev.target.closest('[data-export]') || !letztesErgebnis) return;
  const url = URL.createObjectURL(new Blob([csvRunde()], { type: 'text/csv;charset=utf-8' }));
  const d = new Date(), stempel = `${d.toISOString().slice(0, 10)}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  const a = Object.assign(document.createElement('a'), { href: url, download: `heureka-runde-${stempel}.csv` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
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
    ? l.map((e) => `<li><span>${esc(e.name)}<small>${niveauGueltig(e.niveau) ? `<span class="niveau-marke ${e.niveau}">${niveauInfo(e.niveau).name}</span> · ` : ''}${e.art === 'heu' ? 'Heu' : 'Silage'} · ${esc(e.wetter)} · ${z(e.ts, 0)} % TS · Note ${e.note}</small></span><strong>${e.punkte}</strong></li>`).join('')
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
  const heu = SILOARTEN[szenario.plan.siloart].art === 'heu';
  $('#note-label').textContent = heu ? 'Heuqualität' : 'Gärqualität';
  tippform.ts.max = heu ? 95 : 70;
  tippform.ts.min = heu ? 40 : 15;
  if (heu && Number(tippform.ts.value) < 60) tippform.ts.value = 80;
  if (!heu && Number(tippform.ts.value) > 70) tippform.ts.value = 35;
  tippText();
  $('#szenario-text').textContent = szenario.text;
  $('#szenario-wetter').innerHTML = w.tage.map((d, i) => {
    const mm = (d.regen ?? []).reduce((a, r) => a + r.mm, 0);
    return `<div class="tageskarte"><b>Tag ${i + 1}</b>${wetterSymbol(d)}<span>${Math.round(d.tmax)}° / ${Math.round(d.tmin)}°</span><small>${mm > 0 ? z(mm, 0) + ' mm' : 'trocken'}</small></div>`;
  }).join('');
  tippform.scrollIntoView({ behavior: 'smooth', block: 'start' });
  Assistent.hinweis(`wette.${szenario.id}`, { titel: szenario.name, einfach: szenario.lernziel, fachlich: szenario.lernziel, lernen: 'trocknung' });
}
$('#szenarien').addEventListener('click', (ev) => {
  const b = ev.target.closest('.wahlkarte');
  if (b) waehleSzenario(b.dataset.id);
});
baueWahl($('[data-feld="note"]', tippform), [1, 2, 3, 4, 5].map((n) => ({ wert: n, titel: `${n} · ${NOTEN[n - 1]}` })), tipp);
function wetteNiveau() {
  const einfach = !zeigt('feld.zahlen');
  tippform.ts.closest('label').querySelector('span').textContent = einfach ? 'Trockensubstanz beim Einfahren' : 'TS beim Einfahren';
  tippform.asche.closest('label').querySelector('span').textContent = einfach ? 'Erde im Futter (Rohasche)' : 'Rohasche';
}
wetteNiveau();
function tippText() {
  tippform.tsAus.value = `${tippform.ts.value} % TS`;
  tippform.ascheAus.value = `${tippform.asche.value} g/kg TS`;
  tippform.ts.setAttribute('aria-valuetext', tippform.tsAus.value);
  tippform.asche.setAttribute('aria-valuetext', tippform.ascheAus.value);
}
tippform.addEventListener('input', tippText);
tippText();
tippform.addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (!szenario) return;
  const t = { ts: Number(tippform.ts.value), asche: Number(tippform.asche.value), note: tipp.note, messung: szenario.messung ?? null };
  const { maehen, zetten, schwaden, ernte, ...einstellungen } = szenario.plan;
  starteSpiel({ einstellungen, sz: WETTER.find((x) => x.id === szenario.wetter), plan: { maehen, zetten, schwaden, ernte }, tipp: t });
});

// ---------- Niveau wählen (Startbildschirm, Dialog über den Knopf im Kopf)
document.querySelectorAll('.niveau-wahl').forEach(baueNiveauWahl);
function zeigeNiveauKnopf() {
  const n = niveauInfo();
  $('#niveau-auf').innerHTML = `<span aria-hidden="true">${n.zeichen}</span> ${n.name}`;
  $('#niveau-auf').setAttribute('aria-label', `Niveau: ${n.name}. Ändern`);
}
zeigeNiveauKnopf();
$('#niveau-auf').addEventListener('click', () => dialogOeffnen($('#niveau-dialog')));
beiWechsel(() => {
  zeigeNiveauKnopf();
  einsatzNiveau(true);
  assistentNiveau(true);
  zeigeAssistentSteuerung();
  wetteNiveau();
  spiel?.zeichne(0.3);
  if (aktuell === 'ergebnis') ergebnisNiveau();
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
