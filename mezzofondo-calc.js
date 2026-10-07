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

  // Zone di lavoro: [etichetta, percentuale della VAM 0-1, durata tipica]. Le
  // percentuali sono un valore fisso dentro l'intervallo di riferimento di
  // ciascuna zona (recupero 60-65%, lenta 68-73%, lungo 70-78%, medio
  // 80-85%, soglia 86-90%, ripetute lunghe 92-97%).
  const ZONES = [
    ['Rigen.', 0.63, '30-45′'],
    ['Lenta', 0.72, '45-70′'],
    ['Lungo', 0.76, '90-150′'],
    ['Medio', 0.84, '25-50′'],
    ['Soglia', 0.88, '20-40′ frazionati'],
    ['2000', 0.93, '4-8 km totali'],
    ['1000', 0.96, '4-8 km totali'],
  ];

  const VAM_MIN = 8;
  const VAM_MAX = 24;
  // Coefficiente di stima della VAM dal tempo sul 1000 massimale (T in secondi).
  const VAM_FROM_1000_COEF = 0.89;

  // Recupero in metri (nei simulatori di ripetute): il passo di recupero
  // sta un po' più piano della corsa lenta — un chilometro di recupero lo
  // corri circa un minuto più piano del tuo passo lento. Coefficiente
  // configurabile (varia da persona a persona più dell'altro, sotto).
  const RECOVERY_PACE_FROM_LENTA_COEF = 1.16;
  // Recupero camminando: secondi "equivalenti da fermo" per metro, stesso
  // per tutti (variabilità tra persone trascurabile ai fini del modello) —
  // 100 m camminati = 1'03", 200 m = 2'06".
  const RECOVERY_WALK_SEC_PER_METER = 0.63;
  // Percentuale della VAM della zona "Lenta" (vedi ZONES sopra): usata per
  // ricavare il passo di riferimento del recupero.
  const RECOVERY_LENTA_PCT = 0.72;

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

  // Passo di recupero (min/km) dalla VAM: passoLenta * 1.16. Null se la VAM
  // non è valida.
  function recoveryPaceMinPerKm(vam) {
    if (!isValidVam(vam)) {
      return null;
    }
    const passoLenta = paceMinPerKm(vam, RECOVERY_LENTA_PCT);
    return passoLenta * RECOVERY_PACE_FROM_LENTA_COEF;
  }

  // Secondi di recupero (corsa lenta, PRIMA della conversione attivo→fermo
  // di RipeteCalc.effectiveRecovery, che va applicata a parte) per una
  // distanza in metri, dato il passo di recupero in min/km.
  function recoverySecondsFromRunMeters(meters, paceMinPerKmValue) {
    if (!(meters > 0) || !(paceMinPerKmValue > 0)) {
      return 0;
    }
    return (meters / 1000) * paceMinPerKmValue * 60;
  }

  // Secondi di recupero camminando: già un equivalente "da fermo" di suo,
  // non va fatto passare per RipeteCalc.effectiveRecovery.
  function recoverySecondsFromWalkMeters(meters) {
    return meters > 0 ? meters * RECOVERY_WALK_SEC_PER_METER : 0;
  }

  return {
    ZONES,
    VAM_MIN,
    VAM_MAX,
    VAM_FROM_1000_COEF,
    RECOVERY_PACE_FROM_LENTA_COEF,
    RECOVERY_WALK_SEC_PER_METER,
    RECOVERY_LENTA_PCT,
    paceMinPerKm,
    pacesForVam,
    formatPace,
    vamFromThousand,
    parseVam,
    parseThousandToVam,
    sogliaFromMeters,
    isValidVam,
    recoveryPaceMinPerKm,
    recoverySecondsFromRunMeters,
    recoverySecondsFromWalkMeters,
  };
});
