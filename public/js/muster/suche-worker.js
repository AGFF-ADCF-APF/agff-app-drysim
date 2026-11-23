// Web Worker für die Suche nach Musterlösungen (suche.js); rechnet ohne die Seite zu blockieren.
// Nachricht { setup, wetter, erlaubt, vorgaben } → { art: 'fortschritt', n } … { art: 'fertig', ergebnis } | { art: 'fehler', text }
import { suche } from './suche.js';

self.onmessage = (ev) => {
  try {
    const ergebnis = suche({ ...ev.data, fortschritt: (n) => self.postMessage({ art: 'fortschritt', n }) });
    // nur das Protokoll und die Kennzahlen zurückgeben; die Seite rechnet den Verlauf selbst nach
    const knapp = (e) => (e ? { plan: e.plan, k: e.k } : null);
    self.postMessage({ art: 'fertig', ergebnis: { beste: knapp(ergebnis.beste), guenstig: knapp(ergebnis.guenstig), gerechnet: ergebnis.gerechnet, version: ergebnis.version } });
  } catch (e) {
    self.postMessage({ art: 'fehler', text: String(e?.message ?? e) });
  }
};
