// Spielablauf: Die Uhr läuft, die Spieler lösen die Arbeitsgänge aus (oder im
// Zeitraffer der vorgegebene Plan). Anzeigen, Ticker und Szene werden jede Stunde nachgeführt.
// Der Stand wird als Protokoll der Arbeitsgänge gesichert und lässt sich exakt nachspielen.
import { Feld, SILOARTEN, AUFBEREITER, spieleNach } from './model.js';
import { stundenwetter } from './weather.js';
import { Szene } from './scene.js';
import { wetterSymbol, stundenSymbol, AKTION } from './icons.js';

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
    this.baueWetterbericht();
    this.baueKnoepfe();
    this.baueTempo();
    this.bindeGlobal();
    const t0 = `Tag ${Math.floor(this.feld.t / 24) + 1}, ${zeit(this.feld.t)}`;
    if (resume) this.melde(`${t0}: Runde fortgesetzt. Weiter mit ▶ oder Leertaste.`);
    else this.melde(`Tag 1, ${zeit(START)}: ${this.vorher.nass > 0.1 ? 'Tau liegt auf dem Gras.' : 'Der Tag beginnt.'} ${plan ? 'Zeitraffer läuft …' : this.ruhig ? 'Du bestimmst, wann die Zeit weiterläuft (+1 h).' : 'Wann mähst du?'}`);
    this.zeichne(0.01);
    this.lauf();
  }

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
    return { maehen: p === 'stehend', zetten: p === 'gemaeht', schwaden: p === 'gemaeht', ernte: p === 'schwad' }[art];
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
    if (t === p.schwaden) await this.aktion('schwaden', 700);
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
    if (art === 'zetten') { f.zettenJetzt(); this.melde(`${t}: Gezettet bei ${z(f.ts())} % TS.`); }
    if (art === 'schwaden') { f.schwaden(); this.melde(`${t}: Geschwadet bei ${z(f.ts())} % TS.`); }
    if (art !== 'ernte') this.log.push({ t: f.t, art });
    this.beschaeftigt = false;
    if (art === 'ernte') {
      this.melde(`${t}: Eingefahren bei ${z(f.ts())} % TS.`);
      const res = f.einfahren();
      this.stop();
      vergissRunde();
      this.knoepfeAktiv();
      setTimeout(() => this.onEnde(res), 600);
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
      einmal('regen' + f.t, `${t}: Regen zieht auf – ${z(w.regen, 1)} mm in dieser Stunde!`, true);
    }
    if (zs.phase === 'stehend' && alt.nass > 0.08 && zs.nass <= 0.08) einmal('tauweg' + w.tag, `${t}: Der Tau ist abgetrocknet.`);
    if (zs.phase !== 'stehend' && w.h === 20) einmal('abend' + w.tag, `${t}: Es wird Abend. Über Nacht fällt Tau aufs Futter.`);
    if (zs.phase !== 'stehend') {
      if (zs.ts >= this.ziel[0] && alt.ts < this.ziel[0]) einmal('ziel', `${t}: Feuchtemesser zeigt ${z(zs.ts)} % TS – Zielbereich erreicht!`, true);
      if (zs.ts > this.ziel[1] && alt.ts <= this.ziel[1]) einmal('zutrocken', `${t}: Achtung, das Futter wird zu trocken (${z(zs.ts)} % TS).`, true);
    }
    if (f.t === this.wetter.length - 8) einmal('schluss', `${t}: Noch 8 Stunden bis Spielende!`, true);
    this.vorher = zs;
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
      maehen: `${String(s.schnitthoehe).replace('.', ',')} cm · ${AUFBEREITER[s.aufbereiter].name}${s.breit || AUFBEREITER[s.aufbereiter].breit ? ' · breit' : ''}`,
      zetten: `Zinken ${z(s.zetterHoehe, 1)} cm`,
      schwaden: `Zinken ${z(s.schwaderHoehe, 1)} cm`,
      ernte: SILOARTEN[s.siloart].name,
    };
    const box = $('.aktionen', this.root);
    box.replaceChildren(...Object.keys(NAMEN).map((art) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `aktion ${art}`; b.dataset.art = art;
      b.setAttribute('aria-keyshortcuts', TASTE[art]);
      b.innerHTML = `${AKTION[art]}<span><b>${NAMEN[art]} <kbd>${TASTE[art]}</kbd></b><small>${info[art]}${HALTEN[art] ? ' · halten' : ''}</small></span>`;
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
  }

  // ---------- Anzeige
  zeichne(dauer) {
    const f = this.feld, zs = f.zustand();
    const w = this.wetter[Math.min(f.t, this.wetter.length - 1)];
    this.szene.zeige(zs, w, dauer ?? TEMPO[this.tempo] / 1000);
    $('.uhrzeit', this.root).innerHTML = `<b>Tag ${w.tag}</b> ${zeit(w.h)}`;
    $('.jetzt', this.root).innerHTML = `${stundenSymbol(w)}<span>${z(w.temp)} °C · ${z(w.rh)} % rF${w.regen > 0 ? ` · ${z(w.regen, 1)} mm` : ''}</span>`;
    this.root.querySelectorAll('.tageskarte').forEach((k) => k.classList.toggle('heute', Number(k.dataset.tag) === w.tag));

    const [a, b] = this.ziel;
    const tsPos = (v) => `${Math.min(100, Math.max(0, (v - 10) / 60 * 100))}%`;
    const ts = $('.messer.ts', this.root);
    ts.querySelector('strong').textContent = `${z(zs.ts)} %`;
    ts.querySelector('.ziel').style.left = tsPos(a);
    ts.querySelector('.ziel').style.width = `calc(${tsPos(b)} - ${tsPos(a)})`;
    ts.querySelector('.nadel').style.left = tsPos(zs.ts);
    const imZiel = zs.phase !== 'stehend' && zs.ts >= a && zs.ts <= b;
    ts.classList.toggle('im-ziel', imZiel);
    ts.querySelector('small').textContent = zs.phase === 'stehend' ? 'Gras steht noch' : zs.nass > 0.15 ? 'Futter ist aussen nass' : imZiel ? `✓ im Zielbereich ${a}–${b} %` : `Ziel ${a}–${b} %`;

    const balken = (sel, wert, max, text, schlecht) => {
      const m = $(sel, this.root);
      m.querySelector('strong').textContent = text;
      m.querySelector('i').style.width = `${Math.min(100, (wert / max) * 100)}%`;
      m.classList.toggle('warnung', schlecht);
    };
    balken('.messer.zucker', zs.zucker, 200, `${z(zs.zucker)} g/kg`, zs.zucker < 60);
    balken('.messer.erde', Math.max(0, zs.asche - 70), 130, `${z(zs.asche)} g/kg`, zs.asche > 100);
    balken('.messer.verlust', zs.verlust, 25, `${z(zs.verlust, 1)} %`, zs.verlust > 10);
    this.knoepfeAktiv();
  }
}
