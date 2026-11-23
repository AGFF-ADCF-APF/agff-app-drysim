// Wetterlagen (4 Tage) und vorgegebene Prognose-Szenarien.
// Zeiten in Stunden ab Tag 1, 00:00 (Tag 2, 10 Uhr = 34).

export const WETTER = [
  {
    id: 'hoch', name: 'Hochdruck, Mai', monat: 5, info: 'Stabil schön, kühle Nächte mit Tau',
    tage: [
      { tmin: 7, tmax: 22, rhmax: 97, sonne: 0.95, wind: 2 },
      { tmin: 9, tmax: 24, rhmax: 96, sonne: 0.95, wind: 2 },
      { tmin: 10, tmax: 25, rhmax: 95, sonne: 0.9, wind: 2.5 },
      { tmin: 11, tmax: 23, rhmax: 96, sonne: 0.6, wind: 3 },
    ],
  },
  {
    id: 'gewitter', name: 'Gewitter am Tag 2', monat: 6, info: 'Heiss und schwül, am Nachmittag des 2. Tages Gewitter',
    tage: [
      { tmin: 14, tmax: 28, rhmax: 95, sonne: 0.9, wind: 1.5 },
      { tmin: 16, tmax: 29, rhmax: 96, sonne: 0.7, wind: 1.5, regen: [{ h: 16, mm: 9 }, { h: 17, mm: 5 }, { h: 18, mm: 1 }] },
      { tmin: 13, tmax: 22, rhmax: 99, sonne: 0.5, wind: 2 },
      { tmin: 11, tmax: 24, rhmax: 96, sonne: 0.85, wind: 2 },
    ],
  },
  {
    id: 'foehn', lernziel: 'Zu trocken ist auch nicht gut: Was passiert bei Föhn mit Rundballen und mit dem Blattverlust?', name: 'Föhn, September', monat: 9, info: 'Warmer Föhnwind, trockene Luft, kein Tau',
    tage: [
      { tmin: 14, tmax: 25, rhmax: 75, sonne: 0.9, wind: 5 },
      { tmin: 15, tmax: 26, rhmax: 70, sonne: 0.9, wind: 6 },
      { tmin: 12, tmax: 18, rhmax: 95, sonne: 0.3, wind: 3, regen: [{ h: 13, mm: 2 }, { h: 14, mm: 3 }, { h: 15, mm: 2 }] },
      { tmin: 9, tmax: 16, rhmax: 97, sonne: 0.4, wind: 2 },
    ],
  },
  {
    id: 'sommer', name: 'Heuwetter, Juli', monat: 7, info: 'Drei heisse, trockene Tage, am Abend des 4. Tages Gewitter',
    tage: [
      { tmin: 13, tmax: 27, rhmax: 93, sonne: 0.95, wind: 2 },
      { tmin: 14, tmax: 29, rhmax: 92, sonne: 0.95, wind: 2.5 },
      { tmin: 16, tmax: 30, rhmax: 92, sonne: 0.9, wind: 2 },
      { tmin: 17, tmax: 29, rhmax: 95, sonne: 0.6, wind: 2, regen: [{ h: 18, mm: 8 }, { h: 19, mm: 6 }, { h: 20, mm: 2 }] },
    ],
  },
  {
    // Versuchswetter FAT Tänikon, 24.–26. Juli 2001 (FAT-Bericht 584, Tab. 3: max. 27,2/27,5 °C, rF min. 41/40 %, wolkenlos)
    id: 'taenikon', name: 'Tänikon, Juli 2001', monat: 7, info: 'Das Wetter eines echten Trocknungsversuchs: stabil, wolkenlos, um 27 °C',
    tage: [
      { tmin: 14, tmax: 26, rhmax: 94, sonne: 0.95, wind: 2 },
      { tmin: 14, tmax: 27.2, rhmax: 94, sonne: 0.95, wind: 2 },
      { tmin: 14, tmax: 27.5, rhmax: 94, sonne: 0.95, wind: 2 },
      { tmin: 15, tmax: 26, rhmax: 95, sonne: 0.8, wind: 2 },
    ],
  },
  {
    id: 'wechselhaft', name: 'Wechselhaft, Mai', monat: 5, info: 'Bewölkt, kühl, viel Tau, Schauer am Tag 3',
    tage: [
      { tmin: 6, tmax: 17, rhmax: 99, sonne: 0.45, wind: 2 },
      { tmin: 8, tmax: 18, rhmax: 99, sonne: 0.55, wind: 2 },
      { tmin: 9, tmax: 16, rhmax: 99, sonne: 0.3, wind: 3, regen: [{ h: 11, mm: 1.5 }, { h: 15, mm: 3 }] },
      { tmin: 7, tmax: 19, rhmax: 98, sonne: 0.7, wind: 2 },
    ],
  },
];

export const GRUNDPLAN = {
  bestand: 'ausgewogen', stadium: 3, ertrag: 30, boden: 'eben',
  maehen: 9, schnitthoehe: 7, aufbereiter: 'walzen', ablage: 85,
  zetten: [10], zetterHoehe: 3, schwaden: 17, schwaderHoehe: 3,
  ernte: 18, siloart: 'flachsilo',
};
// Heu: späteres Stadium, Zinken etwas höher (trockenes Futter liegt locker)
const HEUPLAN = { ...GRUNDPLAN, stadium: 4, zetterHoehe: 4, schwaderHoehe: 4, siloart: 'bodenheu' };
// Nachbau FAT-Versuch 1 (Tänikon 2001): Kunstwiese 3. Aufwuchs, 70 % Gräser / 30 % Klee, 32 dt TS/ha,
// gemäht am Vorabend um 20:35 mit 14,6 % TS, Ziel Belüftungsheu ab 60 % TS
export const FAT_PLAN = { ...GRUNDPLAN, bestand: 'ausgewogen', stadium: 3, ertrag: 32, tsFrisch: 14.6, zetterHoehe: 3, schwaderHoehe: 3, siloart: 'belueftung', maehen: 20 };

export const PROGNOSEN = [
  {
    id: 'bilderbuch', lernziel: 'So sieht eine gelungene Silage aus: nach dem Abtrocknen mähen, breit ablegen, kurz liegen lassen und am Nachmittag einfahren.', name: 'Bilderbuch', wetter: 'hoch',
    text: 'Raigrasreicher Bestand im Ähren-/Rispenschieben. Mähen um 9 Uhr, nachdem der Tau abgetrocknet ist, mit Walzenaufbereiter und Breitablage. Einmal zetten, um 15 Uhr schwaden, um 16 Uhr ins Flachsilo.',
    plan: { ...GRUNDPLAN, bestand: 'graeser', schwaden: 15, ernte: 16 },
  },
  {
    id: 'tiefgemaeht', lernziel: 'Erde, wenig Zucker und Regen: wie schnell kippt die Gärung, wenn mehrere Fehler zusammenkommen?', name: 'Tief gemäht, dann Gewitter', wetter: 'gewitter',
    text: 'Kleereicher Bestand, mit 5 cm Schnitthöhe am Morgen um 7 Uhr gemäht, mit Zinkenaufbereiter in die Schwade. Zetter und Schwader sind zu tief eingestellt, auf der Wiese hat es Maulwurfshaufen. Gezettet wird am Tag 2 um 9 Uhr; das Futter liegt breit, als am Nachmittag das Gewitter kommt. Schwaden am Tag 3 um 10 Uhr, einfahren um 12 Uhr ins Flachsilo.',
    plan: { ...GRUNDPLAN, bestand: 'klee', schnitthoehe: 5, maehen: 7, aufbereiter: 'zinken', ablage: 35, boden: 'maulwurf',
      zetten: [33], zetterHoehe: 1, schwaden: 58, schwaderHoehe: 0.5, ernte: 60 },
  },
  {
    id: 'foehn', lernziel: 'Zu trocken ist auch nicht gut: Was passiert bei Föhn mit Rundballen und mit dem Blattverlust?', name: 'Föhn und Rundballen', wetter: 'foehn',
    text: 'Ausgewogener Bestand bei Beginn Blüte, Mähen um 9 Uhr mit Walzenaufbereiter und Breitablage. Zweimal zetten (10 und 14 Uhr), am nächsten Tag um 11 Uhr schwaden und um 13 Uhr Rundballen pressen.',
    plan: { ...GRUNDPLAN, stadium: 4, maehen: 9, zetten: [10, 14], schwaden: 35, ernte: 37, siloart: 'ballen' },
  },
  {
    id: 'ohneaufbereiter', lernziel: 'Nass gemäht, schmale Schwade, Nacht im Tau: wie lange dauert das Anwelken ohne Aufbereiter?', name: 'Nass gemäht, über Nacht', wetter: 'wechselhaft',
    text: 'Ausgewogener Bestand, am Morgen um 7 Uhr in den Tau gemäht, ohne Aufbereiter in die Schwade, nie gezettet. Am Tag 2 um 13 Uhr schwaden, um 15 Uhr ins Flachsilo.',
    plan: { ...GRUNDPLAN, maehen: 7, aufbereiter: 'ohne', ablage: 35, zetten: [], schwaden: 37, ernte: 39 },
  },
  {
    id: 'heubilderbuch', lernziel: 'So gelingt Bodenheu: drei schöne Tage, fleissig zetten, solange das Futter feucht ist, und am Nachmittag des dritten Tages trocken einlagern.', name: 'Bodenheu wie im Bilderbuch', wetter: 'hoch',
    text: 'Ausgewogener Bestand bei Beginn Blüte, gemäht um 9 Uhr mit Walzenaufbereiter und Breitablage. Gezettet am Tag 1 um 10 und 14 Uhr, am Tag 2 um 10 und 14 Uhr. Am Tag 3 um 14 Uhr schwaden, um 16 Uhr auf den Heustock.',
    plan: { ...HEUPLAN, zetten: [10, 14, 34, 38], schwaden: 62, ernte: 64 },
  },
  {
    id: 'heutau', lernziel: 'Fast trocken ist nicht trocken: Was passiert, wenn Heu am Morgen mit Tau eingefahren wird?', name: 'Heu am Morgen eingefahren', wetter: 'hoch',
    text: 'Gleich wie das Bilderbuch-Heu, aber am Tag 3 soll es schnell gehen: Um 6 Uhr wird geschwadet und um 7 Uhr eingefahren, solange noch Tau liegt. Das Heu kommt auf den Heustock, ohne Belüftung.',
    plan: { ...HEUPLAN, zetten: [10, 14, 34, 38], schwaden: 54, ernte: 55 },
  },
  {
    id: 'heufoehn', lernziel: 'Wenn das Wetterfenster nicht für Bodenheu reicht: Wie rettet die Belüftung das Heu vor dem Regen?', name: 'Föhn: Belüftung vor dem Regen', wetter: 'foehn',
    text: 'Ausgewogener Bestand bei Beginn Blüte, Mähen am Tag 1 um 9 Uhr mit Walzenaufbereiter und Breitablage. Zetten um 10 und 14 Uhr und am Tag 2 um 10 Uhr. Am Tag 3 kommt Regen, deshalb wird schon am Tag 2 um 16 Uhr geschwadet und um 18 Uhr in die Heubelüftung eingeführt.',
    plan: { ...HEUPLAN, siloart: 'belueftung', zetten: [10, 14, 34], schwaden: 40, ernte: 42 },
  },
  {
    // Belüftung: plan.belueftung legt den Betrieb im Heustock fest (sonst Standard: Intervall mit Warmluft vom Dach)
    id: 'heudauer', lernziel: 'Viel hilft viel? Was bringt es, wenn der Lüfter auch in der feuchten Nacht durchläuft, und was kostet der Strom?', name: 'Belüftung: Lüfter Tag und Nacht', wetter: 'hoch',
    text: 'Ausgewogener Bestand bei Beginn Blüte, gemäht am Tag 1 um 9 Uhr mit Walzenaufbereiter und Breitablage, gezettet um 10 und 14 Uhr. Am Tag 2 um 11 Uhr schwaden, um 13 Uhr in die Belüftung. Der Lüfter läuft danach Tag und Nacht ohne Pause, ohne Warmluft vom Dach.',
    plan: { ...HEUPLAN, siloart: 'belueftung', zetten: [10, 14], schwaden: 35, ernte: 37, belueftung: { luefter: 'dauer', dach: false, entfeuchter: false } },
  },
  {
    id: 'heugewitter', lernziel: 'Vor dem Gewitter feucht eingeführt: Schafft die Kaltbelüftung ohne Warmluft die Haupttrocknung in 80 Stunden?', name: 'Belüftung: vor dem Gewitter', wetter: 'gewitter',
    text: 'Ausgewogener Bestand bei Beginn Blüte, gemäht am Tag 1 um 9 Uhr mit Walzenaufbereiter und Breitablage, gezettet um 10 und 14 Uhr. Am Tag 2 droht am Nachmittag ein Gewitter: um 10 Uhr schwaden, um 12 Uhr in die Belüftung. Die Anlage hat kein Warmluftdach; die Steuerung lüftet im Intervall.',
    plan: { ...HEUPLAN, siloart: 'belueftung', zetten: [10, 14], schwaden: 34, ernte: 36, belueftung: { luefter: 'intervall', dach: false, entfeuchter: false } },
  },
  {
    // Bedienung am Heustock: plan.anlage (Lüfter, Warmdach, Entfeuchter, Box), plan.einfuellen und plan.belueftungLog (Messen, Eingriffe)
    id: 'lueftermagnicht', lernziel: 'Wenn der Lüfter «nicht mag»: Was passiert mit der Luftmenge, wenn viel nasses, kleereiches Futter hoch in einer kleinen Box liegt?', name: 'Belüftung: Standardlüfter bei 55 % TS', wetter: 'gewitter',
    text: 'Kleereicher Bestand mit hohem Ertrag (45 dt TS/ha), gemäht am Tag 1 um 9 Uhr mit Walzenaufbereiter und Breitablage, gezettet um 10 und 14 Uhr. Am Tag 2 droht ein Gewitter: Schon um 6 Uhr wird geschwadet und um 7 Uhr eingeführt, noch mit Tau und erst rund 55 % TS. Die Box ist klein (28 m²), der Stock wird fast 4 m hoch. Standardlüfter mit Warmdach, Intervallbetrieb.',
    plan: { ...HEUPLAN, bestand: 'klee', ertrag: 45, siloart: 'belueftung', zetten: [10, 14], schwaden: 30, ernte: 31, anlage: { luefter: 'standard', dach: true, entfeuchter: false, box: 'klein' } },
  },
  {
    id: 'zuhoch', lernziel: 'Die Box ist zu klein für die Parzelle: Reicht die Luft, wenn die ganze Ernte auf einmal 2,6 m hoch eingefüllt wird?', name: 'Belüftung: zu hoch gefüllt', wetter: 'gewitter',
    text: 'Ausgewogener Bestand bei Beginn Blüte, gemäht am Tag 1 um 9 Uhr mit Walzenaufbereiter und Breitablage, gezettet um 10 und 14 Uhr. Am Tag 2 um 10 Uhr schwaden, um 12 Uhr mit gut 60 % TS einführen. Die ganze Ernte kommt auf einmal in eine kleine Box (28 m² statt 50 m²): Der Stock liegt 2,6 m hoch. Standardlüfter mit Warmdach, Intervallbetrieb.',
    plan: { ...HEUPLAN, siloart: 'belueftung', zetten: [10, 14], schwaden: 34, ernte: 36, anlage: { luefter: 'standard', dach: true, entfeuchter: false, box: 'klein' } },
  },
  {
    id: 'nest', lernziel: 'Abgeladen, wie es kommt, und nur in der Mitte gemessen: Wer findet das feuchte Nest an der Abladestelle?', name: 'Belüftung: Nest übersehen', wetter: 'gewitter',
    text: 'Ausgewogener Bestand bei Beginn Blüte, gemäht am Tag 1 um 9 Uhr mit Walzenaufbereiter und Breitablage, gezettet um 10 und 14 Uhr. Am Tag 2 um 10 Uhr schwaden, um 12 Uhr einführen. Es eilt: Das Heu wird abgeladen, wie es kommt, hinten liegt es höher und dichter. Standardanlage mit Warmdach, Intervallbetrieb. Jeden Tag um 12 Uhr wird die Heusonde gesteckt, aber nur in der Mitte. Umgeschichtet wird nicht.',
    plan: { ...HEUPLAN, siloart: 'belueftung', zetten: [10, 14], schwaden: 34, ernte: 36, anlage: { luefter: 'standard', dach: true, entfeuchter: false, box: 'passend' }, einfuellen: { lagen: 1, verteilen: false, start: 'sofort' },
      belueftungLog: Array.from({ length: 9 }, (_, i) => ({ t: 36 + 24 * (i + 1), art: 'sonde', wert: 'mitte' })) },
  },
  {
    id: 'kleeheu', lernziel: 'Die Blätter sind das Beste am Heu: Was kostet es, kleereiches Heu trocken und oft zu zetten?', name: 'Kleeheu zu oft gezettet', wetter: 'sommer',
    text: 'Kleereicher Bestand bei Beginn Blüte, gemäht um 9 Uhr mit Zinkenaufbereiter und Breitablage. Gezettet wird jeden Tag mehrmals, auch über Mittag, wenn das Futter schon raschelt: am Tag 1 um 10 und 14 Uhr, am Tag 2 um 10, 13 und 16 Uhr und am Tag 3 um 11 Uhr. Schwaden am Tag 3 um 14 Uhr, Einfahren um 16 Uhr in den Heustock.',
    plan: { ...HEUPLAN, bestand: 'klee', aufbereiter: 'zinken', zetten: [10, 14, 34, 37, 40, 59], schwaden: 62, ernte: 64 },
  },
  {
    id: 'taenikon', lernziel: 'Ein echter Versuch: Wie gut trifft das Spiel die Messung der FAT Tänikon? Tippe zuerst, dann vergleiche Tipp, Spiel und Messung.', name: 'Tänikon 2001: echter Versuch', wetter: 'taenikon',
    text: 'Kunstwiese im 3. Aufwuchs (70 % Gräser, 30 % Klee), 32 dt TS/ha. Gemäht am Vorabend um 20:35 Uhr mit Zinkenaufbereiter, Ablage auf 70 % der Mähbreite. Am nächsten Tag um 14:30 Uhr gezettet, am Tag darauf um 10:30 Uhr gewendet, um 14 Uhr geschwadet und um 15:50 Uhr in die Belüftung eingeführt.',
    plan: { ...FAT_PLAN, aufbereiter: 'zinken', ablage: 70, zetten: [38, 58], schwaden: 62, ernte: 64 },
    messung: { ts: 66.3, text: 'FAT Tänikon, Aufbereiter Kurmann K 618, Breitablage, 2× bearbeitet', quelle: 'FAT-Bericht 584 (Frick 2002)' },
  },
];
