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

  // Recupero attivo (corsetta blanda invece di stare fermi): vale in media
  // circa il 70% di un recupero passivo della stessa durata, ma per pause
  // molto brevi (<= 60s) l'effetto è più tenue (85%) — sotto il minuto non
  // c'è abbastanza tempo perché la corsetta "consumi" il recupero come nelle
  // pause lunghe. Le due rette si incontrano esattamente a 60s (0,85×60 =
  // 0,70×60+9 = 51s), quindi effectiveRecovery è continua nel breakpoint.
  // Il trucco per usarla è NON toccare repeatSeconds/adjRec: si riduce il
  // recupero PRIMA di passarlo a repeatSeconds/repeatSecondsForDist come
  // parametro "rec", così la correzione esistente lavora sul recupero
  // "equivalente fermo" senza bisogno di termini nuovi nella formula.
  const ACTIVE_REC_BREAKPOINT = 60;
  const ACTIVE_REC_SHORT_FACTOR = 0.85;
  const ACTIVE_REC_LONG_FACTOR = 0.70;
  const ACTIVE_REC_LONG_OFFSET = 9;

  function effectiveRecovery(rec, active) {
    if (!active || !rec) return rec;
    return rec <= ACTIVE_REC_BREAKPOINT
      ? rec * ACTIVE_REC_SHORT_FACTOR
      : rec * ACTIVE_REC_LONG_FACTOR + ACTIVE_REC_LONG_OFFSET;
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

  // "Giorno di forza": salite/gradoni/balzi aggiunti come volume
  // equivalente alle ripetute della stessa seduta. Ogni voce è
  // [chiave, etichetta, intensità, secPerRip, conteggio, eccentrico].
  // Il fattore 3.5 nella formula del volume è solo di scala: un minuto a
  // intensità 1.0 equivale a 210 m di corsa piana.
  // "conteggio" dice come si esprime la durata di una serie:
  //  - 'secondi': tempo diretto (o metri, solo per le 3 salite — vedi
  //    STRENGTH_METERS_SPEED), come il "giorno di forza" di prima.
  //  - 'per-gamba' / 'per-lato' / 'totale': a ripetizioni — l'allenatore
  //    scrive "8 ripetizioni" invece di un tempo, il sistema lo converte:
  //    secondi = ripetizioni * secPerRip * (2 se per-gamba/per-lato, il
  //    fattore vale sulla durata — il monopodalico costa più del doppio
  //    tempo per lavorare entrambe le gambe, non il doppio "sforzo" a
  //    ripetizione, quello lo dice solo l'intensità).
  // "eccentrico" non entra nel volume: si somma a parte (vedi
  // strengthEccentricoSeconds/strengthEccentricoLabel) e segnala quanto
  // la seduta scarica sui 2 giorni successivi — una discesa ha intensità
  // bassa (costa poco "a caldo") ma eccentrico alto (fa male il giorno
  // dopo), motivo per cui sono due colonne separate e non un numero solo.
  const STRENGTH_EXERCISES = [
    ['jump-squat-1g', 'Jumping squat monopodalico', 3.0, 2.0, 'per-gamba', 1.5],
    ['sagittali-alt', 'Sagittali alternati', 2.4, 1.8, 'totale', 1.5],
    ['sagittali-1g', 'Sagittali stessa gamba', 2.6, 1.7, 'per-gamba', 1.6],
    ['bulgaro-saltato', 'Squat bulgaro saltato', 3.2, 2.0, 'per-gamba', 2.0],
    ['gradoni-laterale', 'Gradoni in salita laterale', 2.0, 0.6, 'per-lato', 0.8],
    ['gradoni-corsa', 'Gradoni di corsa veloce', 2.2, 0.4, 'totale', 0.5],
    ['balzi-squat', 'Balzi a squat gradone-gradone', 2.8, 1.3, 'totale', 1.2],
    ['balzi-squat-1g', 'Balzi a squat gradone-gradone monopodalici', 3.6, 1.5, 'per-gamba', 1.6],
    ['saltelli-rigidi', 'Saltelli piedi pari ginocchia bloccate', 2.0, 0.5, 'totale', 1.0],
    ['skip-gradini', 'Skip veloce sui gradini', 2.4, 0.35, 'totale', 0.6],
    ['salita-dolce', 'Salita dolce 3-5%', 1.3, 0, 'secondi', 0.3],
    ['salita-media', 'Salita media 6-9%', 1.6, 0, 'secondi', 0.3],
    ['salita-ripida', 'Salita ripida 10-15%', 2.0, 0, 'secondi', 0.3],
  ];

  // Le 3 discese dai gradoni, scelte come ritorno quando l'esercizio è uno
  // dei tipi "da gradoni" (vedi STRENGTH_GRADONI_TYPES) — non compaiono
  // nella select principale, solo in quella del ritorno.
  const STRENGTH_DESCENTS = [
    ['discesa-veloce', 'Discesa veloce, un piede per gradone', 0.8, 0.35, 'totale', 2.2],
    ['discesa-mezzo-squat', 'Discesa a mezzo squat', 1.2, 0.8, 'totale', 2.8],
    ['discesa-skip', 'Discesa gradini', 1.0, 0.4, 'totale', 2.0],
  ];

  // Ritorno "in corsa blanda" dopo una salita: intensità fissa (0,5),
  // indipendente da quella della salita appena fatta — unico "esercizio" di
  // ritorno per le 3 salite (quelle con gradoni usano invece una delle 3
  // discese sopra). Tempo diretto in secondi, non a ripetizioni.
  const STRENGTH_RETURN_JOG = ['ritorno-blando', 'Ritorno in corsa blanda', 0.5, 0, 'secondi', 1.0];

  // Tipi "da gradoni", dove ha senso scegliere una delle 3 discese come
  // ritorno (ci si è fisicamente saliti sopra, si può anche scendere in
  // modi diversi) — gli altri tipi a ripetizioni sono "sul posto", niente
  // dislivello da ridiscendere.
  const STRENGTH_GRADONI_TYPES = ['gradoni-laterale', 'gradoni-corsa', 'balzi-squat', 'balzi-squat-1g', 'skip-gradini'];
  // Le 3 salite, dove invece ha senso solo il "Ritorno correndo" (in corsa
  // blanda) o niente (si torna camminando, non conta).
  const STRENGTH_SALITA_TYPES = ['salita-dolce', 'salita-media', 'salita-ripida'];

  const STRENGTH_SCALE = 3.5;

  // Velocità stimata (m/s) per convertire metri -> secondi, solo per le 3
  // salite (dove ha senso pensare in distanza invece che in tempo) — stima
  // approssimativa, pensata per essere ritoccata qui se non rispecchia il
  // ritmo reale. Gli esercizi a ripetizioni non hanno un equivalente in
  // metri, solo in secondi diretti o ripetizioni.
  const STRENGTH_METERS_SPEED = {
    'salita-dolce': 2.8,
    'salita-media': 2.4,
    'salita-ripida': 2.0,
  };

  // Cerca una voce per chiave in tutte e tre le liste (esercizi principali,
  // discese, ritorno in corsa) — da qui in poi un pezzo del giorno di forza
  // si identifica solo con questa chiave, senza dover sapere a quale lista
  // appartiene.
  function strengthFindDef(key) {
    return STRENGTH_EXERCISES.find((d) => d[0] === key)
      || STRENGTH_DESCENTS.find((d) => d[0] === key)
      || (STRENGTH_RETURN_JOG[0] === key ? STRENGTH_RETURN_JOG : null);
  }

  function strengthIntensity(key) {
    const found = strengthFindDef(key);
    return found ? found[2] : null;
  }

  function strengthSecondsFromMeters(key, meters) {
    const speed = STRENGTH_METERS_SPEED[key];
    return speed && meters > 0 ? meters / speed : 0;
  }

  // Secondi di una singola serie dalle ripetizioni: ripetizioni * secPerRip,
  // raddoppiati se il conteggio è per gamba/per lato (si lavorano entrambe,
  // il doppio del tempo — l'intensità già dice quanto costa la singola
  // ripetizione, qui si somma solo quante volte si ripete davvero).
  function strengthSecondsFromReps(reps, key) {
    const def = strengthFindDef(key);
    if (!def) return 0;
    const countMode = def[4];
    const factor = countMode === 'per-gamba' || countMode === 'per-lato' ? 2 : 1;
    return Math.max(0, reps || 0) * def[3] * factor;
  }

  // Secondi totali di lavoro di un "pezzo" (l'esercizio principale, la
  // discesa scelta, o il ritorno in corsa — tutti calcolati separatamente,
  // mai sommati in un unico totale prima di applicare l'intensità, perché
  // ciascuno ha la propria): durata di una serie (secondi diretti, o dalle
  // ripetizioni) per il numero di serie.
  function strengthPieceSeconds(serieSeconds, numSerie) {
    const reps = Math.max(1, numSerie || 1);
    return Math.max(0, serieSeconds || 0) * reps;
  }

  // Volume equivalente (in metri, stessa unità delle ripetute) di un
  // singolo pezzo: secondiTotali * intensità * 3.5.
  function strengthVolumeEquivalent(totalSeconds, key) {
    const intensity = strengthIntensity(key);
    return intensity && totalSeconds > 0 ? totalSeconds * intensity * STRENGTH_SCALE : 0;
  }

  // Contributo di un pezzo al carico eccentrico della seduta: secondiTotali
  // * eccentrico — si somma su tutti i pezzi di tutti gli esercizi (vedi
  // strengthEccentricoLabel per la lettura del totale).
  function strengthEccentricoSeconds(totalSeconds, key) {
    const def = strengthFindDef(key);
    return def && totalSeconds > 0 ? totalSeconds * def[5] : 0;
  }

  // Soglie di lettura del carico eccentrico totale della seduta (somma di
  // strengthEccentricoSeconds su tutti i pezzi) sui 2 giorni successivi.
  function strengthEccentricoLabel(value) {
    if (value < 150) return 'leggero, nessun vincolo';
    if (value < 350) return 'medio, evita qualità il giorno dopo';
    if (value < 600) return 'alto, due giorni di scarico';
    return 'molto alto, rivedi la seduta';
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
    ACTIVE_REC_BREAKPOINT,
    ACTIVE_REC_SHORT_FACTOR,
    ACTIVE_REC_LONG_FACTOR,
    ACTIVE_REC_LONG_OFFSET,
    effectiveRecovery,
    formatSeconds,
    formatLabel,
    parseThousand,
    isValidVol,
    isValidRec,
    STRENGTH_EXERCISES,
    STRENGTH_DESCENTS,
    STRENGTH_RETURN_JOG,
    STRENGTH_GRADONI_TYPES,
    STRENGTH_SALITA_TYPES,
    STRENGTH_SCALE,
    STRENGTH_METERS_SPEED,
    strengthFindDef,
    strengthIntensity,
    strengthSecondsFromMeters,
    strengthSecondsFromReps,
    strengthPieceSeconds,
    strengthVolumeEquivalent,
    strengthEccentricoSeconds,
    strengthEccentricoLabel,
  };
});
