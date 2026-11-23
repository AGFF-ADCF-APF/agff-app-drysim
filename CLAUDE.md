# agff-app-drysim (Heureka) – Regeln für Claude

Heureka, Lernspiel Futterkonservierung (Silage und Heu): statische Seite mit ES-Modulen (`public/js`), ohne Build-Schritt.
Live https://app.graswachstum.ch/heureka/ (all-inkl), Test https://dev-app.graswachstum.ch/heureka/ (hinter dem Tor).
Kein Grav-Projekt; die Regeln aus `~/git/CLAUDE.md` zu Datenschutz, Deploy, Pushes und Commits gelten trotzdem.
Das Repo ist **öffentlich** (`.push-erlaubt`: oeffentlich *): keine Zugangsdaten, Kontonamen des Hostings, Personen- oder Betriebsdaten.

- **Arbeitsordner ist dieser hier** (`~/git/agff-app-drysim`, seit 23.11.2026). `/opt/stacks/agff-apps/agff-drysim` auf dem
  Home-Server betreibt nur noch den Container `agff-drysim`, der apps.graswachstum.ch/heureka/ und /drysim/ mit 301 auf die neue
  Adresse weiterleitet und den alten Service Worker abmeldet (`umzug/`, bis Mitte 2027). Dort nicht mehr entwickeln.
- **Sprache:** Benutzertexte, Kommentare und Doku auf Deutsch (Schweizer Schreibweise, «ss»).
- **Fachliches:** keine Zahlen oder Regeln erfinden; Unbelegtes als Annahme kennzeichnen (README «Offen»). Messwerte aus
  Veröffentlichungen in `public/js/versuche.js` mit Quelle.
- **Kein Daten-Backend:** Spielstände und Rangliste nur im Browser (localStorage `drysim-…`, Namen nie ändern). Einziger
  Server-Teil ist `public/konto.php`: Anmeldung mit dem AGFF-Konto (SSO agff-familie, client `heureka`) nur für die
  Musterlösungen (Rechte `heureka.teacher`, `heureka.admin`); auf dev zusätzlich das Tor vor allem. Nur der öffentliche
  Schlüssel gehört in `konfig.php` auf dem Server (nie überschreiben, nicht in git).
- **Nach Änderungen an Inhalten:** `tools/seiten.sh` (erzeugt lernen.html, unterricht.html, szenario/*.html, sitemap.xml, sw.js
  und zieht die Mediathek aus futter nach) und `tools/test.sh` – beides grün vor jedem Commit. Erzeugte Dateien mitcommitten.
- **Deploy:** `tools/deploy-allinkl.sh --dev` darf Claude ohne Einzelfrage ausführen (aus dem letzten Commit, mit Sicherung).
  Live (`--live`) nur nach ausdrücklichem Ja für genau diesen Deploy; Claude startet den Befehl höchstens im Terminal-Tab,
  die Bestätigung «live» tippt Martin selbst. SSH-Ziel steht in `tools/deploy-ziel.lokal` (nicht in git).
- **Pushes:** nur auf Auftrag, nach Prüfung auf sensible Daten.
- **Commits:** Autor Martin Zbinden; Attribution laut Sitzung.
