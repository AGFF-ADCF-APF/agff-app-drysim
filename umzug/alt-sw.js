// Alter Standort apps.graswachstum.ch/heureka (und /drysim) nach dem Umzug nach app.graswachstum.ch/heureka:
// Dieser Service Worker ersetzt den alten, löscht dessen Zwischenspeicher, meldet sich ab und lädt offene Fenster neu.
// Der Server leitet danach alles auf die neue Adresse um. Mindestens bis Mitte 2027 hier ausliefern.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
  })());
});
