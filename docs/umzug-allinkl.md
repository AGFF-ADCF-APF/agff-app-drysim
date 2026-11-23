# Umzug von Heureka nach app.graswachstum.ch/heureka (all-inkl)

Stand 23.11.2026. Bisher: statisch in nginx (Container `agff-drysim`) auf dem Home-Server unter https://apps.graswachstum.ch/heureka/.
Neu: https://app.graswachstum.ch/heureka/ auf all-inkl (Apache, PHP 8.4), gleicher Aufbau wie Pratum und Lernherbar.

## Was sich ändert

| Thema | Vorher (Home-Server) | Nachher (all-inkl) |
|---|---|---|
| Auslieferung, Kopfzeilen | `nginx.conf` | `public/.htaccess` (gleiche CSP, nosniff, Referrer-Policy, Cache-Regeln) |
| Links Futterrechner, Heutrocknung, Quellen-PDFs | relativ `../futter/`, `../drywatch/` | absolut `https://apps.graswachstum.ch/…` (Konstante `APPS` in `tools/seiten.mjs`) |
| Mediathek | Skript, CSS, Liste direkt aus futter | Kopie in `public/mediathek/`; `tools/seiten.mjs` zieht sie nach, wenn futter daneben liegt (`/opt/stacks/agff-apps/futter/static/v2/`) |
| Musterlösungen | Admin-Sitzung von Futter v2 (`/futter/v2/api/admin/ich`) | eigene Anmeldung mit dem AGFF-Konto: `public/konto.php`, client `heureka`, Rechte `heureka.teacher` oder `heureka.admin` |
| Testumgebung | – | https://dev-app.graswachstum.ch/heureka/ hinter dem Tor (jedes AGFF-Konto) |
| Daten im Browser | localStorage von apps.graswachstum.ch | neue Herkunft: gespeicherte Runden, Niveau und lokale Rangliste kommen **nicht** mit |

Anmeldung: `public/konto.php` (abgeleitet vom Tor von Pratum). Wege `/heureka/anmelden/start|zurueck|ich`, `/heureka/abmelden`.
Konfiguration `apps/heureka[-dev]/konfig.php` (Beispiele `server/konfig.dev.example.php`, `server/konfig.live.example.php`, nur
öffentlicher Schlüssel). Tests: `test/konto/test.sh` (PHP-Container, beide Betriebsarten).

## Anbieterseite (agff-familie, Sitzung «graswachstum.ch Umstrukturierung»)

- `websites.php` apps: dev `https://dev-app.graswachstum.ch/heureka/anmelden/zurueck`, server `https://app.graswachstum.ch/heureka/anmelden/zurueck`
- `permissions.yaml`: `heureka` mit `teacher` und `admin`
- Schlüssel: `werkzeuge/sso_schluessel.sh --dev heureka`, später `--live heureka` (nur mit Ja); öffentlichen Schlüssel in `konfig.php` eintragen

## Dev

1. `tools/deploy-allinkl.sh --dev einrichten` (einmalig; legt `konfig.php` aus dem Beispiel an)
2. `PUBLIC_KEY` (dev) in `apps/heureka-dev/konfig.php` eintragen
3. `tools/deploy-allinkl.sh --dev` (aus dem letzten Commit; trägt `heureka` in die Sperrliste von dev-app ein und prüft von aussen)

## Live-Umzug (nur mit ausdrücklichem Ja)

1. Anbieterseite live: client `heureka`, Recht `heureka.teacher` für die Lehrpersonen, Live-Schlüssel.
2. `tools/deploy-allinkl.sh --live einrichten`, `PUBLIC_KEY` (live) in `apps/heureka/konfig.php`, dann `tools/deploy-allinkl.sh --live`
   (verlangt die Eingabe «live» im Terminal; Claude führt das nicht selbst aus).
3. Prüfen: https://app.graswachstum.ch/heureka/ (Spiel, Lernseite mit Mediathek, Szenarien), `anmelden/ich`, Anmeldung als Lehrperson,
   Musterlösungen am Ergebnis einer Belüftungsheu-Runde.
4. Alten Standort umschalten (Home-Server, Ordner agff-drysim):
   Erledigt am 23.11.2026: `docker-compose.yml` baut seither `umzug/Dockerfile.alt` (Weiterleitung) statt der App.
   (`umzug/docker-compose.alt.yml` ist damit überholt und kann gelöscht werden.)
   Danach leitet apps.graswachstum.ch/heureka/… und /drysim/… mit 301 auf app.graswachstum.ch/heureka/… weiter (Pfad und
   `?wetter=`, `?code=`, `?niveau=` bleiben). Nur `sw.js` wird noch ausgeliefert: `umzug/alt-sw.js` löscht den Zwischenspeicher,
   meldet den alten Service Worker ab und lädt offene Fenster neu. Ohne diesen Schritt bliebe bei bisherigen Nutzerinnen und
   Nutzern die alte Fassung offline hängen. Mindestens bis Mitte 2027 so lassen.
5. Verweise nachführen: Wiese-App (`~/git/agff-app-pratum`, Einstellung `heurekaUrl`), Futter-Mediathek (`futter/static/v2/mediathek.js`,
   Kommentar «gleicher Host»), Werkzeugseite graswachstum.ch, Unterrichtsunterlagen, QR-Codes.
6. Hinweis auf der Startseite (Fusszeile, `p.umzug`) steht seit dem Umzug; nach einigen Monaten (Mitte 2027) entfernen.

## Zurück, falls nötig

Alten Standort wieder als App starten: in `docker-compose.yml` `build: .` setzen (statt `umzug/Dockerfile.alt`), Router `drysim-sw`
entfernen, `drysim-zu-heureka` wieder auf `$${1}/heureka/$${2}`, dann `docker compose up -d --build`. all-inkl: Sicherungen
unter `apps/heureka[-dev]-sicherungen/`.
