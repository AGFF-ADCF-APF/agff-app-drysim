<?php
declare(strict_types=1);
// Test von public/konto.php (Anmeldung mit dem AGFF-Konto) gegen den eingebauten PHP-Server in beiden Betriebsarten.
// Aufruf: test/konto/test.sh. Das Schlüsselpaar entsteht nur für den Test.
$paar = sodium_crypto_sign_keypair();
$privat = sodium_crypto_sign_secretkey($paar);
$fremd = sodium_crypto_sign_secretkey(sodium_crypto_sign_keypair());
$ISS = 'http://anbieter.test';
$t = sys_get_temp_dir() . '/konto-' . bin2hex(random_bytes(4));
mkdir($t);
$ok = 0; $fail = 0;
function pruefe(string $n, bool $b, string $info = ''): void { global $ok, $fail; if ($b) { $ok++; echo "OK      $n\n"; } else { $fail++; echo "FEHLER  $n $info\n"; } }
function b64(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function token(array $aend = [], ?string $schl = null): string {
    global $privat, $ISS;
    $j = time();
    $d = array_merge(['iss' => $ISS, 'aud' => 'heureka', 'sub' => 'test', 'name' => 'Test', 'roles' => ['heureka.teacher'],
        'state' => '', 'iat' => $j, 'exp' => $j + 60, 'jti' => bin2hex(random_bytes(16))], $aend);
    $k = b64(json_encode(['alg' => 'EdDSA', 'typ' => 'JWT'])); $p = b64(json_encode($d));
    return $k . '.' . $p . '.' . b64(sodium_crypto_sign_detached($k . '.' . $p, $schl ?? $privat));
}
function server(string $name, bool $tor, int $port): void {
    global $t, $paar, $ISS;
    $konfig = "$t/$name.php";
    file_put_contents($konfig, '<?php return ' . var_export(['START_URL' => "$ISS/_konto/sso/extern", 'ISSUER' => $ISS, 'CLIENT' => 'heureka',
        'PUBLIC_KEY' => base64_encode(sodium_crypto_sign_publickey($paar)), 'BASIS' => '/heureka', 'SECURE' => false, 'TOR' => $tor,
        'PUBLIC_DIR' => '/app/public', 'DATEN_DIR' => "$t/daten-$name"], true) . ';');
    $cmd = sprintf('HEUREKA_KONFIG=%s php -S 127.0.0.1:%d /app/public/konto.php > %s/%s.log 2>&1 & echo $!', escapeshellarg($konfig), $port, $t, $name);
    exec($cmd);
}
// einfacher Client ohne Weiterleitungen, mit Cookie
function hole(int $port, string $pfad, array &$cookies = []): array {
    $kopf = $cookies ? ['Cookie: ' . implode('; ', array_map(fn($k, $v) => "$k=$v", array_keys($cookies), $cookies))] : [];
    $ctx = stream_context_create(['http' => ['follow_location' => 0, 'ignore_errors' => true, 'header' => $kopf]]);
    $body = @file_get_contents("http://127.0.0.1:$port$pfad", false, $ctx);
    $h = $http_response_header ?? [];
    $status = (int) (explode(' ', $h[0] ?? 'X 0')[1] ?? 0);
    $loc = '';
    foreach ($h as $z) {
        if (stripos($z, 'Location:') === 0) $loc = trim(substr($z, 9));
        if (stripos($z, 'Set-Cookie:') === 0 && preg_match('/^Set-Cookie:\s*([^=]+)=([^;]*)/i', $z, $m)) {
            if ($m[2] === '' || $m[2] === 'deleted') unset($cookies[$m[1]]); else $cookies[$m[1]] = $m[2];
        }
    }
    return ['status' => $status, 'loc' => $loc, 'body' => (string) $body, 'kopf' => $h];
}
function anmelden(int $port, array $aend = [], ?string $schl = null, array &$c = []): array {
    $r = hole($port, '/heureka/anmelden/start?ziel=%2Fheureka%2Funterricht.html', $c);
    parse_str((string) parse_url($r['loc'], PHP_URL_QUERY), $q);
    $state = $q['state'] ?? '';
    $tok = token(array_merge(['state' => $state], $aend), $schl);
    return hole($port, '/heureka/anmelden/zurueck?' . http_build_query(['token' => $tok, 'state' => $state]), $c);
}
server('live', false, 8861);
server('dev', true, 8862);
usleep(600000);

// --- live
$c = [];
$r = hole(8861, '/heureka/anmelden/ich', $c);
$j = json_decode($r['body'], true);
pruefe('live: ich ohne Sitzung -> nicht angemeldet, keine Lehrperson, no-store', $r['status'] === 200 && $j['angemeldet'] === false && $j['lehrperson'] === false && $j['eingerichtet'] === true
    && (bool) preg_grep('/^Cache-Control: no-store/i', $r['kopf']));
$r = hole(8861, '/heureka/anmelden/start', $c);
pruefe('live: start leitet zum Anbieter mit client=heureka', $r['status'] === 302 && str_starts_with($r['loc'], "$ISS/_konto/sso/extern?") && str_contains($r['loc'], 'client=heureka'));
$c = [];
$r = anmelden(8861, [], null, $c);
pruefe('live: gültiges Token -> zurück zum Ziel', $r['status'] === 302 && $r['loc'] === '/heureka/unterricht.html', $r['status'] . ' ' . $r['loc']);
$j = json_decode(hole(8861, '/heureka/anmelden/ich', $c)['body'], true);
pruefe('live: danach Lehrperson', $j['angemeldet'] === true && $j['lehrperson'] === true && $j['rollen'] === ['heureka.teacher']);
hole(8861, '/heureka/abmelden', $c);
$j = json_decode(hole(8861, '/heureka/anmelden/ich', $c)['body'], true);
pruefe('live: abmelden beendet die Sitzung', $j['angemeldet'] === false);
$c = [];
anmelden(8861, ['roles' => ['herbar.teacher', 'heureka.x']], null, $c);
$j = json_decode(hole(8861, '/heureka/anmelden/ich', $c)['body'], true);
pruefe('live: angemeldet ohne heureka.teacher/admin -> keine Lehrperson, fremde Rollen verworfen', $j['angemeldet'] === true && $j['lehrperson'] === false && $j['rollen'] === ['heureka.x']);
$c = []; $r = anmelden(8861, ['roles' => ['heureka.admin']], null, $c);
pruefe('live: heureka.admin -> Lehrperson', json_decode(hole(8861, '/heureka/anmelden/ich', $c)['body'], true)['lehrperson'] === true);
foreach ([['fremde Signatur', [], $fremd], ['falsches aud', ['aud' => 'pratum'], null], ['falscher Aussteller', ['iss' => 'http://boese.test'], null],
          ['abgelaufen', ['iat' => time() - 400, 'exp' => time() - 340], null], ['jti zu kurz', ['jti' => 'x'], null]] as [$n, $a, $s]) {
    $c = []; $r = anmelden(8861, $a, $s, $c);
    $j = json_decode(hole(8861, '/heureka/anmelden/ich', $c)['body'], true);
    pruefe("live: $n -> abgelehnt, keine Sitzung", $r['status'] === 400 && $j['angemeldet'] === false, (string) $r['status']);
}
$c = []; $r = hole(8861, '/heureka/anmelden/start', $c);
parse_str((string) parse_url($r['loc'], PHP_URL_QUERY), $q);
$tok = token(['state' => $q['state']]);
hole(8861, '/heureka/anmelden/zurueck?' . http_build_query(['token' => $tok, 'state' => $q['state']]), $c);
$c2 = $c; $r = hole(8861, '/heureka/anmelden/zurueck?' . http_build_query(['token' => $tok, 'state' => $q['state']]), $c2);
pruefe('live: dasselbe Token/state zweimal -> abgelehnt', $r['status'] === 400);
$fremdC = []; $r = hole(8861, '/heureka/anmelden/zurueck?' . http_build_query(['token' => token(['state' => str_repeat('a', 32)]), 'state' => str_repeat('a', 32)]), $fremdC);
pruefe('live: state ohne eigene Sitzung -> abgelehnt', $r['status'] === 400);
$c = []; $r = hole(8861, '/heureka/anmelden/start?ziel=https%3A%2F%2Fboese.test%2F', $c);
parse_str((string) parse_url($r['loc'], PHP_URL_QUERY), $q);
$r = hole(8861, '/heureka/anmelden/zurueck?' . http_build_query(['token' => token(['state' => $q['state']]), 'state' => $q['state']]), $c);
pruefe('live: fremdes Ziel -> keine offene Weiterleitung', $r['status'] === 302 && $r['loc'] === '/heureka/');
$r = hole(8861, '/heureka/anmelden/zurueck?error=access_denied&state=' . str_repeat('b', 32));
pruefe('live: error ohne Sitzung -> Meldung, kein Absturz', in_array($r['status'], [400, 403], true));
$r = hole(8861, '/heureka/index.html');
pruefe('live: konto.php liefert keine Dateien aus (macht Apache)', $r['status'] === 404);

// --- dev (Tor)
$c = [];
$r = hole(8862, '/heureka/', $c);
pruefe('dev: ohne Sitzung Torseite', $r['status'] === 200 && str_contains($r['body'], 'heureka-konto') && str_contains($r['body'], 'anmelden/start'));
$r = hole(8862, '/heureka/js/app.js', $c);
pruefe('dev: ohne Sitzung keine Dateien', $r['status'] === 403);
$r = anmelden(8862, ['roles' => []], null, $c);
$r = hole(8862, '/heureka/', $c);
pruefe('dev: angemeldet (auch ohne Rolle) -> Startseite', $r['status'] === 200 && str_contains($r['body'], 'HEU'));
$r = hole(8862, '/heureka/js/app.js', $c);
pruefe('dev: angemeldet -> Skript mit richtigem Typ', $r['status'] === 200 && (bool) preg_grep('#^Content-Type: text/javascript#i', $r['kopf']));
$r = hole(8862, '/heureka/sitemap.xml', $c);
pruefe('dev: sitemap.xml ausgeliefert', $r['status'] === 200);
foreach (['/heureka/konto.php', '/heureka/.htaccess', '/heureka/../server/konfig.example.php', '/heureka/%2e%2e/konfig.php'] as $p) {
    $r = hole(8862, $p, $c);
    pruefe("dev: $p gesperrt", in_array($r['status'], [400, 403, 404], true), (string) $r['status']);
}
$j = json_decode(hole(8862, '/heureka/anmelden/ich', $c)['body'], true);
pruefe('dev: ich ohne Rolle -> angemeldet, keine Lehrperson', $j['angemeldet'] === true && $j['lehrperson'] === false);

// --- ohne Konfiguration (live): ich sagt «nicht eingerichtet», start 503
exec(sprintf('HEUREKA_KONFIG=/gibtsnicht php -S 127.0.0.1:8863 /app/public/konto.php > %s/ohne.log 2>&1 &', $t));
usleep(400000);
$j = json_decode(hole(8863, '/heureka/anmelden/ich')['body'], true);
pruefe('ohne konfig: ich -> nicht eingerichtet', $j['eingerichtet'] === false && $j['angemeldet'] === false);
pruefe('ohne konfig: start -> 503', hole(8863, '/heureka/anmelden/start')['status'] === 503);

exec('pkill -f "php -S 127.0.0.1:886" 2>/dev/null');
echo $fail ? "$fail Prüfung(en) fehlgeschlagen\n" : "Alle Prüfungen bestanden ($ok)\n";
exit($fail ? 1 : 0);
