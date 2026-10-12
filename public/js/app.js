import { stundenwetter, zufallswetter } from './weather.js';
import { simuliere, uhr, BESTAENDE, STADIEN, AUFBEREITER, HOEHEN, SILOARTEN } from './model.js';
import { WETTER, PROGNOSEN, GRUNDPLAN } from './scenarios.js';
import { zeichne } from './chart.js';

const $ = (s, el = document) => el.querySelector(s);
const z = (x, d = 1) => x.toFixed(d).replace('.', ',');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const optionen = (obj, f = (v) => v.name) => Object.entries(obj).map(([k, v]) => `<option value="${k}">${f(v, k)}</option>`).join('');
const NOTEN = ['sehr gut', 'gut', 'verbesserungsbedürftig', 'schlecht', 'sehr schlecht'];

// ---------- Moduswechsel
document.querySelectorAll('.modi button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.modi button').forEach((x) => x.setAttribute('aria-selected', x === b));
  document.querySelectorAll('.modus').forEach((m) => { m.hidden = m.id !== b.dataset.modus; });
}));

// ---------- Erklär-Dialog
const dialog = $('#detail');
function zeigeFaktor(f) {
  $('#detail-titel').textContent = f.titel;
  $('#detail-wert').textContent = f.wert;
  $('#detail-text').textContent = f.text;
  dialog.showModal();
}
function faktorKnoepfe(res) {
  const box = document.createElement('div');
  box.className = 'faktoren';
  for (const f of res.faktoren) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `faktor ${f.stufe}`;
    b.innerHTML = `<strong>${esc(f.titel)}</strong><small>${esc(f.wert)}</small>`;
    b.addEventListener('click', () => zeigeFaktor(f));
    box.append(b);
  }
  return box;
}
function kennzahlen(res) {
  const e = res.ernte, s = res.silage;
  return `<div class="kennzahlen">
    <div class="kennzahl"><span>TS beim Einfahren</span><strong>${z(e.ts)} %</strong></div>
    <div class="kennzahl"><span>Rohasche</span><strong>${z(e.asche, 0)} g/kg</strong></div>
    <div class="kennzahl"><span>Zucker</span><strong>${z(e.zucker, 0)} g/kg</strong></div>
    <div class="kennzahl"><span>Gärqualität</span><strong>Note ${s.note}</strong></div>
    <div class="kennzahl"><span>Energie</span><strong>${z(res.nel, 2)} MJ NEL</strong></div>
    <div class="kennzahl"><span>Verlust Feld bis Trog</span><strong>${z(res.verlustTotal, 0)} %</strong></div>
  </div>`;
}

// ---------- Animation
function animiere(el, uhrEl, wetter, res, msProStunde, ziel) {
  const aktionen = res.ereignisse;
  return new Promise((fertig) => {
    if (!msProStunde) {
      zeichne(el, wetter, { aktionen, verlauf: res.verlauf, ziel });
      uhrEl.textContent = uhr(res.plan.ernte);
      return fertig();
    }
    let t = res.plan.maehen;
    const schritt = () => {
      zeichne(el, wetter, { aktionen: aktionen.filter((a) => a.t <= t), verlauf: res.verlauf, ziel, bis: t });
      uhrEl.textContent = uhr(t);
      if (t >= res.plan.ernte) return fertig();
      t++;
      setTimeout(schritt, msProStunde);
    };
    schritt();
  });
}

// ====================================================================
// Modus 1: Planen & Wettkampf
// ====================================================================
const form = $('#planform');
const zeitOptionen = (leer) => {
  let html = leer ? '<option value="">–</option>' : '';
  for (let d = 0; d < 4; d++) {
    html += `<optgroup label="Tag ${d + 1}">`;
    for (let h = 5; h <= 22; h++) html += `<option value="${d * 24 + h}">Tag ${d + 1}, ${String(h).padStart(2, '0')}:00</option>`;
    html += '</optgroup>';
  }
  return html;
};
form.wetter.innerHTML = WETTER.map((w) => `<option value="${w.id}">${w.name}</option>`).join('') + '<option value="zufall">Zufallswetter mit Code …</option>';
form.bestand.innerHTML = optionen(BESTAENDE);
form.stadium.innerHTML = optionen(STADIEN);
form.siloart.innerHTML = optionen(SILOARTEN, (v) => `${v.name} (Ziel ${v.ziel[0]}–${v.ziel[1]} % TS)`);
form.schnitthoehe.innerHTML = [4, 5, 6, 7, 8, 9].map((h) => `<option value="${h}">${h} cm</option>`).join('');
form.aufbereiter.innerHTML = optionen(AUFBEREITER);
form.zetterHoehe.innerHTML = form.schwaderHoehe.innerHTML = optionen(HOEHEN);
form.querySelectorAll('select.zeit').forEach((s) => { s.innerHTML = zeitOptionen(s.classList.contains('leer')); });

function setzePlan(p) {
  for (const k of ['bestand', 'stadium', 'ertrag', 'boden', 'siloart', 'schnitthoehe', 'aufbereiter', 'zetterHoehe', 'schwaderHoehe', 'maehen', 'schwaden', 'ernte']) form[k].value = p[k];
  form.breit.checked = p.breit;
  [1, 2, 3].forEach((i) => { form['zetten' + i].value = p.zetten[i - 1] ?? ''; });
}
function lesePlan() {
  const n = (k) => Number(form[k].value);
  return {
    bestand: form.bestand.value, stadium: n('stadium'), ertrag: Math.min(50, Math.max(15, n('ertrag') || 30)), boden: form.boden.value,
    siloart: form.siloart.value, schnitthoehe: n('schnitthoehe'), aufbereiter: form.aufbereiter.value, breit: form.breit.checked,
    zetterHoehe: form.zetterHoehe.value, schwaderHoehe: form.schwaderHoehe.value,
    maehen: n('maehen'), schwaden: n('schwaden'), ernte: n('ernte'),
    zetten: [1, 2, 3].map((i) => form['zetten' + i].value).filter((v) => v !== '').map(Number),
  };
}
function aktuellesWetter() {
  if (form.wetter.value === 'zufall') return zufallswetter((form.code.value || 'AGFF').trim().toUpperCase());
  return WETTER.find((w) => w.id === form.wetter.value);
}
function planAktionen(p) {
  return [{ t: p.maehen, art: 'maehen' }, ...p.zetten.map((t) => ({ t, art: 'zetten' })),
    { t: p.schwaden, art: 'schwaden' }, { t: p.ernte, art: 'ernte' }];
}
function vorschau() {
  const w = aktuellesWetter();
  const p = lesePlan();
  $('.zufall', form).hidden = form.wetter.value !== 'zufall';
  $('#wettertitel').textContent = `${w.name}${w.info ? ' – ' + w.info : ''}`;
  $('#uhr').textContent = '';
  zeichne($('#diagramm'), stundenwetter(w), { aktionen: planAktionen(p), ziel: SILOARTEN[p.siloart].ziel });
}

// Startwerte, auch aus der Adresse (Lehrperson verschickt z.B. ?wetter=gewitter oder ?code=KLASSE3)
setzePlan(GRUNDPLAN);
{
  const q = new URLSearchParams(location.search);
  if (q.get('code')) { form.wetter.value = 'zufall'; form.code.value = q.get('code'); }
  else if (WETTER.some((w) => w.id === q.get('wetter'))) form.wetter.value = q.get('wetter');
}
form.addEventListener('input', vorschau);
vorschau();

let laeuft = false;
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (laeuft) return;
  const w = aktuellesWetter(), wetter = stundenwetter(w), p = lesePlan();
  const res = simuliere(p, wetter);
  $('#planfehler').textContent = res.fehler ?? '';
  if (res.fehler) return;
  laeuft = true; $('button.haupt', form).disabled = true;
  $('#ergebnis').hidden = true;
  const ms = { 40: 120, 12: 40, 0: 0 }[form.tempo.value] ?? 40;
  await animiere($('#diagramm'), $('#uhr'), wetter, res, ms, SILOARTEN[p.siloart].ziel);
  laeuft = false; $('button.haupt', form).disabled = false;
  zeigeErgebnis(res, w);
});

function zeigeErgebnis(res, w) {
  const box = $('#ergebnis');
  box.className = 'karte';
  box.innerHTML = `<div class="kartenkopf"><h2>Ergebnis</h2><span class="uhr">${z(res.ernte.stunden, 0)} h auf dem Feld</span></div>
    <div class="kennzahlen"><div class="kennzahl gross"><span>Punkte (Energie im Trog × Qualität)</span><strong>${res.punkte}</strong></div></div>
    ${kennzahlen(res)}
    <p class="hinweis">Tippe auf einen Faktor, um zu sehen, was passiert ist. Grün = gut, gelb = mittel, rot = Problem.</p>`;
  box.append(faktorKnoepfe(res));
  const ein = document.createElement('form');
  ein.className = 'eintragen';
  ein.innerHTML = `<input name="name" maxlength="30" placeholder="Name oder Team" required><button class="haupt">In Rangliste eintragen</button>`;
  ein.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const liste = rangliste();
    liste.push({ name: ein.name.value.trim(), punkte: res.punkte, wetter: w.name, ts: res.ernte.ts, note: res.silage.note, zeit: Date.now() });
    speichereRangliste(liste);
    ein.replaceWith(Object.assign(document.createElement('p'), { className: 'hinweis', textContent: 'Eingetragen.' }));
    zeigeRangliste();
  });
  box.append(ein);
  box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Rangliste nur lokal im Browser (z.B. Beamer-Rechner der Lehrperson)
const RL = 'drysim-rangliste';
function rangliste() { try { return JSON.parse(localStorage.getItem(RL)) ?? []; } catch { return []; } }
function speichereRangliste(l) { try { localStorage.setItem(RL, JSON.stringify(l)); } catch { /* privat: nicht speicherbar */ } }
function zeigeRangliste() {
  const l = rangliste().sort((a, b) => b.punkte - a.punkte).slice(0, 30);
  $('#rangliste').innerHTML = l.length
    ? l.map((e) => `<li><strong>${e.punkte}</strong> ${esc(e.name)} <small>· ${esc(e.wetter)} · ${z(e.ts, 0)} % TS · Note ${e.note}</small></li>`).join('')
    : '<li class="hinweis" style="list-style:none">Noch keine Einträge.</li>';
}
$('#rangliste-leeren').addEventListener('click', () => {
  if (confirm('Rangliste in diesem Browser löschen?')) { speichereRangliste([]); zeigeRangliste(); }
});
zeigeRangliste();

// ====================================================================
// Modus 2: Prognose
// ====================================================================
const tipp = $('#tippform');
let szenario = null;
$('#szenarien').innerHTML = PROGNOSEN.map((p) => {
  const w = WETTER.find((x) => x.id === p.wetter);
  return `<button type="button" class="karte szenario" data-id="${p.id}" aria-pressed="false"><strong>${p.name}</strong><small>${w.name} · ${BESTAENDE[p.plan.bestand].name} · ${SILOARTEN[p.plan.siloart].name}</small></button>`;
}).join('');
$('#szenarien').addEventListener('click', (ev) => {
  const b = ev.target.closest('.szenario');
  if (!b) return;
  document.querySelectorAll('.szenario').forEach((x) => x.setAttribute('aria-pressed', x === b));
  szenario = PROGNOSEN.find((p) => p.id === b.dataset.id);
  const w = WETTER.find((x) => x.id === szenario.wetter);
  $('#prognose-inhalt').hidden = false;
  $('#szenario-titel').textContent = szenario.name;
  $('#szenario-text').textContent = szenario.text;
  $('#pwettertitel').textContent = `${w.name} – ${w.info}`;
  $('#puhr').textContent = '';
  $('#pergebnis').hidden = true;
  $('button.haupt', tipp).disabled = false;
  zeichne($('#pdiagramm'), stundenwetter(w), { aktionen: planAktionen(szenario.plan), ziel: SILOARTEN[szenario.plan.siloart].ziel });
});
const tippAnzeige = () => {
  tipp.tsAus.value = `${tipp.ts.value} %`;
  tipp.ascheAus.value = `${tipp.asche.value} g/kg TS`;
};
tipp.addEventListener('input', tippAnzeige);
tippAnzeige();

tipp.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!szenario || laeuft) return;
  const w = WETTER.find((x) => x.id === szenario.wetter), wetter = stundenwetter(w);
  const res = simuliere(szenario.plan, wetter);
  laeuft = true; $('button.haupt', tipp).disabled = true;
  await animiere($('#pdiagramm'), $('#puhr'), wetter, res, 35, SILOARTEN[szenario.plan.siloart].ziel);
  laeuft = false;

  const g = { ts: Number(tipp.ts.value), asche: Number(tipp.asche.value), note: Number(tipp.note.value) };
  const bewerte = (diff, eng, weit) => (diff <= eng ? 3 : diff <= weit ? 1 : 0);
  const zeilen = [
    ['TS beim Einfahren', `${g.ts} %`, `${z(res.ernte.ts)} %`, bewerte(Math.abs(g.ts - res.ernte.ts), 3, 7)],
    ['Rohasche', `${g.asche} g/kg`, `${z(res.ernte.asche, 0)} g/kg`, bewerte(Math.abs(g.asche - res.ernte.asche), 10, 25)],
    ['Gärqualität', `Note ${g.note}`, `Note ${res.silage.note} (${NOTEN[res.silage.note - 1]})`, bewerte(Math.abs(g.note - res.silage.note), 0, 1)],
  ];
  const total = zeilen.reduce((a, r) => a + r[3], 0);
  const box = $('#pergebnis');
  box.className = 'karte';
  box.innerHTML = `<div class="kartenkopf"><h2>Aufgedeckt</h2><span class="uhr">${total} von 9 Punkten</span></div>
    <table class="vergleich"><thead><tr><th></th><th>Tipp</th><th>Simulation</th><th>Punkte</th></tr></thead><tbody>
    ${zeilen.map(([a, b, c, p]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td><td class="${p === 3 ? 'treffer' : p ? '' : 'daneben'}">${p}</td></tr>`).join('')}
    </tbody></table>${kennzahlen(res)}<p class="hinweis">Warum? Tippe auf die Faktoren.</p>`;
  box.append(faktorKnoepfe(res));
  box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
