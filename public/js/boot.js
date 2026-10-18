/* Darstellung vor dem ersten Zeichnen setzen (kein Inline-Skript wegen CSP): Normal / Draussen / Nacht.
   Wie in Futter v2: data-theme="dark" = Nacht, data-outdoor="1" = Draussen (hoher Kontrast, grosse Ziele). */
(function () {
  'use strict';
  try {
    var t = localStorage.getItem('drysimTheme'); if (t) document.documentElement.dataset.theme = t;
    if (localStorage.getItem('drysimOutdoor') === '1') document.documentElement.dataset.outdoor = '1';
  } catch (e) { /* Speicher nicht verfügbar: automatische Darstellung */ }
})();
