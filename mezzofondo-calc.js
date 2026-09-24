// Modulo puro di calcolo per "Mezzofondo e fondo" (modulo 3 di
// SPEC-calcolatori.md). Nessuna dipendenza dal DOM. Percentuali tarate sulla
// VAM (velocità aerobica massima) — per ritoccarle si modifica solo questo
// file. Riusa RipeteCalc.parseThousand per l'opzione "parti dal 1000
// massimale" invece di duplicare quel parsing (stessa regola: 3-4 cifre,
// ultime due i secondi, minuti 1-12).
(function (root, factory) {
  const mod = factory(root.RipeteCalc);
  if (typeof module === 'object' && module.exports) {
    module.exports = mod;
  }
  root.MezzofondoCalc = mod;
})(typeof self !== 'undefined' ? self : this, function (RipeteCalc) {
  'use strict';

  // Percentuale della VAM per zona di lavoro: [etichetta, percentuale 0-1].
  const ZONES = [
    ['Rigen.', 0.63],
    ['Lenta', 0.72],
    ['Lungo', 0.76],
    ['Medio', 0.84],
    ['Soglia', 0.88],
    ['2000', 0.93],
    ['1000', 0.96],
  ];

  const VAM_MIN = 8;
  const VAM_MAX = 24;
  // Coefficiente di stima della VAM dal tempo sul 1000 massimale (T in secondi).
  const VAM_FROM_1000_COEF = 0.89;

  // Ritmo al chilometro, in MINUTI decimali, alla percentuale "pct" (0-1)
  // della VAM (km/h).
  function paceMinPerKm(vam, pct) {
    return 60 / (vam * pct);
  }

  // Tutti i ritmi (una voce per zona) per una data VAM.
  function pacesForVam(vam) {
    return ZONES.map(([label, pct]) => ({ label, pct, minutes: paceMinPerKm(vam, pct) }));
  }

  // Formattazione di un ritmo in minuti decimali come m′ss″ (arrotondato al
  // secondo, secondi sempre a due cifre).
  function formatPace(min) {
    const t = Math.round(min * 60);
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}′${s < 10 ? '0' : ''}${s}″`;
  }

  // VAM stimata dal tempo sul 1000 massimale (T in secondi).
  function vamFromThousand(T) {
    return 3600 / T * VAM_FROM_1000_COEF;
  }

  // Parsing del campo "VAM": accetta virgola o punto, valido 8-24 km/h.
  function parseVam(str) {
    const v = parseFloat(String(str || '').replace(',', '.'));
    return (Number.isFinite(v) && v >= VAM_MIN && v <= VAM_MAX) ? v : null;
  }

  // Parsing del campo "1000 massimale" -> VAM stimata, o null se il tempo
  // non è valido (stessa regola di RipeteCalc.parseThousand).
  function parseThousandToVam(str) {
    const T = RipeteCalc.parseThousand(str);
    return T === null ? null : vamFromThousand(T);
  }

  // Test soglia: metri percorsi negli ultimi 20 minuti di una prova
  // massimale. vSoglia (km/h) = metri * 0.06 / 20; passo (min/km) =
  // 20 / (metri / 1000). null se i metri non sono un numero positivo.
  function sogliaFromMeters(meters) {
    if (typeof meters !== 'number' || !Number.isFinite(meters) || meters <= 0) {
      return null;
    }
    return { vSoglia: meters * 0.06 / 20, paceMin: 20 / (meters / 1000) };
  }

  function isValidVam(v) {
    return typeof v === 'number' && Number.isFinite(v) && v >= VAM_MIN && v <= VAM_MAX;
  }

  return {
    ZONES,
    VAM_MIN,
    VAM_MAX,
    VAM_FROM_1000_COEF,
    paceMinPerKm,
    pacesForVam,
    formatPace,
    vamFromThousand,
    parseVam,
    parseThousandToVam,
    sogliaFromMeters,
    isValidVam,
  };
});
