// Lehrperson: wer mit dem AGFF-Konto angemeldet ist und auf graswachstum.ch das Recht heureka.teacher oder heureka.admin hat
// (Anmeldung über konto.php, Wege /heureka/anmelden/…). Ohne Sitzung, ohne Netz oder bei Fehler: false, ohne Hinweis.
// Schutz ehrlich benannt (Konzept 11): Das verhindert nur, dass Lernende die Musterlösung angeboten bekommen.
export const ICH_URL = new URL('../anmelden/ich', import.meta.url).href;
export const ANMELDEN_URL = new URL('../anmelden/start', import.meta.url).href;
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
      return j?.angemeldet === true && j?.lehrperson === true;
    } catch { return false; } finally { clearTimeout(uhr); }
  })();
  return anfrage;
}
