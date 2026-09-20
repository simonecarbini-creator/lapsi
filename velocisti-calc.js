// Modulo puro di calcolo per "Andature sprint" (modulo 2 di SPEC-calcolatori.md).
// Nessuna dipendenza dal DOM. Coefficienti tarati sul tempo dei 100 m da
// fermo — per ritoccarli si modifica solo questo file.
// Nome interno "VelocistiCalc" per coerenza con la spec; in interfaccia la
// voce si chiama "Andature sprint" per non confondersi con la sezione atleti
// "Velocisti Ass./Master" già presente in Lapsi (sono due cose diverse: qui
// è solo un calcolatore di andature, non tocca dati di atleti).
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = mod;
  }
  root.VelocistiCalc = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Coefficiente per stimare il massimale su ciascuna distanza a partire dal
  // tempo sui 100 m da fermo: [metri, coefficiente].
  const COEF = [
    [20, 0.26], [30, 0.355], [40, 0.445], [60, 0.64], [80, 0.825], [100, 1],
    [120, 1.22], [150, 1.58], [200, 2.04], [250, 2.60], [300, 3.25], [400, 4.55],
  ];

  // Percentuali di lavoro mostrate come colonne (in %, non frazione).
  const PCTS = [100, 95, 90, 85, 80, 75];

  const MAX100_MIN = 9.5;
  const MAX100_MAX = 22;

  // Tempo (in secondi) sulla distanza "dist" (con coefficiente "coef") alla
  // percentuale "pct" (0-100) del massimale stimato.
  function timeAt(max100, coef, pct) {
    return max100 * coef / (pct / 100);
  }

  // Tutti i tempi (100%..75%) per una distanza, dato il massimale sui 100.
  function timesForDistance(max100, coef) {
    return PCTS.map((pct) => ({ pct, seconds: timeAt(max100, coef, pct) }));
  }

  // Formattazione di un tempo in secondi: sotto 20s due decimali (12,00),
  // da 20 a 60s un decimale (24,5), da 60s in su m′ss,d″.
  function formatSeconds(s) {
    if (s < 20) {
      return s.toFixed(2).replace('.', ',');
    }
    if (s < 59.95) {
      return s.toFixed(1).replace('.', ',');
    }
    const t = Math.round(s * 10) / 10;
    const m = Math.floor(t / 60);
    const sec = t - m * 60;
    return `${m}′${sec < 10 ? '0' : ''}${sec.toFixed(1).replace('.', ',')}″`;
  }

  // Parsing del campo "100 m in": accetta sia virgola che punto decimale,
  // valido nel range 9,5-22 (altrimenti null, output nascosto).
  function parseMax100(str) {
    const v = parseFloat(String(str || '').replace(',', '.'));
    return (Number.isFinite(v) && v >= MAX100_MIN && v <= MAX100_MAX) ? v : null;
  }

  function isValidMax100(v) {
    return typeof v === 'number' && Number.isFinite(v) && v >= MAX100_MIN && v <= MAX100_MAX;
  }

  return {
    COEF,
    PCTS,
    MAX100_MIN,
    MAX100_MAX,
    timeAt,
    timesForDistance,
    formatSeconds,
    parseMax100,
    isValidMax100,
  };
});
