// Musterlösungen am Ergebnis (nur für angemeldete Superuser, Konzept Heubelüftung Abschnitt 11).
// Wird von app.js erst nach bestätigter Sitzung nachgeladen. Rechnet im Web Worker, speichert das Ergebnis je Runde
// im Browser, zeigt Diagramm und Tabelle und bietet «Abspielen» je Variante an. Musterlösungen kommen nie in die Rangliste.
import { rechne, planAusRunde, kennzahlen, GUENSTIG_BEDINGUNG, SUCHE_VERSION } from './suche.js';
import { verlauf } from '../grafik.js';
import { AUFBEREITER } from '../model.js';
import { LUEFTER, BOX, ANLAGE, BETRIEB } from '../belueftung.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const z = (x, d = 0) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '–');
const uhr = (t) => `Tag ${Math.floor(t / 24) + 1}, ${String(t % 24).padStart(2, '0')}:00`;
const SPEICHER = 'drysim-muster';
const FARBE = { eigen: 'var(--gruen)', guenstig: 'var(--blau)', beste: 'var(--gelb-dunkel)' };
const NAMEN = { eigen: 'Deine Runde', guenstig: 'Günstigste gefundene Variante', beste: 'Beste gefundene Variante' };
let NAME = NAMEN;

const lies = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privater Modus */ } };

// Schlüssel der Runde: Wetter (mit Code und Gewitter), Wiese, Anlage, Pannen, Niveau
function schluessel(ctx) {
  const e = ctx.einstellungen;
  const teil = { v: SUCHE_VERSION, w: ctx.wetterRef ?? ctx.sz.id, g: e.gewitter ?? null, p: e.pannen ?? null, n: e.niveau, b: e.bestand, s: e.stadium, er: e.ertrag, bo: e.boden, a: e.anlage, au: ctx.erlaubt };
  return `${SPEICHER}:${JSON.stringify(teil)}`;
}

/**
 * box: Element im Ergebnis; ctx: { res, sz, wetter, einstellungen, wetterRef, erlaubt, abspielen(variante) }
 */
export function zeige(box, ctx) {
  box.hidden = false;
  box.innerHTML = `<h2>Musterlösungen <small class="leise">(nur für angemeldete Lehrpersonen)</small></h2>
    <p class="hinweis">Gleiches Wetter, gleiche Wiese, gleiches Niveau. Das Spiel sucht über Mähzeitpunkt, Aufbereiter, Zetten, Schwaden, Einführen, Anlage und Lüfterbetrieb. Es ist eine Suche mit Raster und Verfeinerung, kein Beweis: angezeigt wird die beste gefundene Variante.</p>
    <div class="knopfreihe"><button type="button" class="gross-knopf gelb" data-muster-los><b>Musterlösungen berechnen</b></button></div>
    <p class="hinweis" data-muster-status role="status"></p><div data-muster-inhalt></div>`;
  const status = box.querySelector('[data-muster-status]'), knopf = box.querySelector('[data-muster-los]');
  const gespeichert = lies(schluessel(ctx));
  if (gespeichert) { knopf.hidden = true; return anzeigen(box, ctx, gespeichert); }
  knopf.onclick = () => {
    knopf.disabled = true;
    status.textContent = 'Rechne … (läuft im Hintergrund)';
    const worker = new Worker(new URL('./suche-worker.js', import.meta.url), { type: 'module' });
    const e = ctx.einstellungen;
    const eigen = ctx.res.plan;
    const vorgaben = [planAusRunde(eigen, { heustockLog: [] })];
    worker.onmessage = (m) => {
      if (m.data.art === 'fortschritt') status.textContent = `Rechne … ${m.data.n} Varianten geprüft`;
      else if (m.data.art === 'fehler') { status.textContent = `Die Suche ist fehlgeschlagen: ${m.data.text}`; worker.terminate(); knopf.disabled = false; }
      else if (m.data.art === 'fertig') {
        worker.terminate(); knopf.hidden = true;
        schreib(schluessel(ctx), m.data.ergebnis);
        anzeigen(box, ctx, m.data.ergebnis);
      }
    };
    worker.onerror = () => { status.textContent = 'Die Suche ist fehlgeschlagen.'; knopf.disabled = false; };
    const { name, ...setup } = e;
    worker.postMessage({ setup, wetter: ctx.wetter, erlaubt: ctx.erlaubt, vorgaben });
  };
}

function beschreibe(plan) {
  const s = plan.einstellungen, a = s.anlage;
  return `Mähen ${uhr(plan.maehen)} mit ${esc(AUFBEREITER[s.aufbereiter].name)}, Stoppelhöhe ${z(s.schnitthoehe)} cm; `
    + `zetten ${plan.zetten.map(uhr).join(', ') || 'nie'}; schwaden ${uhr(plan.schwaden)}; einführen ${uhr(plan.ernte)}. `
    + `${esc(LUEFTER[a.luefter].name)}, ${a.dach !== false ? 'mit' : 'ohne'} Warmdach, ${a.entfeuchter ? 'mit' : 'ohne'} Entfeuchter, Box ${BOX[a.box].m2JeHa * ANLAGE.feldHa} m²; `
    + `Lüfter ${esc(BETRIEB[plan.betrieb.luefter])}${plan.betrieb.entfeuchter ? ', Entfeuchter ein' : ''}; Heusonde täglich um 8 Uhr.`;
}

// TS-Verlauf vom Mähen bis zum Lagerende (Feld und Stock auf einer Zeitachse) und Handlungen als Marken
function reihe(res) {
  const p = res.plan, l = res.belueftung;
  const feld = res.verlauf.filter((v) => v.t >= p.maehen && v.t <= p.ernte).map((v) => [v.t, v.ts]);
  const stock = l ? l.verlauf.map((v) => [v.t, v.ts]) : [];
  const punkte = [...feld, ...stock];
  const tsBei = (t) => { let best = punkte[0]; for (const q of punkte) if (Math.abs(q[0] - t) < Math.abs(best[0] - t)) best = q; return best[1]; };
  const marken = [...res.ereignisse.map((x) => x.t), ...(l?.handlungen ?? []).filter((h) => h.art !== 'sonde').map((h) => h.t)].map((t) => [t, tsBei(t)]);
  return { punkte, marken };
}

function anzeigen(box, ctx, erg) {
  const status = box.querySelector('[data-muster-status]'), inhalt = box.querySelector('[data-muster-inhalt]');
  const v = { eigen: { res: ctx.res } };
  // Finden beide Suchen dieselbe Variante, steht sie nur einmal da
  const dieselbe = erg.guenstig && erg.beste && JSON.stringify(erg.guenstig.plan) === JSON.stringify(erg.beste.plan);
  NAME = dieselbe ? { ...NAMEN, beste: 'Günstigste und beste gefundene Variante' } : NAMEN;
  for (const k of dieselbe ? ['beste'] : ['guenstig', 'beste']) {
    if (!erg[k]) continue;
    const res = rechne(ctx.einstellungen, ctx.wetter, erg[k].plan);
    if (res) v[k] = { res, plan: erg[k].plan };
  }
  status.textContent = `${erg.gerechnet} Varianten geprüft.${dieselbe ? ' Die günstigste Variante ist zugleich die beste.' : erg.guenstig ? '' : ' Keine Variante erfüllt die Bedingung für «günstigste».'}`;
  const reihen = [], leg = [], alle = Object.entries(v);
  let tMin = Infinity, tMax = 0;
  for (const [k, x] of alle) {
    const r = reihe(x.res);
    reihen.push({ name: NAME[k], punkte: r.punkte, farbe: FARBE[k], strich: k !== 'eigen' });
    if (r.marken.length) reihen.push({ name: `${NAME[k]}: Handlungen`, punkte: r.marken, farbe: FARBE[k], art: 'punkte' });
    leg.push([NAME[k], FARBE[k]]);
    tMin = Math.min(tMin, r.punkte[0][0]); tMax = Math.max(tMax, r.punkte.at(-1)[0]);
  }
  tMin = Math.floor(tMin / 24) * 24; tMax = Math.ceil((tMax + 1) / 24) * 24;
  const ticks = [], bereiche = [];
  for (let t = tMin; t < tMax; t += 24) { bereiche.push([t, t + 24, `Tag ${t / 24 + 1}`]); if ((tMax - tMin) / 24 <= 6) ticks.push([t + 12, '12 h']); }
  // Wetter als Band: Regenstunden
  const baender = ctx.wetter.filter((w) => w.t >= tMin && w.t < tMax && w.regen > 0).map((w) => [w.t, w.t + 1, 'var(--blau)', `${uhr(w.t)}: ${z(w.regen, 1)} mm Regen`]);
  leg.push(['Kreis = Arbeitsgang oder Eingriff, Band = Regen', 'var(--leise)', 'nur-text']);
  const grafik = verlauf({
    titel: 'TS vom Mähen bis zum Lagerende: deine Runde und die Musterlösungen', reihen, baender,
    x: { min: tMin, max: tMax, ticks, bereiche }, y: { min: 10, max: 95, titel: 'TS', ticks: [[20, '20 %'], [40, '40 %'], [60, '60 %'], [85, '85 %']] },
    legendeEintraege: leg, quelle: 'Rechnung des Spiels. Feld: Mittel der Parzelle; Stock: Mittel des Heustocks.',
  });
  const zeile = (k) => {
    const res = v[k].res, kz = kennzahlen(res);
    return `<tr><th scope="row" style="color:${FARBE[k]}">${NAME[k]}</th><td>${res.punkte}</td><td>${res.note}</td><td>${z(kz.tsEin, 1)} %</td><td>${z(res.verlustTotal, 1)} %</td><td>${z(kz.kosten, 0)} Fr.</td><td>${z(kz.stunden, 1)} h</td><td>${{ lagerfaehig: 'lagerfähig', zeit: 'Zeit um', brand: 'Brand', abbruch: 'Abbruch' }[kz.ende]}</td></tr>`;
  };
  inhalt.innerHTML = grafik
    + `<div class="tabelle"><table class="zahlen muster-tabelle"><thead><tr><th>Variante</th><th>Punkte</th><th>Note</th><th>TS beim Einführen</th><th>Verlust Feld bis Trog</th><th>Kosten je t Heu</th><th>Arbeitsstunden</th><th>Ende</th></tr></thead><tbody>${alle.map(([k]) => zeile(k)).join('')}</tbody></table></div>`
    + ['guenstig', 'beste'].filter((k) => v[k]).map((k) => `<div class="muster-variante ${k}"><p><b>${NAME[k]}</b></p><p>${beschreibe(v[k].plan)}</p><button type="button" class="leise-knopf" data-abspielen="${k}">Abspielen</button></div>`).join('')
    + `<p class="hinweis">Günstigste Variante: tiefste laufende Kosten je Tonne Heu, sofern das Heu lagerfähig ist, ohne Schimmel und mit Heuqualität mindestens Note ${GUENSTIG_BEDINGUNG.noteMax} (Annahme). Beste Variante: höchste Punktzahl. Die Feldzeiten deiner Runde (mit Standardbetrieb am Stock) sind ein Startpunkt der Suche. Musterlösungen kommen nicht in die Rangliste.</p>`;
  inhalt.querySelectorAll('[data-abspielen]').forEach((b) => { b.onclick = () => ctx.abspielen(v[b.dataset.abspielen].plan); });
}
