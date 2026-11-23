// Modell gegen Richtwerte: die Belüftung unter festen Bedingungen nachrechnen
// (Grundlage für test/belueftung.mjs und die Grafik «Wasserentzug: Spiel gegen FAT 1982»).
import { Heustock, LUFT, ANLAGE, uAusTs } from './belueftung.js';

// Ein Stock mit überall gleicher TS, belüftet mit Luft von `temp` °C und `rh` % (ohne Sonne); Mittel über `stunden`
export function konstant({ ts, temp = 20, rh, stunden = 1, dach = false, entfeuchter = false, luefter = 'dauer', belegung = null }) {
  const wetter = Array.from({ length: stunden + 2 }, (_, t) => ({ t, temp, rh, rad: dach ? 700 : 0, regen: 0 }));
  const h = new Heustock({ dmFeld: 0.3, ts, t0: 0, wetter });
  if (belegung) for (const s of h.schichten) s.dm = belegung / h.n;
  for (const s of h.schichten) s.temp = temp;
  h.t0 = -100; // keine Startregel (24 h Dauerbetrieb), damit die Betriebsart wirkt
  let gm3 = 0, lh = 0, wasser0 = h.wasser, kwh0 = h.kwh, n = 0, ab = null, zu = null;
  for (let i = 0; i < stunden; i++) { const p = h.stunde({ luefter, dach, entfeuchter }); if (!p) break; gm3 += p.gm3; lh += p.lh; n++; ab = p; zu = p; }
  const kg = h.wasser - wasser0, kwh = h.kwh - kwh0;
  // Ausnutzung: tatsächlicher Wasserentzug im Verhältnis zum adiabatischen Sättigungsdefizit der Zuluft
  const p = LUFT.p(ANLAGE.hoehe), x = LUFT.x(zu.zuT, zu.zuRh, p), hz = LUFT.h(zu.zuT, x);
  let a = zu.zuT - 30, b = zu.zuT;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2, xm = (hz - 1.006 * m) / (2501 + 1.86 * m) * 1000; if (LUFT.rh(m, xm, p) > 99.999) a = m; else b = m; }
  const tf = (a + b) / 2, xs = (hz - 1.006 * tf) / (2501 + 1.86 * tf) * 1000;
  const defizit = (xs - x) * LUFT.dichte(zu.zuT, p);
  return { gm3: gm3 / n, lh: lh / n, kwhJeKg: kg > 0 ? kwh / kg : Infinity, kgJeTh: kg / n / h.mengeTonnen(), abRh: ab.abRh, abT: ab.abT, zuT: zu.zuT, zuRh: zu.zuRh, ausnutzung: defizit > 0 ? gm3 / n / defizit : null, defizit };
}
export { uAusTs };
