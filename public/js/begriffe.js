// Fachbegriffe kurz erklärt: für Tipp-Erklärungen (<abbr>) und den Begriffe-Dialog

export const BEGRIFFE = [
  { begriff: 'TS', lang: 'Trockensubstanz', text: 'Was vom Futter übrig bleibt, wenn man das Wasser abzieht. 35 % TS heisst: 100 kg Futter enthalten 35 kg Trockenes und 65 kg Wasser. In Deutschland und Österreich sagt man TM (Trockenmasse).' },
  { begriff: 'TM', lang: 'Trockenmasse', text: 'Dasselbe wie TS. In Deutschland und Österreich üblich; in der Schweiz steht meist TS.' },
  { begriff: 'Rohasche', lang: 'Mineralstoffe und Erde', text: 'Alles, was beim Verbrennen übrig bleibt. Sauberes Futter hat etwa 90 g pro kg TS. Über 100 g (10 %) bedeutet: Erde im Futter, und die Gefahr einer Buttersäuregärung steigt deutlich.' },
  { begriff: 'NEL', lang: 'Netto-Energie Laktation', text: 'Mass für die Energie im Futter, die eine Milchkuh in Milch umsetzen kann (MJ NEL pro kg TS).' },
  { begriff: 'FK', lang: 'Vergärbarkeitskoeffizient', text: 'Rechenwert aus TS, Zucker und Pufferkapazität. Ab 45 lässt sich Futter sicher ohne Buttersäure silieren.' },
  { begriff: 'DLG', lang: 'DLG-Schlüssel', text: 'Deutsches Punkteschema, das die Gärqualität mit Laborwerten (Buttersäure, Essigsäure, pH) bewertet. 100 Punkte sind das Maximum.' },
  { begriff: 'Stomata', lang: 'Spaltöffnungen', text: 'Kleine Atemöffnungen der Blätter. Nach dem Schnitt schliessen sie sich innerhalb etwa einer Stunde.' },
  { begriff: 'Kutikula', lang: 'Wachsschicht', text: 'Wachsschicht auf Blättern und Stängeln. Sie hält das Wasser in der Pflanze, bremst also das Anwelken. Aufbereiter verletzen sie absichtlich.' },
  { begriff: 'Clostridien', lang: 'Buttersäurebakterien', text: 'Bakterien aus der Erde, die im Silo Buttersäure bilden. Sie machen Silage stinkend und vertragen sich schlecht mit Käsereimilch.' },
  { begriff: 'Pufferkapazität', lang: 'Säure-Widerstand', text: 'Wie stark sich das Futter gegen das Absinken des pH-Werts wehrt. Klee hat viel davon, deshalb braucht er mehr Zucker oder mehr TS.' },
  { begriff: 'Siliermittel', lang: 'Zusatz zum Silieren', text: 'Zusätze, die die Gärung in eine gute Richtung lenken. Bei guten Bedingungen sind sie nicht nötig: Vorbeugen ist besser als Korrigieren.' },
  { begriff: 'Atmung', lang: 'Zuckerverbrauch auf dem Feld', text: 'Die gemähten Pflanzen leben noch eine Weile weiter und verbrauchen dabei Zucker. Je kürzer die Feldliegezeit, desto weniger geht verloren.' },
  { begriff: 'Bodenheu', lang: 'auf dem Feld getrocknetes Heu', text: 'Heu, das ganz auf dem Feld trocknet. Es darf höchstens 20 bis 25 % Wasser enthalten, wenn es auf den Heustock kommt (75 bis 80 % TS); dort erwärmt es sich normalerweise bis 40 bis 45 °C. Lagerfähig ist Heu ab 87 bis 88 % TS. Im Spiel gilt es ab 85 % TS als einlagerbar. Braucht mehrere schöne Tage.' },
  { begriff: 'Belüftungsheu', lang: 'Heu mit Heubelüftung', text: 'Angewelktes Heu (meist 60 bis 70 % TS, mit Warmluft oder Entfeuchter auch feuchter) wird eingeführt und im Heustock mit einem Gebläse fertig getrocknet. Spart einen Feldtag und schont die Blätter.' },
  { begriff: 'Nachtschwad', lang: 'Schwad über Nacht', text: 'Heu wird am Abend geschwadet, damit es weniger Tau aufnimmt, und am Morgen wieder breit gestreut.' },
  { begriff: 'Bröckelverluste', lang: 'abgebrochene Blätter', text: 'Trockene Blätter brechen beim Zetten, Schwaden und Pressen ab und bleiben liegen. Bei Heu steigen sie ab etwa 60 % TS überproportional, bei Kräutern und Klee besonders stark; es fehlt dann vor allem Eiweiss.' },
  { begriff: 'Heusonde', lang: 'Thermometer für den Heustock', text: 'Lange Messstange für die Temperatur im Heustock. Gemessen wird nach Messkalender bis zu zwölf Wochen lang. Ab 45 °C erhöhte Aufmerksamkeit, bei 60 bis 70 °C alle fünf Stunden, ab 70 °C die Feuerwehr verständigen: Feuchtes Heu kann sich selbst entzünden.' },
  { begriff: 'Aufbereiter', lang: 'Mähaufbereiter, Knicker', text: 'Gerät am Mähwerk, das die Halme knickt oder quetscht und die Wachsschicht verletzt, damit das Wasser leichter austritt. Es gibt Zinken (Schlägel), Walzen und Intensivaufbereiter mit Bürstenwalze und Breitstreuvorrichtung.' },
  { begriff: 'Kreiselzetter', lang: 'Kreiselheuer, Kreiselzettwender', text: 'Gerät, das das Futter auflockert und breit verteilt. Der erste Durchgang heisst Zetten, spätere Durchgänge Wenden. In der Schweiz sagt man auch Kreiselheuer, in Österreich Kreiselzettwender.' },
  { begriff: 'Schwad', lang: 'Futterstreifen', text: 'Der Streifen, in den der Schwader das Futter zusammenlegt, damit der Ladewagen oder die Presse es aufnehmen kann.' },
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const MUSTER = new RegExp(`\\b(${BEGRIFFE.map((b) => b.begriff).join('|')})\\b`, 'g');
const NACH_NAME = Object.fromEntries(BEGRIFFE.map((b) => [b.begriff, b]));

// Text als HTML ausgeben und Fachbegriffe mit <abbr title="…"> auszeichnen
export function mitBegriffen(text) {
  return esc(text).replace(MUSTER, (m) => `<abbr title="${esc(NACH_NAME[m].lang + ': ' + NACH_NAME[m].text)}">${m}</abbr>`);
}
