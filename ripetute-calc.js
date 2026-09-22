// Modulo puro di calcolo per "Tempi ripetute dal 1000 massimale".
// Nessuna dipendenza dal DOM: solo funzioni pure. I coefficienti tarati
// (pendenza del volume, peso del recupero) sono tutti qui, in un punto
// solo — per ritoccarli non serve toccare l'interfaccia in app.js.
// Fonte delle formule: SPEC-ripetute.md / tempi-ripetute.html (invariate,
// vedi ripetute-calc.test.html per la verifica contro i casi della spec).
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = mod;
  }
  root.RipeteCalc = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Percentuali del passo base per distanza: [metri, moltiplicatore].
  const PCT = [
    [200, 0.93],
    [300, 0.95],
    [400, 0.97],
    [500, 0.99],
    [600, 1.01],
  ];

  // Opzioni ammesse per i controlli: [valore, etichetta].
  const VOL_OPTIONS = [
    [1, '1 km'], [1.5, '1,5'], [2, '2 km'], [2.5, '2,5'], [3, '3 km'],
    [3.5, '3,5'], [4, '4 km'], [4.5, '4,5'], [5, '5 km'],
  ];
  const REC_OPTIONS = [
    [45, '45″'], [60, '1′00″'], [90, '1′30″'],
    [120, '2′00″'], [150, '2′30″'], [180, '3′00″'],
  ];

  const VOL_DEFAULT = 2;
  const REC_DEFAULT = 90;

  // Correzione dovuta al volume totale di lavoro, in secondi ogni 100 m
  // (riferimento 2 km). Ritocca qui la pendenza per cambiare quanto "pesa"
  // allungare il volume totale della seduta.
  function adjVol(vol) {
    return vol <= 3 ? (vol - 2) * 0.6 : 0.6 + (vol - 3) * 0.8;
  }

  // Correzione dovuta al rapporto recupero/durata-ripetuta, clampata in
  // [-0.6, +1.2]. Ritocca qui i coefficienti 1.0/0.4 per cambiare quanto
  // "pesa" un recupero più o meno abbondante rispetto alla prova.
  function adjRec(ratio) {
    const a = ratio < 1 ? (1 - ratio) * 1.0 : -(ratio - 1) * 0.4;
    return Math.max(-0.6, Math.min(1.2, a));
  }

  // Tempo (in secondi) della ripetuta su "dist" metri, dato il tempo T (s)
  // sul 1000 massimale, la percentuale "pct" della distanza, il volume
  // totale "vol" (km) e il recupero "rec" (s) fisso tra le prove.
  // Dipendenza circolare recupero<->durata risolta con due iterazioni,
  // partendo dal tempo non corretto — vedi SPEC-ripetute.md §1.
  function repeatSeconds(T, dist, pct, vol, rec) {
    let t = (T / 10 * pct) * dist / 100;
    for (let i = 0; i < 2; i += 1) {
      const a = Math.max(-1.2, Math.min(2.5, adjVol(vol) + adjRec(rec / t)));
      t = (T / 10 * pct + a) * dist / 100;
    }
    return t;
  }

  // Tutti e cinque i tempi (200/300/400/500/600) per un dato T/vol/rec.
  // Ritorna [{ dist, seconds }, ...] nello stesso ordine di PCT.
  function repeatTimesFor(T, vol, rec) {
    return PCT.map(([dist, pct]) => ({ dist, seconds: repeatSeconds(T, dist, pct, vol, rec) }));
  }

  // pct per una distanza qualsiasi (non solo le 5 di PCT): la tabella è
  // già perfettamente lineare (0,93 a 200m, +0,02 ogni 100m), quindi si
  // ricava la stessa retta dai due estremi e si estrapola oltre — usata dal
  // simulatore di serie personalizzate (vedi masterSeriesBuilderMarkup in
  // app.js), dove le distanze non sono limitate alle cinque standard.
  function pctForDist(dist) {
    const [d0, p0] = PCT[0];
    const [d1, p1] = PCT[PCT.length - 1];
    const slope = (p1 - p0) / (d1 - d0);
    return p0 + slope * (dist - d0);
  }

  // Scorciatoia: tempo (s) per una distanza qualsiasi, pct ricavato da
  // pctForDist invece di dover passare la percentuale a mano.
  function repeatSecondsForDist(T, dist, vol, rec) {
    return repeatSeconds(T, dist, pctForDist(dist), vol, rec);
  }

  // Formattazione di un tempo in secondi: sotto 59,75s arrotonda al mezzo
  // secondo (44″5, 39″), da 59,75s in su arrotonda al secondo (1′33″, i
  // secondi sempre a due cifre).
  function formatSeconds(s) {
    if (s < 59.75) {
      const v = Math.round(s * 2) / 2;
      return v === Math.floor(v) ? `${v}″` : `${Math.floor(v)}″5`;
    }
    const t = Math.round(s);
    const m = Math.floor(t / 60);
    const sec = t % 60;
    return `${m}′${sec < 10 ? '0' : ''}${sec}″`;
  }

  // Etichetta mm′ss″ per un tempo intero in secondi (es. 240 -> "4′00″"),
  // usata sia per il 1000 max che per le righe della tabella.
  function formatLabel(T) {
    const m = Math.floor(T / 60);
    const s = T % 60;
    return `${m}′${s < 10 ? '0' : ''}${s}″`;
  }

  // Parsing libero del campo "1000 in": tiene solo le cifre, accetta 3 o 4
  // cifre — le ultime due sono i secondi, le precedenti i minuti. Valido se
  // secondi <= 59 e minuti tra 1 e 12, altrimenti null (output nascosto).
  function parseThousand(str) {
    const digits = String(str || '').replace(/[^0-9]/g, '');
    if (digits.length < 3 || digits.length > 4) return null;
    const mm = parseInt(digits.slice(0, digits.length - 2), 10);
    const ss = parseInt(digits.slice(-2), 10);
    if (Number.isNaN(mm) || Number.isNaN(ss) || ss > 59 || mm < 1 || mm > 12) return null;
    return mm * 60 + ss;
  }

  function isValidVol(vol) {
    return VOL_OPTIONS.some(([v]) => v === vol);
  }
  function isValidRec(rec) {
    return REC_OPTIONS.some(([r]) => r === rec);
  }

  return {
    PCT,
    VOL_OPTIONS,
    REC_OPTIONS,
    VOL_DEFAULT,
    REC_DEFAULT,
    adjVol,
    adjRec,
    repeatSeconds,
    repeatTimesFor,
    pctForDist,
    repeatSecondsForDist,
    formatSeconds,
    formatLabel,
    parseThousand,
    isValidVol,
    isValidRec,
  };
});
