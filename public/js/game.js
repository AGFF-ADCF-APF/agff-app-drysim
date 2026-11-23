// Spielablauf: Die Uhr läuft, die Spieler lösen die Arbeitsgänge aus (oder im
// Zeitraffer der vorgegebene Plan). Anzeigen, Ticker und Szene werden jede Stunde nachgeführt.
// Der Stand wird als Protokoll der Arbeitsgänge gesichert und lässt sich exakt nachspielen.
import { Feld, SILOARTEN, AUFBEREITER, spieleNach, ablageVon } from './model.js';
import { stundenwetter } from './weather.js';
import { Szene } from './scene.js';
import { wetterSymbol, stundenSymbol, AKTION } from './icons.js';
import { Assistent } from './assistent.js';
import { zeigt } from './niveau.js';

export const START = 5; // Tag 1, 05:00
const TEMPO = { 1: 800, 2: 280, 3: 80 };
const HALTEN = { maehen: 700, ernte: 700 }; // nicht umkehrbare Arbeitsgänge: gedrückt halten
const TASTE = { maehen: 'M', zetten: 'Z', schwaden: 'S', ernte: 'E' };
const NAMEN = { maehen: 'Mähen', zetten: 'Zetten', schwaden: 'Schwaden', ernte: 'Einfahren' };
const $ = (s, el = document) => el.querySelector(s);
const z = (x, d = 0) => x.toFixed(d).replace('.', ',');
const zeit = (t) => `${String(t % 24).padStart(2, '0')}:00`;

// ---------- Gesicherte Runde (localStorage, damit sie auch nach einem App-Wechsel oder Neuladen da ist)
const RUNDE = 'drysim-runde';
const GUELTIG_MS = 12 * 3600 * 1000;
export function gespeicherteRunde() {
  try {
    const r = JSON.parse(localStorage.getItem(RUNDE));
    if (!r || r.v !== 1 || Date.now() - r.zeit > GUELTIG_MS || !Array.isArray(r.log) || !r.einstellungen) return null;
    return r;
  } catch { return null; }
}
export function vergissRunde() { try { localStorage.removeItem(RUNDE); } catch { /* egal */ } }

export class Spiel {
  constructor(root, { setup, wetterSzenario, wetterRef = null, plan = null, resume = null, onEnde }) {
    this.root = root; this.setup = setup; this.sz = wetterSzenario; this.wetterRef = wetterRef; this.plan = plan; this.onEnde = onEnde;
    this.wetter = stundenwetter(wetterSzenario);
    this.log = resume ? resume.log.slice() : [];
    this.feld = resume ? spieleNach(setup, this.wetter, this.log, resume.t, START) : new Feld(setup, this.wetter, START);
    this.ziel = SILOARTEN[setup.siloart].ziel;
    this.heu = SILOARTEN[setup.siloart].art === 'heu';
    this.tsMax = this.heu ? 95 : 70; // Skala des Feuchtemessers
    this.szene = new Szene($('.szene-box', root), wetterSzenario.monat);
    this.ruhig = setup.modus === 'ruhig' && !plan;
    this.tempo = plan ? 3 : 1;
    this.pause = !plan;
    this.beschaeftigt = false;
    this.gemeldet = new Set();
    this.bereit = null; // Doppel-Druck mit Tastatur: { art, bis }
    this.vorher = this.feld.zustand();

    root.classList.toggle('zeitraffer', !!plan);
    root.classList.toggle('ruhig', this.ruhig);
    $('.ticker', root).replaceChildren();
    // Beschriftung der Messer: Fachsprache (Praxis, Profi) oder einfache Worte (Einstieg), siehe beschrifte()
    this.einfachBeschriftet = null;
    this.vorschlagEl = $('.vorschlag', root) ?? Object.assign(document.createElement('p'), { className: 'vorschlag' });
    this.vorschlagEl.setAttribute('role', 'status');
    $('.messer-reihe', root).before(this.vorschlagEl); // gleich unter dem Feld, auf dem Handy ohne Scrollen sichtbar
    this.baueWetterbericht();
    this.baueKnoepfe();
    this.baueTempo();
    this.bindeGlobal();
    const t0 = `Tag ${Math.floor(this.feld.t / 24) + 1}, ${zeit(this.feld.t)}`;
    if (resume) this.melde(`${t0}: Runde fortgesetzt. Weiter mit ▶ oder Leertaste.`);
    else this.melde(`Tag 1, ${zeit(START)}: ${this.vorher.nass > 0.1 ? 'Tau liegt auf dem Gras.' : 'Der Tag beginnt.'} ${plan ? 'Zeitraffer läuft …' : this.ruhig ? 'Du bestimmst, wann die Zeit weiterläuft (Knopf «+1 h»).' : this.heu ? 'Heu braucht zwei bis drei schöne Tage. Wann mähst du?' : 'Wann mähst du?'}`);
    this.zeichne(0.01);
    this.assistentPhase();
    this.lauf();
  }

  // ---------- Traktor-Assistent: Lernhilfe je Phase und Ereignis (in der Wette läuft nur der Zeitraffer)
  assistentPhase() {
    if (this.plan) { Assistent.kontext('spiel.zeitraffer'); return; }
    const phase = { stehend: 'spiel.stehend', gemaeht: 'spiel.gemaeht', schwad: 'spiel.schwad' }[this.feld.phase];
    Assistent.kontext(phase ? phase + (this.heu ? '.heu' : '') : null);
  }
  tipp(key) { if (!this.plan) Assistent.hinweis(key); }

  stop() {
    clearTimeout(this.timer); this.gestoppt = true;
    document.removeEventListener('visibilitychange', this.beiVersteckt);
    document.removeEventListener('keydown', this.beiTaste);
  }

  // ---------- Sichern und Tastatur
  speichere() {
    if (this.plan || this.gestoppt) return;
    try {
      localStorage.setItem(RUNDE, JSON.stringify({
        v: 1, zeit: Date.now(), einstellungen: this.setup, wetterRef: this.wetterRef, log: this.log, t: this.feld.t,
      }));
    } catch { /* privater Modus: dann geht es ohne Sicherung */ }
  }

  bindeGlobal() {
    // Im Hintergrund drosselt der Browser den Takt: lieber pausieren als unbeobachtet weiterlaufen
    this.beiVersteckt = () => {
      if (document.hidden && !this.plan && !this.pause) { this.setzeTempo(0); this.melde('Pausiert, weil die Seite im Hintergrund war. Weiter mit ▶ oder Leertaste.'); }
      if (document.hidden) this.speichere();
    };
    document.addEventListener('visibilitychange', this.beiVersteckt);

    this.beiTaste = (e) => {
      if (this.plan || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, dialog[open]')) return;
      const k = e.key.toLowerCase();
      if (k === ' ' && !e.target.closest?.('button')) { e.preventDefault(); this.setzeTempo(this.pause ? 1 : 0); }
      else if (!this.ruhig && ['1', '2', '3'].includes(k)) this.setzeTempo(Number(k));
      else if (k === 'enter' && this.ruhig && !e.target.closest?.('button')) this.schritt(1);
      else if (k === '+' && this.pause) this.schritt(1);
      else if (k === 'm') this.druecke('maehen');
      else if (k === 'z') this.druecke('zetten');
      else if (k === 's') this.druecke('schwaden');
      else if (k === 'e') this.druecke('ernte');
    };
    document.addEventListener('keydown', this.beiTaste);
  }

  // Arbeitsgang auslösen: nicht umkehrbare Gänge brauchen mit der Tastatur zwei Druck innerhalb von 2 Sekunden
  druecke(art) {
    if (this.beschaeftigt || this.plan) return;
    if (!HALTEN[art]) return this.aktion(art);
    const jetzt = Date.now();
    if (this.bereit?.art === art && jetzt < this.bereit.bis) { this.bereit = null; return this.aktion(art); }
    if (!this.moeglich(art)) return;
    this.bereit = { art, bis: jetzt + 2000 };
    this.melde(`Zum ${art === 'ernte' ? 'Einfahren' : 'Mähen'} nochmals ${TASTE[art]} oder den Knopf drücken (innert 2 Sekunden).`, true);
  }

  moeglich(art) {
    const p = this.feld.phase;
    return { maehen: p === 'stehend', zetten: p === 'gemaeht' || p === 'schwad', schwaden: p === 'gemaeht', ernte: p === 'schwad' }[art];
  }

  // ---------- Takt
  lauf() {
    clearTimeout(this.timer);
    if (this.gestoppt) return;
    this.timer = setTimeout(() => this.takt(), TEMPO[this.tempo]);
  }
  async takt() {
    if (this.gestoppt) return;
    if (this.pause || this.beschaeftigt) return this.lauf();
    if (this.plan) await this.planSchritt();
    if (this.feld.phase === 'geerntet' || this.gestoppt) return;
    if (this.feld.t >= this.wetter.length - 1) return this.zwangsende();
    this.stundeWeiter();
    this.lauf();
  }

  stundeWeiter(dauer) {
    this.feld.stunde();
    this.zeichne(dauer);
    this.pruefeEreignisse();
    this.speichere();
  }

  // Ruhiger Modus und Pause: Zeit gezielt um n Stunden weiterstellen
  async schritt(n) {
    if (this.beschaeftigt || this.plan || this.gestoppt) return;
    if (!this.pause) this.setzeTempo(0);
    for (let i = 0; i < n; i++) {
      if (this.feld.phase === 'geerntet') return;
      if (this.feld.t >= this.wetter.length - 1) return this.zwangsende();
      this.stundeWeiter(0.3);
    }
  }

  async planSchritt() {
    const p = this.plan, t = this.feld.t;
    if (t === p.maehen) await this.aktion('maehen', 700);
    if (p.zetten.includes(t)) await this.aktion('zetten', 700);
    if ([].concat(p.schwaden).includes(t)) await this.aktion('schwaden', 700);
    if (t === p.ernte) await this.aktion('ernte', 700);
  }

  setzeTempo(n) {
    this.tempo = n; this.pause = n === 0;
    this.root.querySelectorAll('.tempo button[data-tempo]').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.tempo) === n));
    this.zeichne(0.3);
  }

  // ---------- Arbeitsgänge
  async aktion(art, dauer = 1500) {
    if (this.beschaeftigt || this.feld.phase === 'geerntet' || !this.moeglich(art)) return;
    const f = this.feld;
    this.beschaeftigt = true;
    this.knoepfeAktiv();
    await this.szene.traktor(art, dauer);
    const t = `Tag ${Math.floor(f.t / 24) + 1}, ${zeit(f.t)}`;
    if (art === 'maehen') { f.maehen(); this.melde(`${t}: Gemäht mit ${String(this.setup.schnitthoehe).replace('.', ',')} cm Schnitthöhe${this.vorher.nass > 0.1 ? ', das Gras war noch nass' : ''}.`); }
    if (art === 'zetten') { const ausSchwad = f.phase === 'schwad'; f.zettenJetzt(); this.melde(`${t}: ${ausSchwad ? 'Schwad wieder breit gestreut' : 'Gezettet'}${this.tsAngabe(f.ts())}.`); }
    if (art === 'schwaden') { f.schwaden(); if (this.heu) this.gemeldet.add('nachtschwad'); this.melde(`${t}: Geschwadet${this.tsAngabe(f.ts())}.`); }
    if (art !== 'ernte') this.log.push({ t: f.t, art });
    this.beschaeftigt = false;
    if (art !== 'ernte') this.assistentPhase();
    if (art === 'zetten' || art === 'schwaden') this.tipp(art === 'zetten' ? 'ev.zetten' : 'ev.schwaden');
    if (art === 'ernte') {
      this.melde(`${t}: Eingefahren${this.tsAngabe(f.ts())}.`);
      const res = f.einfahren();
      this.stop();
      vergissRunde();
      this.knoepfeAktiv();
      setTimeout(() => this.onEnde(res, f, this.log.slice()), 600); // Feld und Protokoll: für die Belüftungsphase
      return;
    }
    this.speichere();
    this.zeichne(0.3);
    this.lauf();
  }

  async zwangsende() {
    this.melde('Die Zeit ist um! Das Futter wird jetzt eingefahren, so wie es ist.');
    if (this.feld.phase === 'stehend') this.feld.maehen();
    if (this.feld.phase === 'gemaeht') this.feld.schwaden();
    this.beschaeftigt = false;
    await this.aktion('ernte', 900);
  }

  // ---------- Hinweise im Ticker
  pruefeEreignisse() {
    const f = this.feld, zs = f.zustand(), w = this.wetter[f.t] ?? zs.w, alt = this.vorher;
    const t = `Tag ${Math.floor(f.t / 24) + 1}, ${zeit(f.t)}`;
    const einmal = (k, text, anhalten = false) => {
      if (this.gemeldet.has(k)) return;
      this.gemeldet.add(k); this.melde(text, anhalten);
      if (anhalten && !this.plan) this.setzeTempo(0);
    };
    if (w.regen > 0 && !(this.wetter[f.t - 1]?.regen > 0)) {
      einmal('regen' + f.t, `${t}: Regen zieht auf${zeigt('feld.zahlen') ? ` – ${z(w.regen, 1)} mm in dieser Stunde` : ''}!`, true);
      this.tipp('ev.regen');
    }
    // Zwei Stunden nach dem Mähen: oben angetrocknet, unten noch nass (Beratungsregel: spätestens jetzt zetten)
    if (zs.phase === 'gemaeht' && f.t - f.maehZeit === 2 && !f.zetten.length && w.rad > 0 && !f.auf.breit) {
      einmal('zweistunden', `${t}: Zwei Stunden nach dem Mähen – oben ist das Futter angetrocknet, unten noch so nass wie beim Mähen. Jetzt zetten?`, true);
      this.tipp('ev.zweistunden');
    }
    if (zs.phase === 'stehend' && alt.nass > 0.08 && zs.nass <= 0.08) einmal('tauweg' + w.tag, `${t}: Der Tau ist abgetrocknet.`);
    if (zs.phase !== 'stehend' && w.h === 20) einmal('abend' + w.tag, `${t}: Es wird Abend. Über Nacht fällt Tau aufs Futter.${this.heu && zs.phase === 'gemaeht' && !this.gemeldet.has('nachtschwad') ? ' Tipp: Ein Nachtschwad nimmt weniger Tau auf; am Morgen wieder zetten.' : ''}`);
    if (this.heu && zs.phase === 'gemaeht' && w.h === 20) this.gemeldet.add('nachtschwad');
    if (zs.phase !== 'stehend' && w.h === 20 && !this.gemeldet.has('abendtipp' + w.tag)) { this.gemeldet.add('abendtipp' + w.tag); this.tipp(this.heu && zs.phase === 'gemaeht' ? 'ev.abend.heu' : 'ev.abend'); }
    if (!this.heu && zs.phase !== 'stehend' && f.t - f.maehZeit >= 35) { einmal('lang35', `${t}: Seit über 35 Stunden auf dem Feld – der Zucker nimmt ab.`); this.tipp('ev.lang35'); }
    if (zs.phase !== 'stehend' && zs.asche > 100 && alt.asche <= 100) this.tipp('ev.erde');
    if (zs.phase !== 'stehend') {
      const belueft = this.setup.siloart === 'belueftung';
      if (zs.ts >= this.ziel[0] && alt.ts < this.ziel[0]) { einmal('ziel', `${t}: ${zeigt('feld.zahlen') ? `Feuchtemesser zeigt ${z(zs.ts)} % TS` : 'Die Ampel ist grün'} – ${this.heu ? (belueft ? 'genug angewelkt für die Belüftung!' : 'das Heu ist lagerfähig!') : 'Zielbereich erreicht!'}`, true); this.tipp(this.heu ? (belueft ? 'ev.ziel.belueftung' : 'ev.ziel.heu') : 'ev.ziel'); }
      if (zs.ts > this.ziel[1] && alt.ts <= this.ziel[1]) this.tipp('ev.zutrocken');
      if (zs.ts > this.ziel[1] && alt.ts <= this.ziel[1]) einmal('zutrocken', this.heu ? `${t}: ${zeigt('feld.zahlen') ? `${z(zs.ts)} % TS – t` : 'T'}rockener als nötig, die Blätter bröckeln jetzt leicht.` : `${t}: Achtung, das Futter wird zu trocken${zeigt('feld.zahlen') ? ` (${z(zs.ts)} % TS)` : ''}.`, !this.heu || belueft);
      if (this.heu && !belueft && zs.ts >= 60 && alt.ts < 60) this.tipp('ev.sproede');
      if (this.heu && !belueft && zs.ts >= 60 && alt.ts < 60) einmal('sproede', `${t}: ${zeigt('feld.zahlen') ? `${z(zs.ts)} % TS – a` : 'Das Heu ist schon recht trocken. A'}b jetzt werden die Blätter spröde. Lieber am Morgen mit etwas Tau zetten.`);
    }
    if (f.t === this.wetter.length - 8) einmal('schluss', `${t}: Noch 8 Stunden bis Spielende!`, true);
    this.vorher = zs;
  }

  // ---------- Niveau: Feuchte als Zahl (Praxis, Profi) oder als Ampel mit kurzen Worten (Einstieg)
  ampel(ts, phase = this.feld.phase) {
    const [a, b] = this.ziel;
    if (phase === 'stehend') return { farbe: 'aus', wort: 'Gras steht noch' };
    return ts < a ? { farbe: 'gelb', wort: 'noch zu nass' } : ts > b ? { farbe: 'rot', wort: 'zu trocken' } : { farbe: 'gruen', wort: 'genau richtig' };
  }
  tsAngabe(ts) { return zeigt('feld.zahlen') ? ` bei ${z(ts)} % TS` : `, das Futter ist ${this.ampel(ts, 'gemaeht').wort}`; }

  // Beschriftung der Messer je Niveau (kann während des Spiels wechseln)
  beschrifte() {
    const einfach = !zeigt('feld.zahlen'), r = this.root;
    if (this.einfachBeschriftet === einfach) return;
    this.einfachBeschriftet = einfach;
    const setze = (sel, titel, klein) => { const m = $(sel, r); m.querySelector('span').innerHTML = titel; if (klein != null) m.querySelector('small').textContent = klein; };
    setze('.messer.ts', einfach ? 'Wie trocken ist das Futter?' : 'Feuchtemesser (<abbr title="Trockensubstanz">TS</abbr>)');
    setze('.messer.zucker', this.heu ? 'Blätter verloren' : 'Zucker', this.heu ? 'Bröckeln beim Zetten, Schwaden, Pressen' : 'Futter für die Milchsäurebakterien');
    setze('.messer.erde', einfach ? 'Erde im Futter' : 'Rohasche (Erde)', einfach ? (this.heu ? 'Erde macht Heu staubig' : 'Erde verdirbt die Silage') : 'über 100 g/kg: Clostridien-Gefahr');
    setze('.messer.verlust', einfach ? 'Futter verloren' : 'Verluste bisher', 'Atmung, Bröckeln, Regen');
    r.classList.toggle('einfach', einfach);
  }

  // Einstieg: Der Traktor schlägt den nächsten sinnvollen Schritt vor (Regeln aus den Tipps des Assistenten)
  vorschlag() {
    const f = this.feld, zs = f.zustand(), w = this.wetter[Math.min(f.t, this.wetter.length - 1)], h = w.h, [a] = this.ziel;
    const weiter = this.ruhig || this.pause ? ' Drück auf «+1 h».' : '';
    const regenBald = this.wetter.slice(f.t, f.t + 3).some((x) => x.regen > 0);
    if (zs.phase === 'stehend') {
      if (regenBald) return [null, `Gleich regnet es. Warte mit dem Mähen.${weiter}`];
      if (h >= (this.heu ? 13 : 15) || h < 5) return [null, this.heu ? `Heu mähst du am Vormittag, wenn der Tau weg ist. Warte bis morgen.${weiter}` : `Heute nicht mehr mähen: Am Abend zu mähen bringt nichts. Warte bis morgen.${weiter}`];
      if (zs.nass > 0.08) return [null, `Noch liegt Tau auf dem Gras. Warte, bis er abgetrocknet ist.${weiter}`];
      return ['maehen', 'Der Tau ist weg: Jetzt mähen. Knopf «Mähen» gedrückt halten.'];
    }
    if (zs.phase === 'gemaeht') {
      if (zs.ts >= a) return ['schwaden', 'Die Ampel ist grün: Jetzt schwaden, danach einfahren.'];
      if (!f.zetten.length) return ['zetten', 'Jetzt zetten: Das dreht die nasse Unterseite nach oben.'];
      if (this.heu && h >= 19) return ['schwaden', 'Es wird Abend: Ein Nachtschwad nimmt weniger Tau auf. Am Morgen wieder breit streuen.'];
      if (this.heu && zs.ts < 60 && f.t - f.zetten[f.zetten.length - 1] >= 4 && w.rad > 0 && zs.nass < 0.15) return ['zetten', 'Nochmals zetten, solange die Blätter noch nicht spröde sind.'];
      return [null, h >= 20 || h < 6 ? `Nacht: Das Futter muss warten, bis die Sonne wieder scheint.${weiter}` : `Jetzt trocknen lassen und auf die Ampel schauen.${weiter}`];
    }
    if (zs.phase === 'schwad') {
      if (zs.ts >= a) return ['ernte', 'Jetzt einfahren! Knopf «Einfahren» gedrückt halten.'];
      if (this.heu && w.rad > 0 && h >= 8 && h < 17 && zs.nass < 0.15) return ['zetten', 'Das Heu ist noch nicht trocken genug: Breit streuen, damit es weiter trocknet.'];
      return [null, `Im Schwad trocknet das Futter nur langsam weiter.${weiter}`];
    }
    return [null, ''];
  }

  melde(text, wichtig = false) {
    const li = document.createElement('li');
    li.textContent = text;
    if (wichtig) li.className = 'wichtig';
    const ticker = $('.ticker', this.root);
    ticker.prepend(li);
    while (ticker.children.length > 6) ticker.lastChild.remove();
  }

  // ---------- Aufbau der Bedienelemente
  baueWetterbericht() {
    const box = $('.bericht', this.root);
    box.innerHTML = this.sz.tage.map((d, i) => {
      const mm = (d.regen ?? []).reduce((a, r) => a + r.mm, 0);
      return `<div class="tageskarte" data-tag="${i + 1}"><b>Tag ${i + 1}</b>${wetterSymbol(d)}<span>${Math.round(d.tmax)}° / ${Math.round(d.tmin)}°</span><small>${mm > 0 ? z(mm, 0) + ' mm' : 'trocken'}</small></div>`;
    }).join('');
  }

  baueKnoepfe() {
    const s = this.setup;
    const info = {
      maehen: `${String(s.schnitthoehe).replace('.', ',')} cm · ${AUFBEREITER[s.aufbereiter].name} · Ablage ${ablageVon(s)} %`,
      zetten: `Zinken ${z(s.zetterHoehe, 1)} cm`,
      schwaden: `Zinken ${z(s.schwaderHoehe, 1)} cm`,
      ernte: SILOARTEN[s.siloart].name,
    };
    const box = $('.aktionen', this.root);
    box.replaceChildren(...Object.keys(NAMEN).map((art) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `aktion ${art}`; b.dataset.art = art;
      b.setAttribute('aria-keyshortcuts', TASTE[art]);
      b.innerHTML = `${AKTION[art]}<span><b>${NAMEN[art]} <kbd>${TASTE[art]}</kbd></b><small><span class="nur-zahlen">${info[art]}</span>${HALTEN[art] ? '<span class="nur-zahlen"> · </span>halten' : ''}</small></span>`;
      if (!HALTEN[art]) {
        b.addEventListener('click', () => this.aktion(art));
      } else {
        // Gedrückt halten: schützt vor Fehltipps (Erschütterung, Scrollen). Tastatur/Screenreader: zweimal drücken.
        let timer = null, gehalten = false;
        const ab = () => { clearTimeout(timer); b.classList.remove('haelt'); };
        b.addEventListener('pointerdown', (e) => {
          if (b.disabled || e.button > 0) return;
          gehalten = false;
          b.classList.add('haelt');
          timer = setTimeout(() => { gehalten = true; ab(); navigator.vibrate?.(30); this.aktion(art); }, HALTEN[art]);
        });
        b.addEventListener('pointerup', () => {
          const zuKurz = !gehalten && b.classList.contains('haelt');
          ab();
          if (zuKurz) { b.classList.add('wackelt'); setTimeout(() => b.classList.remove('wackelt'), 400); this.melde(`${NAMEN[art]}: Knopf gedrückt halten.`); }
        });
        ['pointercancel', 'pointerleave'].forEach((t) => b.addEventListener(t, ab));
        b.addEventListener('contextmenu', (e) => e.preventDefault());
        b.addEventListener('click', (e) => { if (e.detail === 0) this.druecke(art); }); // Tastatur und Screenreader
      }
      return b;
    }));
  }

  baueTempo() {
    this.root.querySelectorAll('.tempo button[data-tempo]').forEach((b) => {
      b.onclick = () => this.setzeTempo(Number(b.dataset.tempo));
    });
    this.root.querySelectorAll('.tempo button[data-schritt]').forEach((b) => {
      b.onclick = () => this.schritt(Number(b.dataset.schritt));
    });
    this.setzeTempo(this.pause ? 0 : this.tempo);
  }

  knoepfeAktiv() {
    const frei = !this.beschaeftigt && !this.plan;
    this.root.querySelectorAll('.aktion').forEach((b) => { b.disabled = !(frei && this.moeglich(b.dataset.art)); });
    // Aus dem Schwad heraus streut der Zetter das Futter wieder breit (Nachtschwad)
    const zt = this.root.querySelector('.aktion.zetten b');
    if (zt) zt.firstChild.textContent = this.feld.phase === 'schwad' ? 'Breit streuen ' : 'Zetten ';
  }

  // ---------- Anzeige
  zeichne(dauer) {
    const f = this.feld, zs = f.zustand();
    const w = this.wetter[Math.min(f.t, this.wetter.length - 1)];
    this.szene.zeige(zs, w, dauer ?? TEMPO[this.tempo] / 1000);
    $('.uhrzeit', this.root).innerHTML = `<b>Tag ${w.tag}</b> ${zeit(w.h)}`;
    this.beschrifte();
    const zahlen = zeigt('feld.zahlen');
    $('.jetzt', this.root).innerHTML = `${stundenSymbol(w)}<span>${z(w.temp)} °C${zahlen ? ` · ${z(w.rh)} % rF` : ''}${w.regen > 0 ? (zahlen ? ` · ${z(w.regen, 1)} mm` : ' · Regen') : ''}`
      + (zeigt('feld.profi') ? ` · ${z(w.rad)} W/m² · VPD ${z(w.vpd, 2)} kPa · Wind ${z(w.wind, 1)} m/s` : '') + '</span>';
    this.root.querySelectorAll('.tageskarte').forEach((k) => k.classList.toggle('heute', Number(k.dataset.tag) === w.tag));

    const [a, b] = this.ziel;
    const tsPos = (v) => `${Math.min(100, Math.max(0, (v - 10) / (this.tsMax - 10) * 100))}%`;
    const ts = $('.messer.ts', this.root);
    const am = this.ampel(zs.ts, zs.phase);
    ts.querySelector('strong').textContent = zahlen ? `${z(zs.ts)} %` : am.wort;
    ['aus', 'gelb', 'gruen', 'rot'].forEach((x) => ts.classList.toggle(`ampel-${x}`, !zahlen && am.farbe === x));
    ts.querySelector('.ziel').style.left = tsPos(a);
    ts.querySelector('.ziel').style.width = `calc(${tsPos(b)} - ${tsPos(a)})`;
    ts.querySelector('.nadel').style.left = tsPos(zs.ts);
    const imZiel = zs.phase !== 'stehend' && zs.ts >= a && zs.ts <= b;
    ts.classList.toggle('im-ziel', imZiel);
    ts.querySelector('small').textContent = !zahlen
      ? (zs.phase === 'stehend' ? 'Ampel grün heisst: einfahren' : zs.nass > 0.15 ? 'Futter ist aussen nass' : imZiel ? '✓ bereit zum Einfahren' : zs.ts < a ? 'weiter trocknen lassen' : 'früher einfahren')
      : (zs.phase === 'stehend' ? 'Gras steht noch' : zs.nass > 0.15 ? 'Futter ist aussen nass' : imZiel ? `✓ im Zielbereich ${a}–${b} %` : `Ziel ${a}–${b} %`)
        + (zeigt('feld.profi') && zs.phase !== 'stehend' ? ` · innen ${z(100 * f.tsInnen(), 1)} % · aussen ${z(100 * zs.nass)} g Wasser/100 g TS` : '');

    const balken = (sel, wert, max, text, schlecht, worte) => {
      const m = $(sel, this.root);
      m.querySelector('strong').textContent = zahlen ? text : worte[schlecht ? 1 : 0];
      m.querySelector('i').style.width = `${Math.min(100, (wert / max) * 100)}%`;
      m.classList.toggle('warnung', schlecht);
    };
    if (this.heu) balken('.messer.zucker', zs.broeckel ?? 0, 10, `${z(zs.broeckel ?? 0, 1)} %`, (zs.broeckel ?? 0) > 4, ['wenige', 'viele']);
    else balken('.messer.zucker', zs.zucker, 200, `${z(zs.zucker)} g/kg`, zs.zucker < 60, ['genug', 'wenig']);
    balken('.messer.erde', Math.max(0, zs.asche - 70), 130, `${z(zs.asche)} g/kg`, zs.asche > 100, ['sauber', 'viel Erde']);
    balken('.messer.verlust', zs.verlust, 25, `${z(zs.verlust, 1)} %`, zs.verlust > 10, ['wenig', 'viel']);
    this.knoepfeAktiv();
    // Vorschlag des Traktors (Einstieg) und hervorgehobener Knopf
    const mitVorschlag = zeigt('feld.vorschlag') && !this.plan && f.phase !== 'geerntet';
    const [art, text] = mitVorschlag ? this.vorschlag() : [null, ''];
    this.vorschlagEl.hidden = !mitVorschlag;
    if (mitVorschlag && this.vorschlagEl.dataset.text !== text) { this.vorschlagEl.dataset.text = text; this.vorschlagEl.innerHTML = `<b>Der Traktor schlägt vor:</b> ${text}`; }
    this.root.querySelectorAll('.aktion').forEach((b) => b.classList.toggle('empfohlen', mitVorschlag && b.dataset.art === art && !b.disabled));
  }
}
