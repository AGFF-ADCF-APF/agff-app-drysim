// Belüftungsmodell gegen Richtwerte aus FAT 1982, Agroscope 2014 und LK Salzburg (Werte in public/js/versuche.js)
//   docker run --rm --user 1000:1000 -v "$PWD":/app -w /app node:22-alpine node test/belueftung.mjs
import { konstant } from '../public/js/belueftung-vergleich.js';
import { tsAusU, uGleich } from '../public/js/belueftung.js';
import { ABB29, LKS_VERFAHREN, LKS_RICHTWERTE, ABLUFT_TS } from '../public/js/versuche.js';
import { stundenwetter } from '../public/js/weather.js';
import { simuliere } from '../public/js/model.js';
import { WETTER, PROGNOSEN } from '../public/js/scenarios.js';
const r = (x, d = 2) => x.toFixed(d);
const pruefe = (name, ok, text) => console.log(`${ok ? 'OK    ' : 'DANEBEN'} ${name}: ${text}`);

// 1. Sorptionsgleichgewicht gegen Abluft-Tabelle (Agroscope 2014, Tab. 3; LK Salzburg S. 45)
const iso = ABLUFT_TS.map(([rh, ts]) => [rh, ts, tsAusU(uGleich(rh, 20))]);
const isoMax = Math.max(...iso.map(([, a, b]) => Math.abs(a - b)));
pruefe('Gleichgewicht Abluft → TS', isoMax <= 2, iso.map(([rh, a, b]) => `${rh} %: ${a}/${r(b, 1)}`).join(', ') + ` (höchstens ${r(isoMax, 1)} Punkte daneben)`);

// 2. Wasserentzug je m³ nach Luftfeuchte und TS (FAT 1982, Abb. 29)
let s = 0, n = 0;
for (const k of ABB29.kurven) {
  const zeile = k.punkte.map(([rh, g]) => { const m = konstant({ ts: k.ts, rh }).gm3; s += (m - g) ** 2; n++; return `${rh}%: ${r(g, 1)}/${r(m)}`; });
  console.log(`        Abb. 29 ${k.name.padEnd(14)} gemessen/Spiel g/m³: ${zeile.join('  ')}`);
}
const rmse = Math.sqrt(s / n);
pruefe('Abb. 29 Wasserentzug', rmse <= 0.25, `mittlere Abweichung ${r(rmse)} g/m³ (Ablesegenauigkeit ±0,1–0,2)`);

// 3. Ausnutzung des Sättigungsdefizits 50–65 % und Kaltbelüftung 0,8–1,1 g/m³ (LK Salzburg)
const a = konstant({ ts: 65, rh: 60 });
pruefe('Ausnutzung Sättigungsdefizit', a.ausnutzung >= 0.45 && a.ausnutzung <= 0.7, `${r(a.ausnutzung * 100, 0)} % bei 65 % TS, 20 °C / 60 % (LK: 50–65 %)`);
const kalt = [60, 65, 70].map((rh) => konstant({ ts: 65, rh, stunden: 12 }).gm3);
pruefe('Kaltbelüftung g/m³', kalt.every((g) => g >= 0.6 && g <= 1.6), `${kalt.map((g) => r(g)).join(' / ')} g/m³ bei 60/65/70 % rF, 65 % TS (LK: «bei üblichen Luftfeuchtewerten» 0,8–1,1)`);

// 4. Strom und Trocknungsleistung je Verfahren (LK Salzburg S. 42, aus Balken abgelesen)
for (const v of LKS_VERFAHREN) {
  const m = konstant({ ts: 65, rh: v.rh, stunden: 12, dach: v.dach });
  pruefe(v.name, Math.abs(m.kwhJeKg - v.kwhJeKg) <= 0.08 && Math.abs(m.kgJeTh - v.kgJeTh) / v.kgJeTh <= 0.25,
    `${r(m.kwhJeKg)} kWh/kg (LK ${v.kwhJeKg}), ${r(m.kgJeTh)} kg/h je t (LK ${v.kgJeTh})`);
}
const e = konstant({ ts: 65, rh: 80, stunden: 12, entfeuchter: true });
pruefe('Entfeuchter kWh/kg', e.kwhJeKg <= LKS_RICHTWERTE.entfKwhJeKg[1] * 1.25, `${r(e.kwhJeKg)} kWh/kg mit Lüfter bei 20 °C / 80 % (LK: 0,26–0,45)`);

// 5. Ganze Runde: Tänikon 2001 (66 % TS beim Einführen gemessen) im Standardbetrieb, Haupttrocknung innert 80 h (LK Salzburg)
const p = PROGNOSEN.find((x) => x.id === 'taenikon');
const b = simuliere(p.plan, stundenwetter(WETTER.find((w) => w.id === p.wetter))).belueftung;
pruefe('Tänikon: Haupttrocknung', b.hauptStunden != null && b.hauptStunden <= LKS_RICHTWERTE.stunden, `${b.hauptStunden} h bis 80 % TS oben, lagerfähig nach ${b.stunden} h, ${r(b.kwhJeT, 0)} kWh/t, ${r(b.kwh / b.wasser)} kWh/kg, bis ${r(b.tempMax, 0)} °C`);
