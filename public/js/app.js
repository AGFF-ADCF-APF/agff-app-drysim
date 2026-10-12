import { stundenwetter, zufallswetter } from './weather.js';
import { BESTAENDE, STADIEN, AUFBEREITER, HOEHEN, SILOARTEN } from './model.js';
import { WETTER, PROGNOSEN, GRUNDPLAN } from './scenarios.js';
import { Szene } from './scene.js';
import { Spiel } from './game.js';
import { zeichne } from './chart.js';
import { wetterSymbol, STERN } from './icons.js';

const $ = (s, el = document) => el.querySelector(s);
const z = (x, d = 1) => x.toFixed(d).replace('.', ',');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const NOTEN = ['sehr gut', 'gut', 'verbesserungsbedürftig', 'schlecht', 'sehr schlecht'];

// ---------- Bildschirme
let spiel = null;
function zeige(id) {
  spiel?.stop(); spiel = null;
  document.querySelectorAll('.bildschirm').forEach((b) => { b.hidden = b.id !== id; });
  $('#zum-menu').hidden = id === 'start';
  if (id === 'start') zeigeRangliste();
  window.scrollTo({ top: 0 });
}
document.addEventListener('click', (ev) => {
  const z = ev.target.closest('[data-gehe]');
  if (z) zeige(z.dataset.gehe);
});

// Startbild: stehendes Gras am Morgen
{
  const s = new Szene($('#startszene'), 6);
  s.zeige({ phase: 'stehend', ts: 18, nass: 0.25, asche: 90 }, { h: 8, sonne: 0.85, regen: 0 }, 0);
}

// ---------- Einsatz planen: Auswahlkarten und Chips
const wahl = { ...GRUNDPLAN, wetter: 'hoch' };
const setup = $('#setupform');
const BESCHREIBUNG = {
  bestand: {
    graeser: 'Viel Zucker – siliert sich leicht.',
    ausgewogen: 'Gräser, Klee und Kräuter gemischt.',
    klee: 'Eiweissreich, wenig Zucker, Blätter bröckeln.',
  },
  aufbereiter: {
    ohne: 'Schonend, aber langsames Anwelken.',
    zinken: 'Schlägt die Wachsschicht kräftig auf.',
    walzen: 'Quetscht die Stängel, schont die Blätter.',
  },
  siloart: {
    flachsilo: 'Mit dem Ladewagen ins Silo, gut verdichten.',
    ballen: 'Pressen und wickeln, braucht trockeneres Futter.',
  },
};
const OPTIONEN = {
  wetter: [...WETTER.map((w) => ({ wert: w.id, titel: w.name, text: w.info, extra: `<span class="wetterreihe">${w.tage.map(wetterSymbol).join('')}</span>` })),
    { wert: 'zufall', titel: 'Überraschung', text: 'Zufallswetter – mit Code für die ganze Klasse gleich.' }],
  bestand: Object.entries(BESTAENDE).map(([k, v]) => ({ wert: k, titel: v.name, text: BESCHREIBUNG.bestand[k] })),
  aufbereiter: Object.entries(AUFBEREITER).map(([k, v]) => ({ wert: k, titel: v.name.replace(/^./, (c) => c.toUpperCase()), text: BESCHREIBUNG.aufbereiter[k] })),
  siloart: Object.entries(SILOARTEN).map(([k, v]) => ({ wert: k, titel: v.name, text: `${BESCHREIBUNG.siloart[k]} Ziel ${v.ziel[0]}–${v.ziel[1]} % TS.` })),
  stadium: Object.entries(STADIEN).map(([k, v]) => ({ wert: Number(k), titel: v.name })),
  boden: [{ wert: 'eben', titel: 'eben' }, { wert: 'maulwurf', titel: 'Maulwurfshaufen' }],
  schnitthoehe: [4, 5, 6, 7, 8, 9].map((h) => ({ wert: h, titel: `${h} cm` })),
  breit: [{ wert: true, titel: 'Breitablage' }, { wert: false, titel: 'in der Mähschwade' }],
  zetterHoehe: Object.entries(HOEHEN).map(([k, v]) => ({ wert: k, titel: `Zinken ${v.cm} über Boden` })),
  schwaderHoehe: Object.entries(HOEHEN).map(([k, v]) => ({ wert: k, titel: `Zinken ${v.cm} über Boden` })),
};

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
setup.querySelectorAll('[data-feld]').forEach((box) => baueWahl(box, box.dataset.feld, wahl, () => {
  $('.code', setup).hidden = wahl.wetter !== 'zufall';
}));
setup.ertrag.addEventListener('input', () => { setup.ertragAus.value = `${setup.ertrag.value} dt TS/ha`; });

// Wetter aus der Adresse (Lehrperson verschickt z.B. ?wetter=gewitter oder ?code=KLASSE3)
{
  const q = new URLSearchParams(location.search);
  const id = q.get('code') ? 'zufall' : q.get('wetter');
  if (id && (id === 'zufall' || WETTER.some((w) => w.id === id))) {
    wahl.wetter = id;
    if (q.get('code')) setup.code.value = q.get('code');
    baueWahl($('[data-feld="wetter"]', setup), 'wetter', wahl, () => { $('.code', setup).hidden = wahl.wetter !== 'zufall'; });
    $('.code', setup).hidden = id !== 'zufall';
  }
}

function wetterVon(id) {
  if (id === 'zufall') return zufallswetter((setup.code.value || 'AGFF').trim().toUpperCase());
  return WETTER.find((w) => w.id === id);
}

let letzterStart = null;
function starteSpiel({ einstellungen, sz, plan = null, tipp = null }) {
  letzterStart = { einstellungen, sz, plan, tipp };
  zeige('spiel');
  spiel = new Spiel($('#spiel'), {
    setup: einstellungen, wetterSzenario: sz, plan,
    onEnde: (res) => zeigeErgebnis(res, sz, tipp, einstellungen),
  });
}

setup.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const einstellungen = { ...wahl, ertrag: Number(setup.ertrag.value), name: setup.name.value.trim() };
  starteSpiel({ einstellungen, sz: wetterVon(wahl.wetter) });
});

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
function zeigeErgebnis(res, sz, tipp, einstellungen) {
  zeige('ergebnis');
  const n = sterne(res);
  $('#sterne').innerHTML = [0, 1, 2].map((i) => STERN(i < n)).join('');
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
    b.innerHTML = `<b>${esc(f.titel)}</b><small>${esc(f.wert)}</small>`;
    b.addEventListener('click', () => {
      $('#detail-titel').textContent = f.titel;
      $('#detail-wert').textContent = f.wert;
      $('#detail-text').textContent = f.text;
      dialog.showModal();
    });
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
function rangliste() { try { return JSON.parse(localStorage.getItem(RL)) ?? []; } catch { return []; } }
function speichereRangliste(l) { try { localStorage.setItem(RL, JSON.stringify(l)); } catch { /* privat: nicht speicherbar */ } }
function zeigeRangliste() {
  const l = rangliste().sort((a, b) => b.punkte - a.punkte).slice(0, 10);
  $('#rangliste').innerHTML = l.length
    ? l.map((e) => `<li><span>${esc(e.name)}<small>${esc(e.wetter)} · ${z(e.ts, 0)} % TS · Note ${e.note}</small></span><strong>${e.punkte}</strong></li>`).join('')
    : '<li class="leer">Noch niemand. Gib beim Einsatz einen Namen ein, dann erscheinst du hier.</li>';
}
$('#rangliste-leeren').addEventListener('click', () => {
  if (confirm('Rangliste in diesem Browser löschen?')) { speichereRangliste([]); zeigeRangliste(); }
});
zeigeRangliste();

// ---------- Prognose-Wette
const tippform = $('#tippform');
const tipp = { note: 2 };
let szenario = null;
$('#szenarien').innerHTML = PROGNOSEN.map((p) => {
  const w = WETTER.find((x) => x.id === p.wetter);
  return `<button type="button" class="wahlkarte" data-id="${p.id}" aria-pressed="false"><b>${p.name}</b><span class="wetterreihe">${w.tage.map(wetterSymbol).join('')}</span><small>${w.name} · ${BESTAENDE[p.plan.bestand].name} · ${SILOARTEN[p.plan.siloart].name}</small></button>`;
}).join('');
$('#szenarien').addEventListener('click', (ev) => {
  const b = ev.target.closest('.wahlkarte');
  if (!b) return;
  document.querySelectorAll('#szenarien .wahlkarte').forEach((x) => x.setAttribute('aria-pressed', x === b));
  szenario = PROGNOSEN.find((p) => p.id === b.dataset.id);
  const w = WETTER.find((x) => x.id === szenario.wetter);
  tippform.hidden = false;
  $('#szenario-titel').textContent = szenario.name;
  $('#szenario-text').textContent = szenario.text;
  $('#szenario-wetter').innerHTML = w.tage.map((d, i) => {
    const mm = (d.regen ?? []).reduce((a, r) => a + r.mm, 0);
    return `<div class="tageskarte"><b>Tag ${i + 1}</b>${wetterSymbol(d)}<span>${Math.round(d.tmax)}° / ${Math.round(d.tmin)}°</span><small>${mm > 0 ? z(mm, 0) + ' mm' : 'trocken'}</small></div>`;
  }).join('');
  tippform.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
baueWahl($('[data-feld="note"]', tippform), [1, 2, 3, 4, 5].map((n) => ({ wert: n, titel: `${n} · ${NOTEN[n - 1]}` })), tipp);
const tippText = () => {
  tippform.tsAus.value = `${tippform.ts.value} % TS`;
  tippform.ascheAus.value = `${tippform.asche.value} g/kg TS`;
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
