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
  maehen: 9, schnitthoehe: 7, aufbereiter: 'walzen', breit: true,
  zetten: [10], zetterHoehe: 3, schwaden: 17, schwaderHoehe: 3,
  ernte: 18, siloart: 'flachsilo',
};

export const PROGNOSEN = [
  {
    id: 'bilderbuch', lernziel: 'So sieht eine gelungene Silage aus: nach dem Abtrocknen mähen, breit ablegen, kurz liegen lassen und am Abend einfahren.', name: 'Bilderbuch', wetter: 'hoch',
    text: 'Raigrasreicher Bestand im Ähren-/Rispenschieben. Mähen um 9 Uhr, nachdem der Tau abgetrocknet ist, mit Walzenaufbereiter und Breitablage. Einmal zetten, um 17 Uhr schwaden, um 18 Uhr ins Flachsilo.',
    plan: { ...GRUNDPLAN, bestand: 'graeser' },
  },
  {
    id: 'tiefgemaeht', lernziel: 'Erde, wenig Zucker und Regen: wie schnell kippt die Gärung, wenn mehrere Fehler zusammenkommen?', name: 'Tief gemäht, dann Gewitter', wetter: 'gewitter',
    text: 'Kleereicher Bestand, mit 5 cm Schnitthöhe am Morgen um 7 Uhr gemäht, mit Zinkenaufbereiter in die Schwade. Zetter und Schwader sind zu tief eingestellt, auf der Wiese hat es Maulwurfshaufen. Gezettet wird am Tag 2 um 9 Uhr; das Futter liegt breit, als am Nachmittag das Gewitter kommt. Schwaden am Tag 3 um 10 Uhr, einfahren um 12 Uhr ins Flachsilo.',
    plan: { ...GRUNDPLAN, bestand: 'klee', schnitthoehe: 5, maehen: 7, aufbereiter: 'zinken', breit: false, boden: 'maulwurf',
      zetten: [33], zetterHoehe: 1, schwaden: 58, schwaderHoehe: 0.5, ernte: 60 },
  },
  {
    id: 'foehn', name: 'Föhn und Rundballen', wetter: 'foehn',
    text: 'Ausgewogener Bestand bei Beginn Blüte, Mähen um 9 Uhr mit Walzenaufbereiter und Breitablage. Zweimal zetten (10 und 14 Uhr), am nächsten Tag um 11 Uhr schwaden und um 13 Uhr Rundballen pressen.',
    plan: { ...GRUNDPLAN, stadium: 4, maehen: 9, zetten: [10, 14], schwaden: 35, ernte: 37, siloart: 'ballen' },
  },
  {
    id: 'ohneaufbereiter', lernziel: 'Nass gemäht, schmale Schwade, Nacht im Tau: wie lange dauert das Anwelken ohne Aufbereiter?', name: 'Nass gemäht, über Nacht', wetter: 'wechselhaft',
    text: 'Ausgewogener Bestand, am Morgen um 7 Uhr in den Tau gemäht, ohne Aufbereiter in die Schwade, nie gezettet. Am Tag 2 um 13 Uhr schwaden, um 15 Uhr ins Flachsilo.',
    plan: { ...GRUNDPLAN, maehen: 7, aufbereiter: 'ohne', breit: false, zetten: [], schwaden: 37, ernte: 39 },
  },
];
