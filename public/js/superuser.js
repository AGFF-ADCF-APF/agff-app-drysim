// Superuser: wer in Futter v2 eine Admin-Sitzung hat (zentrale Anmeldung graswachstum.ch, Recht «admin» oder
// «apps_admin»). Abfrage auf derselben Domain; ohne Sitzung, ohne Netz oder bei Fehler: false, ohne Hinweis.
// Schutz ehrlich benannt (Konzept 11): Das verhindert nur, dass Lernende die Musterlösung angeboten bekommen.
export const ICH_URL = '/futter/v2/api/admin/ich';
let anfrage = null;
export function istSuperuser() {
  if (anfrage) return anfrage;
  anfrage = (async () => {
    if (typeof fetch !== 'function') return false;
    const abbruch = new AbortController(), uhr = setTimeout(() => abbruch.abort(), 4000);
    try {
      const r = await fetch(ICH_URL, { credentials: 'same-origin', cache: 'no-store', signal: abbruch.signal, headers: { Accept: 'application/json' } });
      if (!r.ok) return false;
      const j = await r.json();
      return j?.angemeldet === true;
    } catch { return false; } finally { clearTimeout(uhr); }
  })();
  return anfrage;
}
