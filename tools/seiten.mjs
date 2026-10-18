// Erzeugt die statischen, von Suchmaschinen lesbaren Seiten aus den Daten des Spiels:
// public/lernen.html, public/szenario/<id>.html und public/sitemap.xml
//   docker run --rm -v "$PWD":/app -w /app node:22-alpine node tools/seiten.mjs
import fs from 'node:fs';
import { WETTER, PROGNOSEN } from '../public/js/scenarios.js';
import { BESTAENDE, SILOARTEN, STADIEN, AUFBEREITER } from '../public/js/model.js';
import { BEGRIFFE } from '../public/js/begriffe.js';

const BASIS = 'https://apps.graswachstum.ch/drysim/';
const HEUTE = new Date().toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const zahl = (x) => String(x).replace('.', ',');

function seite({ pfad, tiefe, titel, beschreibung, krumen, h1, inhalt }) {
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
  <script src="${hoch}js/boot.js"></script>
</head>
<body>
  <a class="skip" href="#inhalt">Zum Inhalt</a>
  <header class="kopf">
    <a class="logo" href="${hoch}" aria-label="Silage-Simulator, zum Spiel">
      <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="14" width="22" height="28" rx="3" fill="#2e7d32"/><path d="M8 14 Q19 2 30 14Z" fill="#8a3b2a"/><ellipse cx="36" cy="38" rx="10" ry="5" fill="#a3a843"/></svg>
      <span><b>Silage-Simulator</b><small>Lernspiel Futterkonservierung</small></span>
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
const QUELLEN = [
  ['UW–Madison Extension: Field drying forage for hay and haylage', 'https://dairy.extension.wisc.edu/articles/field-drying-forage-for-hay-and-haylage'],
  ['UW Forage: Swath Drying (Merkblatt, PDF)', 'https://fyi.extension.wisc.edu/forage/files/2014/01/SwathDrying-FOF.pdf'],
  ['Undersander: Harvest Strategies (Alfalfa Symposium 2013, PDF)', 'https://alfalfasymposium.ucdavis.edu/+symposium/proceedings/2013/13WAS-27_Undersander_HarvestStrategies.pdf'],
  ['top agrar: Gras zügig trocken – geht das nur mit Aufbereiter?', 'https://www.topagrar.com/technik/news/krone-maehwerke-gras-zuegig-trocken-geht-das-nur-mit-aufbereiter-12748796.html'],
  ['Agrartechnik (Universität Hohenheim): Halmgutaufbereitung auf dem Feld', 'https://440ejournals.uni-hohenheim.de/index.php/agrartechnik/article/view/2620/2352'],
  ['LfL Bayern / AGGF 2016: Grassilage, TM-Gehalt (Pickert et al., PDF)', 'https://lfl.bayern.de/mam/cms07/ipz/dateien/aggf_2016_pickert_et_al.pdf'],
];
const lernen = seite({
  pfad: 'lernen.html', tiefe: 0,
  titel: 'Futterkonservierung verstehen: Anwelken, Atmung, Erde und Gärqualität – Silage-Simulator',
  beschreibung: 'Wie gute Silage entsteht: Anwelken auf 30 bis 40 % TS, Breitablage, Zucker schonen, sauber arbeiten und die Gärqualität bewerten. Mit Begriffserklärungen.',
  krumen: [['Start', './'], ['Lernen']],
  h1: 'Futterkonservierung verstehen',
  inhalt: `
    <p>Silage entsteht, wenn Milchsäurebakterien im luftdichten Silo den Zucker des Futters zu Milchsäure vergären. Der pH-Wert sinkt, und das Futter wird haltbar. Ob das gelingt, entscheidet sich zu einem grossen Teil schon auf dem Feld. Diese Seite erklärt, was im <a href="./">Silage-Simulator</a> passiert und warum.</p>
    <div class="infobox"><p><strong>Wichtig:</strong> Das Spiel rechnet mit einem vereinfachten Lehrmodell. Es zeigt Zusammenhänge und Grössenordnungen, ist aber keine Prognose für einen Betrieb.</p></div>
    <nav aria-label="Inhalt dieser Seite"><ul>
      <li><a href="#anwelken">Warum anwelken?</a></li>
      <li><a href="#trocknung">Schnell trocknen: erst breit ablegen, dann aufbereiten</a></li>
      <li><a href="#zucker">Zucker schonen: Atmung, Tau und Regen</a></li>
      <li><a href="#sauber">Sauber arbeiten: Schnitthöhe, Zinken und Erde</a></li>
      <li><a href="#zetten">Zetten und Schwaden: Blätter schonen</a></li>
      <li><a href="#gaerung">Gärqualität bewerten: Labor oder Prozess?</a></li>
      <li><a href="#begriffe">Begriffe kurz erklärt</a></li>
      <li><a href="#quellen">Quellen</a></li>
    </ul></nav>

    <h2 id="anwelken">Warum anwelken?</h2>
    <p>Frisches Gras besteht zu über 80 % aus Wasser, also zu weniger als 20 % aus Trockensubstanz (<abbr title="Trockensubstanz">TS</abbr>). Zu nasses Futter siliert schlecht: Der Zucker ist verdünnt, es fliesst Sickersaft ab, und Buttersäurebakterien (Clostridien) haben leichtes Spiel. Zu trockenes Futter lässt sich dagegen schlecht verdichten. Dann bleibt Luft im Silo, es erwärmt sich und schimmelt.</p>
    <ul>
      <li><strong>Flachsilo:</strong> Ziel ${SILOARTEN.flachsilo.ziel[0]} bis ${SILOARTEN.flachsilo.ziel[1]} % TS</li>
      <li><strong>Rundballen:</strong> Ziel ${SILOARTEN.ballen.ziel[0]} bis ${SILOARTEN.ballen.ziel[1]} % TS</li>
    </ul>
    <p>Die <abbr title="Landesanstalt für Landwirtschaft Bayern">LfL Bayern</abbr> nennt für Grassilage meist 30 bis 40 % TM als Optimum. Wie gut sich Futter silieren lässt, beschreibt der Vergärbarkeitskoeffizient <abbr title="Vergärbarkeitskoeffizient">FK</abbr>: Er verbindet TS, Zucker und Pufferkapazität. Ein FK über 45 gilt als gut silierbar. Klee hat viel Pufferkapazität und wenig Zucker, braucht deshalb mehr TS als Gras.</p>

    <h2 id="trocknung">Schnell trocknen: erst breit ablegen, dann aufbereiten</h2>
    <p>Das Anwelken läuft in zwei Phasen:</p>
    <ol>
      <li><strong>Erste Phase (rund eine Stunde):</strong> Die Pflanze verdunstet Wasser über die Spaltöffnungen (<abbr title="Spaltöffnungen">Stomata</abbr>). Sie schliessen sich nach dem Schnitt aber schnell. Der Aufbereiter hält sie nicht offen.</li>
      <li><strong>Zweite Phase:</strong> Das Wasser muss durch die Wachsschicht (<abbr title="Wachsschicht">Kutikula</abbr>) und aus den Stängeln nach aussen. Hier hilft der Aufbereiter, weil er die Wachsschicht verletzt.</li>
    </ol>
    <p>Wichtiger als der Aufbereiter ist die Ablage. In Versuchen der Universität Wisconsin erreichte Luzerne in Breitablage auf mehr als 70 % der Fläche nach rund 8 bis 10 Stunden etwa 65 % Feuchte, also rund 35 % TS. In einer schmalen Schwade war das Futter erst am Folgetag so weit. Die Beratung empfiehlt, das Futter auf 80 bis 100 % der Schnittbreite abzulegen. Die Versuche stammen aus den USA und von Luzerne, die Zeiten lassen sich nicht eins zu eins auf Gras in der Schweiz übertragen.</p>
    <p>In Deutschland gilt die «24-Stunden-Silage» mit rund 35 % TS als Ziel. Ältere Untersuchungen in der Zeitschrift Agrartechnik sehen den Effekt von Rotoraufbereitern bis etwa 60 % TS am grössten.</p>
    <div class="infobox"><p><strong>Im Spiel:</strong> Breitablage und ein früher Zettdurchgang bringen das Futter am gleichen Tag in den Zielbereich. Eine dichte Mähschwade ohne Zetten braucht bis zum nächsten Tag.</p></div>

    <h2 id="zucker">Zucker schonen: Atmung, Tau und Regen</h2>
    <p>Gemähte Pflanzen leben noch eine Weile weiter und veratmen dabei Zucker, bis sie etwa 60 % TS erreichen. Je wärmer es ist und je länger das Futter liegt, desto mehr Zucker geht verloren. Ziel ist eine kurze Feldliegezeit, am besten unter 24 Stunden. Der Zucker fehlt später den Milchsäurebakterien.</p>
    <p>Nachts nimmt das Futter Tau auf. Am Morgen muss dieses Wasser zuerst verdunsten, bevor die Pflanze selbst weiter trocknet. Regen macht den Trocknungsfortschritt zunichte und wäscht zusätzlich Zucker und Mineralstoffe aus. Aufbereitetes Futter mit verletzter Wachsschicht nimmt Wasser schneller auf und verliert mehr.</p>

    <h2 id="sauber">Sauber arbeiten: Schnitthöhe, Zinken und Erde</h2>
    <p>Sauberes Futter hat etwa 90 g Rohasche je kg TS. Alles deutlich darüber ist meistens Erde. Ab etwa 100 g steigt die Gefahr einer Buttersäuregärung, besonders bei nassem Futter. Mit der Erde gelangen Clostridien-Sporen ins Silo. Diese Bakterien bilden Buttersäure. Das macht die Silage stinkend und gefährdet die Käsereitauglichkeit der Milch.</p>
    <ul>
      <li><strong>Schnitthöhe:</strong> Unter 6 cm kommt deutlich mehr Erde ins Futter. Über 7 cm lässt man Ertrag stehen, im Spiel rund 4 % je Zentimeter. Die Stoppeln tragen dafür das Schwad und lassen es luftiger liegen.</li>
      <li><strong>Zinkenhöhe:</strong> Sie wird auf festem, ebenem Boden eingestellt. Auf dem Feld sinken die Räder ein, auf nassem Boden stärker, die Zinken laufen also tiefer. Unter etwa 2 cm reissen sie Erde mit.</li>
      <li><strong>Futter bleibt liegen:</strong> Das Schwad liegt auf den niedergedrückten Stoppeln. Stehen die Zinken darüber, bleibt Futter liegen. Bei hohen Stoppeln darf die Einstellung höher sein.</li>
      <li><strong>Maulwurfshaufen</strong> und ein nasser Boden verstärken das Problem.</li>
    </ul>

    <h2 id="zetten">Zetten und Schwaden: Blätter schonen</h2>
    <p>Zetten lockert das Futter und dreht die feuchte Unterseite nach oben. Am wirksamsten ist ein Durchgang kurz nach dem Mähen. Je trockener das Futter wird, desto mehr bröckelt beim Zetten und Schwaden ab. Bei Klee sind das die eiweissreichen Blätter. Zetten und Schwaden ist daher am besten, solange das Futter noch unter etwa 40 % TS hat.</p>

    <h2 id="gaerung">Gärqualität bewerten: Labor oder Prozess?</h2>
    <p>Der DLG-Schlüssel bewertet Silage im Nachhinein mit Laborwerten: Buttersäure, Essigsäure und pH-Wert ergeben bis 100 Punkte. In der Schweizer Beratung steht häufiger der Prozess im Vordergrund: Wurde alles richtig gemacht, damit die Silage gut werden musste? Vorbeugen ist besser als Korrigieren, und bei guten Bedingungen sind Siliermittel meist nicht nötig. Das Spiel zeigt beides: Am Schluss steht die Note, und die Erklär-Karten zeigen die Arbeitsschritte, die dazu geführt haben.</p>

    <h2 id="begriffe">Begriffe kurz erklärt</h2>
    <dl>
${BEGRIFFE.map((b) => `      <dt>${esc(b.begriff)} <small>(${esc(b.lang)})</small></dt>\n      <dd>${esc(b.text)}</dd>`).join('\n')}
    </dl>

    <h2 id="quellen">Quellen</h2>
    <ul>
${QUELLEN.map(([t, u]) => `      <li><a href="${u}" rel="noopener">${esc(t)}</a></li>`).join('\n')}
      <li>Rotz, C. A.; Chen, Y. (1985): Alfalfa drying model for the field environment. Transactions of the ASAE 28. (Grundlage der Trocknungsrechnung im Spiel)</li>
    </ul>

    <h2>Jetzt ausprobieren</h2>
    <p><a class="knopflink" href="./">Silage-Simulator starten</a></p>
    <p>Oder zuerst ein Szenario ansehen:</p>
    <ul>
${PROGNOSEN.map((p) => `      <li><a href="szenario/${p.id}.html">${esc(p.name)}</a></li>`).join('\n')}
    </ul>
`,
});
fs.writeFileSync(new URL('../public/lernen.html', import.meta.url), lernen);

// ---------- Szenarioseiten
fs.mkdirSync(new URL('../public/szenario/', import.meta.url), { recursive: true });
const sonne = (s) => (s >= 0.8 ? 'sonnig' : s >= 0.45 ? 'wechselnd bewölkt' : 'bewölkt');
for (const p of PROGNOSEN) {
  const w = WETTER.find((x) => x.id === p.wetter);
  const mm = (t) => (t.regen ?? []).reduce((a, r) => a + r.mm, 0);
  const html = seite({
    pfad: `szenario/${p.id}.html`, tiefe: 1,
    titel: `Szenario «${p.name}»: Wie wird die Silage? – Silage-Simulator`,
    beschreibung: `${p.lernziel} Lies das Szenario, tippe das Ergebnis und schau den Zeitraffer an.`,
    krumen: [['Start', '../'], ['Lernen', '../lernen.html'], [`Szenario ${p.name}`]],
    h1: `Szenario «${p.name}»`,
    inhalt: `
    <p><strong>Darum geht es:</strong> ${esc(p.lernziel)}</p>
    <div class="infobox"><p>${esc(p.text)}</p></div>
    <h2>Ausgangslage</h2>
    <ul>
      <li><strong>Wiese:</strong> ${esc(BESTAENDE[p.plan.bestand].name)}, Stadium ${esc(STADIEN[p.plan.stadium].name)}, ${p.plan.ertrag} dt TS/ha</li>
      <li><strong>Maschinen:</strong> ${esc(AUFBEREITER[p.plan.aufbereiter].name)}, Schnitthöhe ${zahl(p.plan.schnitthoehe)} cm, ${p.plan.breit || AUFBEREITER[p.plan.aufbereiter].breit ? 'Breitablage' : 'Mähschwade'}</li>
      <li><strong>Ziel:</strong> ${esc(SILOARTEN[p.plan.siloart].name)}, ${SILOARTEN[p.plan.siloart].ziel[0]} bis ${SILOARTEN[p.plan.siloart].ziel[1]} % TS</li>
    </ul>
    <h2>Wetter: ${esc(w.name)}</h2>
    <p>${esc(w.info)}.</p>
    <ul>
${w.tage.map((t, i) => `      <li><strong>Tag ${i + 1}:</strong> ${Math.round(t.tmin)} bis ${Math.round(t.tmax)} °C, ${sonne(t.sonne)}, ${mm(t) > 0 ? `${Math.round(mm(t))} mm Regen` : 'kein Regen'}</li>`).join('\n')}
    </ul>
    <h2>Was du tippst</h2>
    <p>Wie hoch ist die TS beim Einfahren? Wie viel Rohasche steckt im Futter? Und welche Gärqualität (Note 1 bis 5) hat die Silage nach sechs Wochen? Danach läuft das Szenario im Zeitraffer, und die Erklär-Karten zeigen, warum das Ergebnis so ausfällt.</p>
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

// ---------- Sitemap
const urls = ['', 'lernen.html', ...PROGNOSEN.map((p) => `szenario/${p.id}.html`)];
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
    if (e.isDirectory()) sammle(new URL(`${e.name}/`, ordner), `${praefix}${e.name}/`);
    else if (e.name !== 'sw.js') dateien.push(`${praefix}${e.name}`);
  }
})(wurzel, '');
dateien.sort();
const version = `drysim-${HEUTE}-${dateien.length}`;
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
  const schluessel = r.mode === 'navigate' ? new Request(url.origin + url.pathname) : r; // ?code=… und ?szenario=… teilen sich eine Seite
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const treffer = await c.match(schluessel);
    const netz = fetch(r).then((res) => { if (res.ok) c.put(schluessel, res.clone()); return res; }).catch(() => treffer);
    return treffer || netz;
  }));
});
`);
console.log('Service Worker:', version);
