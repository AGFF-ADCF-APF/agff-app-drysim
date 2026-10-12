// Feldszene als SVG: Himmel im Tagesverlauf, Sonne/Mond, Wolken, Regen, Tau,
// Futter auf dem Feld (Farbe nach TS) und ein Traktor für die Arbeitsgänge.
import { MONATE } from './weather.js';

const NS = 'http://www.w3.org/2000/svg';
const B = 1000, H = 520, HORIZONT = 318;
const el = (tag, attrs = {}, kinder = []) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kinder) e.append(k);
  return e;
};
const mix = (a, b, f) => {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * Math.min(1, Math.max(0, f))).toString(16).padStart(2, '0')).join('');
};
// Pseudozufall, damit das Feld bei jedem Neuzeichnen gleich aussieht
let zaehler = 0; // eindeutige Verlaufs-IDs, falls mehrere Szenen auf der Seite sind
const zufall = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

// Futterfarbe nach TS: frisch grün → olivgrün → strohgelb
export function futterfarbe(ts) {
  const stufen = [[16, '#3b8a2e'], [28, '#6f9c35'], [40, '#a3a843'], [55, '#cbbd66'], [70, '#dccb8c']];
  for (let i = 1; i < stufen.length; i++) {
    if (ts <= stufen[i][0]) return mix(stufen[i - 1][1], stufen[i][1], (ts - stufen[i - 1][0]) / (stufen[i][0] - stufen[i - 1][0]));
  }
  return stufen[stufen.length - 1][1];
}

// Tiefe 0 (hinten) … 1 (vorne) → y und Massstab
const tiefe = (v) => ({ y: HORIZONT + 14 + v ** 1.35 * (H - HORIZONT - 14), s: 0.3 + 0.7 * v });

export class Szene {
  constructor(container, monat = 5) {
    this.m = MONATE[monat] ?? MONATE[5];
    const id = `s${++zaehler}`;
    this.svg = el('svg', { viewBox: `0 0 ${B} ${H}`, class: 'szene', role: 'img', 'aria-label': 'Feld mit Wetter', preserveAspectRatio: 'xMidYMax slice' });
    const defs = el('defs');
    this.himmelOben = el('stop', { offset: '0' });
    this.himmelUnten = el('stop', { offset: '1' });
    defs.append(el('linearGradient', { id: `${id}-himmel`, x1: 0, y1: 0, x2: 0, y2: 1 }, [this.himmelOben, this.himmelUnten]));
    this.ackerOben = el('stop', { offset: '0', 'stop-color': '#6f9e48' });
    this.ackerUnten = el('stop', { offset: '1', 'stop-color': '#4f8a33' });
    defs.append(el('linearGradient', { id: `${id}-acker`, x1: 0, y1: 0, x2: 0, y2: 1 }, [this.ackerOben, this.ackerUnten]));
    this.svg.append(defs, el('rect', { width: B, height: H, fill: `url(#${id}-himmel)` }));

    // Sterne
    this.sterne = el('g', { class: 'sterne' });
    const r = zufall(7);
    for (let i = 0; i < 60; i++) this.sterne.append(el('circle', { cx: r() * B, cy: r() * HORIZONT * 0.8, r: r() * 1.4 + 0.3, fill: '#fff' }));
    this.svg.append(this.sterne);

    // Sonne und Mond
    this.sonne = el('g', { class: 'gestirn' }, [
      el('circle', { r: 46, fill: '#ffd34d', opacity: 0.25 }), el('circle', { r: 30, fill: '#ffd34d' })]);
    this.mond = el('g', { class: 'gestirn' }, [
      el('circle', { r: 20, fill: '#f2efe2' }), el('circle', { r: 18, cx: 9, cy: -5, fill: '#0f1d3d', class: 'mondschatten' })]);
    this.svg.append(this.sonne, this.mond);

    // Hügel, Hof, Bäume
    this.svg.append(
      el('path', { d: `M0 ${HORIZONT - 40} C 160 ${HORIZONT - 110} 300 ${HORIZONT - 60} 430 ${HORIZONT - 90} S 720 ${HORIZONT - 130} 1000 ${HORIZONT - 70} V ${HORIZONT + 20} H 0 Z`, fill: '#8db6a0', class: 'berg' }),
      el('path', { d: `M0 ${HORIZONT - 10} C 200 ${HORIZONT - 60} 380 ${HORIZONT - 20} 560 ${HORIZONT - 40} S 860 ${HORIZONT - 50} 1000 ${HORIZONT - 25} V ${HORIZONT + 20} H 0 Z`, fill: '#5f9a4a' }),
      hof(770, HORIZONT - 22), baum(700, HORIZONT - 12, 1), baum(905, HORIZONT - 18, 1.2), baum(120, HORIZONT - 28, 0.9), baum(160, HORIZONT - 22, 1.1),
    );

    // Wolken
    this.wolken = el('g');
    this.svg.append(this.wolken);

    // Feld
    this.svg.append(el('rect', { x: 0, y: HORIZONT, width: B, height: H - HORIZONT, fill: `url(#${id}-acker)` }));
    this.feld = el('g');
    this.erde = el('g', { fill: '#6b4a2b' });
    this.tau = el('g', { class: 'tau', fill: '#fff' });
    this.traktorEbene = el('g');
    this.svg.append(this.feld, this.erde, this.tau, this.traktorEbene);

    // Regen und Nacht darüber
    this.regen = el('g', { class: 'regen', stroke: '#cfe3ff', 'stroke-width': 1.6, opacity: 0 });
    const rr = zufall(3);
    for (let i = 0; i < 90; i++) {
      const x = rr() * (B + 100), y = rr() * H;
      this.regen.append(el('line', { x1: x, y1: y, x2: x - 8, y2: y + 22, style: `animation-delay:${(-rr()).toFixed(2)}s` }));
    }
    this.nacht = el('rect', { width: B, height: H, fill: '#0a1430', opacity: 0, class: 'nacht', 'pointer-events': 'none' });
    this.svg.append(this.regen, this.nacht);
    container.replaceChildren(this.svg);
    this.layout = null;
  }

  // Wetter und Feldzustand der aktuellen Stunde zeigen
  zeige(z, w, dauer = 0.6) {
    this.svg.style.setProperty('--dauer', `${dauer}s`);
    const { aufgang, untergang } = this.m;
    const h = w.h + 0.5;
    const tagAnteil = (h - aufgang) / (untergang - aufgang);
    const hoehe = Math.sin(Math.PI * tagAnteil); // >0 am Tag
    const truebe = Math.min(1, (1 - (w.sonne ?? 0.8)) * 1.1 + (w.regen > 0 ? 0.5 : 0));
    const daemmerung = Math.max(0, 1 - Math.abs(hoehe) * 4);

    let oben, unten;
    if (hoehe > 0) {
      oben = mix(mix('#3d8bd6', '#7d8c99', truebe), '#4a6fa5', daemmerung);
      unten = mix(mix('#bfe0f7', '#c4ccd3', truebe), '#f5b46a', daemmerung);
    } else {
      oben = mix('#0b1a3a', '#4a6fa5', daemmerung * 0.6);
      unten = mix('#223a66', '#e59a5a', daemmerung * 0.8);
    }
    this.himmelOben.style.stopColor = oben;
    this.himmelUnten.style.stopColor = unten;
    this.sterne.style.opacity = hoehe > 0 ? 0 : Math.min(1, -hoehe * 3) * (1 - truebe);
    this.nacht.style.opacity = hoehe > 0 ? Math.max(0, 0.25 - hoehe) * (1 - Math.min(1, hoehe * 5)) : Math.min(0.5, 0.25 - hoehe * 0.5);

    const bogen = (f) => ({ x: 60 + f * (B - 120), y: HORIZONT - 40 - Math.sin(Math.PI * f) * 170 });
    const s = bogen(Math.min(1.05, Math.max(-0.05, tagAnteil)));
    this.sonne.setAttribute('transform', `translate(${s.x} ${s.y})`);
    this.sonne.style.opacity = hoehe > -0.05 ? 1 - truebe * 0.8 : 0;
    const nachtAnteil = ((h - untergang + 24) % 24) / (24 - (untergang - aufgang));
    const mo = bogen(nachtAnteil);
    this.mond.setAttribute('transform', `translate(${mo.x} ${mo.y})`);
    this.mond.style.opacity = hoehe <= 0 ? 1 - truebe * 0.7 : 0;

    this.zeigeWolken(truebe, w.regen > 0);
    this.regen.style.opacity = w.regen > 0 ? Math.min(1, 0.35 + w.regen / 8) : 0;
    this.zeigeFeld(z);
  }

  zeigeWolken(truebe, regen) {
    const n = Math.round(truebe * 7) + 1;
    const schluessel = `${n}-${regen}`;
    if (this.wolkenSchluessel === schluessel) return;
    this.wolkenSchluessel = schluessel;
    const r = zufall(11);
    const farbe = regen ? '#7a8590' : truebe > 0.5 ? '#d9dee3' : '#ffffff';
    this.wolken.replaceChildren(...Array.from({ length: n }, (_, i) => {
      const g = wolke(r() * B, 40 + r() * 150, 0.7 + r() * 0.8, farbe);
      g.setAttribute('class', 'wolke');
      g.style.animationDuration = `${60 + r() * 60}s`;
      g.style.animationDelay = `${-r() * 60}s`;
      return g;
    }));
  }

  zeigeFeld(z) {
    // Ablage: stehend, breit, mähschwad (mehrere Bänder), schwad (wenige dicke), geerntet
    const ablage = z.phase === 'stehend' ? 'stehend' : z.phase === 'geerntet' ? 'geerntet'
      : z.phase === 'schwad' ? 'schwad' : (z.sd ?? 1) > 1.4 ? 'maehschwad' : 'breit';
    if (ablage !== this.layout) {
      this.layout = ablage;
      this.feld.replaceChildren(...feldInhalt(ablage));
      // Nach dem Mähen sieht man die helle Stoppel, damit das Futter sich abhebt
      const stoppel = ablage !== 'stehend';
      this.ackerOben.style.stopColor = stoppel ? '#7f9a52' : '#6f9e48';
      this.ackerUnten.style.stopColor = stoppel ? '#62803c' : '#4f8a33';
    }
    this.feld.style.color = z.phase === 'stehend' ? '#3f8f2c' : futterfarbe(z.ts);

    // Erde als braune Punkte, Tau/Nässe als Glitzern
    const erde = Math.max(0, Math.round((z.asche - 95) * 2.2));
    if (erde !== this.erdeN) {
      this.erdeN = erde;
      const r = zufall(5);
      this.erde.replaceChildren(...Array.from({ length: Math.min(erde, 260) }, () => {
        const t = tiefe(r());
        return el('ellipse', { cx: r() * B, cy: t.y, rx: 3 * t.s, ry: 1.6 * t.s, opacity: 0.8 });
      }));
    }
    const glitzer = Math.round(Math.min(1, z.nass * 2.5) * 90);
    if (glitzer !== this.tauN) {
      this.tauN = glitzer;
      const r = zufall(9);
      this.tau.replaceChildren(...Array.from({ length: glitzer }, () => {
        const t = tiefe(r());
        return el('circle', { cx: r() * B, cy: t.y - 4 * t.s, r: 1.8 * t.s, style: `animation-delay:${(-r() * 2).toFixed(2)}s` });
      }));
    }
  }

  // Traktor fährt einmal übers Feld; zurück kommt ein Promise. Das Ende hängt an einem
  // Timer, damit das Spiel auch weiterläuft, wenn der Browser die Animation drosselt.
  traktor(art, dauer = 1600) {
    const g = traktorBild(art);
    this.traktorEbene.replaceChildren(g);
    const t0 = performance.now();
    let fertig = false;
    const schritt = (jetzt) => {
      if (fertig) return;
      const f = Math.min(1, (jetzt - t0) / dauer);
      g.setAttribute('transform', `translate(${-260 + f * (B + 520)} ${H - 70}) scale(1.05)`);
      if (f < 1) requestAnimationFrame(schritt);
    };
    g.setAttribute('transform', `translate(-260 ${H - 70})`);
    requestAnimationFrame(schritt);
    return new Promise((ok) => setTimeout(() => { fertig = true; this.traktorEbene.replaceChildren(); ok(); }, dauer));
  }
}

// ---------- Bausteine

function feldInhalt(ablage) {
  const r = zufall(ablage.length * 13);
  const teile = [];
  if (ablage === 'stehend') {
    // Grasbüschel in Reihen, hinten klein, vorne gross
    for (let row = 0; row <= 20; row++) {
      const t = tiefe(row / 20);
      const g = el('g', { class: 'wogen', style: `animation-delay:${(-r() * 3).toFixed(2)}s` });
      for (let i = 0; i < 40; i++) {
        const x = (i + r() * 0.8) * (B / 39) - 10, h = (18 + r() * 14) * t.s, w = 7 * t.s;
        g.append(el('path', { d: `M${x} ${t.y} q ${-w * 0.3} ${-h * 0.6} ${-w * 0.6} ${-h} M${x} ${t.y} q ${w * 0.1} ${-h * 0.7} ${w * 0.5} ${-h * 1.1} M${x} ${t.y} q ${w * 0.4} ${-h * 0.5} ${w} ${-h * 0.8}`, stroke: 'currentColor', 'stroke-width': 1.6 * t.s + 0.4, fill: 'none', 'stroke-linecap': 'round' }));
      }
      teile.push(g);
    }
    return teile;
  }
  // Stoppeln
  const st = el('g', { stroke: '#8fb35a', 'stroke-width': 1, opacity: 0.7 });
  for (let i = 0; i < 260; i++) {
    const t = tiefe(r()), x = r() * B;
    st.append(el('line', { x1: x, y1: t.y, x2: x + r() * 2, y2: t.y - 5 * t.s }));
  }
  teile.push(st);
  if (ablage === 'geerntet') return teile;

  // Bänder: Mitte (Tiefe) und Breite (Anteil der Tiefe)
  const baender = ablage === 'breit' ? Array.from({ length: 14 }, (_, i) => [i / 13, 0.09])
    : ablage === 'maehschwad' ? [0.1, 0.32, 0.56, 0.82].map((v) => [v, 0.07])
      : [0.2, 0.6].map((v) => [v, 0.075]);
  const hoch = ablage === 'schwad' ? 2.2 : ablage === 'maehschwad' ? 1.3 : 0.7;
  for (const [v, br] of baender) {
    const g = el('g', { stroke: 'currentColor', 'stroke-linecap': 'round', fill: 'none' });
    const t = tiefe(v);
    if (ablage === 'breit') g.append(el('rect', { x: 0, y: tiefe(Math.max(0, v - br / 2)).y, width: B, height: tiefe(Math.min(1, v + br / 2)).y - tiefe(Math.max(0, v - br / 2)).y, fill: 'currentColor', opacity: 0.45, stroke: 'none' }));
    else {
      // Schwad als durchgehender Wall mit Schatten
      const dick = 10 * t.s * hoch, wellen = Array.from({ length: 21 }, (_, i) => `${i * 50 - 10},${t.y - dick - Math.sin(i * 1.7) * dick * 0.25}`).join(' L');
      g.append(el('path', { d: `M-10 ${t.y + 3 * t.s} H ${B + 10}`, stroke: 'rgba(40,50,20,.35)', 'stroke-width': 6 * t.s }));
      g.append(el('path', { d: `M-10 ${t.y} L${wellen} L${B + 10} ${t.y} Z`, fill: 'currentColor', stroke: 'none', opacity: 0.9 }));
    }
    const n = ablage === 'breit' ? 150 : 200;
    for (let i = 0; i < n; i++) {
      const tt = tiefe(Math.min(1, Math.max(0, v + (r() - 0.5) * br)));
      const x = r() * (B + 40) - 20, l = (10 + r() * 14) * tt.s, a = (r() - 0.5) * 1.2;
      const y = tt.y - r() * 10 * tt.s * hoch;
      g.append(el('line', { x1: x, y1: y, x2: x + Math.cos(a) * l, y2: y + Math.sin(a) * l * 0.5, 'stroke-width': 2.2 * tt.s + 0.6 }));
    }
    teile.push(g);
  }
  return teile;
}

function wolke(x, y, s, farbe) {
  return el('g', { transform: `translate(${x} ${y}) scale(${s})`, fill: farbe, opacity: 0.92 }, [
    el('ellipse', { cx: 0, cy: 10, rx: 60, ry: 18 }), el('circle', { cx: -22, cy: 0, r: 22 }),
    el('circle', { cx: 8, cy: -10, r: 28 }), el('circle', { cx: 36, cy: 2, r: 18 })]);
}

function baum(x, y, s) {
  return el('g', { transform: `translate(${x} ${y}) scale(${s})` }, [
    el('rect', { x: -2.5, y: -6, width: 5, height: 14, fill: '#5a4030' }),
    el('circle', { cx: 0, cy: -16, r: 14, fill: '#2f6b35' }), el('circle', { cx: -8, cy: -10, r: 9, fill: '#357a3b' })]);
}

function hof(x, y) {
  return el('g', { transform: `translate(${x} ${y})` }, [
    el('rect', { x: 0, y: -22, width: 70, height: 26, fill: '#e9dcc4' }),
    el('path', { d: 'M-8 -20 L35 -46 L78 -20 Z', fill: '#8a3b2a' }),
    el('rect', { x: 40, y: -12, width: 14, height: 16, fill: '#6b4a32' }),
    el('rect', { x: 10, y: -14, width: 9, height: 8, fill: '#f3e7a8' }),
    el('rect', { x: 86, y: -50, width: 18, height: 54, rx: 3, fill: '#b9c2c7' }),
    el('path', { d: 'M86 -50 Q95 -62 104 -50 Z', fill: '#8b969c' })]);
}

function traktorBild(art) {
  const farbe = '#2e7d32';
  const geraet = {
    maehen: [el('rect', { x: 92, y: 20, width: 70, height: 10, rx: 3, fill: '#d33' }), el('rect', { x: 92, y: 30, width: 70, height: 4, fill: '#444' })],
    zetten: [-30, -2, 26].map((dx) => el('g', { class: 'kreisel', transform: `translate(${dx - 30} 26)` }, [
      el('circle', { r: 13, fill: 'none', stroke: '#e0a020', 'stroke-width': 3 }), el('path', { d: 'M-13 0 H13 M0 -13 V13', stroke: '#e0a020', 'stroke-width': 2.5 })])),
    schwaden: [el('rect', { x: -86, y: 8, width: 52, height: 6, fill: '#e0a020' }),
      el('circle', { cx: -60, cy: 26, r: 18, fill: 'none', stroke: '#e0a020', 'stroke-width': 3, class: 'kreisel' })],
    ernte: [el('rect', { x: -150, y: -34, width: 110, height: 48, rx: 4, fill: '#c62828' }),
      el('path', { d: 'M-150 -34 h110 v-10 h-110 Z', fill: '#9fc35a' }),
      el('circle', { cx: -115, cy: 20, r: 12, fill: '#222' }), el('circle', { cx: -80, cy: 20, r: 12, fill: '#222' })],
  }[art] ?? [];
  return el('g', {}, [
    ...geraet,
    el('rect', { x: 0, y: -18, width: 74, height: 30, rx: 5, fill: farbe }),
    el('rect', { x: 8, y: -48, width: 34, height: 32, rx: 3, fill: '#cde7f5', stroke: farbe, 'stroke-width': 4 }),
    el('rect', { x: 52, y: -26, width: 6, height: 12, fill: '#333' }),
    el('circle', { cx: 18, cy: 16, r: 20, fill: '#222' }), el('circle', { cx: 18, cy: 16, r: 8, fill: '#ddd' }),
    el('circle', { cx: 64, cy: 22, r: 13, fill: '#222' }), el('circle', { cx: 64, cy: 22, r: 5, fill: '#ddd' }),
  ]);
}
