// Unumkehrbare Handlungen: Knopf gedrückt halten (schützt vor Fehltipps), wie beim Mähen (game.js).
// Tastatur und Screenreader: zweimal auslösen innert zwei Sekunden. `melde(text)` schreibt in den Ticker.
export function halteKnopf(b, { ms = 700, name, los, melde }) {
  let timer = null, gehalten = false, bereitBis = 0;
  const ab = () => { clearTimeout(timer); b.classList.remove('haelt'); };
  b.classList.add('halten');
  b.style.setProperty('--halte-zeit', `${ms}ms`);
  b.addEventListener('pointerdown', (e) => {
    if (b.disabled || e.button > 0) return;
    gehalten = false;
    b.classList.add('haelt');
    timer = setTimeout(() => { gehalten = true; ab(); navigator.vibrate?.(30); los(); }, ms);
  });
  b.addEventListener('pointerup', () => {
    const zuKurz = !gehalten && b.classList.contains('haelt');
    ab();
    if (zuKurz) { b.classList.add('wackelt'); setTimeout(() => b.classList.remove('wackelt'), 400); melde?.(`${name}: Knopf gedrückt halten.`); }
  });
  ['pointercancel', 'pointerleave'].forEach((t) => b.addEventListener(t, ab));
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  // Tastatur, Schalter und Screenreader lösen «click» ohne Zeiger aus (detail 0)
  const zweimal = () => {
    if (b.disabled) return;
    const jetzt = Date.now();
    if (jetzt < bereitBis) { bereitBis = 0; return los(); }
    bereitBis = jetzt + 2000;
    melde?.(`${name}: zum Bestätigen innert 2 Sekunden nochmals drücken.`, true);
  };
  b.addEventListener('click', (e) => { if (e.detail === 0) zweimal(); });
  return { zweimal };
}
