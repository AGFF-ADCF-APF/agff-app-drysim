// Fachbegriffe kurz erklärt: für Tipp-Erklärungen (<abbr>) und den Begriffe-Dialog

export const BEGRIFFE = [
  { begriff: 'TS', lang: 'Trockensubstanz', text: 'Was vom Futter übrig bleibt, wenn man das Wasser abzieht. 35 % TS heisst: 100 kg Futter enthalten 35 kg Trockenes und 65 kg Wasser.' },
  { begriff: 'Rohasche', lang: 'Mineralstoffe und Erde', text: 'Alles, was beim Verbrennen übrig bleibt. Sauberes Futter hat etwa 90 g pro kg TS. Viel mehr bedeutet: Erde im Futter.' },
  { begriff: 'NEL', lang: 'Netto-Energie Laktation', text: 'Mass für die Energie im Futter, die eine Milchkuh in Milch umsetzen kann (MJ NEL pro kg TS).' },
  { begriff: 'FK', lang: 'Vergärbarkeitskoeffizient', text: 'Rechenwert aus TS, Zucker und Pufferkapazität. Ab 45 lässt sich Futter sicher ohne Buttersäure silieren.' },
  { begriff: 'DLG', lang: 'DLG-Schlüssel', text: 'Deutsches Punkteschema, das die Gärqualität mit Laborwerten (Buttersäure, Essigsäure, pH) bewertet. 100 Punkte sind das Maximum.' },
  { begriff: 'Stomata', lang: 'Spaltöffnungen', text: 'Kleine Atemöffnungen der Blätter. Nach dem Schnitt schliessen sie sich innerhalb etwa einer Stunde.' },
  { begriff: 'Kutikula', lang: 'Wachsschicht', text: 'Wachsschicht auf Blättern und Stängeln. Sie hält das Wasser in der Pflanze, bremst also das Anwelken. Aufbereiter verletzen sie absichtlich.' },
  { begriff: 'Clostridien', lang: 'Buttersäurebakterien', text: 'Bakterien aus der Erde, die im Silo Buttersäure bilden. Sie machen Silage stinkend und vertragen sich schlecht mit Käsereimilch.' },
  { begriff: 'Pufferkapazität', lang: 'Säure-Widerstand', text: 'Wie stark sich das Futter gegen das Absinken des pH-Werts wehrt. Klee hat viel davon, deshalb braucht er mehr Zucker oder mehr TS.' },
  { begriff: 'Siliermittel', lang: 'Zusatz zum Silieren', text: 'Zusätze, die die Gärung in eine gute Richtung lenken. Bei guten Bedingungen sind sie nicht nötig: Vorbeugen ist besser als Korrigieren.' },
  { begriff: 'Atmung', lang: 'Zuckerverbrauch auf dem Feld', text: 'Die gemähten Pflanzen leben noch eine Weile weiter und verbrauchen dabei Zucker. Je kürzer die Feldliegezeit, desto weniger geht verloren.' },
  { begriff: 'Schwad', lang: 'Futterstreifen', text: 'Der Streifen, in den der Schwader das Futter zusammenlegt, damit der Ladewagen oder die Presse es aufnehmen kann.' },
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const MUSTER = new RegExp(`\\b(${BEGRIFFE.map((b) => b.begriff).join('|')})\\b`, 'g');
const NACH_NAME = Object.fromEntries(BEGRIFFE.map((b) => [b.begriff, b]));

// Text als HTML ausgeben und Fachbegriffe mit <abbr title="…"> auszeichnen
export function mitBegriffen(text) {
  return esc(text).replace(MUSTER, (m) => `<abbr title="${esc(NACH_NAME[m].lang + ': ' + NACH_NAME[m].text)}">${m}</abbr>`);
}
