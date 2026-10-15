// Spielablauf: Die Uhr läuft, die Spieler lösen die Arbeitsgänge aus (oder im
// Zeitraffer der vorgegebene Plan). Anzeigen, Ticker und Szene werden jede Stunde nachgeführt.
import { Feld, SILOARTEN, AUFBEREITER } from './model.js';
import { stundenwetter } from './weather.js';
import { Szene } from './scene.js';
import { wetterSymbol, stundenSymbol, AKTION } from './icons.js';

export const START = 5; // Tag 1, 05:00
const TEMPO = { 1: 800, 2: 280, 3: 80 };
const $ = (s, el = document) => el.querySelector(s);
const z = (x, d = 0) => x.toFixed(d).replace('.', ',');
const zeit = (t) => `${String(t % 24).padStart(2, '0')}:00`;

export class Spiel {
  constructor(root, { setup, wetterSzenario, plan = null, onEnde }) {
    this.root = root; this.setup = setup; this.sz = wetterSzenario; this.plan = plan; this.onEnde = onEnde;
    this.wetter = stundenwetter(wetterSzenario);
    this.feld = new Feld(setup, this.wetter, START);
    this.ziel = SILOARTEN[setup.siloart].ziel;
    this.szene = new Szene($('.szene-box', root), wetterSzenario.monat);
    this.tempo = plan ? 3 : 1;
    this.pause = !plan;
    this.beschaeftigt = false;
    this.gemeldet = new Set();
    this.vorher = this.feld.zustand();

    root.classList.toggle('zeitraffer', !!plan);
    $('.ticker', root).replaceChildren();
    this.baueWetterbericht();
    this.baueKnoepfe();
    this.baueTempo();
    this.melde(`Tag 1, ${zeit(START)}: ${this.vorher.nass > 0.1 ? 'Tau liegt auf dem Gras.' : 'Der Tag beginnt.'} ${plan ? 'Zeitraffer läuft …' : 'Wann mähst du?'}`);
    this.zeichne(0.01);
    this.lauf();
  }

  stop() { clearTimeout(this.timer); this.gestoppt = true; }

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
    this.feld.stunde();
    this.zeichne();
    this.pruefeEreignisse();
    this.lauf();
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
    this.root.querySelectorAll('.tempo button').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.tempo) === n));
    this.zeichne(0.3);
  }

  // ---------- Arbeitsgänge
  async aktion(art, dauer = 1500) {
    if (this.beschaeftigt || this.feld.phase === 'geerntet') return;
    const f = this.feld;
    const moeglich = { maehen: f.phase === 'stehend', zetten: f.phase === 'gemaeht', schwaden: f.phase === 'gemaeht', ernte: f.phase === 'schwad' }[art];
    if (!moeglich) return;
    this.beschaeftigt = true;
    this.knoepfeAktiv();
    await this.szene.traktor(art, dauer);
    const t = `Tag ${Math.floor(f.t / 24) + 1}, ${zeit(f.t)}`;
    if (art === 'maehen') { f.maehen(); this.melde(`${t}: Gemäht mit ${String(this.setup.schnitthoehe).replace('.', ',')} cm Schnitthöhe${this.vorher.nass > 0.1 ? ', das Gras war noch nass' : ''}.`); }
    if (art === 'zetten') { f.zettenJetzt(); this.melde(`${t}: Gezettet bei ${z(f.ts())} % TS.`); }
    if (art === 'schwaden') { f.schwaden(); this.melde(`${t}: Geschwadet bei ${z(f.ts())} % TS.`); }
    this.beschaeftigt = false;
    if (art === 'ernte') {
      this.melde(`${t}: Eingefahren bei ${z(f.ts())} % TS.`);
      const res = f.einfahren();
      this.stop();
      this.knoepfeAktiv();
      setTimeout(() => this.onEnde(res), 600);
      return;
    }
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
    const namen = { maehen: 'Mähen', zetten: 'Zetten', schwaden: 'Schwaden', ernte: 'Einfahren' };
    const box = $('.aktionen', this.root);
    box.replaceChildren(...Object.keys(namen).map((art) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `aktion ${art}`; b.dataset.art = art;
      b.innerHTML = `${AKTION[art]}<span><b>${namen[art]}</b><small>${info[art]}</small></span>`;
      b.addEventListener('click', () => this.aktion(art));
      return b;
    }));
  }

  baueTempo() {
    this.root.querySelectorAll('.tempo button').forEach((b) => {
      b.onclick = () => this.setzeTempo(Number(b.dataset.tempo));
    });
    this.setzeTempo(this.pause ? 0 : this.tempo);
  }

  knoepfeAktiv() {
    const f = this.feld, frei = !this.beschaeftigt && !this.plan;
    const ok = { maehen: f.phase === 'stehend', zetten: f.phase === 'gemaeht', schwaden: f.phase === 'gemaeht', ernte: f.phase === 'schwad' };
    this.root.querySelectorAll('.aktion').forEach((b) => { b.disabled = !(frei && ok[b.dataset.art]); });
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
    ts.classList.toggle('im-ziel', zs.phase !== 'stehend' && zs.ts >= a && zs.ts <= b);
    ts.querySelector('small').textContent = zs.phase === 'stehend' ? 'Gras steht noch' : zs.nass > 0.15 ? 'Futter ist aussen nass' : `Ziel ${a}–${b} %`;

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
