<?php
// Konfiguration der Anmeldung von Heureka (public/konto.php). Auf dem Server als apps/heureka[-dev]/konfig.php, nicht in public/,
// nicht in git. Enthält keine Geheimnisse: der öffentliche Schlüssel kann Tokens nur prüfen, nicht ausstellen.
// Fehlt die Datei oder ein Wert, ist die Anmeldung aus: live spielt man ohne Musterlösungen weiter, dev bleibt gesperrt.
return [
    // Anmelde-Website der AGFF (agff-familie): dev https://dev-graswachstum.graswachstum.ch, live https://graswachstum.ch
    'START_URL' => 'https://dev-graswachstum.graswachstum.ch/_konto/sso/extern',
    // «iss» im Token = Adresse der Anmelde-Website
    'ISSUER' => 'https://dev-graswachstum.graswachstum.ch',
    'CLIENT' => 'heureka',
    // Ed25519, 32 Byte, base64 (je Umgebung eigener Schlüssel, von agff-familie werkzeuge/sso_schluessel.sh)
    'PUBLIC_KEY' => '',
    'BASIS' => '/heureka',
    'SECURE' => true,
    // dev: true (Tor vor allem), live: false (öffentlich, Anmeldung nur für die Musterlösungen)
    'TOR' => true,
];
