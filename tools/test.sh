#!/bin/sh
# Alle Prüfungen: Modell und Spiel (Node-Container), Anmeldung konto.php (PHP-Container). Bricht beim ersten Fehler ab.
cd "$(dirname "$0")/.." || exit 1
for t in run fat belueftung bedienung muster; do
  docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/app -w /app node:22-alpine node "test/$t.mjs" > /dev/null 2>&1 \
    && echo "OK      test/$t.mjs" || { echo "FEHLER  test/$t.mjs"; exit 1; }
done
test/konto/test.sh | tail -1
