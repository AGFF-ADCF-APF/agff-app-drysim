// Erzeugt die statischen, von Suchmaschinen lesbaren Seiten aus den Daten des Spiels:
// public/lernen.html, public/szenario/<id>.html und public/sitemap.xml
//   docker run --rm -v "$PWD":/app -w /app node:22-alpine node tools/seiten.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import { WETTER, PROGNOSEN } from '../public/js/scenarios.js';
import { BESTAENDE, SILOARTEN, STADIEN, AUFBEREITER, ablageVon, KAL } from '../public/js/model.js';
import { grafikTrocknung, grafikFeldverluste, grafikAblage, grafikInsekten, grafikZucker, grafikHx, grafikAbb29 } from '../public/js/grafik.js';
import { ANLAGE, LUFT, LUEFTER, BOX, DRUCK_JE_M, DRUCK_BESTAND, DRUCK_ZUSCHLAG, ERNSTFALL, EINGRIFF, NACHRUESTEN, ANSAETZE, KOSTEN_QUELLE, SCHUETTHOEHE, luefterDruck, fuellhoehe, druckSchaetzung } from '../public/js/belueftung.js';
import { konstant } from '../public/js/belueftung-vergleich.js';
import { LKS_VERFAHREN, LKS_RICHTWERTE, ABLUFT_TS } from '../public/js/versuche.js';
import { tsAusU, uGleich } from '../public/js/belueftung.js';
import { vergleicheAlle } from '../public/js/vergleich.js';
import { QUELLE_FAT, QUELLE_TOPAGRAR, QUELLE_KOELN, QUELLE_HUMBERT } from '../public/js/versuche.js';
import { BEGRIFFE } from '../public/js/begriffe.js';
import { TABELLE as NIVEAUS } from '../public/js/niveau.js';

const BASIS = 'https://apps.graswachstum.ch/heureka/';
const HEUTE = new Date().toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const zahl = (x) => String(x).replace('.', ',');

function seite({ pfad, tiefe, titel, beschreibung, krumen, h1, inhalt, kopf = '' }) {
  const hoch = '../'.repeat(tiefe);
  const kr = krumen.map(([t, href], i) => (i === krumen.length - 1
    ? `<li aria-current="page">${esc(t)}</li>` : `<li><a href="${href}">${esc(t)}</a></li>`)).join('');
  return `<!doctype html>
<html lang="de-CH">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titel)}</title>
  <meta name="description" content="${esc(beschreibung)}">
  <link rel="canonical" href="${BASIS}${pfad}">
  <meta name="theme-color" content="#1d5a21" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0f1f10" media="(prefers-color-scheme: dark)">
  <meta name="color-scheme" content="light dark">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="de_CH">
  <meta property="og:title" content="${esc(titel)}">
  <meta property="og:description" content="${esc(beschreibung)}">
  <meta property="og:url" content="${BASIS}${pfad}">
  <meta property="og:image" content="${BASIS}img/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="${hoch}img/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="${hoch}img/icon-192.png">
  <link rel="stylesheet" href="${hoch}css/app.css">
  <script src="${hoch}js/boot.js"></script>${kopf}
</head>
<body>
  <a class="skip" href="#inhalt">Zum Inhalt</a>
  <header class="kopf">
    <a class="logo" href="${hoch}" aria-label="Heureka, zum Spiel">
      <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="14" width="22" height="28" rx="3" fill="#2e7d32"/><path d="M8 14 Q19 2 30 14Z" fill="#8a3b2a"/><ellipse cx="36" cy="38" rx="10" ry="5" fill="#a3a843"/></svg>
      <span><b><span class="logo-heu">HEU</span>reka</b><small>Lernspiel Futterkonservierung</small></span>
    </a>
    <div class="kopf-knoepfe"><button type="button" class="icon-btn" id="modus"></button></div>
  </header>
  <nav class="pfad" aria-label="Pfad"><ol>${kr}</ol></nav>
  <main class="seite" id="inhalt">
    <h1>${esc(h1)}</h1>
${inhalt}
  </main>
  <footer class="fuss">
    <nav aria-label="Weiterführende Links">
      <a href="${hoch}">Zum Spiel</a>
      <a href="${hoch}lernen.html">Begriffe und Hintergründe</a>
      <a href="${hoch}szenario/bilderbuch.html">Szenarien</a>
      <a href="${hoch}unterricht.html">Für Lehrpersonen</a>
      <a href="${hoch}../futter/v2/">Futterrechner</a>
      <a href="${hoch}../drywatch/">Heutrocknung</a>
      <a href="https://www.agff.ch" rel="noopener">AGFF</a>
    </nav>
  </footer>
  <script type="module" src="${hoch}js/modus.js"></script>
</body>
</html>
`;
}

// ---------- Lernseite
// Quellen: zuerst Fachunterlagen aus Österreich, der Schweiz und Deutschland (liegen in der App Heutrocknung), dann Versuche aus den USA.
const DRY = '../drywatch/knowledge/files/';
const QUELLEN_DACH = [
  ['Galler, Kittl, Wirleitner (Landwirtschaftskammer Salzburg): Heutrocknung von A bis Z. Praxisratgeber (Österreich)', `${DRY}Heutrocknung_von_A-Z_Kittl+Galler_2020.pdf`],
  ['Agroscope Transfer Nr. 38/2014: Richtlinien für Heubelüftungsanlagen (Autoren aus Schweiz, Österreich und Deutschland)', `${DRY}agroscope_transfer_38_2014_richtlinien_fuer_heubelueftungsanlagen.pdf`],
  ['Baumgartner, J. (1982): ABC der Heubelüftung. Blätter für Landtechnik 216, FAT Tänikon (Schweiz)', `${DRY}Baumgartner_1982_ABC-der-Heubelueftung.pdf`],
  ['LfL Bayern / AGGF 2016: Grassilage, TM-Gehalt (Pickert et al., PDF)', 'https://lfl.bayern.de/mam/cms07/ipz/dateien/aggf_2016_pickert_et_al.pdf'],
  ['top agrar: Gras zügig trocken – geht das nur mit Aufbereiter? (Deutschland)', 'https://www.topagrar.com/technik/news/krone-maehwerke-gras-zuegig-trocken-geht-das-nur-mit-aufbereiter-12748796.html'],
  ['Agrartechnik (Universität Hohenheim): Halmgutaufbereitung auf dem Feld (Deutschland)', 'https://440ejournals.uni-hohenheim.de/index.php/agrartechnik/article/view/2620/2352'],
  [`${QUELLE_FAT.titel} (Schweiz)`, QUELLE_FAT.url],
  [`${QUELLE_TOPAGRAR.titel} (Deutschland)`, QUELLE_TOPAGRAR.url],
  [`${QUELLE_KOELN.titel} (Deutschland)`, QUELLE_KOELN.url],
  [`${QUELLE_HUMBERT.titel} (Schweiz)`, QUELLE_HUMBERT.url],
  ['Schweizer Bauernverband u. a.: schlaumaehen.ch – tierschonend mähen (Schweiz)', 'https://schlaumaehen.ch/de/'],
  ['FiBL, Vogelwarte, AGRIDEA: agrinatur.ch – Extensiv genutzte Wiese, Auflagen (Schweiz)', 'https://www.agrinatur.ch/bff/extensiv-genutzte-wiese'],
  ['Kanton Bern, LANAT: Anforderungen an Biodiversitätsförderflächen in der Vernetzung (Stand 7.11.2024)', 'https://www.weu.be.ch/content/dam/weu/dokumente/lanat/de/landwirtschaft/biodiversitaet-landschaftsqualitaet/lanat-bewirtschaftungsauflagen-biodiversit%C3%A4tsf%C3%B6rderfl%C3%A4chen-vernetzung-de.pdf'],
  ['Elite / top agrar 2024: Enges Erntefenster – wie lässt sich Gras schnell trocknen? (Beratungsempfehlungen von J.-H. Puckhaber und T. Kilcer)', 'https://www.topagrar.com/rind/news/enges-erntefenster-wie-lasst-sich-gras-schnell-trocknen-22845.html'],
];
const QUELLEN_USA = [
  ['UW–Madison Extension: Field drying forage for hay and haylage', 'https://dairy.extension.wisc.edu/articles/field-drying-forage-for-hay-and-haylage'],
  ['UW Forage: Swath Drying (Merkblatt, PDF)', 'https://fyi.extension.wisc.edu/forage/files/2014/01/SwathDrying-FOF.pdf'],
  ['Undersander: Harvest Strategies (Alfalfa Symposium 2013, PDF)', 'https://alfalfasymposium.ucdavis.edu/+symposium/proceedings/2013/13WAS-27_Undersander_HarvestStrategies.pdf'],
];
// ---------- Abschnitt Heubelüftung (Zahlen aus belueftung.js und den Richtwerten in versuche.js)
function belueftungsAbschnitt() {
  const z = (x, d = 1) => x.toFixed(d).replace('.', ',');
  // Rechenbeispiel: Zuluft 22 °C / 55 %, Abluft 18 °C / 85 %, 100 m² Box
  const bsp = { zu: { t: 22, rh: 55 }, ab: { t: 18, rh: 85 }, V: 11 };
  // gerundete Zwischenwerte, wie von Hand gerechnet
  const r1 = (x) => Math.round(x * 10) / 10;
  const sZu = r1(LUFT.gm3(bsp.zu.t, 100)), sAb = r1(LUFT.gm3(bsp.ab.t, 100));
  const gZu = r1(sZu * bsp.zu.rh / 100), gAb = r1(sAb * bsp.ab.rh / 100), d = r1(gAb - gZu);
  const verf = LKS_VERFAHREN.map((v) => ({ ...v, spiel: konstant({ ts: 65, rh: v.rh, stunden: 12, dach: v.dach }) }));
  const entf = konstant({ ts: 65, rh: 80, stunden: 12, entfeuchter: true });
  return `
    <h2 id="belueftung">Heubelüftung: Luft, Wasser und Strom</h2>
    <p>Belüftungsheu kommt mit 60 bis 75 % TS in den Heustock. Ein Lüfter bläst Aussenluft unter einem Rost hindurch von unten durch das Heu. Die Luft nimmt dabei Wasser auf und trägt es oben hinaus. Wie viel, hängt davon ab, wie trocken und warm die Luft ist und wie feucht das Heu noch ist. Im Spiel folgt nach dem Einführen von Belüftungsheu die Phase <strong>«Am Heustock»</strong>: Du schaltest den Lüfter, die Warmluft vom Dach und den Entfeuchter, Stunde für Stunde.</p>
    <p><strong>Warum feuchte Nachtluft wenig bringt:</strong> Heu und Luft tauschen Wasser aus, bis sie im Gleichgewicht sind. Bei 20 °C und 50 % Luftfeuchte lässt sich Heu auf rund 85 bis 87 % TS trocknen, bei 80 % nur bis etwa 76 % (LK Salzburg). Ist die Luft feuchter als das Gleichgewicht, nimmt das Heu wieder Wasser auf. Warme Luft trocknet bei gleicher relativer Feuchte weiter. Darum hilft schon eine kleine Anwärmung: 5 °C mehr verdoppeln fast die Wasseraufnahme (LK Salzburg).</p>
    <p><strong>Die Luft kühlt sich ab:</strong> Für jedes Kilogramm Wasser, das verdunstet, braucht es 0,68 kWh Wärme. Die nimmt sich das Wasser aus der Luft: Sie kühlt sich ab, 1 °C entspricht rund 0,47 g Wasser je m³ (LK Salzburg). Theoretisch könnte 1 m³ Luft bei 20 °C und 70 % rF 5,2 g Wasser aufnehmen; tatsächlich sind es bei der Kaltbelüftung etwa 0,8 bis 1,1 g, weil sie sich abkühlt und das Heu das Wasser nicht beliebig schnell abgibt. In der Praxis werden 50 bis 65 % des Sättigungsdefizits ausgenutzt (LK Salzburg).</p>
    <h3>Richtwerte für die Anlage</h3>
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>Grösse</th><th>Richtwert</th><th>Quelle</th><th>im Spiel</th></tr></thead>
      <tbody>
        <tr><td>Luftmenge</td><td>rund 0,11 m³/s je m² Stockfläche (0,07–0,14), bei voller Stockhöhe mindestens 0,07</td><td>Agroscope 2014; FAT 1982: 0,10–0,12</td><td>${z(ANLAGE.luft, 2)} m³/s je m²</td></tr>
        <tr><td>Lüfter</td><td>0,11 kW Motorleistung je m² Box; LK Salzburg: 1 kW je 10 m²</td><td>Agroscope 2014; LK Salzburg</td><td>${z(ANLAGE.luefterKw, 2)} kW je m²</td></tr>
        <tr><td>Druck</td><td>100–240 Pa je m Stockhöhe (Dauerwiese 160, kleereich 240)</td><td>Agroscope 2014; LK Salzburg</td><td>nicht gerechnet</td></tr>
        <tr><td>Box</td><td>rund 25 m² je ha Tagesschlagkraft; 14–24 m² je ha und Charge</td><td>LK Salzburg; Agroscope 2014</td><td>${ANLAGE.flaecheJeHa} m² je ha, ${ANLAGE.feldHa} ha Parzelle</td></tr>
        <tr><td>Raumgewicht</td><td>Mittel 78 kg TS je m³ (Gebläse), 65 (Greifer)</td><td>FAT 1982</td><td>${ANLAGE.dichte} kg TS je m³</td></tr>
        <tr><td>Schicht je Einfuhrtag</td><td>1,5 bis höchstens 3 m</td><td>LK Salzburg</td><td>ergibt sich aus Ertrag und Box</td></tr>
        <tr><td>Dachabsaugung</td><td>Dach mindestens doppelt so gross wie die Box, 250–300 W je m² Dach nutzbar</td><td>Agroscope 2014; LK Salzburg: 200–400 W</td><td>${ANLAGE.dachFaktor}-fache Fläche, ${ANLAGE.dachW} W je m² bei voller Sonne</td></tr>
        <tr><td>Entfeuchter</td><td>Kompressor rund 17 kW je 100 m² Box; wenig wirksam unter 10 °C oder unter 35–40 % rF</td><td>LK Salzburg; Agroscope 2014</td><td>Kondensleistung nach Agroscope 2014, Abb. 18</td></tr>
        <tr><td>Lagerfähig</td><td>87–88 % TS; Abluft nach einer Pause unter 50 % rF</td><td>Agroscope 2014; LK Salzburg</td><td>feuchteste Schicht ${ANLAGE.lagerTs} % TS</td></tr>
      </tbody>
    </table></div>
    <h3>So wird belüftet</h3>
    <ul>
      <li><strong>Die ersten 24 Stunden</strong> läuft der Lüfter durch (LK Salzburg). Nach jedem Einfüllen wird unabhängig vom Wetter belüftet (FAT 1982).</li>
      <li><strong>Bei schönem Wetter</strong> sind von etwa 8 bis 20 Uhr die Bedingungen für den Dauerbetrieb gut (FAT 1982).</li>
      <li><strong>Nachts und bei Regen</strong> lohnt es sich nicht, die Kaltbelüftung dauernd laufen zu lassen. Damit sich das Heu nicht erwärmt, wird alle 4 bis 6 Stunden 20 bis 30 Minuten gelüftet, bis die Gutfeuchte bei etwa 20 bis 25 % liegt (FAT 1982). Steuerungen machen das mit Unterbrüchen von 2 bis 3 Stunden (Agroscope 2014).</li>
      <li><strong>Temperatur:</strong> Über 35 °C im Heu muss belüftet werden, nie über 40 °C (LK Salzburg).</li>
      <li><strong>Dauer:</strong> Die Haupttrocknung soll innert 80 Stunden vorbei sein, danach wird nachbelüftet (LK Salzburg).</li>
      <li><strong>Fertig:</strong> Ist die Abluft nach einer längeren Pause unter 50 % rF, ist das Heu lagerfähig (LK Salzburg; Agroscope 2014).</li>
    </ul>
    <p>Die Abluft verrät, wie trocken das Heu ist (Agroscope 2014, Tab. 3; LK Salzburg):</p>
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>Abluft</th>${ABLUFT_TS.map(([rh]) => `<th>${rh} % rF</th>`).join('')}</tr></thead>
      <tbody><tr><td>TS des Heus</td>${ABLUFT_TS.map(([, ts]) => `<td>${z(ts)} %</td>`).join('')}</tr>
      <tr><td>im Spiel (20 °C)</td>${ABLUFT_TS.map(([rh]) => `<td>${z(tsAusU(uGleich(rh, 20)))} %</td>`).join('')}</tr></tbody>
    </table></div>
    <h3 id="rechnen">Selber rechnen: Wie viel Wasser trägt die Luft fort?</h3>
    <p>Mit zwei Fühlern, einem unter dem Rost (Zuluft) und einem über dem Heu (Abluft), lässt sich der Wasserentzug ausrechnen. Beispiel: Zuluft ${bsp.zu.t} °C und ${bsp.zu.rh} % rF, Abluft ${bsp.ab.t} °C und ${bsp.ab.rh} % rF, ${bsp.V} m³/s Luft (100 m² Box).</p>
    <ol>
      <li>Gesättigte Luft enthält bei ${bsp.zu.t} °C höchstens ${z(sZu)} g Wasser je m³. Bei ${bsp.zu.rh} % rF: ${z(sZu)} × ${z(bsp.zu.rh / 100, 2)} = <strong>${z(gZu)} g/m³</strong>.</li>
      <li>Abluft: ${z(sAb)} × ${z(bsp.ab.rh / 100, 2)} = <strong>${z(gAb)} g/m³</strong>.</li>
      <li>Jeder Kubikmeter nimmt ${z(gAb)} − ${z(gZu)} = <strong>${z(d)} g Wasser</strong> mit.</li>
      <li>${bsp.V} m³/s sind ${z(bsp.V * 3600, 0)} m³ je Stunde: ${z(d)} × ${z(bsp.V * 3600, 0)} = ${z(d * bsp.V * 3600, 0)} g, also rund <strong>${z(d * bsp.V * 3.6, 0)} Liter Wasser je Stunde</strong>.</li>
    </ol>
${grafikHx({ zu: bsp.zu, ab: bsp.ab })}
    <p>Im Spiel gibt es dazu die Aufgabe «Nachrechnen» mit den Messwerten der laufenden Stunde. Die App <a href="../drywatch/">Heutrocknung (drywatch)</a> rechnet dasselbe mit den Messwerten deiner eigenen Anlage, genauer mit Gramm Wasser je Kilogramm trockener Luft, und zeigt das h,x-Diagramm.</p>
    <h3>Strom und Verfahren</h3>
    <p>Kaltbelüftung braucht um 0,25 kWh je kg Wasser, mit Dachabsaugung deutlich unter 0,2, mit Entfeuchter 0,26 bis 0,45, mit ständiger Warmluft vom Ofen 1 bis 1,4 kWh (LK Salzburg). Wie feucht das Futter beim Einführen höchstens sein darf, hängt vom Verfahren ab (Tabelle oben unter «Heu»). 10 % mehr Feuchte verdoppeln die Wassermenge, die der Lüfter wegtragen muss (Agroscope 2014).</p>
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>Verfahren (Heu mit 65 % TS)</th><th>Strom, kWh je kg Wasser: LK Salzburg</th><th>im Spiel</th><th>Wasser, kg je h und t Heu: LK Salzburg</th><th>im Spiel</th></tr></thead>
      <tbody>
${verf.map((v) => `        <tr><td>${esc(v.name)}</td><td>${z(v.kwhJeKg, 2)}</td><td>${z(v.spiel.kwhJeKg, 2)}</td><td>${z(v.kgJeTh, 2)}</td><td>${z(v.spiel.kgJeTh, 2)}</td></tr>`).join('\n')}
        <tr><td>Entfeuchter (20 °C / 80 % rF)</td><td>${z(LKS_RICHTWERTE.entfKwhJeKg[0], 2)}–${z(LKS_RICHTWERTE.entfKwhJeKg[1], 2)}</td><td>${z(entf.kwhJeKg, 2)} (mit Lüfter)</td><td>–</td><td>${z(entf.kgJeTh)}</td></tr>
      </tbody>
    </table></div>
    <h3 id="anlage">Anlage, Füllhöhe und Luftmenge</h3>
    <p>Ein Lüfter bringt nicht einfach immer gleich viel Luft. Je höher, dichter und nasser der Heustock, desto mehr Druck braucht es, um die Luft hindurchzudrücken, und desto weniger Luft kommt an. Der Richtwert ist ${z(ANLAGE.luft, 2)} m³ Luft je Sekunde und m² Stockfläche (Spielraum 0,07 bis 0,14); er soll mindestens bei halber Stockhöhe erreicht werden, bei voller Höhe nimmt man 0,07 in Kauf (Agroscope 2014).</p>
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>Druckbedarf bei Soll-Luftmenge</th><th>Pascal</th></tr></thead>
      <tbody>
        <tr><td>je Meter Stockhöhe, Dauerwiese (ausgewogen)</td><td>${DRUCK_JE_M}</td></tr>
        <tr><td>je Meter, gräser- oder kräuterreich</td><td>${z(DRUCK_JE_M * DRUCK_BESTAND.graeser, 0)}</td></tr>
        <tr><td>je Meter, kleereich</td><td>${z(DRUCK_JE_M * DRUCK_BESTAND.klee, 0)}</td></tr>
        <tr><td>Dachabsaugung</td><td>${DRUCK_ZUSCHLAG.dach}</td></tr>
        <tr><td>Luftentfeuchter</td><td>${DRUCK_ZUSCHLAG.entfeuchter}</td></tr>
      </tbody>
    </table></div>
    <p>Quelle der Tabelle: LK Salzburg; Agroscope 2014 nennt 100 bis 240 Pa je Meter. 100 Pa entsprechen 1 cm Wassersäule am U-Rohr-Manometer. Tiefer TS-Gehalt und dichtes Einfüllen erhöhen den Druck zusätzlich (FAT 1982), kurz geschnittenes Kleeheu vom ersten Schnitt am stärksten (Agroscope 2014). Steigt der Druck gegen das Doppelte des Normalwerts, ist zu viel oder zu nasses Heu in der Box (LK Salzburg).</p>
    <p><strong>Füllhöhe:</strong> Sie ergibt sich aus Ertrag, Fläche, Boxgrösse und Raumgewicht (im Mittel ${ANLAGE.dichte} kg TS je m³ bei Gebläse oder Verteiler, 65 mit dem Greifer; FAT 1982). Eine Charge soll 1 bis 2 m nicht überschreiten (Agroscope 2014), keinesfalls 3 m, bei Klee und sehr jungem Futter 2 m; die erste Schicht mindestens 1 m (LK Salzburg). Als Boxfläche gelten ${ANLAGE.flaecheJeHa} m² je Hektare Tagesschlagkraft (LK Salzburg).</p>
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>30 dt TS/ha von ${ANLAGE.feldHa} ha, 65 % TS</th><th>Füllhöhe</th><th>Druckbedarf mit Warmdach</th><th>Standardlüfter (bis ${z(luefterDruck('standard', ANLAGE.luft), 0)} Pa)</th></tr></thead>
      <tbody>
${Object.entries(BOX).map(([k, b]) => { const h = fuellhoehe(0.3 * 0.94, k), d = druckSchaetzung({ hoehe: h, ts: 65, dach: true }); return `        <tr><td>Box ${b.name}, ${b.m2JeHa * ANLAGE.feldHa} m²</td><td>${z(h)} m</td><td>${z(d.bedarf, 0)} Pa</td><td>${d.reicht ? 'reicht' : 'reicht nicht'}</td></tr>`; }).join('\n')}
${(() => { const h = fuellhoehe(0.45 * 0.94, 'klein'), d = druckSchaetzung({ hoehe: h, ts: 55, bestand: 'klee', dach: true }); return `        <tr><td>Box klein, 45 dt TS/ha Kleeheu mit 55 % TS</td><td>${z(h)} m</td><td>${z(d.bedarf, 0)} Pa</td><td>${d.reicht ? 'reicht' : 'reicht nicht'}; starker Lüfter (bis ${z(luefterDruck('stark', ANLAGE.luft), 0)} Pa) reicht${luefterDruck('stark', ANLAGE.luft) >= d.bedarf ? '' : ' auch nicht'}</td></tr>`; })()}
      </tbody>
    </table></div>
    <p>Im Spiel wählst du die Anlage im Einsatz: Standardlüfter (${z(LUEFTER.standard.kw, 2)} kW je m², Kennlinie nach einem Beispiel aus Agroscope 2014) oder starken Lüfter (gleicher Lüfter mit 20 % höherer Drehzahl: mehr Druck, aber ${z(LUEFTER.stark.kw, 2)} kW je m²), mit oder ohne Warmdach, mit oder ohne Entfeuchter, und die Boxfläche. Was der Betrieb nicht hat, lässt sich während der Belüftung nicht zuschalten. Einen stärkeren Lüfter kann man im Notfall holen: Er läuft erst nach ${NACHRUESTEN.warteStunden} Stunden und kostet Miete. Die Anzeige «Luftmenge» zeigt, wie viel Prozent der Soll-Luftmenge der Lüfter gegen den Stock tatsächlich bringt.</p>

    <h3 id="einfuellen">Einfüllen: locker, gleichmässig, Lüfter an</h3>
    <ul>
      <li><strong>Gleichmässig verteilen:</strong> Eine lockere und gleichmässige Beschickung ist entscheidend. Verdichtete Stellen werden umströmt und verderben leicht; durch lockere Stellen entweicht die Luft wie durch einen Kamin (Agroscope 2014). Das Futter nie an einer Stelle fallen lassen (LK Salzburg).</li>
      <li><strong>Lüfter läuft beim Beschicken:</strong> Das schränkt das Absetzen ein (Agroscope 2014); spätestens nach einem halben Meter Heu einschalten (LK Salzburg).</li>
      <li><strong>In Lagen:</strong> Mehrere kleinere Chargen verbessern die Trocknungsleistung (Agroscope 2014). Nach zwei bis drei schönen Belüftungstagen füllt man einen Viertel bis knapp die Hälfte der ersten Menge nach (FAT 1982).</li>
      <li><strong>Umschichten:</strong> Feuchte Nester und verdichtete Stellen mit Gabel oder Greifer beseitigen (FAT 1982). In der Haupttrocknung hilft es, den obersten Meter einmal täglich umzuschichten (LK Salzburg). Nie bei einem heissen Stock.</li>
    </ul>
    <div class="infobox"><p><strong>Im Spiel:</strong> Wer das Heu ablädt, wie es kommt, hat drei ungleiche Säulen: vorne locker und niedrig (Kamin), hinten hoch und dicht (Nest). Das Nest bleibt feucht und schimmelt. Die Heusonde findet es nur, wenn an allen drei Stellen gemessen wird. Umschichten löst es auf. Wer in zwei Lagen einfüllt, muss die zweite Lage rechtzeitig nachfüllen; sie wartet so lange unbelüftet. In der Praxis mäht man dafür an zwei Tagen, im Spiel ist die ganze Parzelle schon gemäht.</p></div>

    <h3 id="bedienen">Messen, eingreifen und der Ernstfall im Spiel</h3>
    <p>Am Heustock siehst du dauernd nur Zuluft, Abluft, Luftmenge und Strom. Wie warm und wie feucht es im Stock ist, zeigt erst die Heusonde. Der Heumesskalender verlangt in den ersten Tagen eine Messung täglich, mit Messstellen höchstens 1,5 m auseinander (LK Salzburg). Das Ergebnis zeigt im Zeitstrahl, wann ein Problem da war und ob es gemessen wurde.</p>
    <ul>
      <li><strong>Über 35 °C:</strong> belüften. <strong>Ab ${ERNSTFALL.achtung} °C:</strong> Gefahr, öfter messen.</li>
      <li><strong>Ab ${ERNSTFALL.vorinfo} °C:</strong> Feuerwehr vorinformieren, alle ${ERNSTFALL.messenAlle} Stunden messen, den Stock nicht mehr öffnen. Wer im Spiel jetzt noch umschichtet oder abträgt, löst den Brand aus.</li>
      <li><strong>Ab ${ERNSTFALL.alarm} °C:</strong> sofort alarmieren. Die Runde endet mit «Abbruch»: Das Heu ist verloren, das Gebäude steht, es gibt wenige Punkte und das Abzeichen «Rechtzeitig gehandelt».</li>
      <li><strong>Nicht alarmiert:</strong> Bleibt der Stock ${ERNSTFALL.brandStunden} Stunden über ${ERNSTFALL.alarm} °C, endet die Runde mit «Brand» und null Punkten.</li>
    </ul>
    <p><strong>Annahmen des Spiels:</strong> Die Unterlagen nennen Temperaturstufen, aber keine Zeiten. Wie schnell ein Stock über 60 °C weiter heiss wird (chemische Erwärmung nach Philipsen 1965) und nach wie vielen Stunden über 70 °C er brennt, ist für das Spiel angenommen. Auch wie stark nasses und dichtes Heu den Druck erhöht, wie ungleich ein schlecht verteilter Stock ist, die Arbeitszeiten und der Bröckelverlust beim Umschichten sind Annahmen.</p>

    <h3 id="kosten-belueftung">Was kostet das Heu?</h3>
    <p>Im Spiel bist du angestellte Betriebsleiterin oder angestellter Betriebsleiter: Es gibt kein Budget und keinen Kaufpreis, es zählen die laufenden Kosten. Das Ergebnis zeigt sie neben den Punkten in Franken je Tonne eingeführtes Heu; sie zählen nicht für die Punkte. Die Ansätze stammen aus dem Kostenkatalog von Agroscope (${esc(KOSTEN_QUELLE)}); Maschinen gelten je Arbeitsdurchgang ohne Bedienung, Hoftechnik als Jahreskosten ohne Strom.</p>
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>Ansatz</th><th>Wert</th><th>Quelle</th></tr></thead>
      <tbody>
${Object.values(ANSAETZE).map((a) => `        <tr><td>${esc(a.name)}</td><td>${z(a.wert, a.wert < 10 && a.wert % 1 ? 2 : 0)} ${esc(a.einheit)}</td><td>${esc(a.quelle)}</td></tr>`).join('\n')}
      </tbody>
    </table></div>
    <p>So rechnet das Spiel: Feldgeräte je Hektare und Durchgang (Ladewagen je Fuder), dazu Traktor und Arbeit für die Zeit, die aus der Arbeitsleistung der Geräte folgt. Der Lüfter ist der kleinste Radialventilator im Katalog, der die nötige Motorleistung hat; ein starker Lüfter hat einen höheren Ansatz, auch wenn er erst während der Belüftung angeschlossen wird (das kostet zusätzlich Arbeitsstunden). Jahreskosten von Lüfter und Heugebläse werden auf die Füllungen eines Jahres verteilt. Warmdach und Entfeuchter stehen nicht im Katalog; ihr Zuschlag kommt aus dem Vergleich «Gesamtkosten Trocknungssysteme» der LK Salzburg (Festkosten Kaltbelüftung 10, Dachabsaugung 11,5, Entfeuchter 19,3, beides 20,8 Euro je Tonne Heu, aus der Grafik abgelesen). Verlorenes Heu wird mit den Vollkosten von Heu bewertet (LK Salzburg). Im Niveau Profi lassen sich alle Ansätze im Ergebnis ändern.</p>

    <h3>Spiel gegen Quelle</h3>
    <p>Das Belüftungsmodell ist an zwei Angaben eingestellt: an der Grafik «Durchschnittlicher Wasserentzug» im «ABC der Heubelüftung» (FAT 1982, Abb. 29) und an der Ausnutzung des Sättigungsdefizits von 50 bis 65 % (LK Salzburg). Die Werte der LK Salzburg zu Strom und Trocknungsleistung in der Tabelle oben dienen als Prüfung.</p>
${grafikAbb29()}
    <p><strong>Was Annahme bleibt:</strong> Eine Messreihe mit Stockfläche, Heumenge, Luftzustand, Dauer und Strom enthalten die Unterlagen nicht. Wie schnell sich ungelüftetes, feuchtes Heu erwärmt und wann es schimmelt, rechnet das Spiel mit eigenen Annahmen (Erwärmung bei 65 % TS und 20 °C rund 0,3 K je Stunde; Schimmel, solange das Heu über 75 % rF im Gleichgewicht ist). Das Wetter nach dem vierten Spieltag ist erfunden, aus der Wetterlage abgeleitet. Weitere Annahmen stehen oben bei «Messen, eingreifen und der Ernstfall».</p>
    <div class="infobox"><p><strong>Im Spiel:</strong> Die Wette und der Zeitraffer rechnen mit dem Standardbetrieb: Intervall mit Feuchtesteuerung und Warmluft vom Dach. Fünf Szenarien zeigen andere Einstellungen: <a href="szenario/heudauer.html">Lüfter Tag und Nacht</a>, <a href="szenario/heugewitter.html">vor dem Gewitter</a>, <a href="szenario/lueftermagnicht.html">Standardlüfter bei 55 % TS</a>, <a href="szenario/zuhoch.html">zu hoch gefüllt</a> und <a href="szenario/nest.html">Nest übersehen</a>.</p></div>`;
}

const lernen = seite({
  pfad: 'lernen.html', tiefe: 0,
  titel: 'Futterkonservierung verstehen: Anwelken, Atmung, Erde, Gärqualität und Heu – Heureka',
  beschreibung: 'Wie gute Silage und gutes Heu entstehen: Anwelken, Breitablage, Aufbereiter, Zetten, Heu ab 87 bis 88 % TS, Heubelüftung mit Wasserentzug und Strom, Heustock-Kontrolle. Nach Unterlagen aus Österreich, der Schweiz und Deutschland.',
  krumen: [['Start', './'], ['Lernen']],
  h1: 'Futterkonservierung verstehen',
  // Gemeinsame AGFF-Mediathek: Liste und Skript liegen in futter (gleicher Host), siehe futter/static/v2/mediathek.js
  kopf: `
  <link rel="stylesheet" href="../futter/v2/assets/mediathek.css">
  <script src="../futter/v2/assets/mediathek.js" defer></script>`,
  inhalt: `
    <p>Silage entsteht, wenn Milchsäurebakterien im luftdichten Silo den Zucker des Futters zu Milchsäure vergären. Der pH-Wert sinkt, und das Futter wird haltbar. Ob das gelingt, entscheidet sich zu einem grossen Teil schon auf dem Feld. Diese Seite erklärt, was im <a href="./">Lernspiel Heureka</a> passiert und warum.</p>
    <div class="infobox"><p><strong>Woher die Zahlen kommen:</strong> Begriffe und Richtwerte stützen sich in erster Linie auf Fachunterlagen aus Österreich, der Schweiz und Deutschland: den Praxisratgeber «Heutrocknung von A bis Z» (<strong>LK Salzburg</strong>), die «Richtlinien für Heubelüftungsanlagen» (<strong>Agroscope 2014</strong>) und das «ABC der Heubelüftung» (<strong>FAT 1982</strong>). Versuche aus den USA ergänzen sie. Das Spiel selbst rechnet mit einem vereinfachten Lehrmodell: Es zeigt Zusammenhänge und Grössenordnungen, ist aber keine Prognose für einen Betrieb.</p></div>
    <nav aria-label="Inhalt dieser Seite"><ul>
      <li><a href="#anwelken">Warum anwelken?</a></li>
      <li><a href="#trocknung">Schnell trocknen: erst breit ablegen, dann aufbereiten</a></li>
      <li><a href="#aufbereiter">Mit oder ohne Aufbereiter?</a></li>
      <li><a href="#bff">Exkurs: Biodiversitätsförderflächen und tierschonendes Mähen</a></li>
      <li><a href="#zucker">Zucker schonen: Atmung, Tau und Regen</a></li>
      <li><a href="#sauber">Sauber arbeiten: Stoppelhöhe, Zinken und Erde</a></li>
      <li><a href="#zetten">Zetten und Schwaden: Blätter schonen</a></li>
      <li><a href="#gaerung">Gärqualität bewerten: Labor oder Prozess?</a></li>
      <li><a href="#heu">Heu: Bodenheu, Heuballen oder Belüftung</a></li>
      <li><a href="#belueftung">Heubelüftung: Luft, Wasser und Strom</a></li>
      <li><a href="#anlage">Heubelüftung: Anlage, Füllhöhe und Luftmenge</a></li>
      <li><a href="#einfuellen">Heubelüftung: Einfüllen</a></li>
      <li><a href="#bedienen">Heubelüftung: Messen, eingreifen, Ernstfall</a></li>
      <li><a href="#versuch">Spiel gegen Messung: der Versuch in Tänikon</a></li>
      <li><a href="#videos">Videos</a></li>
      <li><a href="#begriffe">Begriffe kurz erklärt</a></li>
      <li><a href="#quellen">Quellen</a></li>
    </ul></nav>

    <h2 id="anwelken">Warum anwelken?</h2>
    <p>Frisches Gras besteht zu rund 80 % aus Wasser. Erntereifes Futter hat je nach Nutzungszeitpunkt 18 bis 22 % Trockensubstanz (<abbr title="Trockensubstanz">TS</abbr>, in Deutschland und Österreich <abbr title="Trockenmasse">TM</abbr>), ältere Schweizer Unterlagen rechnen mit 15 % (LK Salzburg; FAT 1982). Zu nasses Futter siliert schlecht: Der Zucker ist verdünnt, es fliesst Sickersaft ab, und Buttersäurebakterien (Clostridien) haben leichtes Spiel. Zu trockenes Futter lässt sich dagegen schlecht verdichten. Dann bleibt Luft im Silo, es erwärmt sich und schimmelt.</p>
    <ul>
      <li><strong>Flachsilo:</strong> Ziel ${SILOARTEN.flachsilo.ziel[0]} bis ${SILOARTEN.flachsilo.ziel[1]} % TS</li>
      <li><strong>Rundballen:</strong> Ziel ${SILOARTEN.ballen.ziel[0]} bis ${SILOARTEN.ballen.ziel[1]} % TS</li>
    </ul>
    <p>Die <abbr title="Landesanstalt für Landwirtschaft Bayern">LfL Bayern</abbr> nennt für Grassilage meist 30 bis 40 % TM als Optimum. Die Unterlagen zur Heutrocknung enthalten keine Zielwerte für Silage; die Silage-Werte im Spiel stützen sich auf die LfL Bayern und das Lehrmodell. Wie gut sich Futter silieren lässt, beschreibt der Vergärbarkeitskoeffizient <abbr title="Vergärbarkeitskoeffizient">FK</abbr>: Er verbindet TS, Zucker und Pufferkapazität. Ein FK über 45 gilt als gut silierbar. Klee hat viel Pufferkapazität und wenig Zucker, braucht deshalb mehr TS als Gras.</p>

    <h2 id="trocknung">Schnell trocknen: erst breit ablegen, dann aufbereiten</h2>
    <p>Das Anwelken läuft in zwei Phasen:</p>
    <ol>
      <li><strong>Erste Phase (rund eine Stunde):</strong> Die Pflanze verdunstet Wasser über die Spaltöffnungen (<abbr title="Spaltöffnungen">Stomata</abbr>). Sie schliessen sich nach dem Schnitt aber schnell. Der Aufbereiter hält sie nicht offen.</li>
      <li><strong>Zweite Phase:</strong> Das Wasser muss durch die Wachsschicht (<abbr title="Wachsschicht">Kutikula</abbr>) und aus den Stängeln nach aussen. Hier hilft der Aufbereiter, weil er die Wachsschicht verletzt.</li>
    </ol>
    <p><strong>Breit ablegen:</strong> Für ein rasches Trocknen wird das Futter sofort nach dem Mähen auf die volle Arbeitsbreite ausgebreitet, sofern der Mäher das aufbereitete Futter nicht schon breitflächig ablegt (LK Salzburg). Versuche der Universität Wisconsin (USA, Luzerne) zeigen den Effekt deutlich: Bei Breitablage auf mehr als 70 % der Fläche war das Futter nach rund 8 bis 10 Stunden bei etwa 65 % Feuchte, also rund 35 % TS. In einer schmalen Schwade war es erst am Folgetag so weit. Die Versuche stammen aus den USA, und die Zeiten lassen sich nicht eins zu eins auf Gras in der Schweiz übertragen.</p>
    <p><strong>Aufbereiter:</strong> Ein Mähaufbereiter verkürzt die Trocknungszeit um 2 bis 4 Stunden und spart oft einen Zettvorgang samt den Bröckelverlusten (LK Salzburg). Bei grobstängeligem Futter sind es 1 bis 6 Stunden (Agroscope 2014). Zinken (Schlägel) passen zu Dauerwiese und Gräsern, Quetschwalzen zu Luzerne und Kleegras; Intensivaufbereiter haben eine Bürstenwalze und eine Breitstreuvorrichtung. Der Effekt sinkt mit der Fahrgeschwindigkeit (besser 7 bis 9 km/h als 11 bis 15 km/h), und das Gerät braucht rund 44 % mehr Leistung als das Mähwerk allein (LK Salzburg). In der ersten Phase direkt nach dem Mähen hilft er wenig, die Ablage ist wichtiger.</p>
    <p>In Deutschland gilt die «24-Stunden-Silage» mit rund 35 % TS als Ziel. Ältere Untersuchungen in der Zeitschrift Agrartechnik sehen den Effekt von Rotoraufbereitern bis etwa 60 % TS am grössten.</p>
    <p><strong>Anwelkgrad schätzen (Stängelprobe):</strong> Stängel in die Handfläche legen und mit dem Daumennagel in Längsrichtung ausstreichen. Tritt am Stängelende kein Wasser mehr aus, sind es mehr als 65 % TS (Agroscope 2014).</p>
    <div class="infobox"><p><strong>Im Spiel:</strong> Breitablage und ein früher Zettdurchgang bringen das Futter am gleichen Tag in den Zielbereich. Eine dichte Mähschwade ohne Zetten braucht bis zum nächsten Tag.</p></div>

    <h2 id="aufbereiter">Mit oder ohne Aufbereiter?</h2>
    <p>Ob es den Aufbereiter braucht, wird in der Praxis oft diskutiert. Was lässt sich belegen?</p>
    <ul>
      <li><strong>Er trocknet schneller.</strong> In Schweizer Versuchen verkürzte der Aufbereiter die Feldliegezeit um rund 25 bis 30 %; beim Einführen hatte das Futter 5 bis 7 % mehr TS als ohne Aufbereiter (FAT-Bericht 584). Im Versuch von top agrar 2021 hatte das aufbereitete Futter nach rund 5 Stunden 35 % TS.</li>
      <li><strong>Es geht auch ohne, wenn breit abgelegt und gezettet wird.</strong> Im gleichen top-agrar-Versuch erreichte das Futter ohne Aufbereiter mit zweimal Wenden am gleichen Tag knapp 35 % TS. Ohne Wenden blieb es bei 27 % TS. Das war ein einzelner Versuchstag mit sehr gutem Wetter, ohne Wiederholungen.</li>
      <li><strong>Schärfer einstellen bringt nicht immer mehr.</strong> An der TH Köln verdoppelte eine engere Einstellung die Knickstellen am Halm und erhöhte den Leistungsbedarf um bis zu 35 %. In der Dauerwiese trocknete das Futter aber nicht messbar schneller: Die Futtermatte am Boden bremst.</li>
      <li><strong>Er braucht mehr Leistung.</strong> Gemessen wurden 61 kW ohne und 122 kW mit Aufbereiter für eine 10-m-Kombination (top agrar 2021); gezogene Heckaufbereiter brauchten 5 bis 12 kW (FAT-Bericht 584).</li>
      <li><strong>Er tötet mehr Insekten.</strong> In einem Versuch von Agroscope starben mit Rotationsmähwerk 37 % der Raupen, mit Aufbereiter 69 % (Humbert et al. 2010).</li>
      <li><strong>Zwei Stunden nach dem Mähen</strong> ist die Oberseite der Ablage angetrocknet, die Unterseite noch so nass wie beim Mähen. Die Beratung empfiehlt deshalb, spätestens dann zu zetten, besonders ohne Aufbereiter.</li>
    </ul>
${grafikInsekten()}
    <p><strong>Nimmt der Zucker nach dem Schnitt zu?</strong> Manche Berater sagen, dass breit abgelegtes Gras in der Sonne noch Photosynthese betreibt und so mehr Zucker bildet, als es veratmet. Belegt ist, dass schnelles Trocknen die Atmung früher stoppt und damit Zucker spart. Eine Zunahme ist in begutachteten Versuchen nicht gesichert. Das Spiel rechnet deshalb nur mit dem Verlust durch die Atmung:</p>
${grafikZucker()}

    <h2 id="bff">Exkurs: Biodiversitätsförderflächen und tierschonendes Mähen</h2>
    <p>Auf artenreichen Wiesen leben Insekten, Spinnen, Amphibien, Bodenbrüter und junge Wildtiere. Wie gemäht wird, entscheidet mit, wie viele davon überleben. Auf Biodiversitätsförderflächen (<abbr title="Biodiversitätsförderfläche">BFF</abbr>) gelten dafür zum Teil verbindliche Regeln.</p>
    <div class="infobox">
      <p><strong>Schlau mähen – das Wichtigste in Kürze</strong> (nach <a href="https://schlaumaehen.ch/de/" rel="noopener">schlaumaehen.ch</a>, einem Projekt des Schweizer Bauernverbandes mit AGRIDEA, apisuisse, IP-Suisse, SVLT und der Vogelwarte, fachlich unterstützt unter anderem von der AGFF):</p>
      <ul>
        <li><strong>Ohne Aufbereiter</strong> in blühenden und artenreichen Beständen und auf BFF. Mit Aufbereiter nur, wenn weniger als eine Biene pro 2 m² fliegt, oder vor 7 Uhr und nach 18 Uhr, wenn kaum Insekten fliegen.</li>
        <li><strong>Hoch mähen:</strong> 10 bis 12 cm schonen Raupen, Amphibien und Reptilien. Bei Amphibien sank die Verlustrate von 27 % auf 5 %, als von 5 auf 12 cm erhöht wurde. Für die Futterqualität genügen ab 8 cm, und es kommt weniger Erde ins Futter.</li>
        <li><strong>Von innen nach aussen</strong> mähen, damit Tiere fliehen können, und vorher nach Rehkitzen und Junghasen suchen.</li>
        <li><strong>Altgrasstreifen:</strong> 5 bis 10 % der Fläche stehen lassen, bei jedem Schnitt an einer anderen Stelle.</li>
        <li><strong>Gestaffelt mähen</strong> statt alles am gleichen Tag, und auf Ökoflächen den Messerbalken dem Rotationsmähwerk vorziehen.</li>
        <li><strong>Heu statt Silage</strong> hilft Kleintieren: Das Futter liegt länger, viele Tiere können noch abwandern.</li>
      </ul>
      <p>Vertiefung: <a href="https://schlaumaehen.ch/de/was-tun.html" rel="noopener">Was tun?</a> · <a href="https://schlaumaehen.ch/de/technik.html" rel="noopener">Technik</a> · <a href="https://schlaumaehen.ch/de/weitere-tipps.html" rel="noopener">Weitere Tipps</a> · <a href="https://schlaumaehen.ch/images/2023_Schlaumaehen_Merkblatt_A5_DE_untereinander.pdf" rel="noopener">Merkblatt (PDF)</a> · <a href="https://schlaumaehen.ch/de/links-und-download.html" rel="noopener">Links und Downloads</a></p>
    </div>
    <p><strong>Was ist Pflicht?</strong> Die Regeln kommen aus zwei Ebenen:</p>
    <ul>
      <li><strong>Bund, Qualitätsstufe II:</strong> Auf extensiv genutzten Wiesen der Qualitätsstufe II ist der Einsatz von Mähaufbereitern verboten (Auflagen gemäss Direktzahlungsverordnung, zusammengestellt auf <a href="https://www.agrinatur.ch/bff/extensiv-genutzte-wiese" rel="noopener">agrinatur.ch</a>). Für alle BFF-Wiesen empfiehlt agrinatur.ch, auf den Aufbereiter zu verzichten und den Messerbalken vorzuziehen.</li>
      <li><strong>Kantone, Vernetzung:</strong> Vernetzungsprojekte legen eigene, teils strengere Auflagen fest. Beispiel Kanton Bern: Auf extensiv und wenig intensiv genutzten Wiesen, Streueflächen und Uferwiesen in der Vernetzung ist der Mähaufbereiter verboten. Dürrfutter soll zwei Nächte am Boden liegen, Haylage mindestens eine Nacht, und bei jedem Schnitt bleiben 10 % der Wiese als Rückzugsfläche stehen (<a href="https://www.weu.be.ch/content/dam/weu/dokumente/lanat/de/landwirtschaft/biodiversitaet-landschaftsqualitaet/lanat-bewirtschaftungsauflagen-biodiversit%C3%A4tsf%C3%B6rderfl%C3%A4chen-vernetzung-de.pdf" rel="noopener">Anforderungen an BFF in der Vernetzung, Kanton Bern, Stand 7.11.2024, PDF</a>).</li>
      <li>Eine schweizweite Zusammenstellung der kantonalen Regeln gibt es nicht. Massgebend sind die Vereinbarung mit dem eigenen Vernetzungsprojekt und die kantonale Fachstelle. Einen Überblick über alle BFF-Typen gibt <a href="https://www.agrinatur.ch/bff" rel="noopener">agrinatur.ch</a> (FiBL, Vogelwarte, AGRIDEA).</li>
    </ul>
    <p><strong>Auf der Karte:</strong> Die landwirtschaftlichen Nutzungsflächen mit den BFF zeigt der Bund auf <a href="https://map.geo.admin.ch/#/map?lang=de&layers=ch.blw.landwirtschaftliche-nutzungsflaechen&bgLayer=ch.swisstopo.pixelkarte-grau&center=2610000,1197000&z=8" rel="noopener">map.geo.admin.ch (Ebene «Nutzungsflächen»)</a>; ein Klick auf eine Fläche zeigt Nutzung und BFF-Qualität. Die Daten zu BFF der Qualitätsstufe II und zur Vernetzung stellen die Kantone auf <a href="https://www.geodienste.ch/services/lwb_biodiversitaetsfoerderflaechen" rel="noopener">geodienste.ch</a> bereit, für die meisten Kantone frei.</p>
    <div class="infobox"><p><strong>Im Spiel:</strong> Die Wiesen im Spiel sind Futterwiesen, keine BFF. Die Karte «Aufbereiter: Preis und Insekten» zeigt, was der Aufbereiter Tiere und Energie kostet, und wer ohne ihn mäht, bekommt das Abzeichen «Insektenschoner».</p></div>

    <h2 id="zucker">Zucker schonen: Atmung, Tau und Regen</h2>
    <p>Gemähte Pflanzen leben noch eine Weile weiter und veratmen dabei Zucker (im Spiel, bis sie etwa 60 % TS erreichen). Je wärmer es ist und je länger das Futter liegt, desto mehr Zucker geht verloren. Bleibt das Futter länger als etwa 35 Stunden auf dem Feld oder wird es eingeregnet, sinkt der Zuckergehalt deutlich; zu langes Anwelken erhöht die Atmungs- und die Bröckelverluste (LK Salzburg). Der Zucker fehlt später den Milchsäurebakterien.</p>
    <p><strong>Mähzeitpunkt:</strong> Gemäht wird frühestens, wenn der Tau abgetrocknet ist, normalerweise am späteren Vormittag. Mähen am Abend bringt keinen Vorteil: Der tagsüber gebildete Zucker wird in der Nacht wieder veratmet, und das Wetterrisiko steigt (LK Salzburg).</p>
    <p>Nachts nimmt das Futter Tau auf. Am Morgen muss dieses Wasser zuerst verdunsten, bevor die Pflanze selbst weiter trocknet. Regen macht den Trocknungsfortschritt zunichte und wäscht zusätzlich Zucker und Mineralstoffe aus. Aufbereitetes Futter mit verletzter Wachsschicht nimmt Wasser schneller auf und verliert mehr.</p>
    <p>Die Konservierungsverluste vom Schnitt bis zum Trog setzen sich so zusammen (LK Salzburg):</p>
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>Verlustart</th><th>Grössenordnung</th><th>Hängt ab von</th></tr></thead>
      <tbody>
        <tr><td>Atmungsverluste</td><td>3 bis 10 % und mehr</td><td>Trocknungszeit</td></tr>
        <tr><td>Bröckelverluste</td><td>3 bis 15 % und mehr</td><td>Zetten, Wenden, Kräuteranteil</td></tr>
        <tr><td>Auswaschungsverluste</td><td>1 bis 5 % und mehr</td><td>Regen, Tau</td></tr>
        <tr><td>Lagerverluste</td><td>2 bis 10 % und mehr</td><td>Restwasser, Nacherwärmung</td></tr>
      </tbody>
    </table></div>
    <p>Das Ziel sind Konservierungsverluste möglichst unter 10 %. Bodenheu und Nasssilage liegen oft bei 20 bis 40 %, Anwelksilage und Kaltbelüftung bei 15 bis 25 %, Eintagessilage mit Warmbelüftung unter 10 % (LK Salzburg).</p>

    <h2 id="sauber">Sauber arbeiten: Stoppelhöhe, Zinken und Erde</h2>
    <p>Sauberes Futter hat etwa 90 g Rohasche je kg TS. Alles deutlich darüber ist meistens Erde. Ab 10 % (100 g je kg TS) ist bei Silage mit einer explosionsartigen Vermehrung der Buttersäurebakterien zu rechnen, vor allem bei starker Verschmutzung und ungenügendem Anwelken (LK Salzburg). Die Sporen stammen aus dem Boden und gelangen mit jeder Futterverschmutzung ins Silo. Zu tiefes Mähen, lückige Bestände, Narbenverletzungen und sporenhaltige Humusteilchen sind die Hauptursachen. Clostridien bilden Buttersäure: Das macht die Silage stinkend, und sie gefährden die Hartkäseherstellung (Lochung, Risse im Teig). Gute Milch enthält unter 200 Sporen je Liter. Heu enthält nahezu keine sporenbildenden Bakterien, das ist für Hartkäse- und Heumilch entscheidend (Agroscope 2014; LK Salzburg).</p>
    <ul>
      <li><strong>Stoppelhöhe:</strong> Mindestens 5 bis 7 cm vom Boden aus gemessen sollen stehen bleiben (im Spiel stellst du diese effektive Stoppelhöhe ein, nicht das Mass am Mähwerk), teils wird auf 8 bis 9 cm gemäht (LK Salzburg). Tiefe Schnitte schaden dem nächsten Aufwuchs: Die Pflanze verliert ihr grünes Assimilationsgewebe und muss aus den Wurzelreserven nachschieben, und das viele Licht am Boden fördert die Keimung von Ampfer. Eine richtige Schnitthöhe bringt weniger Erde im Futter, eine bessere Feldtrocknung durch den grösseren Abstand zum Boden, eine dichte Grasnarbe und einen rascheren Folgeaufwuchs. Im Spiel kommt unter 6 cm deutlich mehr Erde ins Futter, und über 7 cm bleiben rund 4 % Ertrag je Zentimeter stehen.</li>
      <li><strong>Zinkenhöhe:</strong> Sie wird auf festem, ebenem Boden eingestellt. Auf dem Feld sinken die Räder ein, auf nassem Boden stärker, die Zinken laufen also tiefer. Unter etwa 2 cm reissen sie im Spiel Erde mit. Kleine Kreiseldurchmesser und eine flache Kreiselstellung passen sich dem Boden besser an (LK Salzburg; Agroscope 2014).</li>
      <li><strong>Futter bleibt liegen:</strong> Das Schwad liegt auf den niedergedrückten Stoppeln. Stehen die Zinken darüber, bleibt Futter liegen. Bei hohen Stoppeln darf die Einstellung höher sein. Doppelkreiselschwader mit Mittelablage schleifen das Futter weniger über den Boden (LK Salzburg).</li>
      <li><strong>Maulwurfshaufen</strong> und ein nasser Boden verstärken das Problem.</li>
    </ul>

    <h2 id="zetten">Zetten und Schwaden: Blätter schonen</h2>
    <p>Zetten lockert das Futter und verteilt es breit. Am ersten Tag nach dem Mähen kann der Kreiselzettwender mehrmals eingesetzt werden, jeder Arbeitsgang kostet aber Blätter. Mit zunehmender Trocknung, bei Heu über 60 % TM, steigen die Bröckelverluste überproportional. Am zweiten Tag wird das Futter deshalb nur noch wenig bearbeitet. Bei kräuterreichen Beständen und Bodenheu können es bis 100 kg TM je ha und Arbeitsgang sein (LK Salzburg). Bei Klee sind das die eiweissreichen Blätter. Im Spiel steigen die Bröckelverluste ab etwa 35 % TS spürbar.</p>
    <p id="zettwender">Die Durchgänge laufen mit abnehmender Drehzahl und zunehmender Schonung, abwechselnd längs und quer, und der Kreisel steht beim Wenden eher flach. Wie viele es sind, hängt vom Schnitt und vom Aufbereiter ab (LK Salzburg): Beim 1. Schnitt ohne Aufbereiter sind es drei (Zetten und zweimal Wenden). Mit Aufbereiter übernimmt dieser den ersten Durchgang, es bleiben zwei. Bei den Folgeschnitten sind es ebenfalls zwei. Agroscope 2014 nennt mit Aufbereiter zwei bis höchstens drei Durchgänge.</p>
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>Futter</th><th>1. Durchgang (Zetten, steiler Kreisel)</th><th>2. Durchgang (Wenden, flacher Kreisel)</th><th>3. Durchgang (Wenden)</th></tr></thead>
      <tbody>
        <tr><td>1. Schnitt, ohne Aufbereiter</td><td>540 U/min</td><td>400 U/min</td><td>320 U/min</td></tr>
        <tr><td>1. Schnitt, mit Aufbereiter</td><td>übernimmt der Aufbereiter</td><td>400 U/min</td><td>320 U/min</td></tr>
        <tr><td>2. und Folgeschnitte</td><td>540 U/min</td><td>320 U/min</td><td>–</td></tr>
      </tbody>
    </table></div>
    <p>Zapfwellendrehzahl nach LK Salzburg; Agroscope 2014 nennt rund 500 U/min bei 6 bis 8 km/h für den ersten, 380 bis 420 für den zweiten und 340 bis 400 für den dritten Durchgang.</p>
    <p><strong>Schwaden:</strong> Wegen der Bröckelverluste wird besser früh geschwadet, und das Futter trocknet im Schwad im Wind nach. Eine breite Schwadablage ist günstig für das schonende Aufnehmen mit Ladewagen oder Presse (LK Salzburg).</p>

    <h2 id="gaerung">Gärqualität bewerten: Labor oder Prozess?</h2>
    <p>Der DLG-Schlüssel bewertet Silage im Nachhinein mit Laborwerten: Buttersäure, Essigsäure und pH-Wert ergeben bis 100 Punkte. Die Gärqualität entsteht aber auf dem Feld und im Silo: Wer sauber arbeitet, genug anwelkt und gut verdichtet, braucht meist kein Siliermittel. Vorbeugen ist besser als Korrigieren. Das Spiel zeigt beides: Am Schluss steht die Note, und die Erklär-Karten zeigen die Arbeitsschritte, die dazu geführt haben.</p>

    <h2 id="heu">Heu: Bodenheu, Heuballen oder Belüftung</h2>
    <p>Heu wird nicht vergoren, sondern so weit getrocknet, dass Bakterien und Pilze nicht mehr arbeiten können. Lagerfähig ist Heu ab etwa 87 bis 88 % TS (Agroscope 2014; LK Salzburg: fertiges Heu hat rund 88 % TM). Bis dahin muss viel mehr Wasser weg als bei Silage: Aus Gras mit 20 % TS müssen rund 3,35 kg Wasser je kg Heu verdunsten (Agroscope 2014), bei 15 % TS sind es sogar rund 4,9 kg (FAT 1982). Wird das Futter auf 60 % TS vorgetrocknet, bleiben nur noch rund 0,67 kg Wasser je kg Trockenmasse. Der wesentliche Teil der Trocknung passiert also auf dem Feld. Eine um rund 10 % höhere Feuchtigkeit des Belüftungsheus verdoppelt die abzutrocknende Wassermenge (Agroscope 2014).</p>
    <p>Belüftungsheu wird meist am Folgetag nach dem Mähen eingefahren, mit einem Mähaufbereiter und zwei bis höchstens drei Zettdurchgängen sind bei gutem Wetter 60 bis 70 % TS erreichbar (Agroscope 2014). Mit modernen Anlagen genügen oft zwei Sonnentage (LK Salzburg).</p>
    <ul>
      <li><strong>Bodenheu:</strong> trocknet ganz auf dem Feld. Es darf höchstens 20 bis 25 % Wasser enthalten, wenn es auf den Heustock kommt; dort erwärmt es sich dann normalerweise bis 40 bis 45 °C. Im Spiel gilt es ab ${SILOARTEN.bodenheu.ziel[0]} % TS als einlagerbar.</li>
      <li><strong>Heuballen:</strong> Vorsicht bei stark verdichteten Pressballen mit mehr als 20 % Restfeuchte: Sie geben Wärme schlecht ab und schimmeln. Im Spiel gilt ebenfalls ab ${SILOARTEN.heuballen.ziel[0]} % TS als einlagerbar.</li>
      <li><strong>Belüftungsheu:</strong> wird schon feuchter eingeführt, im Spiel ab etwa ${SILOARTEN.belueftung.ziel[0]} % TS. Ein Gebläse trocknet es im Heustock mit Aussenluft fertig. Das verringert Bröckel- und Atmungsverluste und das Wetterrisiko (Agroscope 2014). Wie lange das dauert, hängt von der Luft ab: Bei 20 °C und höchstens 50 % Luftfeuchte lässt sich Heu auf rund 87 % TM trocknen, bei 80 % Luftfeuchte nur bis etwa 76 % TM (LK Salzburg). Die App <a href="../drywatch/">Heutrocknung</a> rechnet das genauer.</li>
    </ul>
    <p id="einfuhrfeuchte">Wie feucht das Futter beim Einfahren höchstens sein darf, hängt vom Trocknungsverfahren ab (nach Wirleitner, in LK Salzburg):</p>
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>Verfahren</th><th>Höchste Feuchte beim Einfahren</th><th>Entspricht TS</th></tr></thead>
      <tbody>
        <tr><td>Bodenheu (ohne Belüftung)</td><td>20 bis 25 %</td><td>75 bis 80 %</td></tr>
        <tr><td>Einfache Kaltbelüftung</td><td>25 bis 35 %</td><td>65 bis 75 %</td></tr>
        <tr><td>Rundballenbelüftung</td><td>höchstens 35 %</td><td>ab 65 %</td></tr>
        <tr><td>Solarbelüftung</td><td>30 bis 40 %</td><td>60 bis 70 %</td></tr>
        <tr><td>Warmbelüftung, Entfeuchter</td><td>40 bis 55 %</td><td>45 bis 60 %</td></tr>
        <tr><td>Fertig getrocknetes Heu (lagerfähig)</td><td>ab etwa 10 bis 13 %</td><td>87 bis 90 %</td></tr>
      </tbody>
    </table></div>
    <p>Belüftungsheu hat mehr Energie als Bodenheu: In den Futterwerttabellen stehen rund 6,4 MJ NEL je kg TM gegenüber 5,7 MJ bei Bodenheu (Grassilage: 6,3 MJ), und das nutzbare Protein ist höher (LK Salzburg).</p>
    <p><strong>Blätter schonen:</strong> Am ersten Tag wird gezettet, solange das Futter feucht ist. Ab etwa 60 % TS werden die Blätter spröde und brechen beim Zetten, Schwaden und Pressen ab; ab da nur noch wenig bearbeiten. Bei Klee sind die Verluste besonders hoch, und es gehen vor allem die eiweissreichen Blätter verloren.</p>
    <p><strong>Tau und Nachtschwad:</strong> Über Nacht nimmt das Heu wieder Feuchtigkeit auf. In der Praxis verringert ein Nachtschwad (am Abend schwaden, am Morgen wieder breit streuen) das. Eingefahren wird immer vor Sonnenuntergang, nicht mit Tau (LK Salzburg).</p>
    <p id="erwaermung"><strong>Erwärmung und Brandgefahr:</strong> Auch scheinbar trockenes Heu atmet nach dem Einlagern noch und erzeugt Wärme und Feuchte. Ohne Belüftung ist eine Eigenerwärmung bis 40 bis 45 °C normal; diese Fermentationsphase mit Schwitzwasser ist nach vier bis sechs Wochen vorbei, bei feucht eingebrachtem, verdichtetem oder sehr jungem Futter dauert sie länger. Hauptursachen für Selbstentzündung sind angeregnetes Heu, hohe Restfeuchte, zu rasche Ernte von sehr jungem blattreichem Futter, verschmutztes Futter und zu dichte Lagerung. Der Heustock wird bis zu zwölf Wochen mit der Heusonde gemessen («Heumesskalender»): in den ersten Tagen täglich, in der 2. bis 4. Woche alle zwei bis drei Tage, danach einmal wöchentlich, mit Messstellen höchstens 1,5 m voneinander entfernt (LK Salzburg).</p>
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>Temperatur im Stock</th><th>Was zu tun ist</th><th>Verluste an Energie / nutzbarem Protein</th></tr></thead>
      <tbody>
        <tr><td>unter 40 °C</td><td>normal</td><td>2 bis 5 % / 2 bis 5 %</td></tr>
        <tr><td>45 bis 60 °C</td><td>Gefahr: Kontrollen verstärken</td><td>bei 50 °C: 10 bis 15 % / 20 bis 25 %</td></tr>
        <tr><td>60 bis 70 °C</td><td>alle fünf Stunden messen, Stock nicht abtragen; die örtliche Feuerwehr vorinformieren und um Rat fragen</td><td>bei 60 °C: 15 bis 20 % / 40 bis 55 %</td></tr>
        <tr><td>über 70 °C oder Mulde im Stock</td><td>sofort die Feuerwehr (Heuwehr) alarmieren</td><td>bei 70 °C: 30 bis 35 % / 70 bis 80 %</td></tr>
      </tbody>
    </table></div>
    <p>Die frühe Information der örtlichen Feuerwehr ab 60 °C ist eine bewährte Praxisempfehlung (sie hat auch Messsonden und gibt Rat); die Quelle verlangt den Alarm ab 70 °C. Einen heissen Heustock niemals selbst abtragen: Luftsauerstoff und Hitze führen unweigerlich zum Brand. Erkennungsmerkmale sind Schwitzwasser, ein seltsam süsslicher Geruch, ein Temperaturanstieg über 50 °C und eine muldenförmige Einbuchtung (Verluste nach Philipsen 1965, in LK Salzburg). Bei der Kaltbelüftung gilt zudem: Stocktemperaturen über 35 °C im Intervallbetrieb beachten (Agroscope 2014).</p>
    <p><strong>Sonne und Regen:</strong> Trockenes Heu, das lange in der Sonne liegt, bleicht aus und verliert Vitamine (Carotin). Regen und Tau waschen aus, 1 bis 5 % und mehr (LK Salzburg). Gutes Heu riecht aromatisch, ist grünlich, blattreich und sauber. Das Spiel bewertet Heu nach Geruch, Farbe, Gefüge (Blätter) und Verunreinigung, angelehnt an die Sinnenprüfung und vereinfacht.</p>
    <div class="infobox"><p><strong>Im Spiel:</strong> Mit Aufbereiter und Breitablage ist Bodenheu bei Hochdruck ab dem Abend des zweiten Tages lagerfähig, ohne diese Hilfen später. Reicht das Wetterfenster nicht, rettet die Belüftung das Futter.</p></div>

${belueftungsAbschnitt()}

    <h2 id="versuch">Spiel gegen Messung: der Versuch in Tänikon</h2>
    <p>Wie gut rechnet das Spiel? Im Juli 2001 hat die Forschungsanstalt FAT in Tänikon vier Aufbereiter für Belüftungsheu verglichen: Kunstwiese im 3. Aufwuchs, 30 % Klee, 32 dt TS pro ha, gemäht am Vorabend mit 14,6 % TS, wolkenloses Wetter um 27 °C. Gemessen wurden die TS im Tagesverlauf und die Verluste auf dem Feld. Das Spiel rechnet dieselben Verfahren mit demselben Wetter nach.</p>
${grafikTrocknung()}
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>Verfahren</th><th>TS beim Einführen, gemessen</th><th>im Spiel</th></tr></thead>
      <tbody>
${vergleicheAlle().map((v) => `        <tr><td>${esc(v.name)}</td><td>${zahl(v.ende.toFixed(1))} %</td><td>${zahl(v.modell.tsEnde.toFixed(1))} %</td></tr>`).join('\n')}
      </tbody>
    </table></div>
    <p>Im Mittel liegt das Spiel rund 3 bis 4 Prozentpunkte TS neben der Messung. Ohne Aufbereiter und beim nie gewendeten Futter trocknet es im Spiel etwas zu langsam. Die Trocknung im Spiel ist an diesem Versuch kalibriert (Grundtempo ${zahl(KAL.k)}, Wirkung der Ablagebreite ${zahl(KAL.ablage)}, Bröckelverluste ×${zahl(KAL.broeckel)}); vorher trocknete das Spielfutter rund einen Drittel zu langsam.</p>
${grafikAblage()}
    <p><strong>Weniger bearbeiten, weniger Verluste:</strong> Die Verluste auf dem Feld lagen für zweitägiges Dürrfutter bei 5 bis 6 % des Ertrags, also tief. Am wenigsten verlor das Verfahren, das nie gewendet wurde, nämlich weniger als die Hälfte. Mit den Bröckelverlusten gehen vor allem Blätter mit viel Eiweiss und Energie verloren.</p>
${grafikFeldverluste()}
    <p>Die Messwerte und die Tabelle stammen aus dem <a href="${QUELLE_FAT.url}" rel="noopener">FAT-Bericht 584</a>. Selber ausprobieren: <a href="szenario/taenikon.html">Szenario «Tänikon 2001»</a>.</p>

    <h2 id="videos">Videos</h2>
    <p>Filme zu Anwelken, Heu und Silage aus der gemeinsamen Mediathek der AGFF-Apps.</p>
    <div data-agff-mediathek data-app="heureka" data-filter data-leer="Die Videoliste ist gerade nicht erreichbar."></div>

    <h2 id="begriffe">Begriffe kurz erklärt</h2>
    <dl>
${BEGRIFFE.map((b) => `      <dt>${esc(b.begriff)} <small>(${esc(b.lang)})</small></dt>\n      <dd>${esc(b.text)}</dd>`).join('\n')}
    </dl>

    <h2 id="quellen">Quellen</h2>
    <h3>Österreich, Schweiz, Deutschland</h3>
    <ul>
${QUELLEN_DACH.map(([t, u]) => `      <li><a href="${u}" rel="noopener">${esc(t)}</a></li>`).join('\n')}
    </ul>
    <h3>USA</h3>
    <ul>
${QUELLEN_USA.map(([t, u]) => `      <li><a href="${u}" rel="noopener">${esc(t)}</a></li>`).join('\n')}
      <li>Rotz, C. A.; Chen, Y. (1985): Alfalfa drying model for the field environment. Transactions of the ASAE 28. (Grundlage der Trocknungsrechnung im Spiel)</li>
    </ul>

    <h2>Jetzt ausprobieren</h2>
    <p><a class="knopflink" href="./">Heureka starten</a></p>
    <p>Oder zuerst ein Szenario ansehen:</p>
    <ul>
${PROGNOSEN.map((p) => `      <li><a href="szenario/${p.id}.html">${esc(p.name)}</a></li>`).join('\n')}
    </ul>
`,
});
fs.writeFileSync(new URL('../public/lernen.html', import.meta.url), lernen);

// ---------- Szenarioseiten
function belueftungInWorten(b = {}, plan = {}) {
  const e = { luefter: 'intervall', dach: true, entfeuchter: false, ...b };
  const a = plan.anlage, ef = plan.einfuellen, log = plan.belueftungLog ?? [];
  return `Lüfter ${{ aus: 'aus', dauer: 'im Dauerbetrieb', intervall: 'im Intervall mit Feuchtesteuerung' }[e.luefter]}, ${e.dach && a?.dach !== false ? 'mit' : 'ohne'} Warmluft vom Dach, ${e.entfeuchter ? 'mit' : 'ohne'} Entfeuchter`
    + (a ? `; ${LUEFTER[a.luefter].name}, Box ${BOX[a.box].m2JeHa * ANLAGE.feldHa} m²` : '')
    + (ef ? `; ${ef.verteilen ? 'gleichmässig verteilt' : 'abgeladen, wie es kommt'}` : '')
    + (log.some((x) => x.art === 'sonde') ? `; Heusonde ${log.every((x) => x.art !== 'sonde' || x.wert === 'mitte') ? 'nur in der Mitte' : 'an drei Stellen'}, ${log.filter((x) => x.art === 'sonde').length}-mal` : '');
}
fs.mkdirSync(new URL('../public/szenario/', import.meta.url), { recursive: true });
const sonne = (s) => (s >= 0.8 ? 'sonnig' : s >= 0.45 ? 'wechselnd bewölkt' : 'bewölkt');
for (const p of PROGNOSEN) {
  const w = WETTER.find((x) => x.id === p.wetter);
  const heu = SILOARTEN[p.plan.siloart].art === 'heu';
  const mm = (t) => (t.regen ?? []).reduce((a, r) => a + r.mm, 0);
  const html = seite({
    pfad: `szenario/${p.id}.html`, tiefe: 1,
    titel: `Szenario «${p.name}»: Wie wird ${heu ? 'das Heu' : 'die Silage'}? – Heureka`,
    beschreibung: `${p.lernziel} Lies das Szenario, tippe das Ergebnis und schau den Zeitraffer an.`,
    krumen: [['Start', '../'], ['Lernen', '../lernen.html'], [`Szenario ${p.name}`]],
    h1: `Szenario «${p.name}»`,
    inhalt: `
    <p><strong>Darum geht es:</strong> ${esc(p.lernziel)}</p>
    <div class="infobox"><p>${esc(p.text)}</p></div>
    <h2>Ausgangslage</h2>
    <ul>
      <li><strong>Wiese:</strong> ${esc(BESTAENDE[p.plan.bestand].name)}, Stadium ${esc(STADIEN[p.plan.stadium].name)}, ${p.plan.ertrag} dt TS/ha</li>
      <li><strong>Maschinen:</strong> ${esc(AUFBEREITER[p.plan.aufbereiter].name)}, Stoppelhöhe ${zahl(p.plan.schnitthoehe)} cm, Ablage auf ${ablageVon(p.plan)} % der Mähbreite</li>${p.plan.siloart === 'belueftung' ? `\n      <li><strong>Belüftung:</strong> ${belueftungInWorten(p.plan.belueftung, p.plan)}</li>` : ''}
      <li><strong>Ziel:</strong> ${esc(SILOARTEN[p.plan.siloart].name)}, ${heu && SILOARTEN[p.plan.siloart].ziel[1] >= 95 ? `ab ${SILOARTEN[p.plan.siloart].ziel[0]}` : `${SILOARTEN[p.plan.siloart].ziel[0]} bis ${SILOARTEN[p.plan.siloart].ziel[1]}`} % TS</li>
    </ul>
    <h2>Wetter: ${esc(w.name)}</h2>
    <p>${esc(w.info)}.</p>
    <ul>
${w.tage.map((t, i) => `      <li><strong>Tag ${i + 1}:</strong> ${Math.round(t.tmin)} bis ${Math.round(t.tmax)} °C, ${sonne(t.sonne)}, ${mm(t) > 0 ? `${Math.round(mm(t))} mm Regen` : 'kein Regen'}</li>`).join('\n')}
    </ul>
    <h2>Was du tippst</h2>
    <p>Wie hoch ist die TS beim Einfahren? Wie viel Rohasche steckt im Futter? Und welche ${heu ? 'Heuqualität (Note 1 bis 5) hat das Heu' : 'Gärqualität (Note 1 bis 5) hat die Silage'} nach sechs Wochen? Danach läuft das Szenario im Zeitraffer, und die Erklär-Karten zeigen, warum das Ergebnis so ausfällt.</p>
    <p><a class="knopflink" href="../?szenario=${p.id}">Szenario tippen und im Zeitraffer ansehen</a></p>
    <h2>Weitere Szenarien</h2>
    <ul>
${PROGNOSEN.filter((q) => q.id !== p.id).map((q) => `      <li><a href="${q.id}.html">${esc(q.name)}</a></li>`).join('\n')}
    </ul>
    <p>Mehr zu den Hintergründen: <a href="../lernen.html">Begriffe und Hintergründe</a>.</p>
`,
  });
  fs.writeFileSync(new URL(`../public/szenario/${p.id}.html`, import.meta.url), html);
}

// ---------- Unterricht: fertige Aufträge je Niveau mit Lernziel, Zeitbedarf und Link
const szenario = (id) => PROGNOSEN.find((p) => p.id === id);
const wetterName = (id) => WETTER.find((w) => w.id === id).name;
const AUFTRAEGE = {
  einstieg: [
    { titel: 'Silage an einem schönen Tag', zeit: '20 Minuten', link: '?niveau=einstieg&wetter=hoch',
      ziel: 'Den Tau abwarten, mähen und einfahren, sobald die Ampel grün ist. Die Lernenden erleben, dass Silage am gleichen Tag gelingen kann.',
      auftrag: `Wetter «${wetterName('hoch')}», Silage ins Flachsilo. Spielt eine Runde und schaut danach die vier Karten an: Was war gut, was geht besser?` },
    { titel: `Wette «${szenario('bilderbuch').name}»`, zeit: '15 Minuten', link: '?niveau=einstieg&szenario=bilderbuch',
      ziel: szenario('bilderbuch').lernziel,
      auftrag: 'Geschichte lesen, Ergebnis tippen, Zeitraffer anschauen. Vergleicht den Tipp mit dem Ergebnis.' },
    { titel: 'Heu braucht schöne Tage', zeit: '25 Minuten', link: '?niveau=einstieg&wetter=sommer',
      ziel: 'Bodenheu braucht mehrere schöne Tage und darf erst ganz trocken auf den Stock. Feuchtes Heu wird warm.',
      auftrag: `Wetter «${wetterName('sommer')}», unter «Silage oder Heu?» Bodenheu wählen. Folgt den Vorschlägen des Traktors und schaut am Schluss die Karte zum Heustock an.` },
    { titel: 'Am Heustock: Lüfter und Feuerwehr', zeit: '25 Minuten', link: '?niveau=einstieg&wetter=foehn',
      ziel: 'Die Belüftung trocknet das Heu im Stock fertig. Die Ampeln zeigen, ob die Luft Wasser mitnimmt und ob der Stock warm wird. Ab 60 Grad die Feuerwehr vorinformieren, ab 70 Grad alarmieren.',
      auftrag: `Wetter «${wetterName('foehn')}», Belüftungsheu wählen. Am Heustock den Lüfter einmal eine ganze Nacht ausschalten und beobachten, was die Ampel «Wärme im Heustock» macht. Wann schlägt der Traktor vor, die Feuerwehr zu rufen?` },
  ],
  praxis: [
    { titel: 'Klassenwettkampf: Gewitter am Tag 2', zeit: '30 Minuten', link: '?niveau=praxis&wetter=gewitter',
      ziel: 'Das Wetterfenster lesen und Maschinen sauber einstellen: Stoppelhöhe, Zinkenhöhe, Ablage. Wer schafft die meiste Energie im Trog vor dem Gewitter?',
      auftrag: 'Alle spielen mit demselben Link und tragen einen Namen ein. Danach vergleicht ihr die Punkte und besprecht die Karten der besten und der schwächsten Runde.' },
    { titel: `Wette «${szenario('tiefgemaeht').name}»`, zeit: '20 Minuten', link: '?niveau=praxis&szenario=tiefgemaeht',
      ziel: szenario('tiefgemaeht').lernziel,
      auftrag: 'Zuerst einzeln tippen (TS, Rohasche, Note), dann den Zeitraffer gemeinsam anschauen. Welche Fehler haben am meisten gekostet?' },
    { titel: 'Zufallswetter mit Klassencode', zeit: '30 Minuten', link: '?niveau=praxis&code=KLASSE1',
      ziel: 'Ein unbekanntes Wetter beurteilen und entscheiden: Silage oder Heu, und wann mähen? Mit dem Code bekommen alle dasselbe Wetter.',
      auftrag: 'Den Code im Link nach Belieben ändern (z. B. KLASSE2). Jede Gruppe begründet ihre Wahl von Lagerart und Mähzeitpunkt in zwei Sätzen.' },
    { titel: `Wette «${szenario('nest').name}»`, zeit: '25 Minuten', link: '?niveau=praxis&szenario=nest',
      ziel: szenario('nest').lernziel,
      auftrag: 'Tippen, Zeitraffer anschauen, dann den Zeitstrahl und die Karten «Einfüllen» und «Kontrolle» lesen. Wann war das Nest da, und warum hat es die Heusonde nicht gezeigt? Was hätte geholfen?' },
    { titel: 'Heubelüftung bedienen: Anlage, Einfüllen, Messen', zeit: '45 Minuten', link: '?niveau=praxis&wetter=gewitter',
      ziel: 'Eine Belüftungsanlage wählen, das Heu richtig einfüllen, täglich mit der Heusonde messen und wenn nötig umschichten. Vor dem Gewitter feucht einführen und trotzdem lagerfähiges Heu erreichen.',
      auftrag: 'Belüftungsheu wählen und im Abschnitt «Anlage» Lüfter und Warmluft festlegen. Zwei Runden spielen: einmal gleichmässig verteilt, einmal «abladen, wie es kommt». Vergleicht Zeitstrahl, Schimmel und Kosten je Tonne.' },
  ],
  profi: [
    { titel: 'Modell gegen Messung: Tänikon 2001', zeit: '45 Minuten', link: '?niveau=profi&szenario=taenikon',
      ziel: szenario('taenikon').lernziel,
      auftrag: 'Tippen, Zeitraffer anschauen, dann im Ergebnis die Rechenwege und «Modell gegen Messung» öffnen. Erklärt die Abweichung zwischen Spiel und Messung mit den Annahmen des Modells.' },
    { titel: 'Föhn: Bodenheu oder Belüftung?', zeit: '45 bis 60 Minuten', link: '?niveau=profi&wetter=foehn',
      ziel: szenario('heufoehn').lernziel,
      auftrag: 'Zwei Runden mit demselben Wetter spielen, einmal Bodenheu, einmal Belüftungsheu. Beide Runden als CSV herunterladen, die TS-Verläufe mit Strahlung und Dampfdruckdefizit darstellen und den Unterschied begründen.' },
    { titel: `Wette «${szenario('kleeheu').name}»`, zeit: '30 Minuten', link: '?niveau=profi&szenario=kleeheu',
      ziel: szenario('kleeheu').lernziel,
      auftrag: 'Im Ergebnis die Verlustbilanz und die Sinnenprüfung nachrechnen. Welcher Verlustposten ist der grösste, und welcher Arbeitsgang hätte ihn verringert?' },
    { titel: `Wette «${szenario('lueftermagnicht').name}»`, zeit: '30 Minuten', link: '?niveau=profi&szenario=lueftermagnicht',
      ziel: szenario('lueftermagnicht').lernziel,
      auftrag: 'Vor dem Zeitraffer den Druckbedarf von Hand schätzen (Stockhöhe × 240 Pa für Kleeheu + 120 Pa Dachabsaugung) und mit der Kennlinie des Standardlüfters vergleichen. Danach im Ergebnis Luftmenge, Zeitstrahl und Kosten ansehen: Was hätten ein starker Lüfter, eine grössere Box oder trockeneres Futter gebracht?' },
    { titel: 'Anlage auslegen und Kosten vergleichen', zeit: '60 Minuten', link: '?niveau=profi&wetter=gewitter&pannen=aus',
      ziel: 'Lüfter, Warmdach, Entfeuchter und Boxfläche auf Ertrag und Feuchte abstimmen, in Lagen einfüllen, nach Messkalender messen und die Kosten je Tonne Heu begründen.',
      auftrag: 'Drei Runden mit demselben Wetter und verschiedenen Anlagen spielen (zum Beispiel kleine Box mit starkem Lüfter gegen passende Box mit Warmdach). Im Ergebnis die Preise anpassen und die Kosten je Tonne vergleichen. Ohne «pannen=aus» im Link kommt eine Panne dazu (Stromausfall oder Sicherung), für alle in der Klasse dieselbe.' },
  ],
};
const unterricht = seite({
  pfad: 'unterricht.html', tiefe: 0,
  titel: 'Heureka im Unterricht: Aufträge für Einstieg, Praxis und Profi – Heureka',
  beschreibung: 'Fertige Aufträge mit Lernziel, Zeitbedarf und Link für das Lernspiel Heureka: drei Niveaus von EBA über EFZ und Betriebsleiterschule bis Höhere Fachschule und Hochschule.',
  krumen: [['Start', './'], ['Für Lehrpersonen']],
  h1: 'Heureka im Unterricht',
  inhalt: `
    <p>Heureka gibt es in drei Niveaus. Gerechnet wird in allen gleich, darum bleiben Punkte und Ranglisten vergleichbar. Unterschiedlich ist, wie viel die Lernenden einstellen, wie viele Zahlen und Erklärungen sie sehen und welche Aufgaben gestellt werden. Jeder Link unten setzt das Niveau und das passende Wetter oder Szenario. Schicken Sie ihn einfach an die Klasse.</p>
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>Niveau</th><th>Für wen</th><th>Was anders ist</th></tr></thead>
      <tbody>
${Object.values(NIVEAUS).map((n) => `        <tr><td><strong>${esc(n.name)}</strong></td><td>${esc(n.fuer)}</td><td>${esc(n.satz)}</td></tr>`).join('\n')}
      </tbody>
    </table></div>
${Object.entries(AUFTRAEGE).map(([id, liste]) => `
    <h2 id="${id}">${esc(NIVEAUS[id].name)}: ${esc(NIVEAUS[id].fuer)}</h2>
${liste.map((a) => `    <div class="auftrag">
      <h3>${esc(a.titel)}</h3>
      <p><strong>Lernziel:</strong> ${esc(a.ziel)}</p>
      <p><strong>Auftrag:</strong> ${esc(a.auftrag)}</p>
      <p><strong>Zeitbedarf:</strong> ${esc(a.zeit)}</p>
      <p><a class="knopflink" href="./${a.link}">Link öffnen</a> <code>${esc(BASIS + a.link)}</code></p>
    </div>`).join('\n')}`).join('\n')}

    <h2 id="wettkampf">Klassenwettkampf: kurz erklärt</h2>
    <ul>
      <li><strong>Gleiches Wetter für alle:</strong> eine feste Wetterlage (<code>?wetter=gewitter</code>) oder ein Zufallswetter mit Code (<code>?code=KLASSE1</code>). Mit <code>?niveau=</code> kombinierbar, zum Beispiel <code>?niveau=praxis&amp;code=KLASSE1</code>.</li>
      <li><strong>Namen eintragen:</strong> Wer unter «Silage oder Heu?» einen Namen oder Teamnamen einträgt, erscheint in der Rangliste, zusammen mit dem Niveau.</li>
      <li><strong>Die Rangliste ist nur lokal:</strong> Sie liegt im Browser des jeweiligen Geräts. Für einen Wettkampf über mehrere Geräte nennen die Lernenden ihre Punkte, oder alle spielen nacheinander am Beamer-Rechner.</li>
      <li><strong>Vergleichbar über die Niveaus:</strong> Das Rechenmodell ist überall gleich. Im Einstieg sind Wiese und Maschinen sinnvoll voreingestellt; wer dort gut spielt, erreicht dieselben Punkte wie im Praxis-Niveau mit gleichen Entscheidungen.</li>
      <li><strong>Ohne Zeitdruck:</strong> Im Einstieg läuft die Zeit nur auf Knopfdruck (ruhiger Modus). In den anderen Niveaus lässt sich das im Einsatz unter «Wie willst du spielen?» wählen.</li>
      <li><strong>Nachbesprechen:</strong> Die Erklärkarten im Ergebnis zeigen, was gut war und was besser geht. Im Profi-Niveau stehen zusätzlich die Rechenwege, ein Datenexport (CSV) und Aufgaben zum Begründen.</li>
    </ul>
    <p>Hintergründe zu allen Themen: <a href="lernen.html">Begriffe und Hintergründe</a>. Szenarien zum Vorbereiten: <a href="szenario/bilderbuch.html">Szenarioseiten</a>.</p>
    <p class="hinweis">Lehrpersonen mit Zugang zur Administration von Futter v2 sehen im Ergebnis von Runden mit Belüftungsheu zusätzlich Musterlösungen (günstigste und beste gefundene Variante, zum Abspielen am Beamer). <a href="/futter/v2/anmelden">Anmelden</a></p>
`,
});
fs.writeFileSync(new URL('../public/unterricht.html', import.meta.url), unterricht);

// ---------- Sitemap
const urls = ['', 'lernen.html', 'unterricht.html', ...PROGNOSEN.map((p) => `szenario/${p.id}.html`)];
fs.writeFileSync(new URL('../public/sitemap.xml', import.meta.url), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${BASIS}${u}</loc><lastmod>${HEUTE}</lastmod></url>`).join('\n')}
</urlset>
`);
console.log('Seiten erzeugt:', urls.length);

// ---------- Service Worker: alle statischen Dateien vorab laden, damit die App auch ohne Netz startet
const wurzel = new URL('../public/', import.meta.url);
const dateien = [];
(function sammle(ordner, praefix) {
  for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
    // js/muster/ (Musterlösungen für Superuser) wird nur nach bestätigter Sitzung geladen und nie zwischengespeichert
    if (e.isDirectory()) { if (`${praefix}${e.name}/` !== 'js/muster/') sammle(new URL(`${e.name}/`, ordner), `${praefix}${e.name}/`); }
    else if (e.name !== 'sw.js') dateien.push(`${praefix}${e.name}`);
  }
})(wurzel, '');
dateien.sort();
// Version aus dem Inhalt aller Dateien: jede Änderung lädt den Cache neu, auch mehrmals am selben Tag
const hash = crypto.createHash('sha256');
for (const d of dateien) hash.update(d).update(fs.readFileSync(new URL(d, wurzel)));
const version = `drysim-${HEUTE}-${hash.digest('hex').slice(0, 10)}`;
fs.writeFileSync(new URL('sw.js', wurzel), `// Automatisch erzeugt von tools/seiten.mjs – nicht von Hand ändern
const CACHE = '${version}';
const DATEIEN = ['./', ${dateien.map((d) => `'${d}'`).join(', ')}];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Aus dem Cache antworten und im Hintergrund erneuern (stale-while-revalidate)
self.addEventListener('fetch', (e) => {
  const r = e.request, url = new URL(r.url);
  if (r.method !== 'GET' || url.origin !== location.origin) return;
  // Nur die eigenen Dateien; nicht die Sitzungsabfrage von Futter v2 und nicht das Suchmodul für Superuser
  const basis = new URL('./', self.registration.scope).pathname;
  if (!url.pathname.startsWith(basis) || url.pathname.startsWith(basis + 'js/muster/')) return;
  const schluessel = r.mode === 'navigate' ? new Request(url.origin + url.pathname) : r; // ?code=… und ?szenario=… teilen sich eine Seite
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const treffer = await c.match(schluessel);
    const netz = fetch(r).then((res) => { if (res.ok) c.put(schluessel, res.clone()); return res; }).catch(() => treffer);
    return treffer || netz;
  }));
});
`);
console.log('Service Worker:', version);
