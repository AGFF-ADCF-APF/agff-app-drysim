#!/bin/sh
# Seiten, Sitemap und Service Worker erzeugen (tools/seiten.mjs) im Node-Container. Die Mediathek wird aus futter
# nachgezogen: Arbeitsordner ~/git/agff-app-futterwert/static/v2 (seit 23.11.2026), sonst der Home-Server-Stand.
cd "$(dirname "$0")/.." || exit 1
FUTTER=${FUTTER_STATIC:-$HOME/git/agff-app-futterwert/static/v2}
[ -f "$FUTTER/mediathek.js" ] || FUTTER=/opt/stacks/agff-apps/futter/static/v2
MOUNT=""
[ -f "$FUTTER/mediathek.js" ] && MOUNT="-v $FUTTER:/futter/static/v2:ro"
# shellcheck disable=SC2086
exec docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/app $MOUNT -w /app node:22-alpine node tools/seiten.mjs
