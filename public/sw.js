// Automatisch erzeugt von tools/seiten.mjs – nicht von Hand ändern
const CACHE = 'drysim-2026-10-18-27';
const DATEIEN = ['./', 'css/app.css', 'img/icon-192.png', 'img/icon-512.png', 'img/icon.svg', 'img/og.png', 'img/og.svg', 'index.html', 'js/app.js', 'js/begriffe.js', 'js/boot.js', 'js/chart.js', 'js/game.js', 'js/icons.js', 'js/maschinen.js', 'js/model.js', 'js/modus.js', 'js/scenarios.js', 'js/scene.js', 'js/weather.js', 'js/wiese.js', 'lernen.html', 'manifest.webmanifest', 'sitemap.xml', 'szenario/bilderbuch.html', 'szenario/foehn.html', 'szenario/ohneaufbereiter.html', 'szenario/tiefgemaeht.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Aus dem Cache antworten und im Hintergrund erneuern (stale-while-revalidate)
self.addEventListener('fetch', (e) => {
  const r = e.request, url = new URL(r.url);
  if (r.method !== 'GET' || url.origin !== location.origin) return;
  const schluessel = r.mode === 'navigate' ? new Request(url.origin + url.pathname) : r; // ?code=… und ?szenario=… teilen sich eine Seite
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const treffer = await c.match(schluessel);
    const netz = fetch(r).then((res) => { if (res.ok) c.put(schluessel, res.clone()); return res; }).catch(() => treffer);
    return treffer || netz;
  }));
});
