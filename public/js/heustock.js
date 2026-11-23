// Zweite Spielphase bei Belüftungsheu: «Am Heustock». Die Uhr läuft stündlich wie auf dem Feld
// (Tempo, Pause, ruhiger Modus). Die Spieler schalten den Lüfter (aus, Dauer, Intervall), die Warmluft vom Dach
// und den Entfeuchter. Die Entscheidungen werden als Protokoll gesichert und lassen sich exakt nachspielen.
// Was eine Anlage hat und was der Bildschirm zeigt, steuert `optionen` (dach, entfeuchter, rechnen), z. B. je Niveau.
import { Heustock, spieleBelueftungNach, OPTIONEN, ANLAGE, LUFT, BETRIEB, SCHALTER, ERNSTFALL, PROTOKOLL_VERSION, uAusTs } from './belueftung.js';
import { halteKnopf } from './halten.js';
import { spieleNach } from './model.js';
import { stundenwetter } from './weather.js';
import { wetterSymbol, stundenSymbol } from './icons.js';
import { Assistent } from './assistent.js';
import { grafikHx } from './grafik.js';
import { START } from './game.js';

const TEMPO = { 1: 800, 2: 280, 3: 80, 4: 25 };
const RUNDE = 'drysim-runde';
const $ = (s, el = document) => el.querySelector(s);
const z = (x, d = 0) => (Number.isFinite(x) ? (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d).replace('.', ',') : '–'); // ohne «−0,0»
const zeit = (t) => `${String(t % 24).padStart(2, '0')}:00`;
const tagZeit = (t) => `Tag ${Math.floor(t / 24) + 1}, ${zeit(t)}`;

// Feld aus einer gesicherten Runde wiederherstellen (Phase Heustock): Arbeitsgänge nachspielen, dann einfahren
export function feldAusRunde(g, sz) {
  const f = spieleNach(g.einstellungen, stundenwetter(sz), g.log, g.ernteT, START);
  f.einfahren();
  return f;
}

export class HeustockSpiel {
  // feld: eingefahrenes Feld (model.js), feldLog: Arbeitsgänge der Feldphase (für die Sicherung)
  constructor(root, { feld, setup, wetterSzenario, wetterRef = null, feldLog = [], resume = null, onEnde }) {
    this.root = root; this.feld = feld; this.setup = setup; this.sz = wetterSzenario; this.wetterRef = wetterRef;
    this.feldLog = feldLog; this.onEnde = onEnde; this.plan = null;
    this.optionen = { ...OPTIONEN, ...(setup.belueftungOptionen ?? {}) };
    this.start = feld.heustockStart(this.optionen);
    this.e = { luefter: 'intervall', dach: !!this.optionen.dach, entfeuchter: false };
    this.log = resume ? resume.log.slice() : [];
    this.stock = resume ? spieleBelueftungNach(this.start, this.log, resume.t, this.e) : new Heustock(this.start);
    for (const x of this.log) if (x.t <= this.stock.t && SCHALTER.includes(x.art)) this.e[x.art] = x.wert; // aktueller Schaltzustand
    this.wetter = this.start.wetter;
    this.ruhig = setup.modus === 'ruhig';
    this.tempo = 1; this.pause = true; this.gemeldet = new Set(); this.vorher = this.stock.zustand();

    root.classList.toggle('ruhig', this.ruhig);
    root.classList.toggle('ohne-dach', !this.optionen.dach);
    root.classList.toggle('ohne-entfeuchter', !this.optionen.entfeuchter);
    root.classList.toggle('ohne-rechnen', !this.optionen.rechnen);
    // Niveau Einstieg: Ampel und kurze Worte statt Zahlen (Option `ampel`)
    this.ampel = !!this.optionen.ampel;
    // Messen: «auto» (Einstieg) zeigt den wahren Stand dauernd; sonst zeigt der Bildschirm nur, was die Heusonde zuletzt mass.
    // Warnen: «vorschlag» (mit Handlungsvorschlag), «warnung» (Hinweis beim Messen), «werte» (nur die Messwerte).
    this.sondeAuto = this.ampel || this.optionen.messen === 'auto';
    this.warnen = this.optionen.ernstfall ?? (this.ampel ? 'vorschlag' : 'warnung');
    root.classList.toggle('ohne-sonde', this.sondeAuto);
    const titel = (sel, t) => { $(sel, root).querySelector('span').innerHTML = t; };
    titel('.messer.hs-ts', this.ampel ? 'Wie trocken ist das Heu?' : 'Heustock (<abbr title="Trockensubstanz">TS</abbr>)');
    titel('.messer.hs-temp', this.ampel ? 'Wärme im Heustock' : 'Stocktemperatur');
    titel('.messer.hs-wasser', this.ampel ? 'Nimmt die Luft Wasser mit?' : 'Wasserentzug');
    $('.ticker', root).replaceChildren();
    this.baueBericht();
    this.baueSteuerung();
    this.bindeGlobal();
    $('#hs-pruefen').onclick = () => this.pruefeRechnung($('#hs-rechnen form'));
    const s = this.stock;
    if (resume) this.melde(`${tagZeit(s.t)}: Runde am Heustock fortgesetzt. ${this.ruhig ? 'Weiter mit +1 h oder +6 h.' : 'Weiter mit ▶ oder Leertaste.'}`);
    else {
      this.melde(`${tagZeit(s.t)}: ${z(s.mengeTonnen(), 1)} t Heu mit ${z(s.tsEin, 1)} % TS liegen ${z(s.hoehe, 1)} m hoch auf ${s.flaeche} m² Rost. Bis ${ANLAGE.zielTs} % TS müssen noch rund ${z(Math.round(s.restWasser() / 10) * 10)} Liter Wasser weg.`);
      this.melde(this.ruhig ? 'Die ersten 24 Stunden läuft der Lüfter durch. Du bestimmst, wann die Zeit weiterläuft.' : 'Die ersten 24 Stunden läuft der Lüfter durch (LK Salzburg). Starte die Uhr mit ▶.', true);
    }
    Assistent.kontext('heustock');
    this.zeichne();
    this.speichere();
    this.lauf();
  }

  // ---------- Schnittstelle wie Spiel (app.js: Bildschirmwechsel, Dialoge)
  stop() {
    clearTimeout(this.timer); this.gestoppt = true;
    document.removeEventListener('visibilitychange', this.beiVersteckt);
    document.removeEventListener('keydown', this.beiTaste);
  }
  speichere() {
    if (this.gestoppt || this.fertig) return;
    try {
      localStorage.setItem(RUNDE, JSON.stringify({
        v: 1, zeit: Date.now(), einstellungen: this.setup, wetterRef: this.wetterRef, log: this.feldLog,
        t: this.stock.t, ernteT: this.stock.t0, heustock: { v: PROTOKOLL_VERSION, log: this.log, t: this.stock.t },
      }));
    } catch { /* privater Modus */ }
  }
  setzeTempo(n) {
    this.tempo = n; this.pause = n === 0;
    this.root.querySelectorAll('.tempo button[data-tempo]').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.tempo) === n));
    this.lauf();
  }

  bindeGlobal() {
    this.beiVersteckt = () => {
      if (document.hidden && !this.pause && !this.auto) { this.setzeTempo(0); this.melde('Pausiert, weil die Seite im Hintergrund war.'); }
      if (document.hidden) this.speichere();
    };
    document.addEventListener('visibilitychange', this.beiVersteckt);
    this.beiTaste = (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.target.closest?.('input, textarea, select, dialog[open]')) return;
      const k = ev.key.toLowerCase();
      if (k === ' ' && !ev.target.closest?.('button')) { ev.preventDefault(); this.setzeTempo(this.pause ? 1 : 0); }
      else if (!this.ruhig && ['1', '2', '3'].includes(k)) this.setzeTempo(Number(k));
      else if ((k === '+' && this.pause) || (k === 'enter' && this.ruhig && !ev.target.closest?.('button'))) this.schritt(1);
      else if (k === 'a') this.schalte('luefter', 'aus');
      else if (k === 'd') this.schalte('luefter', 'dauer');
      else if (k === 'i') this.schalte('luefter', 'intervall');
      else if (k === 'w' && this.optionen.dach) this.schalte('dach', !this.e.dach);
      else if (k === 'e' && this.optionen.entfeuchter) this.schalte('entfeuchter', !this.e.entfeuchter);
      else if (k === 'r' && this.optionen.rechnen) this.oeffneRechnen();
      else if (k === 's' && !this.sondeAuto) this.handle('sonde');
      else if (k === 'f') this.handle('vorinfo');
    };
    document.addEventListener('keydown', this.beiTaste);
  }

  // ---------- Takt
  lauf() {
    clearTimeout(this.timer);
    if (this.gestoppt || this.pause) return;
    this.timer = setTimeout(() => this.takt(), TEMPO[this.auto ? 4 : this.tempo]);
  }
  takt() {
    if (this.gestoppt || this.pause) return;
    this.stundeWeiter();
    if (!this.fertig) this.lauf();
  }
  schritt(n) {
    if (this.gestoppt || this.auto) return;
    if (!this.pause) this.setzeTempo(0);
    for (let i = 0; i < n && !this.fertig; i++) this.stundeWeiter();
  }
  stundeWeiter() {
    if (this.stock.ende) return this.beende();
    this.stock.stunde(this.e);
    this.zeichne();
    this.pruefeEreignisse();
    this.speichere();
    if (this.stock.ende) this.beende();
  }
  // Rest der Belüftung der Steuerung überlassen (Intervall), im Zeitraffer bis zum Ende
  automatik() {
    if (this.fertig) return;
    if (this.e.luefter !== 'intervall') this.schalte('luefter', 'intervall');
    this.auto = true; this.root.classList.add('automatik');
    this.melde(`${tagZeit(this.stock.t)}: Die Steuerung übernimmt (Intervall mit Feuchtesteuerung) – Zeitraffer bis zum Schluss.`);
    this.pause = false; this.lauf();
  }
  beende() {
    if (this.fertig) return;
    this.fertig = true; clearTimeout(this.timer);
    const s = this.stock, r = s.ergebnis();
    this.melde(r.ende === 'brand' ? `${tagZeit(s.t)}: Der Heustock brennt! ${r.handlungen.some((x) => x.art === 'brandluft') ? 'Luft kam an das heisse Heu.' : `Er war zu lange über ${ERNSTFALL.alarm} °C, und niemand hat alarmiert.`}`
      : r.ende === 'abbruch' ? `${tagZeit(s.t)}: Feuerwehr alarmiert. Sie trägt den Stock kontrolliert ab: Das Heu ist verloren, das Gebäude bleibt stehen.`
        : s.lagerfaehig
          ? `${tagZeit(s.t)}: Abluft unter 50 % rF – das Heu ist lagerfähig! ${z(r.stunden)} Stunden belüftet, ${z(r.kwh)} kWh Strom.`
          : `${tagZeit(s.t)}: Die Zeit ist um. Die feuchteste Schicht hat erst ${z(r.tsMinEnde, 1)} % TS.`, true);
    this.root.classList.toggle('brennt', r.ende === 'brand');
    try { localStorage.removeItem(RUNDE); } catch { /* egal */ }
    this.zeichne();
    setTimeout(() => { this.stop(); this.onEnde(r); }, 900);
  }

  // ---------- Entscheidungen
  schalte(art, wert) {
    if (this.fertig || this.e[art] === wert) return;
    if (art === 'dach' && !this.optionen.dach) return;
    if (art === 'entfeuchter' && !this.optionen.entfeuchter) return;
    this.e[art] = wert;
    this.log = this.log.filter((x) => !(x.t === this.stock.t && x.art === art)); // pro Stunde gilt die letzte Wahl
    this.log.push({ t: this.stock.t, art, wert });
    const text = art === 'luefter' ? `Lüfter: ${BETRIEB[wert]}` : art === 'dach' ? `Warmluft vom Dach ${wert ? 'ein' : 'aus'}` : `Entfeuchter ${wert ? 'ein' : 'aus'}`;
    this.melde(`${tagZeit(this.stock.t)}: ${text}.`);
    if (art === 'entfeuchter' && wert) Assistent.hinweis('hs.entfeuchter');
    if (art === 'luefter' && wert === 'dauer') Assistent.hinweis('hs.dauer');
    this.zeigeSteuerung();
    this.speichere();
  }

  // ---------- Handlungen: Heusonde, Feuerwehr (später Eingriffe). Alles steht im Protokoll und wird exakt nachgespielt.
  handle(art, extra = {}) {
    if (this.fertig || this.gestoppt) return;
    const x = { t: this.stock.t, art, ...extra };
    const h = this.stock.handle(x);
    if (!h) return;
    this.log.push(x);
    const t = tagZeit(this.stock.t);
    if (h.art === 'sonde') {
      this.melde(`${t}: Heusonde gesteckt: wärmste Stelle ${z(h.temp)} °C, feuchteste Schicht ${z(h.tsMin)} % TS.`);
      this.warneNachMessung(h.temp, t);
    } else if (h.art === 'vorinfo') {
      this.melde(`${t}: Feuerwehr vorinformiert. Sie weiss Bescheid und gibt Rat${h.temp >= ERNSTFALL.vorinfo ? ': alle fünf Stunden messen, den Stock nicht abtragen.' : '.'}`);
    } else if (h.art === 'fehlalarm') {
      this.melde(`${t}: Die Feuerwehr rückt aus und misst höchstens ${z(h.temp)} °C: keine Brandgefahr. Fehlalarm – die Belüftung läuft weiter.`, true);
    }
    this.vorher = this.stock.zustand();
    this.zeichne();
    this.speichere();
    if (this.stock.ende) this.beende();
  }
  // Was die Messung bedeutet (Schwellen: LK Salzburg). Profi sieht nur die Werte.
  warneNachMessung(temp, t) {
    if (this.warnen === 'werte') return;
    const E = ERNSTFALL;
    if (temp >= E.alarm) { this.melde(`${t}: Über ${E.alarm} °C! Sofort die Feuerwehr alarmieren (Knopf gedrückt halten). Den Stock nicht öffnen.`, true); Assistent.hinweis('hs.ernstfall'); }
    else if (temp >= E.vorinfo) { this.melde(`${t}: Über ${E.vorinfo} °C! Feuerwehr vorinformieren, alle ${E.messenAlle} Stunden messen, den Stock nicht abtragen.`, true); Assistent.hinweis('hs.ernstfall'); }
    else if (temp >= E.achtung) { this.melde(`${t}: Über ${E.achtung} °C: Gefahr. Lüfter laufen lassen und öfter messen.`, true); Assistent.hinweis('hs.warm'); }
    else if (temp > 35) { this.melde(`${t}: Über 35 °C im Heu: Jetzt muss belüftet werden (LK Salzburg).`, true); Assistent.hinweis('hs.warm'); }
    if (temp >= 35 && !this.auto) this.setzeTempo(0);
  }

  // ---------- Hinweise im Ticker
  pruefeEreignisse() {
    const s = this.stock, zs = s.zustand(), p = zs.luft, alt = this.vorher, w = this.wetter[Math.min(s.t, this.wetter.length - 1)];
    const t = tagZeit(s.t), seit = s.t - s.t0;
    const einmal = (k, text, anhalten = false, tipp = null) => {
      if (this.gemeldet.has(k)) return;
      this.gemeldet.add(k); this.melde(text, anhalten);
      if (anhalten && !this.auto) this.setzeTempo(0);
      if (tipp && !this.auto) Assistent.hinweis(tipp);
    };
    const nacht = `${w.tag}-${w.h < 12 ? 'm' : 'a'}`;
    if (p?.f > 0 && p.gm3 < -0.05) einmal('feucht' + nacht, this.ampel ? `${t}: Die Luft ist zu feucht: Der Lüfter macht das Heu wieder feuchter. Intervall oder aus?` : `${t}: Die Luft ist zu feucht (${z(p.aussenRh)} % rF): Der Lüfter befeuchtet das Heu wieder. Intervall oder aus?`, this.e.luefter === 'dauer', 'hs.feucht');
    else if (p?.f > 0 && p.gm3 < 0.3 && seit > 24) einmal('wenig' + nacht, `${t}: ${w.rad > 0 ? 'Die Luft' : 'Die Nachtluft'} ist zu feucht: Der Lüfter bringt jetzt wenig (${z(p.gm3, 1)} g/m³).`);
    const E = ERNSTFALL;
    if (this.sondeAuto) {
      // Einstieg: Die Messung läuft automatisch, mit deutlicher Warnung und Handlungsvorschlag
      if (zs.temp > 35 && alt.temp <= 35) einmal('warm35-' + Math.floor(seit / 12), `${t}: Das Heu wird warm (über 35 °C)! Jetzt muss der Lüfter laufen.`, true, 'hs.warm');
      if (zs.temp > 40 && alt.temp <= 40) einmal('warm40-' + Math.floor(seit / 12), `${t}: Über 40 °C im Heustock – so warm darf Heu nie werden. Lüfter auf Dauer stellen.`, true, 'hs.warm');
      if (zs.temp >= E.achtung && alt.temp < E.achtung) einmal('warm45', `${t}: Über ${E.achtung} °C: Gefahr! Lüfter laufen lassen und den Stock im Auge behalten.`, true, 'hs.warm');
      if (zs.temp >= E.vorinfo && alt.temp < E.vorinfo) einmal('warm60', `${t}: Über ${E.vorinfo} °C! Tippe auf «Feuerwehr vorinformieren». Den Stock nicht selbst abtragen.`, true, 'hs.ernstfall');
      if (zs.temp >= E.alarm && alt.temp < E.alarm) einmal('warm70', `${t}: Über ${E.alarm} °C – der Stock kann sich entzünden! Jetzt «Feuerwehr alarmieren» gedrückt halten.`, true, 'hs.ernstfall');
    } else if (this.warnen !== 'werte') {
      // Praxis: Wer nicht misst, merkt es erst an den Anzeichen (LK Salzburg: Schwitzwasser, süsslicher Geruch)
      const g = s.gemessen;
      if (w.h === 8 && seit >= 12 && (!g || s.t - g.t >= 24)) einmal('messen' + w.tag, `${t}: Heute noch nicht gemessen. In den ersten Tagen wird der Stock täglich mit der Heusonde kontrolliert (LK Salzburg).`);
      if (zs.temp >= 50 && alt.temp < 50) einmal('geruch', `${t}: Im Heustall riecht es seltsam süsslich, auf dem Heu liegt Schwitzwasser. Höchste Zeit für die Heusonde!`, true, 'hs.ernstfall');
    }
    if (p && p.f === 0 && zs.ts < ANLAGE.hauptTs && s.seitLauf === 6) einmal('still' + s.t, `${t}: Seit 6 Stunden kein Luftzug: Das feuchte Heu atmet und erwärmt sich${this.sondeAuto ? ` (jetzt ${z(zs.temp)} °C)` : ''}.`);
    if (s.hauptBei === s.t) einmal('haupt', this.ampel ? `${t}: Das Gröbste ist geschafft – auch die oberste Schicht ist fast trocken. Jetzt nur noch ab und zu belüften.` : `${t}: Haupttrocknung geschafft – auch die oberste Schicht hat 80 % TS (nach ${z(seit)} Stunden). Jetzt nur noch nachbelüften.`, true, 'hs.haupt');
    if (seit === 80 && s.hauptBei == null) einmal('80h', this.ampel ? `${t}: Schon über drei Tage – das Heu sollte jetzt fast trocken sein. Die oberste Schicht ist noch feucht.` : `${t}: 80 Stunden – die Haupttrocknung sollte jetzt vorbei sein (LK Salzburg). Die Abluft ist noch feucht: Oben im Stock ist das Heu noch nicht trocken.`, true);
    if (p?.f > 0 && p.dachK > 1 && !this.gemeldet.has('dach')) einmal('dach', `${t}: Die Sonne wärmt das Dach: Die Zuluft ist ${z(p.dachK, 1)} °C wärmer und nimmt mehr Wasser auf.`, false, 'hs.dach');
    if (this.e.entfeuchter && p?.f > 0 && p.entfLh === 0) einmal('entf-kalt' + w.tag, `${t}: Der Entfeuchter bringt bei ${z(w.temp)} °C und ${z(w.rh)} % rF kaum etwas (unter 10 °C oder 40 % rF).`);
    if (w.h === 20) einmal('abend' + w.tag, `${t}: Es wird Abend. Die Luft kühlt ab und wird feuchter.${this.e.luefter === 'dauer' ? ' Dauerbetrieb in der Nacht bringt meist wenig.' : ''}`);
    if (seit === 36 && this.optionen.rechnen && p?.f > 0) einmal('rechnen', `${t}: Tipp: Rechne den Wasserentzug selbst nach (Knopf «Nachrechnen»).`, false, 'hs.rechnen');
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

  // ---------- Aufbau
  baueBericht() {
    // Wetterbericht für die Belüftungstage (ab Einfuhrtag), aus dem Stundenwetter
    const tag0 = Math.floor(this.stock.t0 / 24), tage = [];
    for (let d = tag0; d < Math.min(tag0 + 7, Math.floor(this.wetter.length / 24)); d++) {
      const h = this.wetter.slice(d * 24, d * 24 + 24);
      tage.push({ d, tmax: Math.max(...h.map((x) => x.temp)), tmin: Math.min(...h.map((x) => x.temp)), sonne: h[12].sonne, regen: h.filter((x) => x.regen > 0).map((x) => ({ h: x.h, mm: x.regen })), mm: h.reduce((a, x) => a + x.regen, 0) });
    }
    $('.bericht', this.root).innerHTML = tage.map((x) => `<div class="tageskarte" data-tag="${x.d + 1}"><b>Tag ${x.d + 1}</b>${wetterSymbol(x)}<span>${Math.round(x.tmax)}° / ${Math.round(x.tmin)}°</span><small>${x.mm > 0 ? z(x.mm, 0) + ' mm' : 'trocken'}</small></div>`).join('');
  }

  baueSteuerung() {
    const r = this.root;
    r.querySelectorAll('[data-luefter]').forEach((b) => { b.onclick = () => this.schalte('luefter', b.dataset.luefter); });
    r.querySelector('[data-schalter="dach"]').onclick = () => this.schalte('dach', !this.e.dach);
    r.querySelector('[data-schalter="entfeuchter"]').onclick = () => this.schalte('entfeuchter', !this.e.entfeuchter);
    r.querySelector('.hs-rechnen-auf').onclick = () => this.oeffneRechnen();
    r.querySelector('.hs-auto').onclick = () => this.automatik();
    r.querySelector('.hs-sonde').onclick = () => this.handle('sonde');
    r.querySelector('.hs-vorinfo').onclick = () => this.handle('vorinfo');
    // Alarm beendet die Runde: gedrückt halten. Der Knopf wird je Runde neu gebaut, damit keine alten Hörer bleiben.
    const alt = r.querySelector('.hs-alarm'), alarm = alt.cloneNode(true);
    alt.replaceWith(alarm);
    halteKnopf(alarm, { name: 'Feuerwehr alarmieren', los: () => this.handle('alarm'), melde: (text, wichtig) => this.melde(text, wichtig) });
    r.querySelectorAll('.tempo button[data-tempo]').forEach((b) => { b.onclick = () => this.setzeTempo(Number(b.dataset.tempo)); });
    r.querySelectorAll('.tempo button[data-schritt]').forEach((b) => { b.onclick = () => this.schritt(Number(b.dataset.schritt)); });
    this.setzeTempo(0);
    this.zeigeSteuerung();
  }

  zeigeSteuerung() {
    const r = this.root;
    r.querySelectorAll('[data-luefter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.luefter === this.e.luefter)));
    for (const k of ['dach', 'entfeuchter']) {
      const b = r.querySelector(`[data-schalter="${k}"]`);
      b.setAttribute('aria-pressed', String(!!this.e[k]));
      b.querySelector('small').textContent = this.e[k] ? 'ein' : 'aus';
    }
    const v = r.querySelector('.hs-vorinfo'), info = this.stock.vorinfoBei != null;
    v.setAttribute('aria-pressed', String(info)); v.disabled = info || this.fertig;
    v.querySelector('span').innerHTML = info ? 'Feuerwehr ist vorinformiert ✓' : 'Feuerwehr vorinformieren <kbd>F</kbd>';
    r.querySelector('.hs-alarm').disabled = !!this.fertig;
    r.querySelector('.hs-sonde').disabled = !!this.fertig;
  }

  // ---------- Anzeige
  zeichne() {
    const s = this.stock, zs = s.zustand(), p = zs.luft, r = this.root;
    const w = this.wetter[Math.min(s.t, this.wetter.length - 1)];
    $('.uhrzeit', r).innerHTML = `<b>Tag ${w.tag}</b> ${zeit(w.h)}`;
    $('.jetzt', r).innerHTML = `${stundenSymbol(w)}<span>Aussen ${z(w.temp)} °C · ${z(w.rh)} % rF</span>`;
    r.querySelectorAll('.tageskarte').forEach((k) => k.classList.toggle('heute', Number(k.dataset.tag) === w.tag));
    // Sicht: Einstieg sieht den wahren Stand; sonst nur, was die Heusonde zuletzt gemessen hat
    const g = this.sondeAuto ? { t: s.t, stellen: [{ name: 'Mitte', schichten: zs.schichten }] } : s.gemessen;
    const alter = g ? s.t - g.t : null;
    const sicht = g ? { schichten: g.stellen[0].schichten, alter } : null;
    $('.hs-bild', r).innerHTML = stockBild(sicht, s.n, p, this.e, w, this.optionen, zs.endeArt === 'brand');
    this.zeigeSteuerung();
    if (this.ampel) return this.zeichneAmpel(zs, p);
    const vor = alter == null ? '' : alter === 0 ? 'eben gemessen' : `gemessen vor ${alter} h`;
    $('.hs-bild', r).setAttribute('aria-label', sicht
      ? `Heustock mit ${s.n} Schichten, ${vor}: ${sicht.schichten.map((x, i) => `Schicht ${i + 1} ${z(x.ts)} % TS, ${z(x.temp)} °C`).join('; ')}`
      : `Heustock mit ${s.n} Schichten, noch nicht gemessen`);
    const mTs = sicht ? { ts: 100 / (1 + sicht.schichten.reduce((a, x) => a + uAusTs(x.ts), 0) / sicht.schichten.length), tsMin: Math.min(...sicht.schichten.map((x) => x.ts)), temp: Math.max(...sicht.schichten.map((x) => x.temp)) } : null;

    const pos = (v) => `${Math.min(100, Math.max(0, (v - 50) / (95 - 50) * 100))}%`;
    const ts = $('.messer.hs-ts', r);
    ts.querySelector('strong').textContent = mTs ? `${z(mTs.ts, 1)} %` : 'nicht gemessen';
    ts.querySelector('.ziel').style.left = pos(ANLAGE.lagerTs);
    ts.querySelector('.ziel').style.width = `calc(${pos(95)} - ${pos(ANLAGE.lagerTs)})`;
    ts.querySelector('.nadel').style.left = pos(mTs?.ts ?? 50);
    ts.querySelector('small').textContent = mTs ? `feuchteste Schicht ${z(mTs.tsMin, 1)} % · ${vor} · lagerfähig ab ${ANLAGE.lagerTs} %` : `Heusonde stecken · lagerfähig ab ${ANLAGE.lagerTs} %`;
    ts.classList.toggle('im-ziel', s.lagerfaehig);
    ts.classList.toggle('ungemessen', !mTs);

    const balken = (sel, wert, max, text, klein, schlecht) => {
      const m = $(sel, r);
      m.querySelector('strong').textContent = text;
      m.querySelector('i').style.width = `${Math.min(100, Math.max(0, wert / max * 100))}%`;
      m.querySelector('small').textContent = klein;
      m.classList.toggle('warnung', schlecht);
    };
    const mt = mTs?.temp;
    balken('.messer.hs-temp', mTs ? mt - 10 : 0, 60, mTs ? `${z(mt)} °C` : 'nicht gemessen',
      !mTs ? 'Heusonde stecken' : `${mt >= ERNSTFALL.alarm ? 'Feuerwehr alarmieren!' : mt >= ERNSTFALL.vorinfo ? 'Feuerwehr vorinformieren' : mt >= ERNSTFALL.achtung ? 'Gefahr: öfter messen' : mt > 40 ? 'nie über 40 °C!' : mt > 35 ? 'über 35 °C: belüften' : 'wärmste Schicht'} · ${vor}`, mTs != null && mt > 35);
    $('.messer.hs-temp', r).classList.toggle('ungemessen', !mTs);
    const laeuft = p?.f > 0;
    balken('.messer.hs-wasser', laeuft ? Math.max(0, p.gm3) : 0, 4, laeuft ? `${z(p.gm3, 1)} g/m³` : 'Lüfter steht',
      laeuft ? `${z(p.lh / p.f)} L/h${p.f < 1 ? ' während des Laufs' : ''} · bisher ${z(Math.round(s.wasser / 10) * 10)} L` : `bisher ${z(Math.round(s.wasser / 10) * 10)} L Wasser entzogen`, laeuft && p.gm3 < -0.05);
    balken('.messer.hs-strom', zs.kwh, Math.max(200, zs.kwh), `${z(zs.kwh)} kWh`, `${z(zs.kwh / s.mengeTonnen())} kWh je t Heu`, false);

    // Zuluft und Abluft
    const luft = (sel, t, rh, text) => { const el = $(sel, r); el.querySelector('strong').textContent = t == null ? '–' : `${z(t, 1)} °C · ${z(rh)} % rF`; el.querySelector('small').textContent = text; };
    luft('.hs-zu', p?.zuT ?? null, p?.zuRh, p ? (p.f > 0 ? `nach Lüfter${p.dachK > 0.5 ? ` und Dach (+${z(p.dachK, 1)} °C)` : ''}${p.entfLh > 0 ? `, Entfeuchter ${z(p.entfLh)} L/h` : ''}` : 'noch nicht gemessen') : 'Lüfter starten');
    luft('.hs-ab', laeuft ? p.abT : null, p?.abRh, laeuft ? (p.abRh > 90 ? 'fast gesättigt: das Heu ist noch feucht' : p.abRh < 50 ? 'unter 50 %: fast lagerfähig' : 'über dem Heu gemessen') : 'Lüfter steht');
    r.querySelector('.hs-rechnen-auf').disabled = !laeuft || this.fertig;
    r.querySelector('.hs-auto').disabled = this.fertig || this.auto;
  }

  // Niveau Einstieg: dieselben Messer, aber mit Ampelfarbe und einem kurzen Wort statt der Zahl
  zeichneAmpel(zs, p) {
    const r = this.root, s = this.stock, laeuft = p?.f > 0;
    const setze = (sel, farbe, wort, klein, anteil) => {
      const m = $(sel, r);
      ['gelb', 'gruen', 'rot', 'aus'].forEach((x) => m.classList.toggle(`ampel-${x}`, x === farbe));
      m.classList.remove('warnung', 'im-ziel');
      m.querySelector('strong').textContent = wort;
      m.querySelector('small').textContent = klein;
      const i = m.querySelector('.balken i'); if (i) i.style.width = `${Math.round(100 * anteil)}%`;
    };
    const pos = (v) => `${Math.min(100, Math.max(0, (v - 50) / (95 - 50) * 100))}%`;
    const ts = $('.messer.hs-ts', r);
    ts.querySelector('.ziel').style.left = pos(ANLAGE.lagerTs);
    ts.querySelector('.ziel').style.width = `calc(${pos(95)} - ${pos(ANLAGE.lagerTs)})`;
    ts.querySelector('.nadel').style.left = pos(zs.ts);
    const fast = zs.tsMin >= ANLAGE.lagerTs - 5;
    setze('.messer.hs-ts', s.lagerfaehig ? 'gruen' : 'gelb', s.lagerfaehig ? 'trocken genug' : fast ? 'fast trocken' : 'noch zu feucht',
      s.lagerfaehig ? 'Das Heu kann so lagern.' : 'Weiter belüften, bis auch die feuchteste Schicht trocken ist.');
    setze('.messer.hs-temp', zs.temp > 40 ? 'rot' : zs.temp > 35 ? 'gelb' : 'gruen', zs.temp >= ERNSTFALL.alarm ? 'Brandgefahr!' : zs.temp >= ERNSTFALL.vorinfo ? 'sehr heiss!' : zs.temp > 40 ? 'zu heiss!' : zs.temp > 35 ? 'wird warm' : 'kühl',
      zs.temp >= ERNSTFALL.alarm ? 'Jetzt die Feuerwehr alarmieren. Den Stock nicht öffnen.' : zs.temp >= ERNSTFALL.vorinfo ? 'Feuerwehr vorinformieren. Den Stock nicht abtragen.' : zs.temp > 35 ? 'Sofort belüften: Die Luft kühlt den Heustock.' : 'So soll es sein.', Math.min(1, Math.max(0, (zs.temp - 10) / 60)));
    const g = laeuft ? p.gm3 : 0;
    setze('.messer.hs-wasser', !laeuft ? 'aus' : g < -0.05 ? 'rot' : g < 0.3 ? 'gelb' : 'gruen', !laeuft ? 'Lüfter steht' : g < -0.05 ? 'nein, sie macht das Heu feuchter' : g < 0.3 ? 'kaum' : g < 1.2 ? 'ja' : 'ja, viel',
      !laeuft ? 'Ohne Luft trocknet das Heu nicht.' : g < 0.3 ? 'Feuchte Luft bringt wenig: Der Lüfter kostet jetzt nur Strom.' : 'Trockene, warme Luft trocknet am besten.', Math.min(1, Math.max(0, g / 4)));
    const jeT = zs.kwh / s.mengeTonnen();
    setze('.messer.hs-strom', null, jeT < 40 ? 'wenig' : jeT < 90 ? 'mittel' : 'viel', 'Strom kostet Geld: nur lüften, wenn es etwas bringt.', Math.min(1, jeT / 150));
    const luft = (sel, wort, klein) => { const el = $(sel, r); el.querySelector('strong').textContent = wort; el.querySelector('small').textContent = klein; };
    luft('.hs-zu', !p ? '–' : p.zuRh < 60 ? 'trocken' : p.zuRh < 80 ? 'mittel' : 'feucht', !p ? 'Lüfter starten' : 'Luft, die ins Heu geblasen wird');
    luft('.hs-ab', !laeuft ? '–' : p.abRh > 90 ? 'sehr feucht' : p.abRh < 50 ? 'trocken' : 'feucht', !laeuft ? 'Lüfter steht' : p.abRh > 90 ? 'Das Heu gibt noch viel Wasser ab.' : p.abRh < 50 ? 'Das Heu ist fast fertig.' : 'Luft, die oben aus dem Heu kommt');
    r.querySelector('.hs-rechnen-auf').disabled = true;
    r.querySelector('.hs-auto').disabled = this.fertig || this.auto;
  }

  // ---------- Messen und rechnen
  oeffneRechnen() {
    const p = this.stock.letzteLuft;
    if (!p || !(p.f > 0) || !this.optionen.rechnen) return;
    if (!this.pause) this.setzeTempo(0);
    const d = $('#hs-rechnen'), V = ANLAGE.luft * this.stock.flaeche;
    // gerundete Messwerte, wie angezeigt: damit rechnen die Lernenden
    const m = { zuT: +p.zuT.toFixed(1), zuRh: Math.round(p.zuRh), abT: +p.abT.toFixed(1), abRh: Math.round(p.abRh), V: +V.toFixed(1) };
    this.messung = { ...m, p, aussen: { t: p.aussenT, rh: p.aussenRh } };
    $('#hs-messwerte', d).innerHTML = `<div class="kennzahl"><span>Zuluft (unter dem Rost)</span><strong>${z(m.zuT, 1)} °C · ${m.zuRh} % rF</strong></div>` +
      `<div class="kennzahl"><span>Abluft (über dem Heu)</span><strong>${z(m.abT, 1)} °C · ${m.abRh} % rF</strong></div>` +
      `<div class="kennzahl"><span>Luftmenge</span><strong>${z(m.V, 1)} m³/s</strong></div>`;
    const tab = [];
    for (let t = 10; t <= 38; t += 2) tab.push(`<tr><td>${t} °C</td><td>${z(LUFT.gm3(t, 100), 1)}</td></tr>`);
    $('#hs-tabelle', d).innerHTML = `<table class="zahlen"><thead><tr><th>Temperatur</th><th>g Wasser je m³ bei 100 % rF</th></tr></thead><tbody>${tab.join('')}</tbody></table>`;
    d.querySelector('form').reset();
    $('#hs-aufloesung', d).innerHTML = '';
    d.showModal();
  }

  pruefeRechnung(form) {
    const m = this.messung; if (!m) return;
    const zahl = (n) => Number(String(form[n].value).replace(',', '.'));
    // Rechenweg mit gerundeten Zwischenwerten, wie von Hand mit der Tabelle
    const r1 = (x) => Math.round(x * 10) / 10;
    const satZu = r1(LUFT.gm3(m.zuT, 100)), satAb = r1(LUFT.gm3(m.abT, 100));
    const zu = r1(satZu * m.zuRh / 100), ab = r1(satAb * m.abRh / 100), d = r1(ab - zu), lh = d * m.V * 3.6;
    const eingabe = { zu: zahl('zu'), ab: zahl('ab'), d: zahl('diff'), lh: zahl('lh') };
    const ok = (x, soll, tol) => Number.isFinite(x) && x !== 0 && Math.abs(x - soll) <= Math.max(tol, Math.abs(soll) * 0.12);
    const z1 = (x) => z(x, 1);
    const zeile = (name, x, soll, tol, einheit) => `<li class="${ok(x, soll, tol) ? 'richtig' : 'falsch'}">${ok(x, soll, tol) ? '✓' : '✗'} ${name}: ${Number.isFinite(x) && x !== 0 ? z1(x) : '–'} ${einheit} (richtig etwa ${z1(soll)} ${einheit})</li>`;
    const sp = m.p.lh / m.p.f;
    $('#hs-aufloesung').innerHTML = `<ul class="pruefung">${zeile('Zuluft', eingabe.zu, zu, 0.3, 'g/m³')}${zeile('Abluft', eingabe.ab, ab, 0.3, 'g/m³')}${zeile('Wasserentzug', eingabe.d, d, 0.2, 'g/m³')}${zeile('Wasser je Stunde', eingabe.lh, lh, 3, 'L/h')}</ul>` +
      `<h3>Rechenweg</h3><ol class="rechenweg">` +
      `<li>Zuluft: Bei ${z1(m.zuT)} °C passen höchstens ${z1(satZu)} g Wasser in 1 m³ Luft. Bei ${m.zuRh} % rF sind es ${m.zuRh} % davon: ${z1(satZu)} × ${z(m.zuRh / 100, 2)} = <b>${z1(zu)} g/m³</b>.</li>` +
      `<li>Abluft: Bei ${z1(m.abT)} °C höchstens ${z1(satAb)} g/m³, bei ${m.abRh} % rF: ${z1(satAb)} × ${z(m.abRh / 100, 2)} = <b>${z1(ab)} g/m³</b>.</li>` +
      `<li>Jeder Kubikmeter Luft nimmt aus dem Heu ${z1(ab)} − ${z1(zu)} = <b>${z1(d)} g Wasser</b> mit.</li>` +
      `<li>Der Lüfter fördert ${z1(m.V)} m³/s, also ${z(m.V * 3600)} m³ je Stunde: ${z1(d)} g/m³ × ${z(m.V * 3600)} m³/h = ${z(d * m.V * 3600)} g/h = <b>${z(lh)} L/h</b> (1 L Wasser = 1 kg).</li>` +
      `</ol><p>Das Spiel rechnet genauer mit Gramm Wasser je Kilogramm trockener Luft, weil sich die Luft im Heu abkühlt und ihr Volumen dabei kleiner wird: <b>${z(m.p.gm3, 2)} g/m³</b> und <b>${z(sp)} L/h</b>. Die Abweichung zu deiner Rechnung ist klein.</p>` +
      grafikHx({ aussen: m.aussen, zu: { t: m.zuT, rh: m.zuRh }, ab: { t: m.abT, rh: m.abRh } }) +
      `<p class="hinweis">Gleiche Rechnung wie in der App <a href="../drywatch/" rel="noopener">Heutrocknung</a>: Dort gibst du die Messwerte deiner eigenen Anlage ein.</p>`;
  }
}

// ---------- Bild des Heustocks (SVG, Farben über CSS-Variablen)
// sicht: { schichten: [{ ts, temp }], alter } aus der letzten Messung, oder null (noch nie gemessen)
function stockBild(sicht, n, p, e, w, opt, brennt = false) {
  const B = 360, H = 230, x0 = 70, x1 = 290, yRost = 190, yOben = 50;
  const schichten = sicht?.schichten ?? Array.from({ length: n }, () => null), altKlasse = sicht && sicht.alter >= 24 ? ' hs-alt' : '';
  const hS = (yRost - yOben) / n, laeuft = p?.f > 0, nacht = w.rad <= 0;
  const teile = [];
  // Dach mit Sonne (Warmluft) und Gebäude
  teile.push(`<path d="M40 40 L180 4 L320 40" fill="none" stroke="var(--leise)" stroke-width="4"/>`);
  if (opt.dach) teile.push(`<path d="M60 34 L180 10 L300 34" fill="none" stroke="${e.dach && laeuft && !nacht ? 'var(--sonne)' : 'var(--linie)'}" stroke-width="6" stroke-linecap="round"><title>Dachkollektor</title></path>`);
  teile.push(`<rect x="${x0 - 4}" y="${yOben - 4}" width="${x1 - x0 + 8}" height="${yRost - yOben + 8}" fill="none" stroke="var(--leise)" stroke-width="2" rx="4"/>`);
  schichten.forEach((s, i) => {
    const y = yRost - (i + 1) * hS;
    if (!s) {
      teile.push(`<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${hS}" class="hs-ungemessen" stroke="var(--karte)" stroke-width="1"/><text x="${(x0 + x1) / 2}" y="${y + hS / 2 + 6}" text-anchor="middle" class="hs-schicht">?</text>`);
      return;
    }
    const nass = Math.min(1, Math.max(0, (uAusTs(s.ts) - uAusTs(87)) / (uAusTs(55) - uAusTs(87))));
    teile.push(`<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${hS}" fill="var(--gelb)"/><rect x="${x0}" y="${y}" width="${x1 - x0}" height="${hS}" fill="var(--gruen-dunkel)" fill-opacity="${(0.15 + 0.8 * nass).toFixed(2)}"${s.temp > 35 ? ' stroke="var(--rot)" stroke-width="3"' : ''}/>`);
    const text = opt.ampel ? `${s.ts >= ANLAGE.lagerTs ? 'trocken' : s.ts >= ANLAGE.lagerTs - 5 ? 'fast trocken' : 'feucht'}${s.temp > 35 ? ' · warm!' : ''}` : `${z(s.ts)} % · ${z(s.temp)} °C`;
    teile.push(`<text x="${(x0 + x1) / 2}" y="${y + hS / 2 + 6}" text-anchor="middle" class="hs-schicht${altKlasse}">${text}</text>`);
  });
  if (brennt) teile.push(`<text x="${(x0 + x1) / 2}" y="${yOben - 14}" text-anchor="middle" class="hs-klein" fill="var(--rot)">Brand!</text>`);
  // Rost, Lüfter, Pfeile
  teile.push(`<line x1="${x0}" x2="${x1}" y1="${yRost + 6}" y2="${yRost + 6}" stroke="var(--leise)" stroke-width="3" stroke-dasharray="6 4"/>`);
  teile.push(`<g class="hs-luefter${laeuft ? ' dreht' : ''}" transform="translate(32 ${yRost + 4})"><circle r="20" fill="var(--karte)" stroke="var(--leise)" stroke-width="3"/><path d="M0 0 L0 -15 A15 15 0 0 1 13 -7 Z M0 0 L13 7 A15 15 0 0 1 -0 15 Z M0 0 L-13 7 A15 15 0 0 1 -13 -7 Z" fill="var(--blau)"/><title>Lüfter</title></g>`);
  if (laeuft) {
    for (const x of [110, 180, 250]) teile.push(`<path d="M${x} ${yRost + 22} L${x} ${yOben - 14}" class="hs-pfeil" stroke="var(--blau)" stroke-width="3" fill="none" marker-end="url(#hs-spitze)"/>`);
  }
  if (laeuft && !opt.ampel) {
    teile.push(`<text x="${x1 + 8}" y="${yOben + 20}" class="hs-klein leise">Abluft</text><text x="${x1 + 8}" y="${yOben + 38}" class="hs-klein">${z(p.abRh)} %</text>`);
    teile.push(`<text x="${x1 + 8}" y="${yRost - 14}" class="hs-klein leise">Zuluft</text><text x="${x1 + 8}" y="${yRost + 4}" class="hs-klein">${z(p.zuRh)} %</text>`);
  }
  return `<svg viewBox="0 0 ${B} ${H}" class="hs-svg" aria-hidden="true"><defs><marker id="hs-spitze" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--blau)"/></marker></defs>${teile.join('')}</svg>`;
}

