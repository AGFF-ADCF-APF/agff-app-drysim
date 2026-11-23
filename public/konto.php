<?php
declare(strict_types=1);

/**
 * Anmeldung von Heureka mit dem AGFF-Konto (SSO der Anmelde-Website, Plugin agff-familie, ~/git/lernherbar/docs/sso-agff.md).
 * Abgeleitet vom Tor von Pratum (agff-app-pratum/server/dev/tor.php).
 *
 * Zwei Betriebsarten (konfig.php, TOR):
 *  - live (TOR = false): Heureka ist öffentlich, Apache liefert die Dateien selbst aus. Nur /anmelden/… und /abmelden
 *    laufen hierher (.htaccess). Die Anmeldung braucht es nur für die Musterlösungen (Rechte heureka.teacher, heureka.admin).
 *  - dev (TOR = true): Jede Anfrage unter /heureka/ läuft hierher (server/dev/.htaccess); ohne Sitzung gibt es nur die Torseite.
 *
 * Wege: /anmelden/start[?ziel=…], /anmelden/zurueck?token=…&state=… (fest beim Anbieter eingetragen), /anmelden/ich (JSON:
 * angemeldet, lehrperson, rollen), /abmelden. Token: EdDSA (Ed25519), aud, iss, exp/iat, state, jti nur einmal.
 * Konfiguration: konfig.php eine Ebene über public/ (Beispiele server/konfig.dev.example.php, server/konfig.live.example.php) oder Datei in HEUREKA_KONFIG.
 * Gespeichert wird nur: angemeldet, sub, rollen (heureka.*), exp (keine Namen, keine Mails).
 */

final class Tor
{
    private const COOKIE = 'heureka_konto';
    private const SITZUNG_SEKUNDEN = 43200;      // 12 h
    private const STATE_SEKUNDEN = 1800;         // 30 Min.
    private const STATE_MAX = 5;
    private const TOKEN_ALTER_MAX = 300;         // 5 Min.
    private const TOLERANZ = 30;
    private const SPRACHEN = ['de', 'fr', 'it'];

    private const MIME = [
        'html' => 'text/html; charset=utf-8',
        'js' => 'text/javascript; charset=utf-8',
        'mjs' => 'text/javascript; charset=utf-8',
        'css' => 'text/css; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'webmanifest' => 'application/manifest+json; charset=utf-8',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'webp' => 'image/webp',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'pdf' => 'application/pdf',
        'wasm' => 'application/wasm',
        'xml' => 'application/xml; charset=utf-8',
        'ico' => 'image/x-icon',
        'txt' => 'text/plain; charset=utf-8',
    ];

    private const TEXTE = [
        'de' => [
            'titel' => 'Heureka – Anmeldung',
            'kopf' => 'Testumgebung Heureka – Anmeldung mit dem AGFF-Konto',
            'text' => 'Diese Testversion ist nicht öffentlich. Sie ist nur für Berechtigte mit AGFF-Konto.',
            'knopf' => 'Mit AGFF-Konto anmelden',
            'erneut' => 'Nochmals anmelden',
            'access_denied' => 'Dieses Konto hat keinen Zugang zu Heureka.',
            'cancelled' => 'Die Anmeldung wurde abgebrochen.',
            'fehler' => 'Die Anmeldung hat nicht geklappt. Bitte noch einmal versuchen.',
            'nichtgefunden' => 'Nicht gefunden.',
            'aus' => 'Die Anmeldung ist hier nicht eingerichtet.',
        ],
        'fr' => [
            'titel' => 'Heureka – connexion',
            'kopf' => 'Environnement de test Heureka – connexion avec le compte AGFF',
            'text' => 'Cette version de test n’est pas publique. Elle est réservée aux personnes autorisées avec un compte AGFF.',
            'knopf' => 'Se connecter avec le compte AGFF',
            'erneut' => 'Se connecter à nouveau',
            'access_denied' => 'Ce compte n’a pas accès à Heureka.',
            'cancelled' => 'La connexion a été annulée.',
            'fehler' => 'La connexion a échoué. Veuillez réessayer.',
            'nichtgefunden' => 'Introuvable.',
            'aus' => 'La connexion n’est pas configurée ici.',
        ],
        'it' => [
            'titel' => 'Heureka – accesso',
            'kopf' => 'Ambiente di test Heureka – accesso con il conto AGFF',
            'text' => 'Questa versione di test non è pubblica. È riservata alle persone autorizzate con conto AGFF.',
            'knopf' => 'Accedi con il conto AGFF',
            'erneut' => 'Accedi di nuovo',
            'access_denied' => 'Questo conto non ha accesso a Heureka.',
            'cancelled' => 'L’accesso è stato annullato.',
            'fehler' => 'L’accesso non è riuscito. Riprova.',
            'nichtgefunden' => 'Non trovato.',
            'aus' => 'L’accesso non è configurato qui.',
        ],
    ];

    private string $basis;
    private string $public;
    private string $daten;
    private array $k;
    private string $sprache = 'de';
    private bool $tor;
    private bool $eingerichtet;

    public function __construct(array $konfig)
    {
        $this->k = $konfig;
        $this->basis = rtrim((string) ($konfig['BASIS'] ?? ''), '/');
        $public = realpath((string) ($konfig['PUBLIC_DIR'] ?? __DIR__));
        if ($public === false) {
            self::ende(500, 'Konfiguration fehlerhaft');
        }
        $this->public = $public;
        $this->daten = rtrim((string) ($konfig['DATEN_DIR'] ?? dirname(__DIR__) . '/daten'), '/');
        $this->sprache = $this->spracheErkennen();
        $this->tor = ($konfig['TOR'] ?? false) === true;
        $this->eingerichtet = self::vollstaendig($konfig);
    }

    public static function vollstaendig(?array $k): bool
    {
        foreach (['START_URL', 'ISSUER', 'CLIENT', 'PUBLIC_KEY'] as $n) {
            if (!is_array($k) || !is_string($k[$n] ?? null) || $k[$n] === '') {
                return false;
            }
        }
        return true;
    }

    public function laufen(): void
    {
        $methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if ($methode !== 'GET' && $methode !== 'HEAD') {
            header('Allow: GET, HEAD');
            self::ende(405, 'Method Not Allowed');
        }

        // Pfad: nur bis «?», dann dekodieren (parse_url würde «//x» als Host lesen)
        $roh = (string) strstr(($_SERVER['REQUEST_URI'] ?? '/') . '?', '?', true);
        $pfad = rawurldecode($roh);
        if ($pfad === '' || $pfad[0] !== '/' || preg_match('/[\x00-\x1f\x7f\\\\]/', $pfad)) {
            self::ende(400, 'Bad Request');
        }
        if ($this->basis !== '') {
            if ($pfad === $this->basis) {
                $this->weiter($this->basis . '/');
            }
            if (strncmp($pfad, $this->basis . '/', strlen($this->basis) + 1) !== 0) {
                $this->nichtGefunden();
            }
            $pfad = substr($pfad, strlen($this->basis));   // beginnt mit «/»
        }

        switch ($pfad) {
            case '/anmelden/ich':
                $this->ich();
            case '/anmelden/start':
                $this->eingerichtet || $this->meldung('aus', 'nicht eingerichtet', 503);
                $this->start();
            case '/anmelden/zurueck':
                $this->eingerichtet || $this->meldung('aus', 'nicht eingerichtet', 503);
                $this->rueckkehr();
            case '/abmelden':
                $this->abmelden();
        }
        if (!$this->tor) {
            $this->nichtGefunden();               // live liefert Apache die Dateien selbst aus
        }

        if ($this->angemeldet()) {
            $this->ausliefern($pfad, $methode === 'HEAD');
        }

        // Ohne Sitzung: Seiten (Verzeichnisse, .html, ohne Endung) zeigen die Torseite, alles andere ist verboten
        $letzter = basename(rtrim($pfad, '/'));
        $seite = substr($pfad, -1) === '/' || !str_contains($letzter, '.') || str_ends_with(strtolower($letzter), '.html');
        if ($seite) {
            $this->torseite($this->zielPruefen($this->basis . $pfad));
        }
        self::ende(403, 'Forbidden');
    }

    // ------------------------------------------------------------------ Anmeldung

    private function start(): never
    {
        $ziel = $this->zielPruefen((string) ($_GET['ziel'] ?? '')) ?? $this->basis . '/';
        $this->aufraeumen();
        $this->sitzungOeffnen(true);

        $jetzt = time();
        $offen = array_filter((array) ($_SESSION['states'] ?? []),
            fn($e) => is_array($e) && ($e['t'] ?? 0) > $jetzt - self::STATE_SEKUNDEN);
        while (count($offen) >= self::STATE_MAX) {
            array_shift($offen);
        }
        $state = bin2hex(random_bytes(16));
        $offen[$state] = ['t' => $jetzt, 'ziel' => $ziel];
        $_SESSION['states'] = $offen;
        session_write_close();

        $start = (string) $this->k['START_URL'];
        $this->weiter($start . (str_contains($start, '?') ? '&' : '?')
            . http_build_query(['client' => $this->k['CLIENT'], 'state' => $state, 'sprache' => $this->sprache]));
    }

    private function rueckkehr(): never
    {
        $state = (string) ($_GET['state'] ?? '');
        $token = (string) ($_GET['token'] ?? '');
        $fehler = (string) ($_GET['error'] ?? '');
        $this->aufraeumen();

        if (!preg_match('/^[0-9a-f]{32}$/', $state) || !$this->sitzungOeffnen(false)) {
            $this->meldung('fehler', 'state oder sitzung fehlt');
        }
        $eintrag = $_SESSION['states'][$state] ?? null;
        unset($_SESSION['states'][$state]);          // jeder state gilt nur einmal
        if (!is_array($eintrag) || ($eintrag['t'] ?? 0) < time() - self::STATE_SEKUNDEN) {
            session_write_close();
            $this->meldung('fehler', 'state unbekannt oder abgelaufen');
        }
        if ($fehler !== '') {
            session_write_close();
            $this->meldung($fehler === 'access_denied' ? 'access_denied' : ($fehler === 'cancelled' ? 'cancelled' : 'fehler'),
                'anbieter meldet ' . preg_replace('/[^a-z_]/', '', $fehler), $fehler === 'cancelled' ? 200 : 403);
        }

        [$daten, $grund] = $this->tokenPruefen($token, $state);
        if ($daten === null) {
            session_write_close();
            $this->meldung('fehler', 'token abgelehnt: ' . $grund);
        }
        if (!$this->jtiEinmalig((string) $daten['jti'])) {
            session_write_close();
            $this->meldung('fehler', 'token abgelehnt: jti schon verwendet');
        }

        session_regenerate_id(true);
        $rollen = array_values(array_filter((array) ($daten['roles'] ?? []),
            fn($r) => is_string($r) && str_starts_with($r, $this->k['CLIENT'] . '.') && strlen($r) <= 64));
        $_SESSION = [
            'angemeldet' => true,
            'sub' => (string) $daten['sub'],
            'rollen' => $rollen,
            'exp' => time() + self::SITZUNG_SEKUNDEN,
        ];
        session_write_close();
        $this->weiter((string) $eintrag['ziel']);
    }

    /** Für das Spiel: angemeldet? Lehrperson (heureka.teacher oder heureka.admin)? Nie zwischenspeichern. */
    private function ich(): never
    {
        $rollen = [];
        $an = false;
        if ($this->eingerichtet && isset($_COOKIE[self::COOKIE]) && is_string($_COOKIE[self::COOKIE]) && $this->sitzungOeffnen(false)) {
            $an = ($_SESSION['angemeldet'] ?? false) === true && (int) ($_SESSION['exp'] ?? 0) > time();
            $rollen = $an ? array_values((array) ($_SESSION['rollen'] ?? [])) : [];
            session_write_close();
        }
        $c = (string) ($this->k['CLIENT'] ?? 'heureka');
        $lehr = in_array($c . '.teacher', $rollen, true) || in_array($c . '.admin', $rollen, true);
        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        echo json_encode(['angemeldet' => $an, 'lehrperson' => $lehr, 'rollen' => $rollen, 'eingerichtet' => $this->eingerichtet]);
        exit;
    }

    private function abmelden(): never
    {
        if ($this->sitzungOeffnen(false)) {
            $_SESSION = [];
            session_destroy();
        }
        setcookie(self::COOKIE, '', [
            'expires' => 1, 'path' => $this->basis . '/', 'secure' => $this->k['SECURE'] ?? true,
            'httponly' => true, 'samesite' => 'Lax',
        ]);
        $this->weiter($this->basis . '/');
    }

    /**
     * @return array{0: ?array, 1: string} Inhalt des Tokens oder null mit Grund (nur Grund wird geloggt, nie Inhalte)
     */
    private function tokenPruefen(string $token, string $state): array
    {
        if ($token === '' || strlen($token) > 4096 || substr_count($token, '.') !== 2) {
            return [null, 'form'];
        }
        [$h, $p, $s] = explode('.', $token);
        $kopf = json_decode((string) self::b64dec($h), true);
        $sig = self::b64dec($s);
        $inhaltRoh = self::b64dec($p);
        $schluessel = base64_decode((string) ($this->k['PUBLIC_KEY'] ?? ''), true);
        if (!is_array($kopf) || ($kopf['alg'] ?? '') !== 'EdDSA' || $sig === null || $inhaltRoh === null) {
            return [null, 'kopf'];
        }
        if ($schluessel === false || strlen($schluessel) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES) {
            return [null, 'schluessel in der konfiguration'];
        }
        if (strlen($sig) !== SODIUM_CRYPTO_SIGN_BYTES || !sodium_crypto_sign_verify_detached($sig, $h . '.' . $p, $schluessel)) {
            return [null, 'signatur'];
        }
        $d = json_decode($inhaltRoh, true);
        if (!is_array($d)) {
            return [null, 'inhalt'];
        }
        if (($d['aud'] ?? null) !== $this->k['CLIENT']) {
            return [null, 'aud'];
        }
        if (($d['iss'] ?? null) !== $this->k['ISSUER']) {
            return [null, 'iss'];
        }
        $iat = $d['iat'] ?? null;
        $exp = $d['exp'] ?? null;
        $jetzt = time();
        if (!is_int($iat) || !is_int($exp) || $exp <= $iat) {
            return [null, 'zeiten'];
        }
        if ($exp + self::TOLERANZ < $jetzt) {
            return [null, 'abgelaufen'];
        }
        if ($iat - self::TOLERANZ > $jetzt || $jetzt - $iat > self::TOKEN_ALTER_MAX) {
            return [null, 'iat'];
        }
        if (!is_string($d['state'] ?? null) || !hash_equals($state, $d['state'])) {
            return [null, 'state'];
        }
        if (!is_string($d['sub'] ?? null) || $d['sub'] === '' || strlen($d['sub']) > 200) {
            return [null, 'sub'];
        }
        if (!is_string($d['jti'] ?? null) || !preg_match('/^[A-Za-z0-9_-]{16,128}$/', $d['jti'])) {
            return [null, 'jti'];
        }
        return [$d, ''];
    }

    /** true, wenn die Kennung neu ist (Datei atomar anlegen); alte Dateien räumt aufraeumen() weg */
    private function jtiEinmalig(string $jti): bool
    {
        $ordner = $this->daten . '/jti';
        if (!is_dir($ordner) && !@mkdir($ordner, 0700, true) && !is_dir($ordner)) {
            error_log('heureka-konto: jti-Ordner nicht anlegbar');
            return false;
        }
        $f = @fopen($ordner . '/' . hash('sha256', $jti), 'x');
        if ($f === false) {
            return false;
        }
        fclose($f);
        return true;
    }

    private function aufraeumen(): void
    {
        $grenze = time() - 86400;
        foreach (glob($this->daten . '/jti/*') ?: [] as $f) {
            if (is_file($f) && (int) @filemtime($f) < $grenze) {
                @unlink($f);
            }
        }
        $grenze = time() - self::SITZUNG_SEKUNDEN - 3600;
        foreach (glob($this->daten . '/sessions/sess_*') ?: [] as $f) {
            if (is_file($f) && (int) @filemtime($f) < $grenze) {
                @unlink($f);
            }
        }
    }

    /** Zieladresse: nur ein Pfad unter der Basis (keine offene Weiterleitung), sonst null */
    private function zielPruefen(string $ziel): ?string
    {
        $prefix = $this->basis . '/';
        if ($ziel === '' || strncmp($ziel, $prefix, strlen($prefix)) !== 0 || str_starts_with($ziel, '//')
            || !preg_match('#^[A-Za-z0-9._~/%@+,;=:-]*$#', $ziel) || str_contains($ziel, '//')) {
            return null;
        }
        $decoded = rawurldecode($ziel);
        if (preg_match('#(^|/)\.\.?(/|$)#', $decoded) || preg_match('/[\x00-\x1f\x7f\\\\]/', $decoded)) {
            return null;
        }
        $rest = substr($ziel, strlen($this->basis));
        if (str_starts_with($rest, '/anmelden/') || str_starts_with($rest, '/abmelden')) {
            return null;
        }
        return $ziel;
    }

    // ------------------------------------------------------------------ Sitzung

    private function sitzungOeffnen(bool $neu): bool
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return true;
        }
        if (!$neu && !isset($_COOKIE[self::COOKIE])) {
            return false;
        }
        $ordner = $this->daten . '/sessions';
        if (!is_dir($ordner) && !@mkdir($ordner, 0700, true) && !is_dir($ordner)) {
            self::ende(500, 'Sitzungsordner fehlt');
        }
        session_save_path($ordner);
        session_name(self::COOKIE);
        session_cache_limiter('');
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        ini_set('session.gc_maxlifetime', (string) self::SITZUNG_SEKUNDEN);
        session_set_cookie_params([
            'lifetime' => self::SITZUNG_SEKUNDEN,
            'path' => $this->basis . '/',
            'secure' => (bool) ($this->k['SECURE'] ?? true),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        if (!session_start()) {
            self::ende(500, 'Sitzung nicht startbar');
        }
        if (isset($_SESSION['exp']) && (int) $_SESSION['exp'] < time()) {
            $_SESSION = [];
        }
        return true;
    }

    private function angemeldet(): bool
    {
        if (!isset($_COOKIE[self::COOKIE]) || !is_string($_COOKIE[self::COOKIE]) || !$this->sitzungOeffnen(false)) {
            return false;
        }
        $ok = ($_SESSION['angemeldet'] ?? false) === true && (int) ($_SESSION['exp'] ?? 0) > time();
        session_write_close();     // Datei gibt die Sperre frei, bevor grosse Dateien gesendet werden
        return $ok;
    }

    // ------------------------------------------------------------------ Dateien

    private function ausliefern(string $pfad, bool $kopfNur): never
    {
        $segmente = [];
        foreach (explode('/', $pfad) as $s) {
            if ($s === '') {
                continue;
            }
            if ($s[0] === '.') {                    // versteckte Dateien und «..»
                $this->nichtGefunden();
            }
            $segmente[] = $s;
        }
        $voll = $this->public . ($segmente ? '/' . implode('/', $segmente) : '');
        $real = realpath($voll);
        if ($real === false) {
            $this->nichtGefunden();
        }
        if (is_dir($real)) {
            if (substr($pfad, -1) !== '/' && $segmente) {
                $this->weiter($this->basis . $pfad . '/');
            }
            $real = realpath($real . '/index.html');
            if ($real === false) {
                $this->nichtGefunden();
            }
        }
        if (strncmp($real, $this->public . '/', strlen($this->public) + 1) !== 0 || !is_file($real)) {
            $this->nichtGefunden();
        }
        // auch nach dem Auflösen von Symlinks: nichts Verstecktes, nicht das Tor selbst
        foreach (explode('/', substr($real, strlen($this->public) + 1)) as $s) {
            if ($s[0] === '.') {
                $this->nichtGefunden();
            }
        }
        $name = basename($real);
        $endung = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (strcasecmp($name, 'konto.php') === 0 || !isset(self::MIME[$endung])) {
            $this->nichtGefunden();
        }

        $mtime = (int) filemtime($real);
        $size = (int) filesize($real);
        $etag = '"' . dechex($mtime) . '-' . dechex($size) . '"';
        header('Content-Type: ' . self::MIME[$endung]);
        header('X-Content-Type-Options: nosniff');
        header('X-Robots-Tag: noindex, nofollow');
        header('Referrer-Policy: same-origin');
        header('ETag: ' . $etag);
        header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
        if ($name === 'sw.js') {
            header('Service-Worker-Allowed: ' . $this->basis . '/');
        }
        header('Cache-Control: ' . (in_array($name, ['sw.js', 'index.html'], true) ? 'private, no-cache' : 'private, max-age=3600'));

        $inm = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
        $ims = $_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? '';
        $unveraendert = $inm !== ''
            ? in_array($etag, array_map('trim', explode(',', str_replace('W/', '', $inm))), true) || trim($inm) === '*'
            : ($ims !== '' && ($t = strtotime($ims)) !== false && $t >= $mtime);
        if ($unveraendert) {
            http_response_code(304);
            exit;
        }

        $von = 0;
        $bis = $size - 1;
        if ($endung === 'pdf') {
            header('Accept-Ranges: bytes');
            $range = $_SERVER['HTTP_RANGE'] ?? '';
            if ($range !== '') {
                if (!preg_match('/^bytes=(\d*)-(\d*)$/', $range, $m) || ($m[1] === '' && $m[2] === '')) {
                    header('Content-Range: bytes */' . $size);
                    self::ende(416, 'Range Not Satisfiable');
                }
                if ($m[1] === '') {                  // letzte n Byte
                    $von = max(0, $size - (int) $m[2]);
                } else {
                    $von = (int) $m[1];
                    $bis = $m[2] === '' ? $size - 1 : min((int) $m[2], $size - 1);
                }
                if ($von > $bis || $von >= $size) {
                    header('Content-Range: bytes */' . $size);
                    self::ende(416, 'Range Not Satisfiable');
                }
                http_response_code(206);
                header('Content-Range: bytes ' . $von . '-' . $bis . '/' . $size);
            }
        }
        header('Content-Length: ' . ($bis - $von + 1));
        if ($kopfNur) {
            exit;
        }
        $f = fopen($real, 'rb');
        if ($f === false) {
            exit;
        }
        fseek($f, $von);
        $rest = $bis - $von + 1;
        while ($rest > 0 && !feof($f)) {
            $teil = fread($f, min(65536, $rest));
            if ($teil === false || $teil === '') {
                break;
            }
            echo $teil;
            $rest -= strlen($teil);
        }
        fclose($f);
        exit;
    }

    // ------------------------------------------------------------------ Seiten und Hilfen

    private function torseite(?string $ziel): never
    {
        $t = self::TEXTE[$this->sprache];
        $link = $this->basis . '/anmelden/start' . ($ziel !== null ? '?ziel=' . rawurlencode($ziel) : '');
        $this->seite(200, $t['kopf'], '<p>' . self::h($t['text']) . '</p><a class="knopf" href="' . self::h($link) . '">'
            . self::h($t['knopf']) . '</a>');
    }

    private function meldung(string $art, string $logGrund, int $status = 403): never
    {
        error_log('heureka-konto: ' . $logGrund);       // nur der Grund, nie Namen, Mails oder Token
        $t = self::TEXTE[$this->sprache];
        $this->seite($art === 'fehler' ? 400 : $status, $t['titel'], '<p>' . self::h($t[$art]) . '</p><a class="knopf" href="'
            . self::h($this->basis . '/anmelden/start') . '">' . self::h($t['erneut']) . '</a>');
    }

    private function seite(int $status, string $titel, string $inhalt): never
    {
        http_response_code($status);
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Robots-Tag: noindex, nofollow');
        header('Referrer-Policy: no-referrer');
        header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'");
        echo '<!doctype html><html lang="' . $this->sprache . '"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1">'
            . '<meta name="robots" content="noindex, nofollow"><meta name="heureka-konto" content="1">'
            . '<title>' . self::h($titel) . '</title>'
            . '<style>body{font:17px/1.5 system-ui,sans-serif;max-width:32em;margin:12vh auto;padding:0 16px;color:#1f2421}'
            . '.knopf{display:inline-block;margin-top:1em;padding:.7em 1.2em;background:#2f6f3e;color:#fff;border-radius:10px;text-decoration:none}</style>'
            . '</head><body><h1>' . self::h($titel) . '</h1>' . $inhalt . '</body></html>';
        exit;
    }

    private function nichtGefunden(): never
    {
        $this->seite(404, self::TEXTE[$this->sprache]['nichtgefunden'], '');
    }

    private function weiter(string $url): never
    {
        header('Cache-Control: no-store');
        header('Referrer-Policy: no-referrer');
        header('Location: ' . $url, true, 302);
        exit;
    }

    private function spracheErkennen(): string
    {
        $beste = 'de';
        $bestQ = -1.0;
        foreach (explode(',', (string) ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '')) as $teil) {
            $x = explode(';', trim($teil));
            $code = strtolower(substr(trim($x[0]), 0, 2));
            $q = 1.0;
            if (isset($x[1]) && preg_match('/q=([0-9.]+)/', $x[1], $m)) {
                $q = (float) $m[1];
            }
            if (in_array($code, self::SPRACHEN, true) && $q > $bestQ && $q > 0) {
                $beste = $code;
                $bestQ = $q;
            }
        }
        return $beste;
    }

    private static function b64dec(string $s): ?string
    {
        if ($s === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $s)) {
            return null;
        }
        $r = base64_decode(strtr($s, '-_', '+/'), true);
        return $r === false ? null : $r;
    }

    private static function h(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private static function ende(int $status, string $text): never
    {
        http_response_code($status);
        header('Content-Type: text/plain; charset=utf-8');
        header('Cache-Control: no-store');
        echo $text;
        exit;
    }
}

(function (): void {
    $datei = getenv('HEUREKA_KONFIG') ?: dirname(__DIR__) . '/konfig.php';
    $k = is_file($datei) ? require $datei : null;
    if (!is_array($k)) {
        $k = [];
    }
    $k += ['BASIS' => '/heureka', 'CLIENT' => 'heureka', 'TOR' => false];
    if (($k['TOR'] ?? false) === true && !Tor::vollstaendig($k)) {
        http_response_code(500);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Konfiguration fehlt';
        exit;
    }
    (new Tor($k))->laufen();
})();
