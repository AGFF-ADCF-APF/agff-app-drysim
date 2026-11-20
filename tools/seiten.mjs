// Erzeugt die statischen, von Suchmaschinen lesbaren Seiten aus den Daten des Spiels:
// public/lernen.html, public/szenario/<id>.html und public/sitemap.xml
//   docker run --rm -v "$PWD":/app -w /app node:22-alpine node tools/seiten.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import { WETTER, PROGNOSEN } from '../public/js/scenarios.js';
import { BESTAENDE, SILOARTEN, STADIEN, AUFBEREITER } from '../public/js/model.js';
import { BEGRIFFE } from '../public/js/begriffe.js';

const BASIS = 'https://apps.graswachstum.ch/heureka/';
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
];
const QUELLEN_USA = [
  ['UW–Madison Extension: Field drying forage for hay and haylage', 'https://dairy.extension.wisc.edu/articles/field-drying-forage-for-hay-and-haylage'],
  ['UW Forage: Swath Drying (Merkblatt, PDF)', 'https://fyi.extension.wisc.edu/forage/files/2014/01/SwathDrying-FOF.pdf'],
  ['Undersander: Harvest Strategies (Alfalfa Symposium 2013, PDF)', 'https://alfalfasymposium.ucdavis.edu/+symposium/proceedings/2013/13WAS-27_Undersander_HarvestStrategies.pdf'],
];
const lernen = seite({
  pfad: 'lernen.html', tiefe: 0,
  titel: 'Futterkonservierung verstehen: Anwelken, Atmung, Erde, Gärqualität und Heu – Heureka',
  beschreibung: 'Wie gute Silage und gutes Heu entstehen: Anwelken, Breitablage, Aufbereiter, Zetten, Heu ab 87 bis 88 % TS, Belüftung und Heustock-Kontrolle. Nach Unterlagen aus Österreich, der Schweiz und Deutschland.',
  krumen: [['Start', './'], ['Lernen']],
  h1: 'Futterkonservierung verstehen',
  inhalt: `
    <p>Silage entsteht, wenn Milchsäurebakterien im luftdichten Silo den Zucker des Futters zu Milchsäure vergären. Der pH-Wert sinkt, und das Futter wird haltbar. Ob das gelingt, entscheidet sich zu einem grossen Teil schon auf dem Feld. Diese Seite erklärt, was im <a href="./">Lernspiel Heureka</a> passiert und warum.</p>
    <div class="infobox"><p><strong>Woher die Zahlen kommen:</strong> Begriffe und Richtwerte stützen sich in erster Linie auf Fachunterlagen aus Österreich, der Schweiz und Deutschland: den Praxisratgeber «Heutrocknung von A bis Z» (<strong>LK Salzburg</strong>), die «Richtlinien für Heubelüftungsanlagen» (<strong>Agroscope 2014</strong>) und das «ABC der Heubelüftung» (<strong>FAT 1982</strong>). Versuche aus den USA ergänzen sie. Das Spiel selbst rechnet mit einem vereinfachten Lehrmodell: Es zeigt Zusammenhänge und Grössenordnungen, ist aber keine Prognose für einen Betrieb.</p></div>
    <nav aria-label="Inhalt dieser Seite"><ul>
      <li><a href="#anwelken">Warum anwelken?</a></li>
      <li><a href="#trocknung">Schnell trocknen: erst breit ablegen, dann aufbereiten</a></li>
      <li><a href="#zucker">Zucker schonen: Atmung, Tau und Regen</a></li>
      <li><a href="#sauber">Sauber arbeiten: Schnitthöhe, Zinken und Erde</a></li>
      <li><a href="#zetten">Zetten und Schwaden: Blätter schonen</a></li>
      <li><a href="#gaerung">Gärqualität bewerten: Labor oder Prozess?</a></li>
      <li><a href="#heu">Heu: Bodenheu, Heuballen oder Belüftung</a></li>
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

    <h2 id="sauber">Sauber arbeiten: Schnitthöhe, Zinken und Erde</h2>
    <p>Sauberes Futter hat etwa 90 g Rohasche je kg TS. Alles deutlich darüber ist meistens Erde. Ab 10 % (100 g je kg TS) ist bei Silage mit einer explosionsartigen Vermehrung der Buttersäurebakterien zu rechnen, vor allem bei starker Verschmutzung und ungenügendem Anwelken (LK Salzburg). Die Sporen stammen aus dem Boden und gelangen mit jeder Futterverschmutzung ins Silo. Zu tiefes Mähen, lückige Bestände, Narbenverletzungen und sporenhaltige Humusteilchen sind die Hauptursachen. Clostridien bilden Buttersäure: Das macht die Silage stinkend, und sie gefährden die Hartkäseherstellung (Lochung, Risse im Teig). Gute Milch enthält unter 200 Sporen je Liter. Heu enthält nahezu keine sporenbildenden Bakterien, das ist für Hartkäse- und Heumilch entscheidend (Agroscope 2014; LK Salzburg).</p>
    <ul>
      <li><strong>Schnitthöhe:</strong> Mindestens 5 bis 7 cm vom Boden aus gemessen sollen stehen bleiben, teils wird auf 8 bis 9 cm gemäht (LK Salzburg). Tiefe Schnitte schaden dem nächsten Aufwuchs: Die Pflanze verliert ihr grünes Assimilationsgewebe und muss aus den Wurzelreserven nachschieben, und das viele Licht am Boden fördert die Keimung von Ampfer. Eine richtige Schnitthöhe bringt weniger Erde im Futter, eine bessere Feldtrocknung durch den grösseren Abstand zum Boden, eine dichte Grasnarbe und einen rascheren Folgeaufwuchs. Im Spiel kommt unter 6 cm deutlich mehr Erde ins Futter, und über 7 cm bleiben rund 4 % Ertrag je Zentimeter stehen.</li>
      <li><strong>Zinkenhöhe:</strong> Sie wird auf festem, ebenem Boden eingestellt. Auf dem Feld sinken die Räder ein, auf nassem Boden stärker, die Zinken laufen also tiefer. Unter etwa 2 cm reissen sie im Spiel Erde mit. Kleine Kreiseldurchmesser und eine flache Kreiselstellung passen sich dem Boden besser an (LK Salzburg; Agroscope 2014).</li>
      <li><strong>Futter bleibt liegen:</strong> Das Schwad liegt auf den niedergedrückten Stoppeln. Stehen die Zinken darüber, bleibt Futter liegen. Bei hohen Stoppeln darf die Einstellung höher sein. Doppelkreiselschwader mit Mittelablage schleifen das Futter weniger über den Boden (LK Salzburg).</li>
      <li><strong>Maulwurfshaufen</strong> und ein nasser Boden verstärken das Problem.</li>
    </ul>

    <h2 id="zetten">Zetten und Schwaden: Blätter schonen</h2>
    <p>Zetten lockert das Futter und verteilt es breit. Am ersten Tag nach dem Mähen kann der Kreiselzettwender mehrmals eingesetzt werden, jeder Arbeitsgang kostet aber Blätter. Mit zunehmender Trocknung, bei Heu über 60 % TM, steigen die Bröckelverluste überproportional. Am zweiten Tag wird das Futter deshalb nur noch wenig bearbeitet. Bei kräuterreichen Beständen und Bodenheu können es bis 100 kg TM je ha und Arbeitsgang sein (LK Salzburg). Bei Klee sind das die eiweissreichen Blätter. Im Spiel steigen die Bröckelverluste ab etwa 35 % TS spürbar.</p>
    <p>Empfohlen werden zwei bis höchstens drei Durchgänge mit abnehmender Drehzahl und zunehmender Schonung. Die Durchgänge erfolgen abwechselnd längs und quer, und der Kreisel steht beim Wenden eher flach:</p>
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>Durchgang</th><th>Zapfwellendrehzahl LK Salzburg</th><th>Zapfwellendrehzahl Agroscope 2014</th></tr></thead>
      <tbody>
        <tr><td>1. (Zetten)</td><td>540 U/min</td><td>rund 500 U/min bei 6 bis 8 km/h</td></tr>
        <tr><td>2. (Wenden)</td><td>400 U/min</td><td>380 bis 420 U/min</td></tr>
        <tr><td>3. (Wenden)</td><td>320 U/min</td><td>340 bis 400 U/min</td></tr>
      </tbody>
    </table></div>
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
    <p>Wie feucht das Futter beim Einfahren höchstens sein darf, hängt vom Trocknungsverfahren ab (nach Wirleitner, in LK Salzburg):</p>
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
    <p><strong>Erwärmung und Brandgefahr:</strong> Auch scheinbar trockenes Heu atmet nach dem Einlagern noch und erzeugt Wärme und Feuchte. Ohne Belüftung ist eine Eigenerwärmung bis 40 bis 45 °C normal; diese Fermentationsphase mit Schwitzwasser ist nach vier bis sechs Wochen vorbei, bei feucht eingebrachtem, verdichtetem oder sehr jungem Futter dauert sie länger. Hauptursachen für Selbstentzündung sind angeregnetes Heu, hohe Restfeuchte, zu rasche Ernte von sehr jungem blattreichem Futter, verschmutztes Futter und zu dichte Lagerung. Der Heustock wird bis zu zwölf Wochen mit der Heusonde gemessen («Heumesskalender»): in den ersten Tagen täglich, in der 2. bis 4. Woche alle zwei bis drei Tage, danach einmal wöchentlich, mit Messstellen höchstens 1,5 m voneinander entfernt (LK Salzburg).</p>
    <div class="tabelle"><table class="zahlen">
      <thead><tr><th>Temperatur im Stock</th><th>Was zu tun ist</th><th>Verluste an Energie / nutzbarem Protein</th></tr></thead>
      <tbody>
        <tr><td>unter 40 °C</td><td>normal</td><td>2 bis 5 % / 2 bis 5 %</td></tr>
        <tr><td>45 bis 60 °C</td><td>Gefahr: Kontrollen verstärken</td><td>bei 50 °C: 10 bis 15 % / 20 bis 25 %</td></tr>
        <tr><td>60 bis 70 °C</td><td>alle fünf Stunden messen, Stock nicht abtragen</td><td>bei 60 °C: 15 bis 20 % / 40 bis 55 %</td></tr>
        <tr><td>über 70 °C oder Mulde im Stock</td><td>sofort die Feuerwehr (Heuwehr) rufen</td><td>bei 70 °C: 30 bis 35 % / 70 bis 80 %</td></tr>
      </tbody>
    </table></div>
    <p>Einen heissen Heustock niemals selbst abtragen: Luftsauerstoff und Hitze führen unweigerlich zum Brand. Erkennungsmerkmale sind Schwitzwasser, ein seltsam süsslicher Geruch, ein Temperaturanstieg über 50 °C und eine muldenförmige Einbuchtung (Verluste nach Philipsen 1965, in LK Salzburg). Bei der Kaltbelüftung gilt zudem: Stocktemperaturen über 35 °C im Intervallbetrieb beachten (Agroscope 2014).</p>
    <p><strong>Sonne und Regen:</strong> Trockenes Heu, das lange in der Sonne liegt, bleicht aus und verliert Vitamine (Carotin). Regen und Tau waschen aus, 1 bis 5 % und mehr (LK Salzburg). Gutes Heu riecht aromatisch, ist grünlich, blattreich und sauber. Das Spiel bewertet Heu nach Geruch, Farbe, Gefüge (Blätter) und Verunreinigung, angelehnt an die Sinnenprüfung und vereinfacht.</p>
    <div class="infobox"><p><strong>Im Spiel:</strong> Bei Hochdruck ist Bodenheu am Nachmittag des dritten Tages lagerfähig. Reicht das Wetterfenster nicht, rettet die Belüftung das Futter.</p></div>

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
      <li><strong>Maschinen:</strong> ${esc(AUFBEREITER[p.plan.aufbereiter].name)}, Schnitthöhe ${zahl(p.plan.schnitthoehe)} cm, ${p.plan.breit || AUFBEREITER[p.plan.aufbereiter].breit ? 'Breitablage' : 'Mähschwade'}</li>
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
  const schluessel = r.mode === 'navigate' ? new Request(url.origin + url.pathname) : r; // ?code=… und ?szenario=… teilen sich eine Seite
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const treffer = await c.match(schluessel);
    const netz = fetch(r).then((res) => { if (res.ok) c.put(schluessel, res.clone()); return res; }).catch(() => treffer);
    return treffer || netz;
  }));
});
`);
console.log('Service Worker:', version);
