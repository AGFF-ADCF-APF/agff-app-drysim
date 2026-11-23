// Messwerte aus Versuchen, abgeschrieben aus den Veröffentlichungen (nicht aus dem Modell).
// Grundlage für «Modell gegen Messung», die Grafiken im Spiel und auf der Lernseite.

export const QUELLE_FAT = { titel: 'FAT-Bericht 584: Gezogene Aufbereiter im Vergleich (Frick 2002)', url: 'https://api.agropool.ch/v1/file/1127948' };
export const QUELLE_TOPAGRAR = { titel: 'top agrar 12/2021: Gras zügig trocken – nur mit Aufbereiter?', url: 'https://www.topagrar.com/dl/topagrar/2021/12/T_092_095_12_21.pdf' };
export const QUELLE_KOELN = { titel: 'Kath-Petersen (TH Köln), Bauernblatt 6.6.2020: Kann man die Trocknungszeit vorwählen?', url: 'https://www.lksh.de/fileadmin/PDF_Downloadcenter/Bauernblatt/2020/BB_23_06.06/39-41_Petersen.pdf' };
export const QUELLE_HUMBERT = { titel: 'Humbert et al. 2010: Impact of different meadow mowing techniques on field invertebrates (Agroscope)', url: 'https://www.conservationevidence.com/individual-study/2762' };

// FAT Tänikon, Versuch 1, 24.–26. Juli 2001: Kunstwiese 3. Aufwuchs, 30 % Klee, 32 dt TS/ha,
// gemäht 24.7. um 20:35 mit 14,6 % TS, Ziel Belüftungsheu ab 60 % TS, eingeführt 26.7. um 15:50.
// t = Stunden ab 24.7. 00:00 (wie im Spiel: Tag 1 = 24.7.). Zetten/Wenden als Stunden, schwaden, Messpunkte [t, TS %].
// Aufbereiter Fella/Vicon/Kurmann K 618 im Spiel als Zinkenaufbereiter, Kurmann K 618 Twin als «mit Zinken und Bürste».
export const FAT_VERFAHREN = [
  { id: 'ohne', name: 'Ohne Aufbereiter, Schwade, 3× bearbeitet', aufbereiter: 'ohne', ablage: 32, zetten: [34.25, 38.5, 58.5], schwaden: 62, ende: 64.7,
    verlust: { aufnahme: 74, broeckel: 84 } },
  { id: 'fella-schwad', name: 'Fella, Schwade, 3×', aufbereiter: 'zinken', ablage: 32, zetten: [34.25, 38.5, 58.5], schwaden: 62, ende: 70.3, verlust: { aufnahme: 74, broeckel: 115 } },
  { id: 'vicon-schwad', name: 'Vicon, Schwade, 3×', aufbereiter: 'zinken', ablage: 32, zetten: [34.25, 38.5, 58.5], schwaden: 62, ende: 71.0, verlust: { aufnahme: 71, broeckel: 112 } },
  { id: 'k618-schwad', name: 'Kurmann K 618, Schwade, 3×', aufbereiter: 'zinken', ablage: 32, zetten: [34.25, 38.5, 58.5], schwaden: 62, ende: 72.0, verlust: { aufnahme: 82, broeckel: 117 } },
  { id: 'fella-breit', name: 'Fella, Breitablage 55 %, 2×', aufbereiter: 'zinken', ablage: 55, zetten: [38.5, 58.5], schwaden: 62, ende: 61.4,
    punkte: [[32.9, 13.6], [35.9, 16.5], [39.6, 25.6], [42, 33.2], [59.3, 42.7], [63, 61.4]], verlust: { aufnahme: 64, broeckel: 104 } },
  { id: 'vicon-breit', name: 'Vicon, Breitablage 65 %, 2×', aufbereiter: 'zinken', ablage: 65, zetten: [38.5, 58.5], schwaden: 62, ende: 60.8,
    punkte: [[32.9, 13.4], [35.9, 16.8], [39.6, 25.4], [42, 33.0], [59.3, 43.5], [63, 60.8]], verlust: { aufnahme: 53, broeckel: 109 } },
  { id: 'k618-breit', name: 'Kurmann K 618, Breitablage 70 %, 2×', aufbereiter: 'zinken', ablage: 70, zetten: [38.5, 58.5], schwaden: 62, ende: 66.4,
    punkte: [[32.9, 14.1], [35.9, 18.4], [39.6, 31.3], [42, 40.2], [59.3, 51.5], [63, 66.4]], verlust: { aufnahme: 51, broeckel: 113 } },
  { id: 'twin-2x', name: 'Kurmann Twin (Bürste), 85 %, 2×', aufbereiter: 'buerste', ablage: 85, zetten: [38.5, 58.5], schwaden: 62, ende: 71.8,
    punkte: [[32.7, 13.8], [35.6, 18.9], [39.3, 34.7], [41.75, 47.4], [59, 53.7], [62.75, 71.8]], verlust: { aufnahme: 64, broeckel: 118 } },
  { id: 'twin-1x', name: 'Kurmann Twin (Bürste), 85 %, 1×', aufbereiter: 'buerste', ablage: 85, zetten: [38.5], schwaden: 62, ende: 67.3,
    punkte: [[32.7, 13.8], [35.6, 18.9], [39.3, 34.7], [41.75, 47.4], [62.75, 67.3]], verlust: { aufnahme: 49, broeckel: 93 } },
  { id: 'twin-0x', name: 'Kurmann Twin (Bürste), 85 %, nie gewendet', aufbereiter: 'buerste', ablage: 85, zetten: [], schwaden: 60, ende: 65.3,
    punkte: [[32.9, 13.7], [35.9, 19.1], [39.6, 31.6], [42, 38.2], [59.3, 48.5], [63, 65.3]], verlust: { aufnahme: 30, broeckel: 55 } },
];
export const FAT_ERTRAG = 32; // dt TS/ha; Feldverluste in kg TS/ha

// FAT Versuch 1, Tab. 5: Ablagebreite in % der effektiven Mähbreite (280 cm)
export const FAT_ABLAGE = [['Fella KC 270 D', 55], ['Vicon TK 300', 65], ['Kurmann K 618', 70], ['Kurmann K 618 Twin', 85]];

// Humbert et al. 2010 (Agroscope): getötete oder verletzte Raupen beim Mähen
export const INSEKTEN = [['Motormäher (Balken)', 20], ['Rotationsmähwerk', 37], ['Rotationsmähwerk mit Aufbereiter', 69]];

// Antriebsleistung einer 10-m-Mähkombination, gemessen (top agrar 12/2021)
export const LEISTUNG = [['ohne Aufbereiter', 61], ['mit Aufbereiter', 122]];

// top agrar 12/2021: Spelle (Emsland), 9.5.2021, 28 °C, Ackergras, gemäht 11 Uhr mit 19,9 % TS, ein Versuchstag ohne Wiederholung.
// Zeit bis rund 35 % TS: mit Aufbereiter etwa 5 h; ohne Aufbereiter, zweimal gewendet, knapp 35 % um 19 Uhr (8 h); ohne Wenden 27,2 % TS am Abend.
export const TOPAGRAR_35 = [['mit Aufbereiter', 5], ['ohne Aufbereiter, 2× gewendet', 8]];

// ---------- Heubelüftung: Richtwerte aus den Fachunterlagen (abgeschrieben bzw. aus Grafiken abgelesen)
export const QUELLE_FAT1982 = { titel: 'Baumgartner, J. (1982): ABC der Heubelüftung. Blätter für Landtechnik 216, FAT Tänikon', url: 'https://apps.graswachstum.ch/drywatch/knowledge/files/Baumgartner_1982_ABC-der-Heubelueftung.pdf' };
export const QUELLE_AGROSCOPE38 = { titel: 'Agroscope Transfer Nr. 38/2014: Richtlinien für Heubelüftungsanlagen', url: 'https://apps.graswachstum.ch/drywatch/knowledge/files/agroscope_transfer_38_2014_richtlinien_fuer_heubelueftungsanlagen.pdf' };
export const QUELLE_LKS = { titel: 'Galler, Kittl, Wirleitner (LK Salzburg): Heutrocknung von A bis Z', url: 'https://apps.graswachstum.ch/drywatch/knowledge/files/Heutrocknung_von_A-Z_Kittl+Galler_2020.pdf' };

// FAT 1982, Abb. 29: «Durchschnittlicher Wasserentzug in Abhängigkeit der relativen Luftfeuchtigkeit und verschiedener
// Trocknungsgrade des Heus», g/m³ Luft, aus der Grafik abgelesen (±0,1–0,2 g/m³). Temperatur nicht angegeben (Spiel: 20 °C).
// Die TS-Klassen sind im Spiel durch einen Vertreterwert ersetzt (unter 55 % → 52 %, über 75 % → 80 %).
export const ABB29 = {
  kurven: [
    { name: 'unter 55 % TS', ts: 52, punkte: [[50, 3.1], [60, 2.3], [70, 1.6], [80, 1.0], [90, 0.5]] },
    { name: '55–65 % TS', ts: 60, punkte: [[40, 3.0], [50, 2.3], [60, 1.7], [70, 1.2], [80, 0.75], [90, 0.35]] },
    { name: '65–75 % TS', ts: 70, punkte: [[40, 2.3], [50, 1.6], [60, 1.1], [70, 0.7], [80, 0.35], [90, -0.05]] },
    { name: 'über 75 % TS', ts: 80, punkte: [[40, 1.3], [50, 0.75], [60, 0.35], [70, 0.05], [80, -0.2], [90, -0.3]] },
  ],
};
// LK Salzburg S. 42 (nach Wirleitner, aus Balken abgelesen): spezifischer Energiebedarf und Trocknungsleistung
export const LKS_VERFAHREN = [
  { name: 'Kaltluft 20 °C / 65 % rF', rh: 65, dach: false, kwhJeKg: 0.24, kgJeTh: 3.0 },
  { name: 'Kaltluft 20 °C / 70 % rF', rh: 70, dach: false, kwhJeKg: 0.28, kgJeTh: 2.55 },
  { name: 'mit Dachabsaugung', rh: 65, dach: true, kwhJeKg: 0.19, kgJeTh: 4.4 },
];
// LK Salzburg: Kaltbelüftung «bei üblichen Luftfeuchtewerten ungefähr 0,8 bis 1,1 g Wasser/m³ Luft» (S. 34),
// Ausnutzung des adiabatischen Sättigungsdefizits 50–65 % (S. 34), Entfeuchter 0,26–0,45 kWh/kg Wasser (S. 43),
// Dachabsaugung «deutlich unterhalb von 0,2 kWh/kg» (S. 43), Haupttrocknung innert 80 h (S. 30)
export const LKS_RICHTWERTE = { kaltGm3: [0.8, 1.1], ausnutzung: [0.5, 0.65], entfKwhJeKg: [0.26, 0.45], dachKwhJeKg: 0.2, stunden: 80 };
// Gleichgewicht Luftfeuchte → TS bei 20 °C (Abluft-Tabelle: Agroscope 2014, Tab. 3; LK Salzburg S. 45)
export const ABLUFT_TS = [[90, 68], [80, 74], [70, 78], [60, 82.5], [50, 85]];
