// Niveaus: Einstieg (EBA, 1. Lehrjahr EFZ), Praxis (EFZ, Betriebsleiterschule), Profi (HF, Hochschule).
// Das Rechenmodell ist für alle Niveaus gleich, damit Ranglisten und Klassenwettkämpfe vergleichbar bleiben.
// Unterschiedlich ist nur, wie viel man einstellen muss, wie viel Text und Zahlen man sieht und welche
// Aufgaben gestellt werden. Alles, was ein Niveau zeigt, steht in dieser einen Tabelle; die übrigen
// Module fragen mit `zeigt('bereich.merkmal')` nach, statt das Niveau selbst zu prüfen.
// Gemerkt im Browser (localStorage), setzbar per Adresse: ?niveau=einstieg|praxis|profi

const KEY = 'drysim-niveau';
export const STANDARD = 'praxis';

export const TABELLE = {
  einstieg: {
    name: 'Einstieg', zeichen: '●○○', fuer: 'EBA und 1. Lehrjahr EFZ',
    satz: 'Wenig einstellen, Ampel statt Zahlen. Der Traktor schlägt den nächsten Schritt vor.',
    einsatz: { kurz: true, voreinstellen: true, modus: 'ruhig' },          // nur Wetter und Silage/Heu, Rest hinter «Mehr einstellen»
    feld: { ampel: true, vorschlag: true, zahlen: false, profi: false },   // Ampel und kurze Worte statt Zahlen
    ergebnis: { karten: ['einstieg'], kurz: true, zahlen: false, rueckblick: false, rechenweg: false, export: false, aufgaben: false },
    assistent: { stufe: 'einfach', nurAufWunsch: false },
    // Bildschirm «Am Heustock»: ohne Entfeuchter und ohne Rechenaufgabe
    // Bildschirm «Am Heustock» (Konzept Heubelüftung, Abschnitt 7): Anlage vorgegeben, Einfüllen automatisch richtig,
    // Messung automatisch mit Ampel, Eingriffe nur Lüfter und Feuerwehr, Warnung mit Handlungsvorschlag
    belueftung: { steuerung: 'ein-aus', anzeige: 'ampel', aufgabe: null, anlage: [], kennlinie: false, einfuellen: [], messen: 'auto',
      eingriffe: [], ernstfall: 'vorschlag', pannen: false, kosten: false, karten: 'einfach' },
  },
  praxis: {
    name: 'Praxis', zeichen: '●●○', fuer: 'EFZ und Betriebsleiterschule',
    satz: 'Wiese und Maschinen selbst einstellen, mit Zahlen und Erklärungen.',
    einsatz: { kurz: false, voreinstellen: false, modus: 'live' },
    feld: { ampel: false, vorschlag: false, zahlen: true, profi: false },
    ergebnis: { karten: ['einstieg', 'praxis'], kurz: false, zahlen: true, rueckblick: true, rechenweg: false, export: false, aufgaben: false },
    assistent: { stufe: null, nurAufWunsch: false },
    // Lüfter, Warmluft und Entfeuchter wählen (Entfeuchter auf Wunsch des Auftraggebers auch in Praxis), Höhe sehen und verteilen, Heusonde als Handlung, dazu Umschichten und Lüfter holen; Nachrechnen freiwillig
    belueftung: { steuerung: 'praxis', anzeige: 'zahlen', aufgabe: 'wasserentzug', anlage: ['luefter', 'dach', 'entfeuchter'], kennlinie: false, einfuellen: ['verteilen', 'start'], messen: 'hand',
      eingriffe: ['umschichten', 'luefterHolen'], ernstfall: 'warnung', pannen: false, kosten: false, karten: 'alle' },
  },
  profi: {
    name: 'Profi', zeichen: '●●●', fuer: 'Höhere Fachschule und Hochschule',
    satz: 'Alle Zahlen und Rechenwege, Modell gegen Messung, Datenexport und Begründungsaufgaben.',
    einsatz: { kurz: false, voreinstellen: false, modus: 'live' },
    feld: { ampel: false, vorschlag: false, zahlen: true, profi: true },
    ergebnis: { karten: ['einstieg', 'praxis', 'profi'], kurz: false, zahlen: true, rueckblick: true, rechenweg: true, export: true, aufgaben: true },
    assistent: { stufe: 'fachlich', nurAufWunsch: true },                  // Traktor meldet sich nur auf Wunsch
    // Alles wählen mit Kennlinie und Kosten, Lagen und Nachfüllen, Messraster und Messkalender, Auslagern, Pannen; nur Messwerte
    belueftung: { steuerung: 'praxis', anzeige: 'zahlen', aufgabe: 'wasserentzug', anlage: ['luefter', 'dach', 'entfeuchter', 'box'], kennlinie: true, einfuellen: ['verteilen', 'start', 'lagen'], messen: 'raster',
      eingriffe: ['umschichten', 'luefterHolen', 'auslagern', 'nachfuellen'], ernstfall: 'werte', pannen: true, kosten: true, karten: 'alle' },
  },
};
export const NIVEAUS = Object.keys(TABELLE);
export const gueltig = (id) => Object.hasOwn(TABELLE, id);

const lies = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const schreib = (v) => { try { localStorage.setItem(KEY, v); } catch { /* privater Modus: gilt dann nur für diesen Besuch */ } };

let aktuell = STANDARD;
{
  const gemerkt = lies();
  if (gueltig(gemerkt)) aktuell = gemerkt;
  // Lehrperson verschickt einen Link: ?niveau=… gilt vor dem gemerkten Wert und wird gemerkt
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('niveau') : null;
  if (gueltig(q)) { aktuell = q; schreib(q); }
  if (typeof document !== 'undefined') document.documentElement.dataset.niveau = aktuell;
}

const hoerer = new Set();
export const niveau = () => aktuell;
export const info = (id = aktuell) => TABELLE[id];
/** Merkmal des aktuellen Niveaus, z. B. zeigt('feld.ampel') */
export function zeigt(pfad, id = aktuell) {
  return pfad.split('.').reduce((o, k) => (o == null ? o : o[k]), TABELLE[id]);
}
/** Erklärkarte sichtbar? Jede Karte trägt in model.js `ab` (einstieg | praxis | profi). */
export const karteSichtbar = (karte, id = aktuell) => TABELLE[id].ergebnis.karten.includes(karte.ab ?? 'praxis');

export function setzeNiveau(id) {
  if (!gueltig(id) || id === aktuell) return;
  const alt = aktuell;
  aktuell = id; schreib(id);
  document.documentElement.dataset.niveau = id;
  hoerer.forEach((fn) => fn(id, alt));
}
export const beiWechsel = (fn) => hoerer.add(fn);

/** Drei Knöpfe zur Wahl des Niveaus (Startbildschirm und Dialog). */
export function baueNiveauWahl(box) {
  const zeichne = () => {
    box.innerHTML = NIVEAUS.map((id) => {
      const n = TABELLE[id];
      return `<button type="button" class="niveau-knopf ${id}" data-niveau="${id}" aria-pressed="${id === aktuell}">`
        + `<span class="niveau-zeichen" aria-hidden="true">${n.zeichen}</span><b>${n.name}</b><small class="niveau-fuer">${n.fuer}</small><small>${n.satz}</small></button>`;
    }).join('');
  };
  zeichne();
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-niveau]'); if (b) setzeNiveau(b.dataset.niveau); });
  beiWechsel(zeichne);
}
