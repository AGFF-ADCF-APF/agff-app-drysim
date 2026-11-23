#!/bin/bash
# Deploy von Heureka nach all-inkl (KAS) über SSH. Muster: agff-app-pratum/werkzeuge/deploy-allinkl.sh (dort ausführlich).
#
#   dev:  https://dev-app.graswachstum.ch/heureka   Code <Konto>/apps/heureka-dev, Symlink heureka -> ../apps/heureka-dev/public
#         Tor vor allem (public/konto.php mit server/dev/.htaccess, TOR => true in konfig.php)
#   live: https://app.graswachstum.ch/heureka       Code <Konto>/apps/heureka, öffentlich; konto.php nur für die Anmeldung
#         der Lehrpersonen (Musterlösungen), TOR => false
#   konfig.php (ohne Geheimnisse, öffentlicher Schlüssel) und daten/ (Sitzungen, jti) liegen im Code-Ordner, nicht in public/.
#   SSH-Ziel (Benutzer@Server des Hosting-Kontos) steht nicht im Repo (öffentlich), sondern in tools/deploy-ziel.lokal
#   (eine Zeile, in .gitignore) oder in der Umgebungsvariable HEUREKA_SSH_ZIEL. <Konto> = /www/htdocs/<Kontoname>.
#
# Dev: ohne Einzelfrage erlaubt (~/git/CLAUDE.md), mit Sicherung des Dev-Stands; ohne gültigen Sperr-Block auf dev-app nie.
# Live: NUR nach ausdrücklichem Ja für genau diesen Deploy; das Skript verlangt die Eingabe «live» im Terminal, die ein Mensch tippt.
#
# Aufruf:
#   tools/deploy-allinkl.sh --dev einrichten | --dev [--trocken]
#   tools/deploy-allinkl.sh --live einrichten | --live [--trocken]
# Der Code kommt immer aus dem letzten Commit (git archive), nie aus dem Arbeitsordner.
set -euo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd)
ZIEL=${HEUREKA_SSH_ZIEL:-$(head -n1 "$REPO/tools/deploy-ziel.lokal" 2>/dev/null || true)}
[[ "$ZIEL" =~ ^ssh-([a-z0-9]+)@[a-z0-9.-]+$ ]] || { echo "SSH-Ziel fehlt: tools/deploy-ziel.lokal (ssh-<konto>@<server>) oder HEUREKA_SSH_ZIEL"; exit 1; }
W=/www/htdocs/${BASH_REMATCH[1]}
PFAD=heureka
case "${1:-}" in
  --dev) UMGEBUNG=dev; HOST=dev-app.graswachstum.ch; APP=$W/apps/heureka-dev; shift ;;
  --live) UMGEBUNG=live; HOST=app.graswachstum.ch; APP=$W/apps/heureka; shift ;;
  *) echo "Aufruf: $0 --dev|--live [einrichten|--trocken]"; exit 1 ;;
esac
DOCROOT=$W/$HOST
SICHERUNGEN=$APP-sicherungen
AKTION=deploy
while [ $# -gt 0 ]; do
  case "$1" in
    einrichten|--trocken) AKTION=$1; shift ;;
    *) echo "Unbekannt: $1"; exit 1 ;;
  esac
done
STEMPEL=$(date +%Y%m%d-%H%M%S)
exec 9>"${TMPDIR:-/tmp}/heureka-$UMGEBUNG-deploy.lock"
flock -w 600 9
if [ "$UMGEBUNG" = live ] && [ "$AKTION" != --trocken ]; then
  [ -t 0 ] || { echo "Abgebrochen: Live-Deploy nur nach ausdrücklichem Ja, die Bestätigung braucht ein Terminal."; exit 1; }
  read -r -p "LIVE (https://$HOST/$PFAD, $AKTION). Zur Bestätigung «live» eintippen: " antwort
  [ "$antwort" = live ] || { echo "Abgebrochen."; exit 1; }
fi

# --- Sperre von dev-app: gültiger Block in der .htaccess der Dokumentenwurzel? (Ohne Block ist dev offen: nie deployen) ---
sperre_gueltig() {
  ssh "$ZIEL" "awk '/^# BEGIN dev-app-sperre/{s=1} s{print} /^# END dev-app-sperre/{s=0}' $DOCROOT/.htaccess 2>/dev/null" \
    | { b=0; d=0; e=0; while IFS= read -r z; do
          case "$z" in '# BEGIN dev-app-sperre'*) b=1 ;; '# END dev-app-sperre'*) e=1 ;; esac
          case "$z" in *'Require all denied'*) d=1 ;; esac
        done; [ $b = 1 ] && [ $d = 1 ] && [ $e = 1 ]; }
}
if [ "$UMGEBUNG" = dev ] && ! sperre_gueltig; then
  echo "Keine gültige Sperre (Block dev-app-sperre) in $DOCROOT/.htaccess. Abbruch (dev wäre offen)."; exit 1
fi

if [ "$AKTION" = einrichten ]; then
  ssh "$ZIEL" "set -e; test -d $DOCROOT || { echo 'Dokumentenwurzel $DOCROOT fehlt'; exit 1; }
    test ! -e $APP || { echo '$APP gibt es schon'; exit 1; }
    test ! -e $DOCROOT/$PFAD || { echo '$DOCROOT/$PFAD gibt es schon'; exit 1; }
    mkdir -p $APP/public
    mkdir -p -m 700 $SICHERUNGEN $APP/daten/jti $APP/daten/sessions
    ln -s ../apps/$(basename $APP)/public $DOCROOT/$PFAD"
  scp -q "$REPO/server/konfig.$UMGEBUNG.example.php" "$ZIEL:$APP/konfig.php"
  ssh "$ZIEL" "chmod 600 $APP/konfig.php"
  echo "Eingerichtet: $APP (Code), $DOCROOT/$PFAD -> public/. konfig.php aus server/konfig.$UMGEBUNG.example.php:"
  echo "PUBLIC_KEY eintragen (öffentlicher Schlüssel von agff-familie, sso_schluessel.sh --$UMGEBUNG heureka), dann $0 --$UMGEBUNG"
  exit 0
fi

ssh "$ZIEL" "test -d $APP/public && test -L $DOCROOT/$PFAD && test -f $APP/konfig.php && test -d $APP/daten" \
  || { echo "Nicht eingerichtet: zuerst $0 --$UMGEBUNG einrichten"; exit 1; }

# --- Paket bauen (aus dem letzten Commit) ---
BAU=$(mktemp -d)
trap 'rm -rf "$BAU"' EXIT
git -C "$REPO" cat-file -e HEAD:public/index.html && git -C "$REPO" cat-file -e HEAD:public/konto.php \
  && git -C "$REPO" cat-file -e HEAD:server/dev/.htaccess || { echo "public/index.html, public/konto.php und server/dev/.htaccess müssen committet sein."; exit 1; }
git -C "$REPO" archive HEAD public server/dev | tar -x -C "$BAU"
COMMIT=$(git -C "$REPO" rev-parse HEAD)
KOMMENTAR="Commit: $(git -C "$REPO" log -1 --format='%h %s')"
if [ "$UMGEBUNG" = dev ]; then
  cp "$BAU/server/dev/.htaccess" "$BAU/public/.htaccess"   # Tor vor allem
fi
rm -rf "$BAU/server"
docker run --rm -v "$BAU/public:/b:ro" php:8.4.27-apache-trixie php -l /b/konto.php >/dev/null || { echo "konto.php hat Syntaxfehler. Abbruch."; exit 1; }

# --- Sperre-Block für dev: Liste der freien App-Pfade aus $DOCROOT/.sperre-frei (+ dieser Pfad), Text wie in lernherbar/scripts/deploy-allinkl.sh ---
SPERRE=""
if [ "$UMGEBUNG" = dev ]; then
  SPERRE="$BAU/sperre-block.txt"
  # Fehlt die Liste noch, gilt der bisherige Block: dort freies Lernherbar übernehmen, damit /herbar/ nicht gesperrt wird
  FREI_LISTE=$( { ssh "$ZIEL" "if [ -f $DOCROOT/.sperre-frei ]; then cat $DOCROOT/.sperre-frei; elif grep -q '|herbar(/' $DOCROOT/.htaccess 2>/dev/null; then echo herbar; fi"; echo "$PFAD"; } | grep -E '^[a-z0-9][a-z0-9-]*$' | sort -u)
  FREI_REGEX=$(echo "$FREI_LISTE" | paste -sd'|')
  { echo "# BEGIN dev-app-sperre (verwaltet von den Deploy-Skripten der Apps, Liste in .sperre-frei)"
    echo "## Testumgebung: Die Apps unter ihrem Pfad schützen sich selbst (Anmeldung mit AGFF-Konto). Alles andere auf"
    echo "## dieser Subdomain ist gesperrt; frei sind nur die Sperrseite und die Zertifikats-Erneuerung."
    echo "## THE_REQUEST statt REQUEST_URI: die Umleitung der Apps auf index.php ändert REQUEST_URI, die Anfragezeile nicht."
    echo "## Punkt-Segmente («/../») in der Anfragezeile sind gesperrt (sonst käme man über /app/../ an den Rest der Subdomain)."
    echo "<If \"%{REQUEST_URI} != '/sperre.html' && (%{THE_REQUEST} !~ m#^[A-Z]+ /(sperre\\.html|\\.well-known/[^ ]*|($FREI_REGEX)(/[^ ]*)?)[ ?]# || %{THE_REQUEST} =~ m#/(\\.|%2e){1,2}(/|%2f|[ ?])#i)\">"
    echo "  Require all denied"
    echo "  ErrorDocument 403 /sperre.html"
    echo "</If>"
    echo "<FilesMatch \"^\\.sperre-\">"
    echo "  Require all denied"
    echo "</FilesMatch>"
    echo "<IfModule mod_headers.c>"
    echo "  Header always set X-Robots-Tag \"noindex, nofollow\""
    echo "</IfModule>"
    echo "# END dev-app-sperre"; } > "$SPERRE"
  echo "$FREI_LISTE" > "$BAU/sperre-frei.txt"
fi

RSYNC=(-az -c --delete --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r)
if [ "$AKTION" = --trocken ]; then
  echo "$KOMMENTAR"
  rsync -n "${RSYNC[@]}" --itemize-changes "$BAU/public/" "$ZIEL:$APP/public/" | grep -v '^\.d' | head -60 || true
  [ -z "$SPERRE" ] || echo "Sperre dev-app: freie Pfade künftig: $(echo "$FREI_LISTE" | paste -sd' ')"
  exit 0
fi

# --- Sicherung des Server-Stands (public/ und konfig.php; daten/ sind nur kurzlebige Sitzungen und jti) ---
ssh "$ZIEL" "set -euo pipefail; mkdir -p -m 700 $SICHERUNGEN/$STEMPEL; cd $APP
  tar czf $SICHERUNGEN/$STEMPEL/code.tar.gz public \$(test -f konfig.php && echo konfig.php) 2>/dev/null || true
  chmod -R go-rwx $SICHERUNGEN/$STEMPEL
  ls -1d $SICHERUNGEN/*/ | head -n -10 | xargs -r rm -rf
  echo 'Sicherung: $SICHERUNGEN/$STEMPEL'"

# --- Hochladen (feste Rechte: mktemp legt den Bauordner mit 700 an) ---
rsync "${RSYNC[@]}" "$BAU/public/" "$ZIEL:$APP/public/"
ssh "$ZIEL" "set -e; cd $APP; echo '$COMMIT' > .deploy-commit; chmod 644 .deploy-commit
  mkdir -p -m 700 daten/jti daten/sessions
  echo 'Deploy $UMGEBUNG fertig: '\$(date)"

# --- Sperre in die .htaccess der Dokumentenwurzel (nur dev, erst nach dem Hochladen: /heureka/ wird erst frei, wenn das Tor läuft; nur der eigene Block wird ersetzt) ---
if [ -n "$SPERRE" ]; then
  scp -q "$SPERRE" "$ZIEL:$DOCROOT/.sperre-block.tmp"
  scp -q "$BAU/sperre-frei.txt" "$ZIEL:$DOCROOT/.sperre-frei"
  ssh "$ZIEL" "set -e; cd $DOCROOT; test -f sperre.html || { echo 'sperre.html fehlt (kommt vom Lernherbar-Deploy)'; exit 1; }
    cp -p .htaccess .htaccess.vorher
    awk '/^# BEGIN dev-app-sperre/{s=1} !s{print} /^# END dev-app-sperre/{s=0}' .htaccess > .htaccess.rest
    cat .sperre-block.tmp .htaccess.rest > .htaccess.neu && mv .htaccess.neu .htaccess && rm -f .htaccess.rest .sperre-block.tmp
    chmod 644 .htaccess .sperre-frei"
fi

# --- Prüfung von aussen ---
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$@" || true; }
fehler=0
if [ "$UMGEBUNG" = dev ]; then
  tor=$(curl -s --max-time 20 -w '\n%{http_code}' "https://$HOST/$PFAD/" || true)
  c1=${tor##*$'\n'}
  if [ "$c1" = 200 ] && grep -q 'name="heureka-konto"' <<<"$tor"; then echo "/$PFAD/ ohne Sitzung -> 200 Torseite"; else echo "FEHLER /$PFAD/ ohne Sitzung -> $c1 (erwartet Torseite)"; printf '%s\n' "$tor" | head -c 400; echo; fehler=1; fi
  c2=$(code "https://$HOST/$PFAD/js/app.js")
  case "$c2" in 302|403) echo "/$PFAD/js/app.js ohne Sitzung -> $c2" ;; *) echo "FEHLER /$PFAD/js/app.js ohne Sitzung -> $c2 (erwartet 302/403)"; fehler=1 ;; esac
  c3=$(code --path-as-is "https://$HOST/$PFAD/../"); c3b=$(code --path-as-is "https://$HOST/$PFAD/%2e%2e/%2e%2e/")
  case "$c3$c3b" in *200*) echo "FEHLER /$PFAD/../ -> $c3, /$PFAD/%2e%2e/ -> $c3b"; fehler=1 ;; *) echo "/$PFAD/../ -> $c3, /$PFAD/%2e%2e/%2e%2e/ -> $c3b (nichts ausgeliefert)" ;; esac
  c4=$(code "https://$HOST/irgendwas"); c4b=$(code "https://$HOST/.sperre-frei")
  if [ "$c4" = 403 ] && [ "$c4b" = 403 ]; then echo "/irgendwas -> 403, /.sperre-frei -> 403 (Sperre)"; else echo "FEHLER Sperre: /irgendwas -> $c4, /.sperre-frei -> $c4b (erwartet 403)"; fehler=1; fi
  c5=$(code "https://$HOST/herbar/")
  case "$c5" in 200|401) echo "/herbar/ weiterhin erreichbar -> $c5" ;; *) echo "FEHLER /herbar/ -> $c5 (erwartet 200/401)"; fehler=1 ;; esac
  if [ "$fehler" != 0 ]; then
    ssh "$ZIEL" "cd $DOCROOT && mv .htaccess.vorher .htaccess"
    echo "Prüfung fehlgeschlagen: die vorherige .htaccess der Dokumentenwurzel ist wiederhergestellt. Bitte prüfen."; exit 1
  fi
else
  c1=$(code "https://$HOST/$PFAD/"); echo "https://$HOST/$PFAD/ -> $c1"; [ "$c1" = 200 ] || fehler=1
  ich=$(curl -s --max-time 20 "https://$HOST/$PFAD/anmelden/ich" || true); echo "anmelden/ich -> $ich"
  grep -q '"angemeldet":false' <<<"$ich" || fehler=1
  for p in konto.php .htaccess ../apps/heureka/konfig.php; do c=$(code --path-as-is "https://$HOST/$PFAD/$p"); echo "/$PFAD/$p -> $c"; [ "$c" = 200 ] && fehler=1; done
  [ "$fehler" = 0 ] || exit 1
fi
echo "$KOMMENTAR"
