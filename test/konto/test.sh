#!/bin/sh
# Test der Anmeldung (public/konto.php) im PHP-Container, wie auf all-inkl (PHP 8.4 mit sodium)
cd "$(dirname "$0")/../.." && docker run --rm --user 1000:1000 -v "$PWD":/app -w /app php:8.4.27-apache-trixie sh -c 'php -l public/konto.php >/dev/null && php test/konto/test.php'
