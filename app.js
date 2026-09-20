const APP_BUILD = '2026-09-20e';
console.log('[Lapsi] build', APP_BUILD, '— Ripetute brevi anche in Master, a fianco di Mezzofondo e fondo');

// Autodifesa contro l'HTML in cache: su iPhone, un'icona salvata in Home può
// restare bloccata su un index.html vecchio mentre questo script (grazie al
// cache-busting sull'URL) è sempre l'ultima versione. Se l'HTML non ha gli
// elementi che questa versione del JS si aspetta, va tutto silenziosamente in
// errore — non è mai successo un crash rumoroso, semplicemente i pulsanti non
// fanno più nulla. Qui confrontiamo un marcatore di versione scritto
// nell'HTML con APP_BUILD: se non combaciano, la pagina è in cache e forziamo
// una navigazione vera (non un semplice reload) per andare a riprendere
// l'HTML fresco dal server.
(function ensureFreshHtml() {
  const htmlBuild = document.documentElement.dataset.build;
  if (htmlBuild && htmlBuild !== APP_BUILD) {
    console.warn('[Lapsi] HTML in cache (build', htmlBuild, ') diverso dallo script (build', APP_BUILD, ') — ricarico una copia fresca.');
    location.href = `${location.pathname}?_=${Date.now()}`;
    throw new Error('Pagina in cache: navigazione di ricarica in corso.');
  }
})();

// Chiave nuova: ignora eventuali dati vecchi salvati da versioni precedenti
// sotto 'run-tracker-athletes' (che potrebbero essere obsoleti/incompleti).
const STORAGE_KEY = 'lapsi-athletes';
const ACTIVITY_OPTIONS = [
  { label: '100mt', meters: 100 },
  { label: '800mt', meters: 800 },
  { label: '1km', meters: 1000 },
  { label: '1.2km', meters: 1200 },
  { label: '2km', meters: 2000 },
];
const SUGGESTION_MIN_CHARS = 3;
const MAX_AVATAR_SIZE = 300 * 1024; // 300KB

const form = document.getElementById('athlete-form');
const avatarInput = document.getElementById('avatar');
const avatarPreview = document.getElementById('avatar-preview');
const nameInput = document.getElementById('name');
const surnameInput = document.getElementById('surname');
const nicknameInput = document.getElementById('nickname');
const militaryInput = document.getElementById('military');
const activityInput = document.getElementById('activity');
const hoursInput = document.getElementById('hours');
const minutesInput = document.getElementById('minutes');
const secondsInput = document.getElementById('seconds');
const tenthsInput = document.getElementById('tenths');
const takeoffFootInput = document.getElementById('takeoffFoot');
const jumpMetersInput = document.getElementById('jumpMeters');
const jumpCmInput = document.getElementById('jumpCm');
const createdDateInput = document.getElementById('createdDate');
const createdTimeInput = document.getElementById('createdTime');
const athletesList = document.getElementById('athletes-list');
const emptyState = document.getElementById('empty-state');
const exportButton = document.getElementById('export-json');
const importButton = document.getElementById('import-json');
const importFileInput = document.getElementById('import-json-file');
const athleteSearchInput = document.getElementById('athlete-search');
const distanceChips = document.getElementById('distance-chips');
const sortChips = document.getElementById('sort-chips');
const outcomeChips = document.getElementById('outcome-chips');
const filtersApplyButton = document.getElementById('filters-apply');
const filtersResetButton = document.getElementById('filters-reset');
const athleteSuggestions = document.getElementById('athlete-suggestions');

const FILTER_DEFAULTS = { distance: 'Tutte', sort: 'az', outcome: 'all', includeDecided: null };
// activeDistance/activeSort = ciò che la lista mostra ora (anche l'anteprima live
// mentre il pannello filtri è aperto). filterSnapshot = valori confermati da
// ripristinare se si chiude senza premere "Applica".
// activeOutcome: 'all' (default) | 'passed' | 'failed' — filtro esplicito per
// vedere SOLO chi ha un dato esito (chip live, come distanza/ordinamento).
// activeIncludeDecided: rilevante solo quando activeOutcome è 'all'. null =
// non ancora scelto (default: chi ha già un esito Superato/Non superato
// resta incluso ma va in fondo alla lista); true = scelto "Sì" all'Applica
// (incluso e mischiato normalmente nell'ordinamento); false = scelto "No"
// (escluso dai risultati).
let activeDistance = FILTER_DEFAULTS.distance;
let activeSort = FILTER_DEFAULTS.sort;
let activeOutcome = FILTER_DEFAULTS.outcome;
let activeIncludeDecided = FILTER_DEFAULTS.includeDecided;
let filterSnapshot = null;

const PAGE_SIZE = 5;
let currentPage = 1;
const openRegisterButton = document.getElementById('open-register');
const closeRegisterButton = document.getElementById('close-register');
const registerScreen = document.getElementById('register-screen');
const toggleSearchButton = document.getElementById('toggle-search');
const searchPanel = document.getElementById('athlete-search-panel');
const toggleFiltersButton = document.getElementById('toggle-filters');
const filtersPanel = document.getElementById('athlete-filters');

const splashScreen = document.getElementById('splash-screen');
const homeScreen = document.getElementById('home-screen');
const appHeaderWrap = document.getElementById('app-header-wrap');
const militariShell = document.getElementById('militari-shell');
const velocistiShell = document.getElementById('velocisti-shell');
const masterShell = document.getElementById('master-shell');
const enterMilitariButton = document.getElementById('enter-militari');
const enterVelocistiButton = document.getElementById('enter-velocisti');
const enterMasterButton = document.getElementById('enter-master');
const menuToggleButton = document.getElementById('menu-toggle');
const mainMenu = document.getElementById('main-menu');
const menuBackdrop = document.getElementById('menu-backdrop');
const trainingNotesFab = document.getElementById('training-notes-fab');
const ripetuteFab = document.getElementById('ripetute-fab');
const sprintFab = document.getElementById('sprint-fab');
const fondoFab = document.getElementById('fondo-fab');

if (splashScreen) {
  setTimeout(() => {
    splashScreen.classList.add('is-hiding');
    setTimeout(() => splashScreen.remove(), 550);
  }, 2800);
}

// Blocco scroll del body dietro le schermate a overlay. Su iOS Safari
// `overflow: hidden` sul body non basta: lo scroll "sfonda" comunque verso il
// contenuto sottostante. Fissare il body con position:fixed lo rende
// realmente immobile; al termine si ripristina l'esatta posizione di scroll.
let bodyScrollLockY = 0;
function lockBodyScroll() {
  bodyScrollLockY = window.scrollY || window.pageYOffset || 0;
  document.body.classList.add('register-open');
  document.body.style.position = 'fixed';
  document.body.style.top = `-${bodyScrollLockY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
}
function unlockBodyScroll() {
  document.body.classList.remove('register-open');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  window.scrollTo(0, bodyScrollLockY);
}

// Il menu è un overlay: si apre sopra il contenuto (che resta fermo dietro una
// velina), non lo spinge giù.
function setMenuOpen(open) {
  if (!menuToggleButton || !mainMenu) {
    return;
  }
  setCollapsibleOpen(menuToggleButton, mainMenu, open);
  if (menuBackdrop) {
    menuBackdrop.hidden = !open;
  }
}

// Sezione attiva: 'militari', 'velocisti' o 'master'. Il burger menu e i
// pulsanti della home permettono di passare da una all'altra senza tornare
// alla home. "master" non ha ancora una gestione atleti propria: ospita solo
// il calcolatore "Mezzofondo e fondo".
const SECTION_SHELLS = { militari: militariShell, velocisti: velocistiShell, master: masterShell };

function switchSection(section) {
  if (!SECTION_SHELLS[section]) {
    return;
  }
  homeScreen.hidden = true;
  if (appHeaderWrap) appHeaderWrap.hidden = false;
  Object.entries(SECTION_SHELLS).forEach(([key, shell]) => {
    if (shell) shell.hidden = key !== section;
  });
  setMenuOpen(false);
  document.querySelectorAll('.menu-item[data-section]').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.section === section);
  });
  // Ogni calcolatore vive nella sua sezione: "Programma allenamento" solo nei
  // militari, "Andature sprint" solo tra i velocisti, "Mezzofondo e fondo"
  // solo in Master. "Ripetute brevi" compare sia nei militari (a fianco
  // delle Note) sia in Master (a fianco di Mezzofondo e fondo).
  if (trainingNotesFab) {
    trainingNotesFab.hidden = section !== 'militari';
  }
  if (ripetuteFab) {
    ripetuteFab.hidden = section !== 'militari' && section !== 'master';
  }
  if (sprintFab) {
    sprintFab.hidden = section !== 'velocisti';
  }
  if (fondoFab) {
    fondoFab.hidden = section !== 'master';
  }
  window.scrollTo(0, 0);
}

if (enterMilitariButton) {
  enterMilitariButton.addEventListener('click', () => switchSection('militari'));
}
if (enterVelocistiButton) {
  enterVelocistiButton.addEventListener('click', () => switchSection('velocisti'));
}
if (enterMasterButton) {
  enterMasterButton.addEventListener('click', () => switchSection('master'));
}
document.querySelectorAll('.menu-item[data-section]').forEach((item) => {
  item.addEventListener('click', () => switchSection(item.dataset.section));
});
if (menuToggleButton && mainMenu) {
  menuToggleButton.addEventListener('click', () => {
    setMenuOpen(mainMenu.hidden);
  });
}
if (menuBackdrop) {
  menuBackdrop.addEventListener('click', () => setMenuOpen(false));
}

let currentAvatarData = null;

function pad(value, length = 2) {
  return String(value).padStart(length, '0');
}

function getNowParts() {
  const now = new Date();

  return {
    date: now.toLocaleDateString('it-IT'),
    time: now.toLocaleTimeString('it-IT', { hour12: false }),
    iso: now.toISOString(),
  };
}

function populateInsertionFields() {
  const { date, time } = getNowParts();
  createdDateInput.value = date;
  createdTimeInput.value = time;
}

function normalizeTimeValue(value, max, fallback = 0) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  if (parsed < 0) {
    return fallback;
  }

  if (parsed > max) {
    return max;
  }

  return parsed;
}

function formatTimeFromParts({ hours, minutes, seconds, tenths }) {
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${tenths}`;
}

function formatTime(value = null) {
  const hours = normalizeTimeValue(value !== null ? value.hours : hoursInput.value, 99, 0);
  const minutes = normalizeTimeValue(value !== null ? value.minutes : minutesInput.value, 59, 0);
  const seconds = normalizeTimeValue(value !== null ? value.seconds : secondsInput.value, 59, 0);
  const tenths = normalizeTimeValue(value !== null ? value.tenths : tenthsInput.value, 9, 0);

  return formatTimeFromParts({ hours, minutes, seconds, tenths });
}

function parseTimeParts(timeString) {
  const clean = String(timeString).trim();
  const match = clean.match(/^(\d+):(\d+):(\d+)\.(\d)$/);

  if (!match) {
    return { hours: 0, minutes: 0, seconds: 0, tenths: 0 };
  }

  const [, hours, minutes, seconds, tenths] = match;
  return {
    hours: Number(hours),
    minutes: Number(minutes),
    seconds: Number(seconds),
    tenths: Number(tenths),
  };
}

function parseTimeToSeconds(timeString) {
  const { hours, minutes, seconds, tenths } = parseTimeParts(timeString);
  return hours * 3600 + minutes * 60 + seconds + tenths / 10;
}

function formatSecondsForDisplay(totalSeconds) {
  const safeTotal = Number.isFinite(totalSeconds) ? Math.max(totalSeconds, 0) : 0;
  const wholeSeconds = Math.floor(safeTotal);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const seconds = wholeSeconds % 60;
  const tenths = Math.round((safeTotal - wholeSeconds) * 10) % 10;

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${tenths}`;
}

function getActivityMeters(activityValue) {
  const selected = ACTIVITY_OPTIONS.find((option) => option.label === activityValue);
  return selected ? selected.meters : 1000;
}

function buildProjections(timeString, activity) {
  const baseDistance = getActivityMeters(activity);
  const totalSeconds = parseTimeToSeconds(timeString);

  if (!totalSeconds) {
    return [];
  }

  const distances = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const secondsPerMeter = totalSeconds / baseDistance;

  return distances.map((distance) => ({
    distance,
    label: distance >= 1000 ? '1km' : `${distance}mt`,
    time: formatSecondsForDisplay(distance * secondsPerMeter),
    isBase: distance === baseDistance,
  }));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getInitials(name, surname) {
  const n = (name || '').trim().charAt(0).toUpperCase();
  const s = (surname || '').trim().charAt(0).toUpperCase();
  return (n + s) || '?';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result;
      // Comprimi se troppo grande
      if (base64String.length > MAX_AVATAR_SIZE) {
        // Se troppo grande, resize l'immagine
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 200;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 200, 200);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => reject(new Error('Errore nel caricamento dell\'immagine'));
        img.src = base64String;
      } else {
        resolve(base64String);
      }
    };
    reader.onerror = () => reject(new Error('Errore nella lettura del file'));
    reader.readAsDataURL(file);
  });
}

function updateAvatarPreview() {
  if (currentAvatarData) {
    avatarPreview.style.backgroundImage = `url('${currentAvatarData}')`;
    avatarPreview.classList.remove('avatar-empty');
    avatarPreview.innerHTML = '';
  } else {
    const name = nameInput.value.trim();
    const surname = surnameInput.value.trim();
    if (name || surname) {
      avatarPreview.classList.remove('avatar-empty');
      avatarPreview.innerHTML = `<span class="avatar-initials">${getInitials(name, surname)}</span>`;
      avatarPreview.style.backgroundImage = '';
    } else {
      avatarPreview.classList.add('avatar-empty');
      avatarPreview.innerHTML = '<span class="avatar-placeholder">+</span>';
      avatarPreview.style.backgroundImage = '';
    }
  }
}

function getAthleteTimeRecords(athlete) {
  const times = Array.isArray(athlete.times) ? athlete.times : [];

  return [...times].sort((a, b) => {
    const aDate = new Date(a.createdAt || 0).getTime();
    const bDate = new Date(b.createdAt || 0).getTime();
    return aDate - bDate;
  });
}

function getLatestAthleteTime(athlete) {
  const times = getAthleteTimeRecords(athlete);
  return times.length ? times[times.length - 1] : null;
}

function getBestAthleteTime(athlete) {
  const times = getAthleteTimeRecords(athlete)
    .filter((record) => record.activity !== 'Salto in alto' && parseTimeToSeconds(record.time) > 0);

  if (!times.length) {
    return null;
  }

  return times.reduce((best, current) => (
    parseTimeToSeconds(current.time) < parseTimeToSeconds(best.time) ? current : best
  ));
}

function getBestAthleteJump(athlete) {
  const jumps = getAthleteTimeRecords(athlete)
    .filter((record) => record.activity === 'Salto in alto' && parseFloat(record.jumpHeight || 0) > 0);

  if (!jumps.length) {
    return null;
  }

  return jumps.reduce((best, current) => (
    parseFloat(current.jumpHeight || 0) > parseFloat(best.jumpHeight || 0) ? current : best
  ));
}

function normalizeAthlete(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  // Esito del concorso: null = in corso (default), 'passed' = superato,
  // 'failed' = non superato. competitionAskedOn tiene la data (YYYY-MM-DD)
  // dell'ultima volta che il popup automatico del giorno-dopo è stato
  // mostrato/rimandato con "Non lo so ancora", per non richiederlo più volte
  // lo stesso giorno.
  const competitionResult = entry.competitionResult === 'passed' || entry.competitionResult === 'failed'
    ? entry.competitionResult
    : null;
  const competitionAskedOn = entry.competitionAskedOn || null;

  if (Array.isArray(entry.times)) {
    return {
      id: entry.id || `athlete-${Math.random().toString(36).slice(2, 8)}`,
      name: entry.name || '',
      surname: entry.surname || '',
      nickname: entry.nickname || '',
      military: entry.military || '',
      activity: entry.activity || '1km',
      avatar: entry.avatar || null,
      notes: normalizeNotes(entry.notes, entry.notesSavedAt),
      competitionResult,
      competitionAskedOn,
      times: entry.times.map((timeEntry) => ({
        ...timeEntry,
        id: timeEntry.id || `${entry.id || 'time'}-${Math.random().toString(36).slice(2, 8)}`,
      })),
    };
  }

  if (entry.time || entry.date || entry.activity || entry.createdAt) {
    return {
      id: entry.id || `athlete-${Math.random().toString(36).slice(2, 8)}`,
      name: entry.name || '',
      surname: entry.surname || '',
      nickname: entry.nickname || '',
      military: entry.military || '',
      activity: entry.activity || '1km',
      avatar: entry.avatar || null,
      notes: normalizeNotes(entry.notes, entry.notesSavedAt),
      competitionResult,
      competitionAskedOn,
      times: [{
        id: entry.id || `time-${Math.random().toString(36).slice(2, 8)}`,
        activity: entry.activity || '1km',
        time: entry.time || '00:00:00.0',
        date: entry.date || '',
        timeInserted: entry.timeInserted || '',
        createdAt: entry.createdAt || new Date().toISOString(),
      }],
    };
  }

  return null;
}

let cachedEntries = [];

function getAthletes() {
  return [...cachedEntries];
}

// Persistenza: store locale del browser (localStorage). Funziona identico in
// locale (via server.py come semplice file server) e su hosting statico tipo
// GitHub Pages. Al primo avvio, se lo store è vuoto, semina i dati dal file
// statico athletes-data.json incluso nel repo.
function persistEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Impossibile salvare in localStorage:', error);
  }
}

async function readEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      const normalized = Array.isArray(parsed) ? parsed.map(normalizeAthlete).filter(Boolean) : [];
      cachedEntries = normalized;
      return normalized;
    }
  } catch (error) {
    console.warn('localStorage non leggibile, provo il seed dal file:', error);
  }

  // Primo avvio (o store non disponibile): semina da athletes-data.json.
  try {
    const response = await fetch('./athletes-data.json', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      const normalized = Array.isArray(data) ? data.map(normalizeAthlete).filter(Boolean) : [];
      cachedEntries = normalized;
      persistEntries(normalized);
      return normalized;
    }
  } catch (error) {
    console.warn('Seed athletes-data.json non disponibile:', error);
  }

  cachedEntries = [];
  return [];
}

async function saveEntries(entries) {
  cachedEntries = entries;
  persistEntries(entries);
}

function getSuggestionQueries() {
  const nameQuery = (nameInput.value || '').trim().toLowerCase();
  const surnameQuery = (surnameInput ? surnameInput.value || '' : '').trim().toLowerCase();
  return {
    nameQuery: nameQuery.length >= SUGGESTION_MIN_CHARS ? nameQuery : '',
    surnameQuery: surnameQuery.length >= SUGGESTION_MIN_CHARS ? surnameQuery : '',
  };
}

function findMatchingAthletes() {
  const { nameQuery, surnameQuery } = getSuggestionQueries();

  if (!nameQuery && !surnameQuery) {
    return [];
  }

  return getAthletes().filter((athlete) => {
    const name = (athlete.name || '').toLowerCase();
    const surname = (athlete.surname || '').toLowerCase();
    const full = `${name} ${surname}`;
    // match come sottostringa contigua, valutando i due campi in modo indipendente
    const nameHit = nameQuery && (name.includes(nameQuery) || full.includes(nameQuery));
    const surnameHit = surnameQuery && (surname.includes(surnameQuery) || full.includes(surnameQuery));
    return nameHit || surnameHit;
  }).slice(0, 5);
}

function highlightMatch(text, query) {
  const value = String(text || '');
  if (!query) {
    return escapeHtml(value);
  }
  const index = value.toLowerCase().indexOf(query);
  if (index === -1) {
    return escapeHtml(value);
  }
  const before = value.slice(0, index);
  const hit = value.slice(index, index + query.length);
  const after = value.slice(index + query.length);
  return `${escapeHtml(before)}<mark class="sugg-mark">${escapeHtml(hit)}</mark>${escapeHtml(after)}`;
}

function renderSuggestions() {
  const matches = findMatchingAthletes();
  const { nameQuery, surnameQuery } = getSuggestionQueries();

  if (!matches.length) {
    athleteSuggestions.hidden = true;
    athleteSuggestions.innerHTML = '';
    return;
  }

  athleteSuggestions.hidden = false;
  athleteSuggestions.innerHTML = matches.map((athlete) => `
    <button type="button" class="suggestion-item" data-athlete-id="${athlete.id}">
      <strong>${highlightMatch(athlete.name, nameQuery || surnameQuery)} ${highlightMatch(athlete.surname, surnameQuery || nameQuery)}</strong>
      <small>${escapeHtml(athlete.military || 'Nessun corpo')}</small>
    </button>
  `).join('');
}

function hideSuggestions() {
  athleteSuggestions.hidden = true;
  athleteSuggestions.innerHTML = '';
}

// Click su un suggerimento in registrazione: è un atleta già esistente, quindi
// chiudo la registrazione e apro direttamente la sua scheda in modifica.
function openEditFormFor(athleteId) {
  const entry = getAthletes().find((e) => e.id === athleteId);
  if (!entry) {
    return;
  }

  hideSuggestions();
  closeRegisterScreen();

  const findEditButton = () => athletesList.querySelector(`.edit-btn[data-id="${athleteId}"]`);
  let editButton = findEditButton();

  if (!editButton) {
    // la card potrebbe essere nascosta da un filtro attivo o non ancora caricata:
    // azzero i filtri e mi assicuro che l'atleta sia tra quelli visibili.
    athleteSearchInput.value = '';
    const searchClearBtn = document.getElementById('athlete-search-clear');
    if (searchClearBtn) searchClearBtn.hidden = true;
    activeDistance = FILTER_DEFAULTS.distance;
    activeSort = FILTER_DEFAULTS.sort;
    activeOutcome = FILTER_DEFAULTS.outcome;
    activeIncludeDecided = FILTER_DEFAULTS.includeDecided;
    syncFilterChips();
    const targetIdx = getFilteredEntries().findIndex((a) => a.id === athleteId);
    currentPage = targetIdx >= 0 ? Math.floor(targetIdx / PAGE_SIZE) + 1 : 1;
    renderEntries();
    editButton = findEditButton();
  }

  if (editButton) {
    editButton.click();
    const item = editButton.closest('.athlete-item');
    if (item) {
      item.scrollIntoView({ block: 'center' });
    }
  }
}

function getFilteredEntries() {
  const athletes = cachedEntries;
  const query = athleteSearchInput.value.trim().toLowerCase();
  const activityFilter = activeDistance;
  const sortValue = activeSort;

  const filtered = athletes.filter((athlete) => {
    const runRecords = Array.isArray(athlete.times) ? athlete.times : [];
    const activityMatch = activityFilter === 'Tutte'
      || runRecords.some((record) => record.activity === activityFilter)
      || athlete.activity === activityFilter;
    // ricerca solo su nome/cognome, come sottostringa contigua (niente corpo militare)
    const name = (athlete.name || '').toLowerCase();
    const surname = (athlete.surname || '').toLowerCase();
    const searchMatch = !query
      || name.includes(query)
      || surname.includes(query)
      || `${name} ${surname}`.includes(query);
    // Filtro esplicito "Superati"/"Non superati": mostra SOLO quello stato,
    // a prescindere dal toggle Sì/No dell'Applica (che ha senso solo con
    // "Tutti", dove l'inclusione dei decisi è ambigua per definizione).
    const outcomeMatch = activeOutcome === 'all' || athlete.competitionResult === activeOutcome;
    // Scelto "No" all'Applica (solo con "Tutti"): chi ha già un esito
    // (Superato/Non superato) esce del tutto dai risultati, non solo in coda.
    const decidedMatch = activeOutcome !== 'all' || activeIncludeDecided !== false || !athlete.competitionResult;
    return activityMatch && searchMatch && outcomeMatch && decidedMatch;
  });

  // A parità di tempo/misura/data, si va in ordine alfabetico per nome e cognome.
  const alphaCompare = (a, b) => {
    const aName = `${a.name} ${a.surname}`.trim().toLowerCase();
    const bName = `${b.name} ${b.surname}`.trim().toLowerCase();
    return aName.localeCompare(bName, 'it');
  };

  filtered.sort((a, b) => {
    if (sortValue === 'az' || sortValue === 'za') {
      const cmp = alphaCompare(a, b);
      return sortValue === 'az' ? cmp : -cmp;
    }

    if (sortValue === 'recent' || sortValue === 'oldest') {
      const aDate = new Date(getLatestAthleteTime(a)?.createdAt || 0).getTime();
      const bDate = new Date(getLatestAthleteTime(b)?.createdAt || 0).getTime();
      const cmp = sortValue === 'recent' ? bDate - aDate : aDate - bDate;
      return cmp !== 0 ? cmp : alphaCompare(a, b);
    }

    if (sortValue === 'bestjump' || sortValue === 'worstjump') {
      const aBest = getBestAthleteJump(a);
      const bBest = getBestAthleteJump(b);
      const aHeight = aBest ? parseFloat(aBest.jumpHeight || 0) : -1;
      const bHeight = bBest ? parseFloat(bBest.jumpHeight || 0) : -1;
      const cmp = sortValue === 'bestjump' ? bHeight - aHeight : aHeight - bHeight;
      return cmp !== 0 ? cmp : alphaCompare(a, b);
    }

    const aBest = getBestAthleteTime(a);
    const bBest = getBestAthleteTime(b);
    const aSeconds = aBest ? parseTimeToSeconds(aBest.time) : Number.MAX_SAFE_INTEGER;
    const bSeconds = bBest ? parseTimeToSeconds(bBest.time) : Number.MAX_SAFE_INTEGER;
    const cmp = sortValue === 'worst' ? bSeconds - aSeconds : aSeconds - bSeconds;
    return cmp !== 0 ? cmp : alphaCompare(a, b);
  });

  // Finché non si sceglie esplicitamente "Sì" all'Applica, chi ha già un
  // esito (Superato/Non superato) resta incluso ma va sempre in fondo,
  // qualunque sia l'ordinamento attivo (con "No" sono già stati esclusi sopra,
  // quindi qui "decided" è vuoto e la partizione è un no-op). Con un filtro
  // esplicito "Superati"/"Non superati" i risultati condividono già lo stesso
  // esito: la partizione non serve (e comunque non farebbe nulla).
  if (activeOutcome === 'all' && activeIncludeDecided !== true) {
    const pending = filtered.filter((athlete) => !athlete.competitionResult);
    const decided = filtered.filter((athlete) => athlete.competitionResult);
    return [...pending, ...decided];
  }

  return filtered;
}

function createEditForm(entry) {
  const editForm = document.createElement('form');
  editForm.className = 'edit-form';
  editForm.hidden = true;
  editForm.dataset.id = entry.id;

  const runningActivity = ACTIVITY_OPTIONS.some((opt) => opt.label === entry.activity)
    ? entry.activity
    : '1km';
  const activityOptions = ACTIVITY_OPTIONS
    .map((opt) => `<option value="${opt.label}" ${opt.label === runningActivity ? 'selected' : ''}>${opt.label}</option>`)
    .join('');
  const w = (suffix) => `w-${entry.id}-${suffix}`;

  // Piede di stacco preselezionato = quello scelto la prima volta (primo salto
  // registrato con un piede), così se non lo si tocca resta quello di sempre.
  const firstJumpWithFoot = getAthleteTimeRecords(entry)
    .find((record) => record.activity === 'Salto in alto' && record.takeoffFoot);
  const defaultTakeoffFoot = firstJumpWithFoot ? firstJumpWithFoot.takeoffFoot : '';

  // Data del concorso mostrata sulla card = concorsoDate del record più recente.
  const latestRecord = getLatestAthleteTime(entry);
  const concorsoNativeValue = (() => {
    const ts = latestRecord ? parseItDate(latestRecord.concorsoDate || '') : null;
    if (ts === null) {
      return '';
    }
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const resultDateField = (prefix) => resultDateFieldHtml(prefix);

  const dateParts = (value) => {
    const parts = String(value || '').split('/');
    return { gg: parts[0] || '', mo: parts[1] || '', yy: (parts[2] || '').slice(-2) };
  };

  const pastDateCells = (record) => {
    const dp = dateParts(record.date);
    return `
      <div class="edit-past-cells">
        <span class="edit-past-tag">Data</span>
        <span class="mini-group">
          <input class="mini-input" data-f="gg" type="number" min="1" max="31" inputmode="numeric" value="${escapeHtml(dp.gg)}" aria-label="giorno" />
          <b>/</b>
          <input class="mini-input" data-f="mo" type="number" min="1" max="12" inputmode="numeric" value="${escapeHtml(dp.mo)}" aria-label="mese" />
          <b>/</b>
          <input class="mini-input" data-f="yy" type="number" min="0" max="99" inputmode="numeric" value="${escapeHtml(dp.yy)}" aria-label="anno" />
        </span>
      </div>
    `;
  };

  const trashIcon = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg>';
  const undoIcon = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-1"/></svg>';
  const confirmIcon = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>';

  const pastRow = (record, kind, cellsHtml) => `
    <div class="edit-past-row" data-record-id="${escapeHtml(record.id)}" data-kind="${kind}">
      <div class="edit-past-fields">
        ${cellsHtml}
        ${pastDateCells(record)}
      </div>
      <button type="button" class="past-del-btn" aria-label="Elimina questo risultato">
        <span class="ic ic-del" aria-hidden="true">${trashIcon}</span>
        <span class="ic ic-undo" aria-hidden="true">${undoIcon}</span>
      </button>
      <button type="button" class="past-del-confirm-btn" aria-label="Elimina definitivamente" title="Elimina definitivamente">
        ${confirmIcon}
      </button>
    </div>
  `;

  const pastRunRow = (record) => {
    const tp = parseTimeParts(record.time);
    return pastRow(record, 'run', `
      <div class="edit-past-cells">
        <span class="edit-past-tag">${escapeHtml(record.activity || 'Corsa')}</span>
        <span class="mini-group">
          <input class="mini-input" data-f="h" type="number" min="0" max="99" inputmode="numeric" value="${pad(tp.hours)}" aria-label="ore" />
          <b>:</b>
          <input class="mini-input" data-f="m" type="number" min="0" max="59" inputmode="numeric" value="${pad(tp.minutes)}" aria-label="minuti" />
          <b>:</b>
          <input class="mini-input" data-f="s" type="number" min="0" max="59" inputmode="numeric" value="${pad(tp.seconds)}" aria-label="secondi" />
          <b>.</b>
          <input class="mini-input mini-input-sm" data-f="d" type="number" min="0" max="9" inputmode="numeric" value="${tp.tenths}" aria-label="decimi" />
        </span>
      </div>
    `);
  };

  const pastJumpRow = (record) => {
    const [jm = '0', jcm = '00'] = String(record.jumpHeight || '0.00').split('.');
    return pastRow(record, 'jump', `
      <div class="edit-past-cells">
        <span class="edit-past-tag">Alto</span>
        <span class="mini-group">
          <input class="mini-input" data-f="jm" type="number" min="0" max="3" inputmode="numeric" value="${escapeHtml(jm)}" aria-label="metri" />
          <b>.</b>
          <input class="mini-input" data-f="jcm" type="number" min="0" max="99" step="5" inputmode="numeric" value="${escapeHtml(jcm)}" aria-label="centimetri" />
          <b>m</b>
        </span>
      </div>
    `);
  };

  const pastRecords = getAthleteTimeRecords(entry);
  const pastRuns = pastRecords.filter((record) => record.activity !== 'Salto in alto');
  const pastJumps = pastRecords.filter((record) => record.activity === 'Salto in alto');

  // Sezioni a fisarmonica: collassate di default, un click sull'intestazione
  // apre quella sezione e chiude le altre (vedi wiring su .edit-section-toggle).
  const sectionWrap = editSectionWrap;

  const pastSection = (pastRuns.length || pastJumps.length) ? sectionWrap('Modifica risultati precedenti', `
      <div class="edit-subgroup">
        <div class="edit-subtitle">Corsa</div>
        ${pastRuns.length ? pastRuns.map(pastRunRow).join('') : '<div class="edit-past-empty">Nessun risultato</div>'}
      </div>
      <div class="edit-subgroup">
        <div class="edit-subtitle">Salto in alto</div>
        ${pastJumps.length ? pastJumps.map(pastJumpRow).join('') : '<div class="edit-past-empty">Nessun risultato</div>'}
      </div>
  `) : '';

  const anagraficaBody = `
      <div class="field-row">
        <div class="field-group">
          <label>Nome</label>
          <input name="edit-name" type="text" value="${escapeHtml(entry.name)}" />
        </div>
        <div class="field-group">
          <label>Cognome</label>
          <input name="edit-surname" type="text" value="${escapeHtml(entry.surname)}" />
        </div>
      </div>
      <div class="field-row-avatar">
        <div class="field-group avatar-field">
          <label>Foto profilo</label>
          <div class="avatar-edit-wrapper">
            <input class="edit-avatar-input" type="file" accept="image/*" />
            <div class="avatar-circle avatar-edit-circle">
              ${entry.avatar
                ? ''
                : `<span class="avatar-initials">${escapeHtml(getInitials(entry.name, entry.surname))}</span>`
              }
              <span class="avatar-cam" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 8h3l1.6-2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
                  <circle cx="12" cy="13" r="3.2" />
                </svg>
              </span>
            </div>
          </div>
        </div>
        <div class="field-group">
          <label>Corpo militare</label>
          <select name="edit-military">
            <option value="">Seleziona</option>
            <option value="Polizia" ${entry.military === 'Polizia' ? 'selected' : ''}>Polizia</option>
            <option value="Carabinieri" ${entry.military === 'Carabinieri' ? 'selected' : ''}>Carabinieri</option>
            <option value="Finanza" ${entry.military === 'Finanza' ? 'selected' : ''}>Finanza</option>
            <option value="Vigili del fuoco" ${entry.military === 'Vigili del fuoco' ? 'selected' : ''}>Vigili del fuoco</option>
            <option value="Aeronautica" ${entry.military === 'Aeronautica' ? 'selected' : ''}>Aeronautica</option>
            <option value="Marina" ${entry.military === 'Marina' ? 'selected' : ''}>Marina</option>
            <option value="Gendarmeria" ${entry.military === 'Gendarmeria' ? 'selected' : ''}>Gendarmeria</option>
            <option value="Esercito" ${entry.military === 'Esercito' ? 'selected' : ''}>Esercito</option>
          </select>
        </div>
      </div>
      ${latestRecord ? `
      <div class="field-group">
        <label>Data del concorso</label>
        <input class="native-date" name="edit-concorso-date" type="date" value="${concorsoNativeValue}" />
      </div>` : ''}
  `;

  const risultatiBody = `
      <div class="field-group">
        <label>Corsa</label>
        <select name="edit-new-activity">${activityOptions}</select>
        <div class="seg-input" role="group" aria-label="Nuovo tempo di corsa">
          <div class="seg-field">
            <span class="seg-label">h</span>
            <input class="seg-cell" name="edit-nt-hours" type="text" inputmode="numeric" maxlength="2" data-max="99" value="00" aria-label="ore" autocomplete="off" data-1p-ignore data-lpignore="true" data-form-type="other" />
          </div>
          <span class="seg-colon">:</span>
          <div class="seg-field">
            <span class="seg-label">min</span>
            <input class="seg-cell" name="edit-nt-minutes" type="text" inputmode="numeric" maxlength="2" data-max="59" value="00" aria-label="minuti" autocomplete="off" data-1p-ignore data-lpignore="true" data-form-type="other" />
          </div>
          <span class="seg-colon">:</span>
          <div class="seg-field">
            <span class="seg-label">sec</span>
            <input class="seg-cell" name="edit-nt-seconds" type="text" inputmode="numeric" maxlength="2" data-max="59" value="00" aria-label="secondi" autocomplete="off" data-1p-ignore data-lpignore="true" data-form-type="other" />
          </div>
          <span class="seg-colon">.</span>
          <div class="seg-field">
            <span class="seg-label">dec</span>
            <input class="seg-cell seg-cell-narrow" name="edit-nt-tenths" type="text" inputmode="numeric" maxlength="1" data-max="9" value="0" aria-label="decimi" autocomplete="off" data-1p-ignore data-lpignore="true" data-form-type="other" />
          </div>
        </div>
        ${resultDateField('nt')}
      </div>
      <div class="field-group field-group-jump">
        <label>Salto in alto</label>
        <select name="edit-new-foot">
          <option value="" ${defaultTakeoffFoot === '' ? 'selected' : ''}>Piede di stacco</option>
          <option value="Sinistro" ${defaultTakeoffFoot === 'Sinistro' ? 'selected' : ''}>Sinistro</option>
          <option value="Centrale" ${defaultTakeoffFoot === 'Centrale' ? 'selected' : ''}>Centrale</option>
          <option value="Destro" ${defaultTakeoffFoot === 'Destro' ? 'selected' : ''}>Destro</option>
        </select>
        <div class="ruler" data-min="0" data-max="250" data-step="5" aria-label="Nuova altezza salto">
          <div class="ruler-readout"><span class="ruler-value">—</span><span class="ruler-unit">m</span></div>
          <div class="ruler-viewport">
            <div class="ruler-strip"></div>
            <span class="ruler-needle" aria-hidden="true"></span>
          </div>
          <input type="hidden" class="ruler-m" name="edit-nh-m" value="0" />
          <input type="hidden" class="ruler-cm" name="edit-nh-cm" value="0" />
        </div>
        ${resultDateField('nh')}
      </div>
  `;

  editForm.innerHTML = `
    ${sectionWrap('Anagrafica', anagraficaBody)}
    ${sectionWrap('Aggiungi risultati', risultatiBody)}
    ${pastSection}

    <div class="edit-actions">
      <button type="submit" class="primary-btn save-edit-btn">Salva</button>
      <button type="button" class="secondary-btn cancel-edit-btn">Annulla</button>
    </div>
  `;

  // Set avatar image if exists
  const avatarCircle = editForm.querySelector('.avatar-edit-circle');
  if (entry.avatar) {
    avatarCircle.style.backgroundImage = `url('${entry.avatar}')`;
    avatarCircle.querySelector('.avatar-initials')?.remove();
  }

  // Avatar input handler for edit form
  const avatarInput = editForm.querySelector('.edit-avatar-input');
  let editAvatarData = entry.avatar || null;

  avatarInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        editAvatarData = await fileToBase64(file);
        editForm.dataset.editAvatarData = editAvatarData;
        avatarCircle.style.backgroundImage = `url('${editAvatarData}')`;
        avatarCircle.querySelector('.avatar-initials')?.remove();
      } catch (error) {
        console.error('Errore nel caricamento dell\'avatar:', error);
        alert('Errore nel caricamento dell\'immagine. Prova un file più piccolo.');
        avatarInput.value = '';
      }
    }
  });

  avatarCircle.addEventListener('click', () => {
    avatarInput.click();
  });

  // Store the original avatar in the form for fallback
  editForm.dataset.editAvatarData = editAvatarData || '';

  // "Setta data del risultato": la checkbox mostra/nasconde il date picker del
  // nuovo risultato (corsa o salto).
  editForm.querySelectorAll('.result-date-toggle input[type="checkbox"]').forEach((checkbox) => {
    const field = checkbox.closest('.field-group').querySelector('.result-date-field');
    if (!field) {
      return;
    }
    checkbox.addEventListener('change', () => {
      field.hidden = !checkbox.checked;
      if (checkbox.checked) {
        field.focus();
      }
    });
  });

  return editForm;
}

function formatConcorsoDate() {
  const dayInput = document.getElementById('concorsoDay');
  const monthInput = document.getElementById('concorsoMonth');
  const yearInput = document.getElementById('concorsoYear');

  if (!dayInput || !monthInput || !yearInput) {
    return '';
  }

  // Se il campo è rimasto vuoto (nessuna data scelta in registrazione), non
  // si assume "oggi": si salva un segnaposto che ricorda di aggiornarla dopo,
  // dalla sezione di modifica.
  const day = dayInput.value.trim();
  const month = monthInput.value.trim();
  const year = yearInput.value.trim();
  if (!day && !month && !year) {
    return '--/--/--';
  }

  return `${pad(Number(day) || 0)}/${pad(Number(month) || 0)}/${pad(Number(year) || 0)}`;
}

function formatJumpHeight() {
  const metersInput = document.getElementById('jumpMeters');
  const cmInput = document.getElementById('jumpCm');

  if (!metersInput || !cmInput) {
    return '';
  }

  return `${Number(metersInput.value) || 0}.${pad(Number(cmInput.value) || 0)}`;
}

function highJumpIcon(size = 14) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">`
    + '<line x1="6" y1="22" x2="6.8" y2="9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
    + '<line x1="17.6" y1="15" x2="18" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    + '<line x1="4.6" y1="10.5" x2="19" y2="5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
    + '</svg>';
}

function runnerIcon(size = 15) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">`
    + '<circle cx="16.5" cy="5" r="2.3" fill="currentColor" stroke="none"/>'
    + '<path d="M14.2 8.8 9.5 14"/>'
    + '<path d="M9.5 14 13.5 16.5 11 21.5"/>'
    + '<path d="M9.5 14 5 15 2.5 12"/>'
    + '<path d="M13.6 9.4 16.8 9.8 15.4 12.6"/>'
    + '<path d="M13.6 9.4 10.6 8.6 9 11"/>'
    + '</svg>';
}

function calendarIcon(size = 12) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2">`
    + '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/>'
    + '<line x1="3.5" y1="9.5" x2="20.5" y2="9.5"/>'
    + '<line x1="8" y1="3" x2="8" y2="6.5" stroke-linecap="round"/>'
    + '<line x1="16" y1="3" x2="16" y2="6.5" stroke-linecap="round"/>'
    + '</svg>';
}

function hourglassIcon(size = 14) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`
    + '<path d="M6 3h12"/>'
    + '<path d="M6 21h12"/>'
    + '<path d="M7 3v3.5c0 1.4.9 2.6 2.3 3.3L12 11l2.7-1.2C16.1 9.1 17 7.9 17 6.5V3"/>'
    + '<path d="M7 21v-3.5c0-1.4.9-2.6 2.3-3.3L12 13l2.7 1.2c1.4.7 2.3 1.9 2.3 3.3V21"/>'
    + '</svg>';
}

function thumbsUpIcon(size = 14) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`
    + '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>'
    + '<path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>'
    + '</svg>';
}

function thumbsDownIcon(size = 14) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`
    + '<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>'
    + '<path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/>'
    + '</svg>';
}

function reloadIcon(size = 14) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">`
    + '<path d="M20 11A8 8 0 104 13"/>'
    + '<path d="M20 5v6h-6"/>'
    + '</svg>';
}

// Stesso scudo usato per "C. Militari" nella home, riusato sulla pill del
// corpo militare in ogni card.
function militaryShieldIcon(size = 11) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">`
    + '<path d="M12 2 4 5v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z"/>'
    + '</svg>';
}

// Data odierna in formato input[type=date] (yyyy-mm-dd), per precompilare i
// date picker dei form di modifica.
function todayNativeDateValue() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Checkbox "Cambia data del risultato" (casella custom con spunta) + date
// picker nascosto sotto: condivisa tra il form di modifica atleti militari e
// quello dei velocisti.
// Sezione a fisarmonica dei form di modifica: intestazione cliccabile (con
// chevron) + corpo collassabile. Condivisa tra atleti e velocisti — l'apertura
// esclusiva delle sezioni è gestita da toggleEditSection.
function editSectionWrap(title, bodyHtml) {
  const chevron = '<svg class="edit-section-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
  return `
    <div class="edit-section">
      <button type="button" class="edit-section-toggle" aria-expanded="false">
        <span class="edit-section-title">${title}</span>
        ${chevron}
      </button>
      <div class="edit-section-body" hidden>
        ${bodyHtml}
      </div>
    </div>
  `;
}

function resultDateFieldHtml(prefix, todayNativeValue = todayNativeDateValue()) {
  const checkIcon = '<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>';
  return `
    <label class="result-date-toggle">
      <input type="checkbox" class="result-date-checkbox" name="edit-${prefix}-setdate" />
      <span class="result-date-box" aria-hidden="true">${checkIcon}</span>
      <span class="result-date-text">Cambia data del risultato</span>
    </label>
    <input class="native-date result-date-field" name="edit-${prefix}-date" type="date" value="${todayNativeValue}" hidden />
  `;
}

// Legge il valore di "Cambia data del risultato" per un prefisso di campo del
// form di modifica: se flaggata restituisce la data scelta (date/iso/label
// breve), altrimenti la data/ora corrente. Condivisa tra atleti e velocisti.
function resultDateFrom(editForm, prefix, now) {
  const checkbox = editForm.querySelector(`[name="edit-${prefix}-setdate"]`);
  const field = editForm.querySelector(`[name="edit-${prefix}-date"]`);
  if (!checkbox || !checkbox.checked || !field || !field.value) {
    return { date: now.date, iso: now.iso, concorso: shortYearDate(now.date) };
  }
  const [year, month, day] = field.value.split('-').map(Number);
  const localDate = `${pad(day)}/${pad(month)}/${year}`;
  const ts = new Date(year, month - 1, day, 12, 0, 0).getTime();
  return { date: localDate, iso: new Date(ts).toISOString(), concorso: shortYearDate(localDate) };
}

function targetIcon(size = 12) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2">`
    + '<circle cx="12" cy="12" r="9"/>'
    + '<circle cx="12" cy="12" r="5"/>'
    + '<circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>'
    + '</svg>';
}

function takeoffFootIcon(foot) {
  const on = 'fill:var(--primary);stroke:var(--primary);stroke-width:1.2;stroke-linejoin:round';
  const off = 'fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round';
  const foeven = (selected) => `style="${selected ? on : off}"`;
  const single = (x, selected) => `<g transform="translate(${x} 0)" ${foeven(selected)}>`
    + '<ellipse cx="6.5" cy="7" rx="5.4" ry="6.4"/>'
    + '<ellipse cx="6.5" cy="17.4" rx="3.9" ry="3.4"/>'
    + '</g>';

  // "Centrale": entrambi i piedi colorati (stacco simmetrico).
  const leftOn = foot === 'Sinistro' || foot === 'Centrale';
  const rightOn = foot === 'Destro' || foot === 'Centrale';

  return '<svg class="foot-icon" viewBox="0 0 32 22" width="34" height="22" aria-hidden="true" focusable="false">'
    + single(2, leftOn)
    + single(17, rightOn)
    + '</svg>';
}

function shortYearDate(dateStr) {
  const parts = String(dateStr).split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    parts[2] = parts[2].slice(2);
  }
  return parts.join('/');
}

function parseItDate(dateStr) {
  const match = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) {
    return null;
  }
  let [, day, month, year] = match;
  year = Number(year);
  if (year < 100) {
    year += 2000;
  }
  return new Date(year, Number(month) - 1, Number(day)).getTime();
}

const CHART_RUN_COLOR = '#FF5C3A';
const CHART_JUMP_COLOR = '#8b5cf6';
// Base fissa degli assi: la corsa parte da 7:00 (fondo dell'asse), l'alto da 1,00 m
// (misura minima). Se un risultato reale sfora questi limiti, l'asse si allarga per
// contenerlo comunque.
const CHART_RUN_FLOOR_S = 7 * 60;
const CHART_JUMP_FLOOR_M = 1.0;

function formatChartClock(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Mini grafico su carta millimetrata: X = tempo (date), asse Y sinistro = tempi di
// corsa (arancio), asse Y destro = altezze salto in alto (viola). Ogni serie ha la
// propria scala, i valori degli assi sono quelli reali.
function buildResultsChart(runHistory, jumpHistory) {
  const toPoints = (records, valueFn) => records
    .map((record) => ({ t: parseItDate(record.date), v: valueFn(record), date: record.date }))
    .filter((point) => point.t !== null && Number.isFinite(point.v) && point.v > 0)
    .sort((a, b) => a.t - b.t);

  const runPoints = toPoints(runHistory, (record) => parseTimeToSeconds(record.time));
  const jumpPoints = toPoints(jumpHistory, (record) => parseFloat(record.jumpHeight || 0));

  if (runPoints.length < 2 && jumpPoints.length < 2) {
    return '';
  }

  const uid = Math.random().toString(36).slice(2, 8);
  const hasRun = runPoints.length >= 2;
  const hasJump = jumpPoints.length >= 2;

  const W = 340;
  const H = 146;
  const mL = hasRun ? 40 : 12;
  const mR = hasJump ? 36 : 12;
  const mT = 10;
  const mB = 26;
  const plotX = mL;
  const plotY = mT;
  const plotW = W - mL - mR;
  const plotH = H - mT - mB;

  const allTimes = [...runPoints, ...jumpPoints].map((point) => point.t);
  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);
  const spanT = maxT - minT;
  const xFor = (time, index, count) => (spanT === 0
    ? plotX + (count > 1 ? index / (count - 1) : 0.5) * plotW
    : plotX + ((time - minT) / spanT) * plotW);

  // invert: valori "migliori" in alto (per la corsa il tempo più basso sta sopra,
  // così una progressione positiva fa salire la linea).
  // snap: aggancia gli estremi dell'asse a una griglia (es. 0.05 m = 5 cm).
  const scaleFor = (points, { invert = false, snap = 0, fixedLo = null, fixedHi = null } = {}) => {
    const values = points.map((point) => point.v);
    let lo = Math.min(...values);
    let hi = Math.max(...values);

    if (snap) {
      const unit = Math.round(snap * 100);
      let loUnits = Math.floor(Math.round(lo * 100) / unit) * unit;
      let hiUnits = Math.ceil(Math.round(hi * 100) / unit) * unit;
      if (fixedLo !== null) {
        loUnits = Math.min(loUnits, Math.round((fixedLo * 100) / unit) * unit);
      }
      if (fixedHi !== null) {
        hiUnits = Math.max(hiUnits, Math.round((fixedHi * 100) / unit) * unit);
      }
      if (hiUnits <= loUnits) {
        hiUnits = loUnits + unit;
      }
      if (((hiUnits - loUnits) / unit) % 2 === 1) {
        hiUnits += unit;
      }
      lo = loUnits / 100;
      hi = hiUnits / 100;
    } else {
      const pad = (hi - lo) * 0.14 || hi * 0.06 || 1;
      lo -= pad;
      hi += pad;
      if (fixedLo !== null) {
        lo = Math.min(lo, fixedLo);
      }
      if (fixedHi !== null) {
        hi = Math.max(hi, fixedHi);
      }
    }

    const span = hi - lo || 1;
    return {
      lo,
      hi,
      // fraction 0 = bordo alto del grafico, 1 = bordo basso
      valueAtFraction: (fraction) => (invert ? lo + span * fraction : hi - span * fraction),
      yFor: (value) => {
        const norm = (value - lo) / span;
        const fraction = invert ? norm : 1 - norm;
        return plotY + fraction * plotH;
      },
    };
  };

  // X per una serie: proporzionale alla data, ma con una distanza minima tra punti
  // consecutivi così più risultati nello stesso giorno non si sovrappongono; se la
  // serie sfora il bordo (tutte date uguali/ravvicinate) viene ridistribuita.
  const seriesXs = (points) => {
    const count = points.length;
    const xs = points.map((point, index) => xFor(point.t, index, count));
    const minGap = Math.min(16, plotW / Math.max(1, count - 1));
    for (let i = 1; i < xs.length; i += 1) {
      if (xs[i] - xs[i - 1] < minGap) {
        xs[i] = xs[i - 1] + minGap;
      }
    }
    const first = xs[0];
    const last = xs[xs.length - 1];
    if (last > plotX + plotW || last - first < minGap * 0.75) {
      const range = last - first || 1;
      for (let i = 0; i < xs.length; i += 1) {
        xs[i] = plotX + ((xs[i] - first) / range) * plotW;
      }
    }
    return xs;
  };

  const seriesSvg = (points, scale, color) => {
    const xs = seriesXs(points);
    const coords = points.map((point, index) => ({
      x: xs[index],
      y: scale.yFor(point.v),
    }));
    const path = coords
      .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`)
      .join(' ');
    const dots = coords
      .map((coord) => `<circle cx="${coord.x.toFixed(1)}" cy="${coord.y.toFixed(1)}" r="3" fill="${color}"/>`)
      .join('');
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
  };

  const axisTicks = (scale, format, x, anchor, color) => [0, 0.5, 1]
    .map((fraction) => {
      const value = scale.valueAtFraction(fraction);
      const y = plotY + plotH * fraction + 3;
      return `<text x="${x}" y="${y.toFixed(1)}" text-anchor="${anchor}" fill="${color}">${format(value)}</text>`;
    })
    .join('');

  let runLayer = '';
  let runTicks = '';
  if (hasRun) {
    const scale = scaleFor(runPoints, { invert: true, fixedHi: CHART_RUN_FLOOR_S });
    runLayer = seriesSvg(runPoints, scale, CHART_RUN_COLOR);
    runTicks = axisTicks(scale, formatChartClock, mL - 5, 'end', CHART_RUN_COLOR);
  }

  let jumpLayer = '';
  let jumpTicks = '';
  if (hasJump) {
    const scale = scaleFor(jumpPoints, { snap: 0.05, fixedLo: CHART_JUMP_FLOOR_M });
    jumpLayer = seriesSvg(jumpPoints, scale, CHART_JUMP_COLOR);
    jumpTicks = axisTicks(scale, (value) => value.toFixed(2), W - mR + 5, 'start', CHART_JUMP_COLOR);
  }

  const datePoints = [...runPoints, ...jumpPoints].sort((a, b) => a.t - b.t);
  const first = datePoints[0];
  const last = datePoints[datePoints.length - 1];
  const dateLabel = (point, anchor, x) => `<text x="${x}" y="${H - 15}" text-anchor="${anchor}" class="chart-axis-label">${escapeHtml(shortYearDate(point.date))}</text>`;
  const xLabels = first.date === last.date
    ? dateLabel(first, 'middle', plotX + plotW / 2)
    : dateLabel(first, 'start', plotX) + dateLabel(last, 'end', plotX + plotW);

  return `
    <div class="results-chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento dei risultati nel tempo">
        <defs>
          <pattern id="grid-min-${uid}" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M8 0H0V8" fill="none" stroke="#e9edf3" stroke-width="1" />
          </pattern>
          <pattern id="grid-maj-${uid}" width="32" height="32" patternUnits="userSpaceOnUse">
            <rect width="32" height="32" fill="url(#grid-min-${uid})" />
            <path d="M32 0H0V32" fill="none" stroke="#dbe1ea" stroke-width="1" />
          </pattern>
        </defs>
        <rect x="${plotX}" y="${plotY}" width="${plotW}" height="${plotH}" fill="url(#grid-maj-${uid})" stroke="#d3dae4" stroke-width="1" />
        ${runLayer}
        ${jumpLayer}
        ${runTicks}
        ${jumpTicks}
        ${xLabels}
        <text x="${plotX + plotW / 2}" y="${H - 2}" text-anchor="middle" class="chart-axis-label">tempo</text>
      </svg>
      <div class="results-chart-legend">
        ${hasRun ? `<span><i style="background:${CHART_RUN_COLOR}"></i>Corsa</span>` : ''}
        ${hasJump ? `<span><i style="background:${CHART_JUMP_COLOR}"></i>Salto in alto</span>` : ''}
      </div>
    </div>
  `;
}

// Le note dell'atleta sono un registro: ogni nota ha il proprio testo + data.
function normalizeNotes(notes, legacySavedAt) {
  if (Array.isArray(notes)) {
    return notes
      .filter((note) => note && typeof note === 'object' && String(note.text || '').trim())
      .map((note) => ({
        id: note.id || `note-${Math.random().toString(36).slice(2, 9)}`,
        text: String(note.text || ''),
        savedAt: String(note.savedAt || ''),
      }));
  }
  if (typeof notes === 'string' && notes.trim()) {
    return [{
      id: `note-${Math.random().toString(36).slice(2, 9)}`,
      text: notes,
      savedAt: String(legacySavedAt || ''),
    }];
  }
  return [];
}

// Blocco note dell'atleta, dentro il pannello (tra grafico e proiezioni).
function buildNotesBlock(entry) {
  const notes = Array.isArray(entry.notes) ? entry.notes : [];
  const logMarkup = notes.length
    ? notes.map((note) => `
        <div class="notes-entry">
          <div class="notes-entry-text">${escapeHtml(note.text)}</div>
          <div class="notes-entry-date">${escapeHtml(note.savedAt)}</div>
        </div>
      `).join('')
    : '<div class="notes-empty">Nessuna nota</div>';
  return `
    <div class="notes-block" data-athlete-id="${escapeHtml(entry.id)}">
      <div class="notes-label">Note</div>
      <div class="notes-log">${logMarkup}</div>
      <div class="notes-new">
        <textarea class="notes-input" rows="2" placeholder="Aggiungi una nota…"></textarea>
        <div class="notes-foot">
          <button type="button" class="notes-clear" aria-label="Cancella tutte le note" title="Cancella tutte le note" ${notes.length ? '' : 'hidden'}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" />
            </svg>
          </button>
          <button type="button" class="notes-btn" disabled>Salva</button>
        </div>
      </div>
    </div>
  `;
}

async function handleNotesAdd(button) {
  const block = button.closest('.notes-block');
  if (!block) {
    return;
  }
  const input = block.querySelector('.notes-input');
  const text = input.value.trim();
  if (!text) {
    return;
  }

  const athleteId = block.dataset.athleteId;
  const athletes = getAthletes();
  const index = athletes.findIndex((athlete) => athlete.id === athleteId);
  if (index === -1) {
    return;
  }

  const now = getNowParts();
  const stamp = `${shortYearDate(now.date)} ${now.time.slice(0, 5)}`;
  const newNote = {
    id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    savedAt: stamp,
  };
  const current = Array.isArray(athletes[index].notes) ? athletes[index].notes : [];
  athletes[index] = { ...athletes[index], notes: [...current, newNote] };
  await saveEntries(athletes);

  const log = block.querySelector('.notes-log');
  const empty = log.querySelector('.notes-empty');
  if (empty) {
    empty.remove();
  }
  const entryEl = document.createElement('div');
  entryEl.className = 'notes-entry';
  entryEl.innerHTML = `<div class="notes-entry-text">${escapeHtml(text)}</div><div class="notes-entry-date">${escapeHtml(stamp)}</div>`;
  log.appendChild(entryEl);
  log.scrollTop = log.scrollHeight;

  input.value = '';
  button.disabled = true;
  const clearButton = block.querySelector('.notes-clear');
  if (clearButton) {
    clearButton.hidden = false;
  }
  showToast('Nota aggiunta!');
}

async function handleNotesClear(button) {
  const block = button.closest('.notes-block');
  if (!block) {
    return;
  }
  const athleteId = block.dataset.athleteId;
  const athletes = getAthletes();
  const index = athletes.findIndex((athlete) => athlete.id === athleteId);
  if (index === -1) {
    return;
  }
  if (!(Array.isArray(athletes[index].notes) && athletes[index].notes.length)) {
    return;
  }

  const confirmed = await showConfirm('Cancellare tutte le note?', {
    detail: "L'operazione non è reversibile.",
    confirmText: 'Cancella',
  });
  if (!confirmed) {
    return;
  }

  athletes[index] = { ...athletes[index], notes: [] };
  await saveEntries(athletes);

  block.querySelector('.notes-log').innerHTML = '<div class="notes-empty">Nessuna nota</div>';
  button.hidden = true;
  showToast('Note cancellate!');
}

function dismissOverlay(overlay, done) {
  if (!overlay || overlay.dataset.closing) {
    return;
  }
  overlay.dataset.closing = '1';
  overlay.classList.add('is-closing');
  const finish = () => {
    overlay.remove();
    if (done) {
      done();
    }
  };
  overlay.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 400);
}

function successCheckMarkup() {
  return '<svg class="feedback-check" viewBox="0 0 52 52" aria-hidden="true">'
    + '<circle class="feedback-check-circle" cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="3"/>'
    + '<path class="feedback-check-mark" d="M15 27 L23 35 L38 17" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>';
}

function showToast(message, { duration = 1900 } = {}) {
  document.querySelectorAll('.app-overlay').forEach((el) => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'app-overlay app-toast';
  overlay.innerHTML = `
    <div class="app-toast-inner">
      <span class="app-toast-mark">${successCheckMarkup()}</span>
      <span class="app-toast-text">${escapeHtml(message)}</span>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  setTimeout(() => dismissOverlay(overlay), duration);
}

function showConfirm(message, { detail = '', confirmText = 'Conferma', cancelText = 'Annulla' } = {}) {
  document.querySelectorAll('.app-overlay').forEach((el) => el.remove());

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'app-overlay app-confirm';
    overlay.innerHTML = `
      <div class="app-confirm-box" role="dialog" aria-modal="true">
        <div class="app-confirm-text">${escapeHtml(message)}</div>
        ${detail ? `<div class="app-confirm-sub">${escapeHtml(detail)}</div>` : ''}
        <div class="app-confirm-actions">
          <button type="button" class="app-btn app-btn-danger" data-choice="ok">${escapeHtml(confirmText)}</button>
          <button type="button" class="app-btn app-btn-ghost" data-choice="cancel">${escapeHtml(cancelText)}</button>
        </div>
      </div>
    `;

    let settled = false;
    const close = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      document.removeEventListener('keydown', onKey);
      dismissOverlay(overlay, () => resolve(result));
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        close(false);
      }
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close(false);
      }
      const choiceButton = event.target.closest('[data-choice]');
      if (choiceButton) {
        close(choiceButton.dataset.choice === 'ok');
      }
    });
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
  });
}

// Variante di showConfirm con N pulsanti a scelta libera (invece dei soli
// ok/annulla). Risolve con il "value" del pulsante scelto, oppure null se
// chiuso senza scegliere (backdrop/Escape) — usata per l'esito del concorso
// (Superato/Non superato/Riabilita) e per il popup automatico del giorno-dopo.
function showChoice(message, { detail = '', options = [] } = {}) {
  document.querySelectorAll('.app-overlay').forEach((el) => el.remove());

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'app-overlay app-confirm';
    const buttonsHtml = options.map((opt) => `
      <button type="button" class="app-btn ${opt.className || 'app-btn-ghost'}" data-choice="${escapeHtml(opt.value)}" ${opt.disabled ? 'disabled' : ''}>
        ${opt.icon || ''}<span>${escapeHtml(opt.label)}</span>
      </button>
    `).join('');
    overlay.innerHTML = `
      <div class="app-confirm-box" role="dialog" aria-modal="true">
        <button type="button" class="app-confirm-close" data-choice-close aria-label="Chiudi">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
        </button>
        <div class="app-confirm-text">${escapeHtml(message)}</div>
        ${detail ? `<div class="app-confirm-sub">${escapeHtml(detail)}</div>` : ''}
        <div class="app-confirm-actions app-confirm-actions-col">
          ${buttonsHtml}
        </div>
      </div>
    `;

    let settled = false;
    const close = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      document.removeEventListener('keydown', onKey);
      dismissOverlay(overlay, () => resolve(result));
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        close(null);
      }
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close(null);
        return;
      }
      if (event.target.closest('[data-choice-close]')) {
        close(null);
        return;
      }
      const choiceButton = event.target.closest('[data-choice]');
      if (choiceButton && !choiceButton.disabled) {
        close(choiceButton.dataset.choice);
      }
    });
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
  });
}

// Paginazione: al massimo 3 quadratini numerati (finestra intorno alla
// pagina corrente) invece di uno per pagina, con «/» per saltare subito a
// prima/ultima quando le pagine sono più di 3 — evita di affollare la barra
// su schermi stretti mantenendo comunque un accesso rapido agli estremi.
function paginationMarkup(current, totalPages) {
  const prev = `<button type="button" class="page-btn page-arrow" data-page="${current - 1}" aria-label="Pagina precedente"${current === 1 ? ' disabled' : ''}>‹</button>`;
  const next = `<button type="button" class="page-btn page-arrow" data-page="${current + 1}" aria-label="Pagina successiva"${current === totalPages ? ' disabled' : ''}>›</button>`;

  if (totalPages <= 3) {
    let middle = '';
    for (let page = 1; page <= totalPages; page += 1) {
      middle += `<button type="button" class="page-btn${page === current ? ' is-current' : ''}" data-page="${page}">${page}</button>`;
    }
    return prev + middle + next;
  }

  const first = `<button type="button" class="page-btn page-arrow" data-page="1" aria-label="Prima pagina"${current === 1 ? ' disabled' : ''}>«</button>`;
  const last = `<button type="button" class="page-btn page-arrow" data-page="${totalPages}" aria-label="Ultima pagina"${current === totalPages ? ' disabled' : ''}>»</button>`;

  let start = Math.max(1, current - 1);
  const end = Math.min(totalPages, start + 2);
  start = Math.max(1, end - 2);

  let middle = '';
  for (let page = start; page <= end; page += 1) {
    middle += `<button type="button" class="page-btn${page === current ? ' is-current' : ''}" data-page="${page}">${page}</button>`;
  }

  return first + prev + middle + next + last;
}

function renderPagination(total) {
  const nav = document.getElementById('athlete-pagination');
  if (!nav) {
    return;
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) {
    nav.hidden = true;
    nav.innerHTML = '';
    return;
  }
  nav.hidden = false;
  nav.innerHTML = paginationMarkup(currentPage, totalPages);
}

function renderEntries() {
  const entries = getFilteredEntries();
  const searchQuery = athleteSearchInput.value.trim().toLowerCase();
  athletesList.innerHTML = '';

  const countEl = document.getElementById('athlete-count');
  if (countEl) {
    countEl.textContent = String(entries.length);
  }
  const titleEl = document.getElementById('athlete-list-title-text');
  if (titleEl) {
    titleEl.textContent = activeOutcome === 'passed' ? 'Atleti idonei'
      : activeOutcome === 'failed' ? 'Atleti non idonei'
      : 'Atleti registrati';
  }

  if (!entries.length) {
    emptyState.style.display = 'flex';
    renderPagination(0);
    return;
  }

  emptyState.style.display = 'none';

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const pageEntries = entries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  pageEntries.forEach((entry) => {
    const latestTime = getLatestAthleteTime(entry);
    const history = getAthleteTimeRecords(entry);

    const runRecords = history.filter((r) => r.activity !== 'Salto in alto');
    const timedRuns = runRecords.filter((r) => parseTimeToSeconds(r.time) > 0);
    const bestRun = timedRuns.length
      ? timedRuns.reduce((best, r) => (parseTimeToSeconds(r.time) < parseTimeToSeconds(best.time) ? r : best))
      : (runRecords[runRecords.length - 1] || null);

    const jumpRecords = history.filter((r) => r.activity === 'Salto in alto');
    const bestJump = jumpRecords.length
      ? jumpRecords.reduce((best, r) => (parseFloat(r.jumpHeight || 0) > parseFloat(best.jumpHeight || 0) ? r : best))
      : null;

    const athleteTime = bestRun ? bestRun.time : (latestTime ? latestTime.time : '00:00:00.0');
    const athleteActivity = bestRun ? bestRun.activity : (latestTime ? latestTime.activity : entry.activity || '1km');

    // Le proiezioni si basano sull'ultimo tempo di corsa registrato (non sul PB).
    const lastTimedRun = timedRuns.length ? timedRuns[timedRuns.length - 1] : null;
    const projectionBaseLabel = lastTimedRun ? (lastTimedRun.activity || '1km') : '1km';
    const projections = lastTimedRun
      ? buildProjections(lastTimedRun.time, projectionBaseLabel)
      : [];

    const item = document.createElement('li');
    item.className = 'athlete-item card-v2';

    const concorsoDate = latestTime && latestTime.concorsoDate ? latestTime.concorsoDate : '--/--/--';

    // Esito concorso: badge sempre visibile (default "in corso"). Una volta
    // deciso l'esito la card si disabilita con una velina sopra al resto,
    // ma il badge resta sopra la velina e quindi sempre cliccabile.
    const competitionResult = entry.competitionResult;
    const isDecided = competitionResult === 'passed' || competitionResult === 'failed';
    item.classList.toggle('is-decided', isDecided);
    const badgeClass = competitionResult === 'passed' ? 'result-badge-passed'
      : competitionResult === 'failed' ? 'result-badge-failed'
      : 'result-badge-pending';
    const badgeIcon = competitionResult === 'passed' ? thumbsUpIcon(15)
      : competitionResult === 'failed' ? thumbsDownIcon(15)
      : hourglassIcon(14);
    const badgeLabel = competitionResult === 'passed' ? 'Concorso superato'
      : competitionResult === 'failed' ? 'Concorso non superato'
      : 'Concorso in corso';
    const badgeMarkup = `<button type="button" class="result-badge ${badgeClass}" data-id="${entry.id}" aria-label="${escapeHtml(badgeLabel)} — cambia esito" title="${escapeHtml(badgeLabel)}">${badgeIcon}</button>`;
    const veilMarkup = isDecided ? '<div class="card-veil" aria-hidden="true"></div>' : '';

    const avatarMarkup = entry.avatar
      ? `<span class="v2-avatar" style="background-image:url('${entry.avatar}')"></span>`
      : `<span class="v2-avatar v2-avatar-initials">${escapeHtml(getInitials(entry.name, entry.surname))}</span>`;

    const pb = '<span class="v2-pb">PB</span>';

    const runTile = bestRun ? `
      <div class="v2-tile">
        <div class="v2-tile-head"><span class="v2-tile-ic">${runnerIcon(15)}</span>Corsa ${pb}</div>
        <div class="v2-tile-val">${escapeHtml(bestRun.time)}</div>
        <div class="v2-tile-sub">${escapeHtml(bestRun.activity)} · ${escapeHtml(shortYearDate(bestRun.date || ''))}</div>
      </div>` : '';

    const jumpFoot = bestJump && bestJump.takeoffFoot ? bestJump.takeoffFoot : '';
    const jumpFootLabel = jumpFoot ? `Piede di stacco: ${jumpFoot}` : 'Piede di stacco non indicato';
    const jumpTile = bestJump ? `
      <div class="v2-tile">
        <div class="v2-tile-head"><span class="v2-tile-ic">${highJumpIcon(15)}</span>Alto ${pb}</div>
        <div class="v2-tile-val">${bestJump.jumpHeight ? `${escapeHtml(bestJump.jumpHeight)}<small> m</small>` : '--'}</div>
        <div class="v2-tile-sub">${escapeHtml(shortYearDate(bestJump.date || ''))}${jumpFoot ? ` · <span class="v2-foot" title="${escapeHtml(jumpFootLabel)}">${takeoffFootIcon(jumpFoot)}</span>` : ''}</div>
      </div>` : '';

    const tilesMarkup = (runTile || jumpTile)
      ? `<div class="v2-tiles">${runTile}${jumpTile}</div>`
      : '<div class="v2-tiles"><div class="v2-tile v2-tile-empty">Nessun risultato registrato</div></div>';

    item.innerHTML = `
      <span class="v2-accent" aria-hidden="true"></span>
      ${veilMarkup}
      ${badgeMarkup}
      <div class="v2-head">
        ${avatarMarkup}
        <div class="v2-id">
          <div class="v2-name">${highlightMatch(entry.name, searchQuery)} ${highlightMatch(entry.surname, searchQuery)}</div>
          <div class="v2-meta">
            <span class="v2-corp">${militaryShieldIcon(10)}${escapeHtml(entry.military || 'Nessun corpo')}</span>
            <span class="v2-concorso">${calendarIcon(11)}${escapeHtml(concorsoDate)}</span>
          </div>
        </div>
      </div>
      ${tilesMarkup}
      <div class="v2-actions"></div>
    `;

    const actionsWrap = item.querySelector('.v2-actions');

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.dataset.id = entry.id;
    deleteButton.setAttribute('aria-label', 'Elimina atleta');
    deleteButton.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'edit-btn';
    editButton.dataset.id = entry.id;
    editButton.textContent = '✎';
    editButton.setAttribute('aria-label', 'Modifica atleta');

    const projectionToggle = document.createElement('button');
    projectionToggle.type = 'button';
    projectionToggle.className = 'projection-toggle';
    projectionToggle.dataset.id = entry.id;
    projectionToggle.textContent = '→';
    projectionToggle.setAttribute('aria-label', 'Mostra proiezione tempi');
    projectionToggle.setAttribute('aria-expanded', 'false');

    actionsWrap.appendChild(deleteButton);
    actionsWrap.appendChild(editButton);
    actionsWrap.appendChild(projectionToggle);

    const panel = document.createElement('div');
    panel.className = 'projection-panel';
    panel.hidden = true;

    const runHistory = history.filter((record) => record.activity !== 'Salto in alto');
    const jumpHistory = history.filter((record) => record.activity === 'Salto in alto');

    const runHistoryMarkup = runHistory.length
      ? runHistory.map((record) => `
          <div class="history-row">
            <span>${escapeHtml(record.activity)} • ${escapeHtml(record.date)}</span>
            <strong>${escapeHtml(record.time)}</strong>
          </div>
        `).join('')
      : '<div class="history-row history-empty"><span>Nessun risultato</span></div>';

    const jumpHistoryMarkup = jumpHistory.length
      ? jumpHistory.map((record) => `
          <div class="history-row">
            <span>${escapeHtml(record.date)}</span>
            <strong>${record.jumpHeight ? `${escapeHtml(record.jumpHeight)} m` : '--'}</strong>
          </div>
        `).join('')
      : '<div class="history-row history-empty"><span>Nessun risultato</span></div>';

    const projectionsMarkup = projections.length ? `
      <div class="projection-section">
        <div class="projection-label">Proiezioni basate su ${escapeHtml(projectionBaseLabel)} attuale</div>
        ${projections.map((projection) => `
          <div class="projection-row${projection.isBase ? ' projection-row-base' : ''}">
            <span>${projection.label}</span>
            <strong>${projection.time}</strong>
          </div>
        `).join('')}
      </div>
    ` : '';

    panel.innerHTML = `
      <div class="time-history">
        <div class="history-header">Risultati</div>
        <div class="history-subhead">Corsa</div>
        ${runHistoryMarkup}
        <div class="history-subhead">Salto in alto</div>
        ${jumpHistoryMarkup}
      </div>
      ${buildResultsChart(runHistory, jumpHistory)}
      ${buildNotesBlock(entry)}
      ${projectionsMarkup}
    `;

    item.appendChild(panel);
    athletesList.appendChild(item);
  });

  renderPagination(entries.length);
}

async function handleSubmit(event) {
  event.preventDefault();

  const name = nameInput.value.trim();
  const surname = surnameInput.value.trim();

  if (!name || !surname) {
    alert('Inserisci nome e cognome.');
    return;
  }

  const time = formatTime();
  const now = getNowParts();
  const selectedActivity = activityInput.value || '1km';
  const nicknameValue = nicknameInput ? nicknameInput.value.trim() : '';
  const athletes = getAthletes();
  const selectedAthleteId = form.dataset.selectedAthleteId;

  let athlete = selectedAthleteId
    ? athletes.find((entry) => entry.id === selectedAthleteId)
    : athletes.find((entry) => entry.name.toLowerCase() === name.toLowerCase() && entry.surname.toLowerCase() === surname.toLowerCase());

  if (!athlete) {
    athlete = {
      id: `athlete-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      surname,
      nickname: nicknameValue,
      military: militaryInput.value,
      activity: selectedActivity,
      avatar: currentAvatarData,
      times: [],
    };
    athletes.push(athlete);
  } else {
    athlete.name = name;
    athlete.surname = surname;
    athlete.nickname = nicknameValue || athlete.nickname || '';
    athlete.military = militaryInput.value || athlete.military || '';
    athlete.activity = selectedActivity;
    if (currentAvatarData) {
      athlete.avatar = currentAvatarData;
    }
  }

  const concorso = formatConcorsoDate();
  const newRecordId = () => `time-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const baseRecord = () => ({
    id: newRecordId(),
    date: now.date,
    timeInserted: now.time,
    createdAt: now.iso,
    concorsoDate: concorso,
  });

  const records = [];

  const jumpHeight = formatJumpHeight();
  const takeoffFoot = takeoffFootInput ? takeoffFootInput.value : '';
  const hasJump = jumpHeight !== '0.00' || takeoffFoot;

  if (time !== '00:00:00.0' || !hasJump) {
    records.push({ ...baseRecord(), activity: selectedActivity, time });
  }

  if (hasJump) {
    records.push({ ...baseRecord(), activity: 'Salto in alto', time: '00:00:00.0', takeoffFoot, jumpHeight });
  }

  const baseTs = Date.parse(now.iso);
  records.forEach((record, index) => {
    record.createdAt = new Date(baseTs + index).toISOString();
  });

  athlete.times.push(...records);

  await saveEntries(athletes);
  currentPage = 1;
  renderEntries();
  form.reset();
  delete form.dataset.selectedAthleteId;

  activityInput.value = '1km';
  hoursInput.value = '00';
  minutesInput.value = '00';
  secondsInput.value = '00';
  tenthsInput.value = '0';
  if (takeoffFootInput) {
    takeoffFootInput.value = '';
  }
  if (jumpMetersInput) {
    jumpMetersInput.value = '0';
  }
  if (jumpCmInput) {
    jumpCmInput.value = '0';
  }
  document.querySelectorAll('.seg-input .seg-cell').forEach((cell) => {
    const maxLen = Number(cell.getAttribute('maxlength') || 2);
    cell.value = '0'.repeat(maxLen);
  });
  document.querySelectorAll('.ruler').forEach((ruler) => {
    if (typeof ruler._rulerSync === 'function') {
      ruler._rulerSync();
    }
  });
  initConcorsoDate();
  if (nicknameInput) {
    nicknameInput.value = '';
  }
  militaryInput.value = '';
  currentAvatarData = null;
  avatarInput.value = '';
  updateAvatarPreview();
  hideSuggestions();
  populateInsertionFields();
  closeRegisterScreen();
  showToast('Salvato!');
}

// Quando si apre una scheda (proiezioni o modifica) la portiamo in cima alla
// vista, così si legge dall'inizio invece di ritrovarsi a metà contenuto.
function scrollCardIntoView(item) {
  requestAnimationFrame(() => {
    item.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}

// Sezioni del form di modifica a fisarmonica: una sola aperta per volta,
// collassate di default. Aprirne una chiude le altre nello stesso form.
function toggleEditSection(toggleButton) {
  const editForm = toggleButton.closest('.edit-form');
  if (!editForm) {
    return;
  }
  const body = toggleButton.nextElementSibling;
  const wasOpen = body && !body.hidden;

  editForm.querySelectorAll('.edit-section-toggle').forEach((btn) => {
    btn.setAttribute('aria-expanded', 'false');
  });
  editForm.querySelectorAll('.edit-section-body').forEach((b) => {
    b.hidden = true;
  });

  if (!wasOpen && body) {
    body.hidden = false;
    toggleButton.setAttribute('aria-expanded', 'true');
  }
}

// Una sola card "aperta" per volta: chiude pannello proiezioni e form di modifica
// di tutte le altre card.
function collapseOtherCards(exceptItem) {
  athletesList.querySelectorAll('.athlete-item').forEach((item) => {
    if (item === exceptItem) {
      return;
    }
    const panel = item.querySelector('.projection-panel');
    if (panel && !panel.hidden) {
      panel.hidden = true;
      const toggle = item.querySelector('.projection-toggle');
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.style.transform = 'rotate(0deg)';
      }
    }
    const editForm = item.querySelector('.edit-form');
    if (editForm && !editForm.hidden) {
      editForm.hidden = true;
    }
  });
}

// Popup dell'esito concorso, aperto dal badge in alto a dx della card. Chi
// clicca può segnare Superato/Non superato (anche cambiando idea su una card
// già decisa) o Riabilitare la card (disponibile solo se un esito era già
// stato scelto in precedenza).
async function handleCompetitionBadgeClick(badgeButton) {
  const entryId = badgeButton.dataset.id;
  const athletes = getAthletes();
  const entry = athletes.find((item) => item.id === entryId);
  if (!entry) {
    return;
  }
  const label = `${entry.name} ${entry.surname}`.trim() || 'questo atleta';
  const isDecided = entry.competitionResult === 'passed' || entry.competitionResult === 'failed';

  const choice = await showChoice(`Esito concorso\n${label}`, {
    detail: isDecided
      ? 'La card è disabilitata: puoi cambiare l\'esito o riabilitarla.'
      : 'Segna l\'esito quando il concorso è concluso.',
    options: [
      { value: 'passed', label: 'Superato', className: 'app-btn-success', icon: thumbsUpIcon(16) },
      { value: 'failed', label: 'Non superato', className: 'app-btn-danger', icon: thumbsDownIcon(16) },
      { value: 'reactivate', label: 'Riabilita', className: 'app-btn-ghost', icon: reloadIcon(14), disabled: !isDecided },
    ],
  });

  if (!choice) {
    return;
  }

  const current = getAthletes();
  const index = current.findIndex((item) => item.id === entryId);
  if (index === -1) {
    return;
  }

  if (choice === 'reactivate') {
    current[index] = { ...current[index], competitionResult: null, competitionAskedOn: null };
    await saveEntries(current);
    renderEntries();
    showToast('Card riabilitata!');
    return;
  }

  current[index] = { ...current[index], competitionResult: choice, competitionAskedOn: null };
  await saveEntries(current);
  renderEntries();
  showToast(choice === 'passed' ? 'Segnato come superato!' : 'Segnato come non superato!');
}

async function handleListClick(event) {
  const deleteButton = event.target.closest('.delete-btn');
  const projectionButton = event.target.closest('.projection-toggle');
  const editButton = event.target.closest('.edit-btn');
  const cancelButton = event.target.closest('.cancel-edit-btn');
  const suggestionButton = event.target.closest('.suggestion-item');
  const pastDeleteButton = event.target.closest('.past-del-btn');
  const pastDeleteConfirmButton = event.target.closest('.past-del-confirm-btn');
  const notesButton = event.target.closest('.notes-btn');
  const notesClearButton = event.target.closest('.notes-clear');
  const editSectionToggle = event.target.closest('.edit-section-toggle');
  const badgeButton = event.target.closest('.result-badge');

  if (badgeButton) {
    await handleCompetitionBadgeClick(badgeButton);
    return;
  }

  if (editSectionToggle) {
    toggleEditSection(editSectionToggle);
    return;
  }

  if (notesClearButton) {
    await handleNotesClear(notesClearButton);
    return;
  }

  if (notesButton) {
    await handleNotesAdd(notesButton);
    return;
  }

  if (pastDeleteConfirmButton) {
    // conferma definitiva: la riga sparisce dalla vista (resta segnata
    // "row-deleted" per essere tolta dai dati al Salva, ma senza più undo)
    const row = pastDeleteConfirmButton.closest('.edit-past-row');
    if (row) {
      row.hidden = true;
    }
    return;
  }

  if (pastDeleteButton) {
    // segna/annulla l'eliminazione di un risultato: si applica al Salva
    const row = pastDeleteButton.closest('.edit-past-row');
    if (row) {
      row.classList.toggle('row-deleted');
    }
    return;
  }

  if (suggestionButton) {
    openEditFormFor(suggestionButton.dataset.athleteId);
    return;
  }

  if (deleteButton) {
    const entryId = deleteButton.dataset.id;
    const athletes = getAthletes();
    const target = athletes.find((entry) => entry.id === entryId);
    const label = target ? `${target.name} ${target.surname}`.trim() : 'questo atleta';

    const confirmed = await showConfirm(`Eliminare ${label}?`, {
      detail: "L'operazione non è reversibile.",
      confirmText: 'Elimina',
    });
    if (!confirmed) {
      return;
    }

    const entries = athletes.filter((entry) => entry.id !== entryId);
    await saveEntries(entries);
    renderEntries();
    showToast('Eliminato!');
    return;
  }

  if (cancelButton) {
    const formItem = cancelButton.closest('.edit-form');
    if (formItem) {
      formItem.hidden = true;
    }
    return;
  }

  if (editButton) {
    const item = editButton.closest('.athlete-item');

    // Se la scheda proiezioni è aperta, chiudila: le due viste sono alternative.
    const projectionPanel = item.querySelector('.projection-panel');
    const projectionButtonEl = item.querySelector('.projection-toggle');
    if (projectionPanel && !projectionPanel.hidden) {
      projectionPanel.hidden = true;
      if (projectionButtonEl) {
        projectionButtonEl.setAttribute('aria-expanded', 'false');
        projectionButtonEl.style.transform = 'rotate(0deg)';
      }
    }

    let editForm = item.querySelector('.edit-form');

    if (!editForm) {
      const entry = getAthletes().find((e) => e.id === editButton.dataset.id);
      if (!entry) {
        return;
      }
      collapseOtherCards(item);
      editForm = createEditForm(entry);
      item.appendChild(editForm);
      wireCustomInputs(editForm);
      editForm.hidden = false;
      scrollCardIntoView(item);
      return;
    }

    const willOpen = editForm.hidden;
    if (willOpen) {
      collapseOtherCards(item);
    }
    editForm.hidden = !editForm.hidden;
    if (willOpen) {
      scrollCardIntoView(item);
    }
    return;
  }

  if (projectionButton) {
    const item = projectionButton.closest('.athlete-item');
    const panel = item.querySelector('.projection-panel');
    const isExpanded = projectionButton.getAttribute('aria-expanded') === 'true';
    const nextExpanded = !isExpanded;

    // Aprendo le proiezioni: chiudi il form di modifica di questa card e tutte
    // le altre card aperte (una sola aperta per volta).
    if (nextExpanded) {
      const editForm = item.querySelector('.edit-form');
      if (editForm && !editForm.hidden) {
        editForm.hidden = true;
      }
      collapseOtherCards(item);
    }

    projectionButton.setAttribute('aria-expanded', String(nextExpanded));
    panel.hidden = !nextExpanded;
    projectionButton.style.transform = nextExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
    if (nextExpanded) {
      scrollCardIntoView(item);
    }
  }
}

async function handleEditSubmit(event) {
  const editForm = event.target.closest('.edit-form');

  if (!editForm) {
    return;
  }

  event.preventDefault();

  const entryId = editForm.dataset.id;
  const athletes = getAthletes();
  const targetIndex = athletes.findIndex((entry) => entry.id === entryId);

  if (targetIndex === -1) {
    return;
  }

  const updatedName = editForm.querySelector('[name="edit-name"]').value.trim();
  const updatedSurname = editForm.querySelector('[name="edit-surname"]').value.trim();

  if (!updatedName || !updatedSurname) {
    alert('Nome e cognome non possono essere vuoti.');
    return;
  }

  const updatedEntry = { ...athletes[targetIndex] };
  updatedEntry.name = updatedName;
  updatedEntry.surname = updatedSurname;
  const editNicknameInput = editForm.querySelector('[name="edit-nickname"]');
  updatedEntry.nickname = editNicknameInput ? editNicknameInput.value.trim() : updatedEntry.nickname || '';
  updatedEntry.military = editForm.querySelector('[name="edit-military"]').value;
  
  // Update avatar if provided in form
  const editAvatarData = editForm.dataset.editAvatarData || '';
  if (editAvatarData) {
    updatedEntry.avatar = editAvatarData;
  }

  const editVal = (name) => Number(editForm.querySelector(`[name="${name}"]`).value || 0);
  const now = getNowParts();
  const newId = () => `time-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const added = [];

  // Data del nuovo risultato: se la checkbox "Cambia data del risultato" è
  // flaggata si usa la data scelta (per date / createdAt / concorsoDate),
  // altrimenti oggi.
  const resultDate = (prefix) => resultDateFrom(editForm, prefix, now);

  const newTime = formatTimeFromParts({
    hours: editVal('edit-nt-hours'),
    minutes: editVal('edit-nt-minutes'),
    seconds: editVal('edit-nt-seconds'),
    tenths: editVal('edit-nt-tenths'),
  });
  if (newTime !== '00:00:00.0') {
    const rd = resultDate('nt');
    added.push({
      id: newId(),
      activity: editForm.querySelector('[name="edit-new-activity"]').value || '1km',
      time: newTime,
      date: rd.date,
      timeInserted: now.time,
      createdAt: rd.iso,
      concorsoDate: rd.concorso,
    });
  }

  const jumpM = editVal('edit-nh-m');
  const jumpCm = editVal('edit-nh-cm');
  const takeoffFoot = editForm.querySelector('[name="edit-new-foot"]').value;
  // Solo l'altezza indica un salto da aggiungere: il piede ha ora un valore di
  // default precompilato (l'ultimo usato), quindi da solo non basta più a farlo
  // scattare — altrimenti ogni salvataggio aggiungerebbe un salto fantasma.
  if (jumpM > 0 || jumpCm > 0) {
    const rd = resultDate('nh');
    added.push({
      id: newId(),
      activity: 'Salto in alto',
      time: '00:00:00.0',
      date: rd.date,
      timeInserted: now.time,
      createdAt: rd.iso,
      concorsoDate: rd.concorso,
      takeoffFoot,
      jumpHeight: `${jumpM}.${pad(jumpCm)}`,
    });
  }

  if (added.length) {
    // piccolo offset progressivo così due nuovi record non condividono lo stesso
    // istante (mantenendo comunque la data scelta dall'utente).
    added.forEach((record, index) => {
      record.createdAt = new Date(Date.parse(record.createdAt) + index).toISOString();
    });
  }

  // Risultati precedenti segnati per l'eliminazione (icona cestino) → rimossi al Salva.
  const deletedIds = new Set(
    [...editForm.querySelectorAll('.edit-past-row.row-deleted')].map((row) => row.dataset.recordId)
  );

  // Modifica dei risultati già registrati: si aggiornano SOLO i campi che l'utente
  // ha effettivamente cambiato rispetto al valore salvato, così le righe non
  // toccate (e i loro createdAt/concorsoDate/piede di stacco) restano intatte.
  const times = athletes[targetIndex].times
    .map((record) => ({ ...record }))
    .filter((record) => !deletedIds.has(record.id));
  editForm.querySelectorAll('.edit-past-row:not(.row-deleted)').forEach((row) => {
    const record = times.find((item) => item.id === row.dataset.recordId);
    if (!record) {
      return;
    }
    const fieldValue = (name) => {
      const input = row.querySelector(`[data-f="${name}"]`);
      return input ? Number(input.value || 0) : 0;
    };

    const day = fieldValue('gg');
    const month = fieldValue('mo');
    const year = fieldValue('yy');
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 0 && year <= 99) {
      const newDate = `${pad(day)}/${pad(month)}/${2000 + year}`;
      const newTs = parseItDate(newDate);
      const oldTs = parseItDate(record.date);
      if (newTs !== null && newTs !== oldTs) {
        record.date = newDate;
        record.createdAt = new Date(newTs).toISOString();
      }
    }

    if (row.dataset.kind === 'run') {
      const editedTime = formatTimeFromParts({
        hours: fieldValue('h'),
        minutes: fieldValue('m'),
        seconds: fieldValue('s'),
        tenths: fieldValue('d'),
      });
      if (editedTime !== '00:00:00.0' && editedTime !== record.time) {
        record.time = editedTime;
      }
    } else {
      const meters = fieldValue('jm');
      const centimeters = fieldValue('jcm');
      if (meters > 0 || centimeters > 0) {
        const editedHeight = `${meters}.${pad(centimeters)}`;
        if (editedHeight !== record.jumpHeight) {
          record.jumpHeight = editedHeight;
        }
      }
    }
  });

  // Data del concorso (Anagrafica): aggiorna il concorsoDate del record che era il
  // più recente all'apertura del form (quello mostrato sulla card).
  const concorsoInput = editForm.querySelector('[name="edit-concorso-date"]');
  if (concorsoInput && concorsoInput.value) {
    const latestBefore = getLatestAthleteTime(athletes[targetIndex]);
    const parts = concorsoInput.value.split('-');
    if (latestBefore && parts.length === 3) {
      const newConcorso = `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
      const targetRecord = times.find((record) => record.id === latestBefore.id);
      if (targetRecord && targetRecord.concorsoDate !== newConcorso) {
        targetRecord.concorsoDate = newConcorso;
      }
    }
  }

  updatedEntry.times = [...times, ...added];

  athletes[targetIndex] = updatedEntry;
  await saveEntries(athletes);
  renderEntries();
}

// Esporta/Importa sono unici per tutta l'app (atleti militari + velocisti
// insieme in un solo file), non per singola sezione — coerente con l'averli
// spostati nel menu principale invece che nelle rispettive schermate.
function exportEntriesAsJson() {
  const athletes = getAthletes();
  const velocisti = getVelocisti();

  if (!athletes.length && !velocisti.length) {
    alert('Nessun dato da esportare.');
    return;
  }

  const payload = {
    lapsi: true,
    exportedAt: new Date().toISOString(),
    athletes,
    velocisti,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lapsi-dati.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importEntriesFromJson(file) {
  if (!file) {
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (error) {
    await showConfirm('File non valido', {
      detail: 'Non sembra un JSON leggibile.',
      confirmText: 'Ok',
      cancelText: 'Chiudi',
    });
    return;
  }

  // Formato unico { athletes, velocisti } (esportato da questa build), ma
  // resta leggibile anche un vecchio export "solo atleti" (un array nudo).
  const athletesList = Array.isArray(parsed)
    ? parsed
    : (parsed && Array.isArray(parsed.athletes)) ? parsed.athletes : null;
  const velocistiList = (parsed && !Array.isArray(parsed) && Array.isArray(parsed.velocisti))
    ? parsed.velocisti
    : null;

  if (!athletesList && !velocistiList) {
    await showConfirm('File non valido', {
      detail: 'Il JSON non contiene dati di Lapsi riconoscibili.',
      confirmText: 'Ok',
      cancelText: 'Chiudi',
    });
    return;
  }

  const normalizedAthletes = athletesList ? athletesList.map(normalizeAthlete).filter(Boolean) : null;
  const normalizedVelocisti = velocistiList ? velocistiList.map(normalizeVelocista).filter(Boolean) : null;

  if (!(normalizedAthletes && normalizedAthletes.length) && !(normalizedVelocisti && normalizedVelocisti.length)) {
    await showConfirm('Nessun dato valido nel file', {
      confirmText: 'Ok',
      cancelText: 'Chiudi',
    });
    return;
  }

  const importParts = [];
  if (normalizedAthletes) importParts.push(`${normalizedAthletes.length} atleti`);
  if (normalizedVelocisti) importParts.push(`${normalizedVelocisti.length} velocisti`);

  const currentParts = [];
  if (normalizedAthletes && getAthletes().length) currentParts.push(`${getAthletes().length} atleti`);
  if (normalizedVelocisti && getVelocisti().length) currentParts.push(`${getVelocisti().length} velocisti`);

  const confirmed = await showConfirm(`Importare ${importParts.join(' e ')}?`, {
    detail: currentParts.length
      ? `Sostituiranno i dati attualmente presenti su questo dispositivo (${currentParts.join(', ')}).`
      : 'Verranno caricati su questo dispositivo.',
    confirmText: 'Importa',
    cancelText: 'Annulla',
  });
  if (!confirmed) {
    return;
  }

  if (normalizedAthletes) {
    await saveEntries(normalizedAthletes);
    currentPage = 1;
    renderEntries();
  }
  if (normalizedVelocisti) {
    await saveVelocisti(normalizedVelocisti);
    velCurrentPage = 1;
    renderVelocisti();
  }
  showToast('Import completato!');
}

function handleSuggestionInput() {
  renderSuggestions();
}


/* ===== Nuovi input: tempo "segmentato" + righello altezza ===== */

function wireSegInput(container) {
  if (!container.dataset.ctxwired) {
    container.dataset.ctxwired = '1';
    container.addEventListener('contextmenu', (event) => event.preventDefault());
  }
  const cells = [...container.querySelectorAll('.seg-cell')];
  cells.forEach((cell, index) => {
    if (cell.dataset.wired) {
      return;
    }
    cell.dataset.wired = '1';
    const maxLen = Number(cell.getAttribute('maxlength') || 2);
    const maxVal = Number(cell.dataset.max || 99);
    const padCell = () => {
      cell.value = (cell.value === '' ? '0' : cell.value).padStart(maxLen, '0');
    };

    cell.setAttribute('spellcheck', 'false');
    cell.setAttribute('autocorrect', 'off');
    cell.setAttribute('autocapitalize', 'off');

    // Niente menù contestuale / callout / selezione automatica su queste celle:
    // sono cifre, si digita e basta. Il primo tasto sostituisce il valore.
    let fresh = false;
    cell.addEventListener('contextmenu', (event) => event.preventDefault());
    cell.addEventListener('focus', () => { fresh = true; });
    cell.addEventListener('input', () => {
      fresh = false;
      let value = cell.value.replace(/\D/g, '').slice(0, maxLen);
      if (value !== '' && Number(value) > maxVal) {
        value = String(maxVal);
      }
      cell.value = value;
      if (value.length >= maxLen && index < cells.length - 1) {
        cells[index + 1].focus();
      }
    });
    cell.addEventListener('blur', padCell);
    cell.addEventListener('keydown', (event) => {
      if (/^\d$/.test(event.key) && fresh) {
        cell.value = '';
      }
      fresh = false;
      if (event.key === 'Backspace' && cell.value === '' && index > 0) {
        cells[index - 1].focus();
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const current = Number(cell.value || 0);
        const next = Math.max(0, Math.min(maxVal, current + (event.key === 'ArrowUp' ? 1 : -1)));
        cell.value = String(next).padStart(maxLen, '0');
      }
    });
  });
}

function wireRuler(container) {
  if (container.dataset.wired) {
    return;
  }
  container.dataset.wired = '1';

  const min = Number(container.dataset.min || 0);
  const max = Number(container.dataset.max || 250);
  const step = Number(container.dataset.step || 5);
  const STEP_PX = 20;
  const count = Math.round((max - min) / step);
  const strip = container.querySelector('.ruler-strip');
  const readout = container.querySelector('.ruler-value');
  const metersInput = container.querySelector('.ruler-m');
  const cmInput = container.querySelector('.ruler-cm');

  strip.style.setProperty('--step-px', `${STEP_PX}px`);
  strip.innerHTML = Array.from({ length: count + 1 }, (_, i) => {
    const cm = min + i * step;
    const major = cm % 10 === 0;
    return `<span class="ruler-tick${major ? ' is-major' : ''}">${
      major ? `<i class="ruler-tick-label">${(cm / 100).toFixed(2)}</i>` : ''
    }</span>`;
  }).join('');

  const clampIndex = (i) => Math.max(0, Math.min(count, i));
  const cmToIndex = (cm) => clampIndex(Math.round((cm - min) / step));
  const indexToCm = (i) => min + i * step;

  let index = cmToIndex((Number(metersInput.value || 0) * 100) + Number(cmInput.value || 0));

  const setReadout = (cm) => {
    readout.textContent = cm <= 0 ? '—' : (cm / 100).toFixed(2);
    container.classList.toggle('is-empty', cm <= 0);
  };
  const commit = (i, animate) => {
    index = clampIndex(i);
    const cm = indexToCm(index);
    strip.style.transition = animate ? 'transform 0.16s ease-out' : 'none';
    strip.style.transform = `translateX(${-(index * STEP_PX)}px)`;
    metersInput.value = String(Math.floor(cm / 100));
    cmInput.value = String(cm % 100);
    setReadout(cm);
  };
  container._rulerSync = () => {
    commit(cmToIndex((Number(metersInput.value || 0) * 100) + Number(cmInput.value || 0)), false);
  };
  commit(index, false);

  let dragStartX = 0;
  let dragStartOffset = 0;
  let dragging = false;

  const begin = (clientX) => {
    dragging = true;
    dragStartX = clientX;
    dragStartOffset = -(index * STEP_PX);
    strip.style.transition = 'none';
  };
  const move = (clientX, event) => {
    if (!dragging) {
      return;
    }
    if (event && event.cancelable) {
      event.preventDefault();
    }
    const offset = Math.max(-(count * STEP_PX), Math.min(0, dragStartOffset + (clientX - dragStartX)));
    strip.style.transform = `translateX(${offset}px)`;
    setReadout(indexToCm(clampIndex(Math.round(-offset / STEP_PX))));
  };
  const end = () => {
    if (!dragging) {
      return;
    }
    dragging = false;
    const match = strip.style.transform.match(/-?[\d.]+/);
    const offset = match ? parseFloat(match[0]) : 0;
    commit(Math.round(-offset / STEP_PX), true);
  };

  container.addEventListener('pointerdown', (event) => {
    begin(event.clientX);
    if (container.setPointerCapture && event.pointerId != null) {
      try { container.setPointerCapture(event.pointerId); } catch (e) { /* noop */ }
    }
  });
  container.addEventListener('pointermove', (event) => move(event.clientX, event));
  container.addEventListener('pointerup', end);
  container.addEventListener('pointercancel', end);
  container.addEventListener('touchstart', (event) => begin(event.touches[0].clientX), { passive: true });
  container.addEventListener('touchmove', (event) => move(event.touches[0].clientX, event), { passive: false });
  container.addEventListener('touchend', end);
}

function wireCustomInputs(root = document) {
  root.querySelectorAll('.seg-input').forEach(wireSegInput);
  root.querySelectorAll('.ruler').forEach(wireRuler);
}

wireCustomInputs(document);

// Il campo "Data concorso" parte vuoto: se non lo si tocca, l'atleta viene
// salvato con concorsoDate = "--/--/--" invece della data odierna, così in
// scheda si vede subito che va aggiornata dalla sezione di modifica.
function initConcorsoDate() {
  const dayInput = document.getElementById('concorsoDay');
  const monthInput = document.getElementById('concorsoMonth');
  const yearInput = document.getElementById('concorsoYear');
  const nativeInput = document.getElementById('concorso-date');

  if (!dayInput || !monthInput || !yearInput) {
    return;
  }

  dayInput.value = '';
  monthInput.value = '';
  yearInput.value = '';

  if (nativeInput) {
    nativeInput.value = '';
  }
}

function syncConcorsoFromNative() {
  const nativeInput = document.getElementById('concorso-date');
  const dayInput = document.getElementById('concorsoDay');
  const monthInput = document.getElementById('concorsoMonth');
  const yearInput = document.getElementById('concorsoYear');
  if (!nativeInput || !dayInput || !monthInput || !yearInput) {
    return;
  }
  if (!nativeInput.value) {
    // Data cancellata dal picker: torna vuoto invece di restare sull'ultimo
    // valore scelto.
    dayInput.value = '';
    monthInput.value = '';
    yearInput.value = '';
    return;
  }
  const [year, month, day] = nativeInput.value.split('-').map(Number);
  if (year && month && day) {
    dayInput.value = pad(day);
    monthInput.value = pad(month);
    yearInput.value = pad(year % 100);
  }
}

const concorsoDateInput = document.getElementById('concorso-date');
if (concorsoDateInput) {
  concorsoDateInput.addEventListener('input', syncConcorsoFromNative);
  concorsoDateInput.addEventListener('change', syncConcorsoFromNative);
}

initConcorsoDate();

// Avatar input handler
avatarInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (file) {
    try {
      currentAvatarData = await fileToBase64(file);
      updateAvatarPreview();
    } catch (error) {
      console.error('Errore nel caricamento dell\'avatar:', error);
      alert('Errore nel caricamento dell\'immagine. Prova un file più piccolo.');
      avatarInput.value = '';
      currentAvatarData = null;
      updateAvatarPreview();
    }
  } else {
    currentAvatarData = null;
    updateAvatarPreview();
  }
});

// Click on avatar to open file picker
avatarPreview.addEventListener('click', () => {
  avatarInput.click();
});

// Update avatar preview when name/surname change
nameInput.addEventListener('input', updateAvatarPreview);
surnameInput.addEventListener('input', updateAvatarPreview);

form.addEventListener('submit', handleSubmit);
athletesList.addEventListener('click', handleListClick);
athletesList.addEventListener('submit', handleEditSubmit);
athletesList.addEventListener('input', (event) => {
  const input = event.target.closest('.notes-input');
  if (!input) {
    return;
  }
  const button = input.closest('.notes-block').querySelector('.notes-btn');
  button.disabled = input.value.trim() === '';
});
// Campi di "Modifica risultati precedenti": selezionano tutto il contenuto
// al focus, così si può sovrascrivere subito la cifra senza dover spostare
// prima il cursore a destra per cancellarla. Il select() è rimandato al tick
// successivo (setTimeout 0): chiamandolo subito, mentre il browser sta ancora
// gestendo il click che ha dato il focus, su Chrome desktop va in conflitto
// con il posizionamento nativo del cursore e apre per errore il menu
// contestuale di selezione — rimandandolo di un istante il conflitto sparisce
// e il comportamento resta identico (selezione visibile, sovrascrivibile).
athletesList.addEventListener('focusin', (event) => {
  const input = event.target.closest('.mini-input');
  if (input) {
    setTimeout(() => input.select(), 0);
  }
});
exportButton.addEventListener('click', () => {
  setMenuOpen(false);
  exportEntriesAsJson();
});
if (importButton && importFileInput) {
  importButton.addEventListener('click', () => {
    setMenuOpen(false);
    importFileInput.click();
  });
  importFileInput.addEventListener('change', async () => {
    const file = importFileInput.files && importFileInput.files[0];
    importFileInput.value = '';
    await importEntriesFromJson(file);
  });
}
athleteSearchInput.addEventListener('input', () => {
  currentPage = 1;
  renderEntries();
});

// Pulsante "x" nel campo ricerca: compare appena si digita, cancella e rimette
// il focus. Riusabile per qualunque coppia input/pulsante (es. sezione Velocisti).
function wireSearchClear(input, clearButton) {
  if (!input || !clearButton) {
    return;
  }
  input.addEventListener('input', () => {
    clearButton.hidden = input.value.length === 0;
  });
  clearButton.addEventListener('click', () => {
    input.value = '';
    clearButton.hidden = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
}

wireSearchClear(athleteSearchInput, document.getElementById('athlete-search-clear'));

const athletePagination = document.getElementById('athlete-pagination');
if (athletePagination) {
  athletePagination.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) {
      return;
    }
    const page = Number(button.dataset.page);
    if (!Number.isFinite(page) || page === currentPage) {
      return;
    }
    currentPage = page;
    renderEntries();
    const head = document.querySelector('.list-head');
    if (head) {
      head.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  });
}

function setChipGroupSelection(group, value) {
  group.querySelectorAll('.fchip').forEach((chip) => {
    const isSelected = chip.dataset.value === value;
    chip.classList.toggle('selected', isSelected);
    chip.setAttribute('aria-pressed', String(isSelected));
  });
}

function getChipGroupSelection(group, fallback) {
  const selected = group.querySelector('.fchip.selected');
  return selected ? selected.dataset.value : fallback;
}

function syncFilterChips() {
  setChipGroupSelection(distanceChips, activeDistance);
  setChipGroupSelection(sortChips, activeSort);
  if (outcomeChips) {
    setChipGroupSelection(outcomeChips, activeOutcome);
  }
}

function revertFiltersDraft() {
  if (!filterSnapshot) {
    return;
  }
  activeDistance = filterSnapshot.distance;
  activeSort = filterSnapshot.sort;
  activeOutcome = filterSnapshot.outcome;
  activeIncludeDecided = filterSnapshot.includeDecided;
  filterSnapshot = null;
  currentPage = 1;
  syncFilterChips();
  renderEntries();
}

[distanceChips, sortChips, outcomeChips].forEach((group) => {
  if (!group) {
    return;
  }
  group.addEventListener('click', (event) => {
    const chip = event.target.closest('.fchip');
    if (!chip || !group.contains(chip)) {
      return;
    }
    setChipGroupSelection(group, chip.dataset.value);
    if (group === distanceChips) {
      activeDistance = chip.dataset.value;
    } else if (group === sortChips) {
      activeSort = chip.dataset.value;
    } else {
      activeOutcome = chip.dataset.value;
    }
    currentPage = 1;
    renderEntries();
  });
});

filtersApplyButton.addEventListener('click', async () => {
  // Il toggle Sì/No ha senso solo con "Tutti": con un filtro esplicito
  // Superati/Non superati non c'è ambiguità da chiedere.
  const hasDecided = activeOutcome === 'all' && getAthletes().some((entry) => entry.competitionResult);
  if (hasDecided) {
    const choice = await showChoice('Includere anche chi ha già un esito?', {
      detail: 'Atleti già segnati come Superato o Non superato.',
      options: [
        { value: 'yes', label: 'Sì, tra tutti', className: 'app-btn-ghost' },
        { value: 'no', label: 'No, solo attivi', className: 'app-btn-ghost' },
      ],
    });
    if (choice === 'yes') {
      activeIncludeDecided = true;
    } else if (choice === 'no') {
      activeIncludeDecided = false;
    }
    // popup chiuso senza scegliere: lascia invariato il valore attuale
  }
  filterSnapshot = null;
  currentPage = 1;
  setCollapsibleOpen(toggleFiltersButton, filtersPanel, false);
  toggleFiltersButton.setAttribute('aria-label', 'Mostra filtri');
  renderEntries();
});

filtersResetButton.addEventListener('click', () => {
  activeDistance = FILTER_DEFAULTS.distance;
  activeSort = FILTER_DEFAULTS.sort;
  activeOutcome = FILTER_DEFAULTS.outcome;
  activeIncludeDecided = FILTER_DEFAULTS.includeDecided;
  currentPage = 1;
  syncFilterChips();
  renderEntries();
});

syncFilterChips();

function setCollapsibleOpen(button, panel, open) {
  panel.hidden = !open;
  button.classList.toggle('open', open);
  button.setAttribute('aria-expanded', String(open));
}

function openRegisterScreen() {
  registerScreen.hidden = false;
  lockBodyScroll();
  registerScreen.scrollTop = 0;
  populateInsertionFields();
  nameInput.focus();
}

function closeRegisterScreen() {
  registerScreen.hidden = true;
  unlockBodyScroll();
}

if (openRegisterButton) {
  openRegisterButton.addEventListener('click', openRegisterScreen);
}
if (closeRegisterButton) {
  closeRegisterButton.addEventListener('click', closeRegisterScreen);
}
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }
  if (registerScreen && !registerScreen.hidden) {
    closeRegisterScreen();
  }
  if (velRegisterScreen && !velRegisterScreen.hidden) {
    closeVelRegisterScreen();
  }
  if (trainingNotesOverlay && !trainingNotesOverlay.hidden) {
    closeTrainingNotes();
  }
  if (calcOverlay && !calcOverlay.hidden) {
    closeCalc();
  }
});

function closeToolPanels(except) {
  if (except !== 'search') {
    setCollapsibleOpen(toggleSearchButton, searchPanel, false);
    toggleSearchButton.setAttribute('aria-label', 'Cerca atleta');
  }
  if (except !== 'filters') {
    if (!filtersPanel.hidden) {
      revertFiltersDraft();
    }
    setCollapsibleOpen(toggleFiltersButton, filtersPanel, false);
    toggleFiltersButton.setAttribute('aria-label', 'Mostra filtri');
  }
}

toggleSearchButton.addEventListener('click', () => {
  const open = searchPanel.hidden;
  closeToolPanels('search');
  setCollapsibleOpen(toggleSearchButton, searchPanel, open);
  toggleSearchButton.setAttribute('aria-label', open ? 'Nascondi ricerca' : 'Cerca atleta');
  if (open) {
    athleteSearchInput.focus();
  }
});

toggleFiltersButton.addEventListener('click', () => {
  const open = filtersPanel.hidden;
  closeToolPanels('filters');
  if (open) {
    filterSnapshot = { distance: activeDistance, sort: activeSort, outcome: activeOutcome, includeDecided: activeIncludeDecided };
    syncFilterChips();
    setCollapsibleOpen(toggleFiltersButton, filtersPanel, true);
    toggleFiltersButton.setAttribute('aria-label', 'Chiudi filtri');
  } else {
    revertFiltersDraft();
    setCollapsibleOpen(toggleFiltersButton, filtersPanel, false);
    toggleFiltersButton.setAttribute('aria-label', 'Mostra filtri');
  }
});
nameInput.addEventListener('input', handleSuggestionInput);
surnameInput.addEventListener('input', handleSuggestionInput);
if (nicknameInput) {
  nicknameInput.addEventListener('input', handleSuggestionInput);
}
athleteSuggestions.addEventListener('click', handleListClick);

// ===================== Sezione "Velocisti" =====================
// Dominio dati separato dagli atleti militari (storage a parte): anagrafica
// leggera (avatar, nome/cognome, specialità) + un taccuino con tre registri —
// risultati cronometrati (100/200/400, vento facoltativo), test rapidi
// (balzi/lanciati/VAM...) e note — riusando dove possibile grafico e notes
// già costruiti per gli atleti militari.
const STORAGE_KEY_VELOCISTI = 'lapsi-velocisti';
const SPECIALTY_OPTIONS = ['100mt', '200mt', '400mt'];
const TEST_TYPE_OPTIONS = ['30m lanciati', 'CMJ', 'SJ', 'Balzo da fermo', 'Altro'];
const VEL_PAGE_SIZE = 5;
const VEL_FILTER_DEFAULTS = { specialty: 'Tutte', sort: 'az' };

const velOpenRegisterButton = document.getElementById('vel-open-register');
const velCloseRegisterButton = document.getElementById('vel-close-register');
const velRegisterScreen = document.getElementById('velocisti-register-screen');
const velForm = document.getElementById('velocista-form');
const velNameInput = document.getElementById('vel-name');
const velSurnameInput = document.getElementById('vel-surname');
const velAvatarInput = document.getElementById('vel-avatar');
const velAvatarPreview = document.getElementById('vel-avatar-preview');
const velSpecialtyInput = document.getElementById('vel-specialty');
const velList = document.getElementById('vel-list');
const velEmptyState = document.getElementById('vel-empty-state');
const velCountEl = document.getElementById('vel-count');
const velSearchInput = document.getElementById('vel-search');
const velToggleSearchButton = document.getElementById('vel-toggle-search');
const velSearchPanel = document.getElementById('vel-search-panel');
const velToggleFiltersButton = document.getElementById('vel-toggle-filters');
const velFiltersPanel = document.getElementById('vel-filters');
const velSpecialtyChips = document.getElementById('vel-specialty-chips');
const velSortChips = document.getElementById('vel-sort-chips');
const velFiltersApplyButton = document.getElementById('vel-filters-apply');
const velFiltersResetButton = document.getElementById('vel-filters-reset');
const velPaginationNav = document.getElementById('vel-pagination');

let cachedVelocisti = [];
let velActiveSpecialty = VEL_FILTER_DEFAULTS.specialty;
let velActiveSort = VEL_FILTER_DEFAULTS.sort;
let velFilterSnapshot = null;
let velCurrentPage = 1;
let currentVelAvatarData = null;

function getVelocisti() {
  return [...cachedVelocisti];
}

// Un risultato cronometrato (100/200/400). Il vento è facoltativo: si registra
// solo se lo si conosce, non è un dato obbligatorio come nel modello da pista.
function normalizeVelResult(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }
  const time = String(record.time || '').trim();
  if (!time || time === '00:00:00.0') {
    return null;
  }
  return {
    id: record.id || `vr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    activity: SPECIALTY_OPTIONS.includes(record.activity) ? record.activity : SPECIALTY_OPTIONS[0],
    time,
    date: String(record.date || ''),
    wind: record.wind != null ? String(record.wind).trim() : '',
    createdAt: record.createdAt || new Date(0).toISOString(),
  };
}

// Una prova/test non cronometrato (balzi, lanciati, VAM...): tipo libero da un
// piccolo elenco + valore libero, niente catalogo/protocollo rigido.
function normalizeVelTest(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }
  const value = String(record.value || '').trim();
  if (!value) {
    return null;
  }
  return {
    id: record.id || `vt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: record.type ? String(record.type) : 'Altro',
    value,
    note: record.note ? String(record.note) : '',
    date: String(record.date || ''),
    createdAt: record.createdAt || new Date(0).toISOString(),
  };
}

function normalizeVelocista(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  return {
    id: entry.id || `vel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: entry.name || '',
    surname: entry.surname || '',
    avatar: entry.avatar || null,
    specialty: SPECIALTY_OPTIONS.includes(entry.specialty) ? entry.specialty : '',
    createdAt: entry.createdAt || new Date(0).toISOString(),
    results: Array.isArray(entry.results) ? entry.results.map(normalizeVelResult).filter(Boolean) : [],
    tests: Array.isArray(entry.tests) ? entry.tests.map(normalizeVelTest).filter(Boolean) : [],
    notes: normalizeNotes(entry.notes),
  };
}

function persistVelocisti(entries) {
  try {
    localStorage.setItem(STORAGE_KEY_VELOCISTI, JSON.stringify(entries));
  } catch (error) {
    console.error('Impossibile salvare i velocisti in localStorage:', error);
  }
}

function readVelocisti() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VELOCISTI);
    const parsed = raw !== null ? JSON.parse(raw) : [];
    const normalized = Array.isArray(parsed) ? parsed.map(normalizeVelocista).filter(Boolean) : [];
    cachedVelocisti = normalized;
    return normalized;
  } catch (error) {
    console.warn('Errore lettura velocisti da localStorage:', error);
    cachedVelocisti = [];
    return [];
  }
}

async function saveVelocisti(entries) {
  // Rinormalizza sempre prima di salvare: evita che un record creato "a mano"
  // (es. in un punto del codice che dimentica results/tests/notes) rompa il
  // rendering più avanti — stesso principio di readVelocisti.
  const normalized = entries.map(normalizeVelocista).filter(Boolean);
  cachedVelocisti = normalized;
  persistVelocisti(normalized);
}

function getFilteredVelocisti() {
  const query = velSearchInput.value.trim().toLowerCase();
  const specialtyFilter = velActiveSpecialty;
  const sortValue = velActiveSort;

  const filtered = cachedVelocisti.filter((entry) => {
    const specialtyMatch = specialtyFilter === 'Tutte' || entry.specialty === specialtyFilter;
    const name = (entry.name || '').toLowerCase();
    const surname = (entry.surname || '').toLowerCase();
    const searchMatch = !query || name.includes(query) || surname.includes(query) || `${name} ${surname}`.includes(query);
    return specialtyMatch && searchMatch;
  });

  filtered.sort((a, b) => {
    if (sortValue === 'az' || sortValue === 'za') {
      const aName = `${a.name} ${a.surname}`.trim().toLowerCase();
      const bName = `${b.name} ${b.surname}`.trim().toLowerCase();
      const cmp = aName.localeCompare(bName, 'it');
      return sortValue === 'az' ? cmp : -cmp;
    }
    const aDate = new Date(a.createdAt || 0).getTime();
    const bDate = new Date(b.createdAt || 0).getTime();
    return sortValue === 'recent' ? bDate - aDate : aDate - bDate;
  });

  return filtered;
}

function renderVelPagination(total) {
  const nav = velPaginationNav;
  if (!nav) {
    return;
  }
  const totalPages = Math.max(1, Math.ceil(total / VEL_PAGE_SIZE));
  if (totalPages <= 1) {
    nav.hidden = true;
    nav.innerHTML = '';
    return;
  }
  nav.hidden = false;
  nav.innerHTML = paginationMarkup(velCurrentPage, totalPages);
}

// Una sola card "aperta" per volta, come nella sezione C. Militari.
function velCollapseOtherCards(exceptItem) {
  velList.querySelectorAll('.athlete-item').forEach((item) => {
    if (item === exceptItem) {
      return;
    }
    const panel = item.querySelector('.projection-panel');
    if (panel && !panel.hidden) {
      panel.hidden = true;
      const toggle = item.querySelector('.projection-toggle');
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.style.transform = 'rotate(0deg)';
      }
    }
    const editForm = item.querySelector('.edit-form');
    if (editForm && !editForm.hidden) {
      editForm.hidden = true;
    }
  });
}

// Blocco note del velocista: stessa markup/logica di buildNotesBlock, ma
// legge/scrive nello store dei velocisti invece che in quello degli atleti.
function buildVelNotesBlock(entry) {
  const notes = Array.isArray(entry.notes) ? entry.notes : [];
  const logMarkup = notes.length
    ? notes.map((note) => `
        <div class="notes-entry">
          <div class="notes-entry-text">${escapeHtml(note.text)}</div>
          <div class="notes-entry-date">${escapeHtml(note.savedAt)}</div>
        </div>
      `).join('')
    : '<div class="notes-empty">Nessuna nota</div>';
  return `
    <div class="notes-block" data-velocista-id="${escapeHtml(entry.id)}">
      <div class="notes-label">Note</div>
      <div class="notes-log">${logMarkup}</div>
      <div class="notes-new">
        <textarea class="notes-input" rows="2" placeholder="Aggiungi una nota…"></textarea>
        <div class="notes-foot">
          <button type="button" class="notes-clear" aria-label="Cancella tutte le note" title="Cancella tutte le note" ${notes.length ? '' : 'hidden'}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" />
            </svg>
          </button>
          <button type="button" class="notes-btn" disabled>Salva</button>
        </div>
      </div>
    </div>
  `;
}

async function handleVelNotesAdd(button) {
  const block = button.closest('.notes-block');
  if (!block) {
    return;
  }
  const input = block.querySelector('.notes-input');
  const text = input.value.trim();
  if (!text) {
    return;
  }

  const velocistaId = block.dataset.velocistaId;
  const entries = getVelocisti();
  const index = entries.findIndex((entry) => entry.id === velocistaId);
  if (index === -1) {
    return;
  }

  const now = getNowParts();
  const stamp = `${shortYearDate(now.date)} ${now.time.slice(0, 5)}`;
  const newNote = {
    id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    savedAt: stamp,
  };
  const current = Array.isArray(entries[index].notes) ? entries[index].notes : [];
  entries[index] = { ...entries[index], notes: [...current, newNote] };
  await saveVelocisti(entries);

  const log = block.querySelector('.notes-log');
  const empty = log.querySelector('.notes-empty');
  if (empty) {
    empty.remove();
  }
  const entryEl = document.createElement('div');
  entryEl.className = 'notes-entry';
  entryEl.innerHTML = `<div class="notes-entry-text">${escapeHtml(text)}</div><div class="notes-entry-date">${escapeHtml(stamp)}</div>`;
  log.appendChild(entryEl);
  log.scrollTop = log.scrollHeight;

  input.value = '';
  button.disabled = true;
  const clearButton = block.querySelector('.notes-clear');
  if (clearButton) {
    clearButton.hidden = false;
  }
  showToast('Nota aggiunta!');
}

async function handleVelNotesClear(button) {
  const block = button.closest('.notes-block');
  if (!block) {
    return;
  }
  const velocistaId = block.dataset.velocistaId;
  const entries = getVelocisti();
  const index = entries.findIndex((entry) => entry.id === velocistaId);
  if (index === -1) {
    return;
  }
  if (!(Array.isArray(entries[index].notes) && entries[index].notes.length)) {
    return;
  }

  const confirmed = await showConfirm('Cancellare tutte le note?', {
    detail: "L'operazione non è reversibile.",
    confirmText: 'Cancella',
  });
  if (!confirmed) {
    return;
  }

  entries[index] = { ...entries[index], notes: [] };
  await saveVelocisti(entries);

  block.querySelector('.notes-log').innerHTML = '<div class="notes-empty">Nessuna nota</div>';
  button.hidden = true;
  showToast('Note cancellate!');
}

function renderVelocisti() {
  const entries = getFilteredVelocisti();
  const searchQuery = velSearchInput.value.trim().toLowerCase();
  velList.innerHTML = '';

  if (velCountEl) {
    velCountEl.textContent = String(entries.length);
  }

  if (!entries.length) {
    velEmptyState.style.display = 'flex';
    renderVelPagination(0);
    return;
  }

  velEmptyState.style.display = 'none';

  const totalPages = Math.max(1, Math.ceil(entries.length / VEL_PAGE_SIZE));
  velCurrentPage = Math.min(Math.max(1, velCurrentPage), totalPages);
  const pageEntries = entries.slice((velCurrentPage - 1) * VEL_PAGE_SIZE, velCurrentPage * VEL_PAGE_SIZE);

  pageEntries.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'athlete-item card-v2';

    const avatarMarkup = entry.avatar
      ? `<span class="v2-avatar" style="background-image:url('${entry.avatar}')"></span>`
      : `<span class="v2-avatar v2-avatar-initials">${escapeHtml(getInitials(entry.name, entry.surname))}</span>`;

    const specialtyLabel = entry.specialty || 'Nessuna specialità';

    const results = [...entry.results].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    const tests = [...entry.tests].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    const timedResults = results.filter((r) => parseTimeToSeconds(r.time) > 0);
    const bestResult = timedResults.length
      ? timedResults.reduce((best, r) => (parseTimeToSeconds(r.time) < parseTimeToSeconds(best.time) ? r : best))
      : null;

    const pb = '<span class="v2-pb">PB</span>';
    const resultTile = bestResult ? `
      <div class="v2-tile">
        <div class="v2-tile-head"><span class="v2-tile-ic">${runnerIcon(15)}</span>Corsa ${pb}</div>
        <div class="v2-tile-val">${escapeHtml(bestResult.time)}</div>
        <div class="v2-tile-sub">${escapeHtml(bestResult.activity)} · ${escapeHtml(shortYearDate(bestResult.date || ''))}${bestResult.wind ? ` · ${escapeHtml(bestResult.wind)} m/s` : ''}</div>
      </div>` : '';
    const tilesMarkup = resultTile
      ? `<div class="v2-tiles">${resultTile}</div>`
      : '<div class="v2-tiles"><div class="v2-tile v2-tile-empty">Nessun risultato registrato</div></div>';

    item.innerHTML = `
      <span class="v2-accent" aria-hidden="true"></span>
      <div class="v2-head">
        ${avatarMarkup}
        <div class="v2-id">
          <div class="v2-name">${highlightMatch(entry.name, searchQuery)} ${highlightMatch(entry.surname, searchQuery)}</div>
          <div class="v2-meta">
            <span class="v2-corp">${escapeHtml(specialtyLabel)}</span>
          </div>
        </div>
      </div>
      ${tilesMarkup}
      <div class="v2-actions"></div>
    `;

    const actionsWrap = item.querySelector('.v2-actions');

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.dataset.id = entry.id;
    deleteButton.setAttribute('aria-label', 'Elimina velocista');
    deleteButton.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'edit-btn';
    editButton.dataset.id = entry.id;
    editButton.textContent = '✎';
    editButton.setAttribute('aria-label', 'Modifica velocista');

    const projectionToggle = document.createElement('button');
    projectionToggle.type = 'button';
    projectionToggle.className = 'projection-toggle';
    projectionToggle.dataset.id = entry.id;
    projectionToggle.textContent = '→';
    projectionToggle.setAttribute('aria-label', 'Mostra dettagli');
    projectionToggle.setAttribute('aria-expanded', 'false');

    actionsWrap.appendChild(deleteButton);
    actionsWrap.appendChild(editButton);
    actionsWrap.appendChild(projectionToggle);

    const panel = document.createElement('div');
    panel.className = 'projection-panel';
    panel.hidden = true;

    const smallTrashIcon = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg>';

    const resultsHistoryMarkup = results.length
      ? results.map((record) => `
          <div class="history-row">
            <span>${escapeHtml(record.activity)} • ${escapeHtml(shortYearDate(record.date || ''))}${record.wind ? ` • ${escapeHtml(record.wind)} m/s` : ''}</span>
            <span class="history-row-right">
              <strong>${escapeHtml(record.time)}</strong>
              <button type="button" class="history-del-btn vel-result-del" data-id="${escapeHtml(record.id)}" aria-label="Elimina risultato">${smallTrashIcon}</button>
            </span>
          </div>
        `).join('')
      : '<div class="history-row history-empty">Nessun risultato registrato ancora.</div>';

    const testsMarkup = tests.length
      ? tests.map((record) => `
          <div class="projection-row">
            <span>${escapeHtml(record.type)} • ${escapeHtml(shortYearDate(record.date || ''))}${record.note ? ` — ${escapeHtml(record.note)}` : ''}</span>
            <span class="history-row-right">
              <strong>${escapeHtml(record.value)}</strong>
              <button type="button" class="history-del-btn vel-test-del" data-id="${escapeHtml(record.id)}" aria-label="Elimina test">${smallTrashIcon}</button>
            </span>
          </div>
        `).join('')
      : '<div class="history-row history-empty">Nessun test registrato ancora.</div>';

    panel.innerHTML = `
      <div class="time-history">
        <div class="history-header">Risultati</div>
        ${resultsHistoryMarkup}
      </div>
      ${buildResultsChart(results, [])}
      <div class="projection-section">
        <div class="projection-label">Test</div>
        ${testsMarkup}
      </div>
      ${buildVelNotesBlock(entry)}
    `;
    item.appendChild(panel);

    velList.appendChild(item);
  });

  renderVelPagination(entries.length);
}

function createVelocistaEditForm(entry) {
  const editForm = document.createElement('form');
  editForm.className = 'edit-form';
  editForm.hidden = true;
  editForm.dataset.id = entry.id;

  const specialtyOptionsHtml = ['', ...SPECIALTY_OPTIONS]
    .map((value) => `<option value="${value}" ${entry.specialty === value ? 'selected' : ''}>${value || 'Seleziona'}</option>`)
    .join('');
  const activityOptionsHtml = SPECIALTY_OPTIONS
    .map((value) => `<option value="${value}">${value}</option>`)
    .join('');
  const testTypeOptionsHtml = TEST_TYPE_OPTIONS
    .map((value) => `<option value="${value}">${value}</option>`)
    .join('');

  const anagraficaBody = `
    <div class="field-row">
      <div class="field-group">
        <label>Nome</label>
        <input name="edit-vel-name" type="text" value="${escapeHtml(entry.name)}" />
      </div>
      <div class="field-group">
        <label>Cognome</label>
        <input name="edit-vel-surname" type="text" value="${escapeHtml(entry.surname)}" />
      </div>
    </div>
    <div class="field-row-avatar">
      <div class="field-group avatar-field">
        <label>Foto profilo</label>
        <div class="avatar-edit-wrapper">
          <input class="edit-avatar-input" type="file" accept="image/*" />
          <div class="avatar-circle avatar-edit-circle">
            ${entry.avatar ? '' : `<span class="avatar-initials">${escapeHtml(getInitials(entry.name, entry.surname))}</span>`}
            <span class="avatar-cam" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 8h3l1.6-2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
            </span>
          </div>
        </div>
      </div>
      <div class="field-group">
        <label>Specialità</label>
        <select name="edit-vel-specialty">${specialtyOptionsHtml}</select>
      </div>
    </div>
  `;

  const risultatoBody = `
    <div class="field-group">
      <label>Nuovo risultato</label>
      <select name="edit-vr-activity">${activityOptionsHtml}</select>
      <div class="seg-input" role="group" aria-label="Nuovo tempo">
        <div class="seg-field">
          <span class="seg-label">h</span>
          <input class="seg-cell" name="edit-vr-hours" type="text" inputmode="numeric" maxlength="2" data-max="99" value="00" aria-label="ore" autocomplete="off" data-1p-ignore data-lpignore="true" data-form-type="other" />
        </div>
        <span class="seg-colon">:</span>
        <div class="seg-field">
          <span class="seg-label">min</span>
          <input class="seg-cell" name="edit-vr-minutes" type="text" inputmode="numeric" maxlength="2" data-max="59" value="00" aria-label="minuti" autocomplete="off" data-1p-ignore data-lpignore="true" data-form-type="other" />
        </div>
        <span class="seg-colon">:</span>
        <div class="seg-field">
          <span class="seg-label">sec</span>
          <input class="seg-cell" name="edit-vr-seconds" type="text" inputmode="numeric" maxlength="2" data-max="59" value="00" aria-label="secondi" autocomplete="off" data-1p-ignore data-lpignore="true" data-form-type="other" />
        </div>
        <span class="seg-colon">.</span>
        <div class="seg-field">
          <span class="seg-label">dec</span>
          <input class="seg-cell seg-cell-narrow" name="edit-vr-tenths" type="text" inputmode="numeric" maxlength="1" data-max="9" value="0" aria-label="decimi" autocomplete="off" data-1p-ignore data-lpignore="true" data-form-type="other" />
        </div>
      </div>
    </div>
    <div class="field-group field-group-jump">
      <label>Vento (facoltativo)</label>
      <input name="edit-vr-wind" type="text" inputmode="decimal" placeholder="es. +1.2" autocomplete="off" />
    </div>
    ${resultDateFieldHtml('vr')}
  `;

  const testBody = `
    <div class="field-group">
      <label>Tipo di test</label>
      <select name="edit-vt-type">${testTypeOptionsHtml}</select>
    </div>
    <div class="field-group field-group-jump">
      <label>Valore</label>
      <input name="edit-vt-value" type="text" inputmode="decimal" placeholder="es. 2.45 m, 38 cm..." autocomplete="off" />
    </div>
    <div class="field-group">
      <label>Nota (facoltativa)</label>
      <input name="edit-vt-note" type="text" autocomplete="off" placeholder="es. recupero 3'..." />
    </div>
    ${resultDateFieldHtml('vt')}
  `;

  editForm.innerHTML = `
    ${editSectionWrap('Anagrafica', anagraficaBody)}
    ${editSectionWrap('Aggiungi risultato', risultatoBody)}
    ${editSectionWrap('Aggiungi test', testBody)}
    <div class="edit-actions">
      <button type="submit" class="primary-btn save-edit-btn">Salva</button>
      <button type="button" class="secondary-btn cancel-edit-btn">Annulla</button>
    </div>
  `;

  const avatarCircle = editForm.querySelector('.avatar-edit-circle');
  if (entry.avatar) {
    avatarCircle.style.backgroundImage = `url('${entry.avatar}')`;
    avatarCircle.querySelector('.avatar-initials')?.remove();
  }

  const avatarInputEl = editForm.querySelector('.edit-avatar-input');
  let editAvatarData = entry.avatar || null;

  avatarInputEl.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        editAvatarData = await fileToBase64(file);
        editForm.dataset.editAvatarData = editAvatarData;
        avatarCircle.style.backgroundImage = `url('${editAvatarData}')`;
        avatarCircle.querySelector('.avatar-initials')?.remove();
      } catch (error) {
        console.error('Errore nel caricamento dell\'avatar:', error);
        alert('Errore nel caricamento dell\'immagine. Prova un file più piccolo.');
        avatarInputEl.value = '';
      }
    }
  });

  avatarCircle.addEventListener('click', () => {
    avatarInputEl.click();
  });

  editForm.dataset.editAvatarData = editAvatarData || '';

  return editForm;
}

async function handleVelEditSubmit(event) {
  const editForm = event.target.closest('.edit-form');
  if (!editForm) {
    return;
  }
  event.preventDefault();

  const entryId = editForm.dataset.id;
  const entries = getVelocisti();
  const targetIndex = entries.findIndex((entry) => entry.id === entryId);
  if (targetIndex === -1) {
    return;
  }

  const updatedName = editForm.querySelector('[name="edit-vel-name"]').value.trim();
  const updatedSurname = editForm.querySelector('[name="edit-vel-surname"]').value.trim();
  if (!updatedName || !updatedSurname) {
    alert('Nome e cognome non possono essere vuoti.');
    return;
  }

  const updatedEntry = { ...entries[targetIndex] };
  updatedEntry.name = updatedName;
  updatedEntry.surname = updatedSurname;
  updatedEntry.specialty = editForm.querySelector('[name="edit-vel-specialty"]').value;

  const editAvatarData = editForm.dataset.editAvatarData || '';
  if (editAvatarData) {
    updatedEntry.avatar = editAvatarData;
  }

  const now = getNowParts();
  const newVelId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const editVal = (name) => {
    const el = editForm.querySelector(`[name="${name}"]`);
    return Number(el ? el.value : 0) || 0;
  };

  // Nuovo risultato: solo se è stato inserito un tempo reale.
  const results = Array.isArray(updatedEntry.results) ? [...updatedEntry.results] : [];
  const newTime = formatTimeFromParts({
    hours: editVal('edit-vr-hours'),
    minutes: editVal('edit-vr-minutes'),
    seconds: editVal('edit-vr-seconds'),
    tenths: editVal('edit-vr-tenths'),
  });
  if (newTime !== '00:00:00.0') {
    const rd = resultDateFrom(editForm, 'vr', now);
    const windInput = editForm.querySelector('[name="edit-vr-wind"]');
    results.push({
      id: newVelId('vr'),
      activity: editForm.querySelector('[name="edit-vr-activity"]').value || SPECIALTY_OPTIONS[0],
      time: newTime,
      date: rd.date,
      wind: windInput ? windInput.value.trim() : '',
      createdAt: rd.iso,
    });
  }
  updatedEntry.results = results;

  // Nuovo test: solo se è stato inserito un valore.
  const tests = Array.isArray(updatedEntry.tests) ? [...updatedEntry.tests] : [];
  const testValueInput = editForm.querySelector('[name="edit-vt-value"]');
  const testValue = testValueInput ? testValueInput.value.trim() : '';
  if (testValue) {
    const rd = resultDateFrom(editForm, 'vt', now);
    const testNoteInput = editForm.querySelector('[name="edit-vt-note"]');
    tests.push({
      id: newVelId('vt'),
      type: editForm.querySelector('[name="edit-vt-type"]').value || 'Altro',
      value: testValue,
      note: testNoteInput ? testNoteInput.value.trim() : '',
      date: rd.date,
      createdAt: rd.iso,
    });
  }
  updatedEntry.tests = tests;

  entries[targetIndex] = updatedEntry;
  await saveVelocisti(entries);
  renderVelocisti();
}

async function handleVelListClick(event) {
  const deleteButton = event.target.closest('.delete-btn');
  const editButton = event.target.closest('.edit-btn');
  const cancelButton = event.target.closest('.cancel-edit-btn');
  const projectionButton = event.target.closest('.projection-toggle');
  const editSectionToggle = event.target.closest('.edit-section-toggle');
  const resultDelButton = event.target.closest('.vel-result-del');
  const testDelButton = event.target.closest('.vel-test-del');
  const notesButton = event.target.closest('.notes-btn');
  const notesClearButton = event.target.closest('.notes-clear');

  if (editSectionToggle) {
    toggleEditSection(editSectionToggle);
    return;
  }

  if (notesClearButton) {
    await handleVelNotesClear(notesClearButton);
    return;
  }

  if (notesButton) {
    await handleVelNotesAdd(notesButton);
    return;
  }

  if (resultDelButton) {
    const entryId = resultDelButton.closest('.athlete-item')?.querySelector('.delete-btn')?.dataset.id;
    const entries = getVelocisti();
    const index = entries.findIndex((entry) => entry.id === entryId);
    if (index === -1) {
      return;
    }
    const confirmed = await showConfirm('Eliminare questo risultato?', {
      detail: "L'operazione non è reversibile.",
      confirmText: 'Elimina',
    });
    if (!confirmed) {
      return;
    }
    entries[index] = { ...entries[index], results: entries[index].results.filter((r) => r.id !== resultDelButton.dataset.id) };
    await saveVelocisti(entries);
    renderVelocisti();
    showToast('Eliminato!');
    return;
  }

  if (testDelButton) {
    const entryId = testDelButton.closest('.athlete-item')?.querySelector('.delete-btn')?.dataset.id;
    const entries = getVelocisti();
    const index = entries.findIndex((entry) => entry.id === entryId);
    if (index === -1) {
      return;
    }
    const confirmed = await showConfirm('Eliminare questo test?', {
      detail: "L'operazione non è reversibile.",
      confirmText: 'Elimina',
    });
    if (!confirmed) {
      return;
    }
    entries[index] = { ...entries[index], tests: entries[index].tests.filter((t) => t.id !== testDelButton.dataset.id) };
    await saveVelocisti(entries);
    renderVelocisti();
    showToast('Eliminato!');
    return;
  }

  if (deleteButton) {
    const entryId = deleteButton.dataset.id;
    const entries = getVelocisti();
    const target = entries.find((entry) => entry.id === entryId);
    const label = target ? `${target.name} ${target.surname}`.trim() : 'questo velocista';

    const confirmed = await showConfirm(`Eliminare ${label}?`, {
      detail: "L'operazione non è reversibile.",
      confirmText: 'Elimina',
    });
    if (!confirmed) {
      return;
    }

    const remaining = entries.filter((entry) => entry.id !== entryId);
    await saveVelocisti(remaining);
    renderVelocisti();
    showToast('Eliminato!');
    return;
  }

  if (cancelButton) {
    const formItem = cancelButton.closest('.edit-form');
    if (formItem) {
      formItem.hidden = true;
    }
    return;
  }

  if (editButton) {
    const item = editButton.closest('.athlete-item');
    const projectionPanel = item.querySelector('.projection-panel');
    const projectionButtonEl = item.querySelector('.projection-toggle');
    if (projectionPanel && !projectionPanel.hidden) {
      projectionPanel.hidden = true;
      if (projectionButtonEl) {
        projectionButtonEl.setAttribute('aria-expanded', 'false');
        projectionButtonEl.style.transform = 'rotate(0deg)';
      }
    }

    let editForm = item.querySelector('.edit-form');
    if (!editForm) {
      const entry = getVelocisti().find((e) => e.id === editButton.dataset.id);
      if (!entry) {
        return;
      }
      velCollapseOtherCards(item);
      editForm = createVelocistaEditForm(entry);
      item.appendChild(editForm);
      wireCustomInputs(editForm);
      editForm.hidden = false;
      scrollCardIntoView(item);
      return;
    }

    const willOpen = editForm.hidden;
    if (willOpen) {
      velCollapseOtherCards(item);
    }
    editForm.hidden = !editForm.hidden;
    if (willOpen) {
      scrollCardIntoView(item);
    }
    return;
  }

  if (projectionButton) {
    const item = projectionButton.closest('.athlete-item');
    const panel = item.querySelector('.projection-panel');
    const isExpanded = projectionButton.getAttribute('aria-expanded') === 'true';
    const nextExpanded = !isExpanded;

    if (nextExpanded) {
      const editForm = item.querySelector('.edit-form');
      if (editForm && !editForm.hidden) {
        editForm.hidden = true;
      }
      velCollapseOtherCards(item);
    }

    projectionButton.setAttribute('aria-expanded', String(nextExpanded));
    panel.hidden = !nextExpanded;
    projectionButton.style.transform = nextExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
    if (nextExpanded) {
      scrollCardIntoView(item);
    }
  }
}

velList.addEventListener('click', handleVelListClick);
velList.addEventListener('submit', handleVelEditSubmit);
velList.addEventListener('input', (event) => {
  const input = event.target.closest('.notes-input');
  if (!input) {
    return;
  }
  const button = input.closest('.notes-block').querySelector('.notes-btn');
  button.disabled = input.value.trim() === '';
});

function velSyncFilterChips() {
  setChipGroupSelection(velSpecialtyChips, velActiveSpecialty);
  setChipGroupSelection(velSortChips, velActiveSort);
}

function velRevertFiltersDraft() {
  if (!velFilterSnapshot) {
    return;
  }
  velActiveSpecialty = velFilterSnapshot.specialty;
  velActiveSort = velFilterSnapshot.sort;
  velFilterSnapshot = null;
  velCurrentPage = 1;
  velSyncFilterChips();
  renderVelocisti();
}

function velCloseToolPanels(except) {
  if (except !== 'search') {
    setCollapsibleOpen(velToggleSearchButton, velSearchPanel, false);
    velToggleSearchButton.setAttribute('aria-label', 'Cerca velocista');
  }
  if (except !== 'filters') {
    if (!velFiltersPanel.hidden) {
      velRevertFiltersDraft();
    }
    setCollapsibleOpen(velToggleFiltersButton, velFiltersPanel, false);
    velToggleFiltersButton.setAttribute('aria-label', 'Mostra filtri');
  }
}

velToggleSearchButton.addEventListener('click', () => {
  const open = velSearchPanel.hidden;
  velCloseToolPanels('search');
  setCollapsibleOpen(velToggleSearchButton, velSearchPanel, open);
  velToggleSearchButton.setAttribute('aria-label', open ? 'Nascondi ricerca' : 'Cerca velocista');
  if (open) {
    velSearchInput.focus();
  }
});

velToggleFiltersButton.addEventListener('click', () => {
  const open = velFiltersPanel.hidden;
  velCloseToolPanels('filters');
  if (open) {
    velFilterSnapshot = { specialty: velActiveSpecialty, sort: velActiveSort };
    velSyncFilterChips();
    setCollapsibleOpen(velToggleFiltersButton, velFiltersPanel, true);
    velToggleFiltersButton.setAttribute('aria-label', 'Chiudi filtri');
  } else {
    velRevertFiltersDraft();
    setCollapsibleOpen(velToggleFiltersButton, velFiltersPanel, false);
    velToggleFiltersButton.setAttribute('aria-label', 'Mostra filtri');
  }
});

[velSpecialtyChips, velSortChips].forEach((group) => {
  group.addEventListener('click', (event) => {
    const chip = event.target.closest('.fchip');
    if (!chip || !group.contains(chip)) {
      return;
    }
    setChipGroupSelection(group, chip.dataset.value);
    if (group === velSpecialtyChips) {
      velActiveSpecialty = chip.dataset.value;
    } else {
      velActiveSort = chip.dataset.value;
    }
    velCurrentPage = 1;
    renderVelocisti();
  });
});

velFiltersApplyButton.addEventListener('click', () => {
  velFilterSnapshot = null;
  setCollapsibleOpen(velToggleFiltersButton, velFiltersPanel, false);
  velToggleFiltersButton.setAttribute('aria-label', 'Mostra filtri');
});

velFiltersResetButton.addEventListener('click', () => {
  velActiveSpecialty = VEL_FILTER_DEFAULTS.specialty;
  velActiveSort = VEL_FILTER_DEFAULTS.sort;
  velCurrentPage = 1;
  velSyncFilterChips();
  renderVelocisti();
});

velSyncFilterChips();

velSearchInput.addEventListener('input', () => {
  velCurrentPage = 1;
  renderVelocisti();
});
wireSearchClear(velSearchInput, document.getElementById('vel-search-clear'));

if (velPaginationNav) {
  velPaginationNav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) {
      return;
    }
    const page = Number(button.dataset.page);
    if (!Number.isFinite(page) || page === velCurrentPage) {
      return;
    }
    velCurrentPage = page;
    renderVelocisti();
    const head = velList.closest('.list-section')?.querySelector('.list-head');
    if (head) {
      head.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  });
}

// ----- Form di registrazione velocista -----
function updateVelAvatarPreview() {
  if (currentVelAvatarData) {
    velAvatarPreview.style.backgroundImage = `url('${currentVelAvatarData}')`;
    velAvatarPreview.classList.remove('avatar-empty');
    velAvatarPreview.innerHTML = '';
  } else {
    const name = velNameInput.value.trim();
    const surname = velSurnameInput.value.trim();
    if (name || surname) {
      velAvatarPreview.classList.remove('avatar-empty');
      velAvatarPreview.innerHTML = `<span class="avatar-initials">${getInitials(name, surname)}</span>`;
      velAvatarPreview.style.backgroundImage = '';
    } else {
      velAvatarPreview.classList.add('avatar-empty');
      velAvatarPreview.innerHTML = '<span class="avatar-placeholder">+</span>';
      velAvatarPreview.style.backgroundImage = '';
    }
  }
}

velAvatarInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (file) {
    try {
      currentVelAvatarData = await fileToBase64(file);
      updateVelAvatarPreview();
    } catch (error) {
      console.error('Errore nel caricamento dell\'avatar:', error);
      alert('Errore nel caricamento dell\'immagine. Prova un file più piccolo.');
      velAvatarInput.value = '';
      currentVelAvatarData = null;
      updateVelAvatarPreview();
    }
  } else {
    currentVelAvatarData = null;
    updateVelAvatarPreview();
  }
});

velAvatarPreview.addEventListener('click', () => {
  velAvatarInput.click();
});

velNameInput.addEventListener('input', updateVelAvatarPreview);
velSurnameInput.addEventListener('input', updateVelAvatarPreview);

function openVelRegisterScreen() {
  velRegisterScreen.hidden = false;
  lockBodyScroll();
  velRegisterScreen.scrollTop = 0;
  velNameInput.focus();
}

function closeVelRegisterScreen() {
  velRegisterScreen.hidden = true;
  unlockBodyScroll();
}

if (velOpenRegisterButton) {
  velOpenRegisterButton.addEventListener('click', openVelRegisterScreen);
}
if (velCloseRegisterButton) {
  velCloseRegisterButton.addEventListener('click', closeVelRegisterScreen);
}

velForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = velNameInput.value.trim();
  const surname = velSurnameInput.value.trim();
  if (!name || !surname) {
    alert('Inserisci nome e cognome.');
    return;
  }

  const entries = getVelocisti();
  entries.push({
    id: `vel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    surname,
    avatar: currentVelAvatarData,
    specialty: velSpecialtyInput.value,
    createdAt: new Date().toISOString(),
    results: [],
    tests: [],
    notes: [],
  });

  await saveVelocisti(entries);
  velCurrentPage = 1;
  renderVelocisti();

  velForm.reset();
  currentVelAvatarData = null;
  velAvatarInput.value = '';
  updateVelAvatarPreview();
  closeVelRegisterScreen();
  showToast('Salvato!');
});

// ===================== "Programma allenamento" (solo C. Militari) =====================
// Elenco di voci a fisarmonica (titolo + testo), condiviso per tutta la
// sezione atleti militari — non legato a un singolo atleta. Ogni voce ha un
// corpo "contenteditable"; la formattazione (grassetto/corsivo/ecc.) si fa
// con i comandi nativi di iPhone sul testo selezionato, non con pulsanti
// nostri.
const STORAGE_KEY_TRAINING_NOTES = 'lapsi-training-notes';

const trainingNotesBackdrop = document.getElementById('training-notes-backdrop');
const trainingNotesOverlay = document.getElementById('training-notes-overlay');
const trainingNotesClose = document.getElementById('training-notes-close');
const trainingNotesList = document.getElementById('training-notes-list');
const trainingNotesAdd = document.getElementById('training-notes-add');
const trainingNotesSave = document.getElementById('training-notes-save');

let trainingActiveEditor = null;

function newTrainingEntryId() {
  return `tn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Toglie tag/attributi pericolosi da un HTML prima di salvarlo o rimetterlo in
// pagina (l'editor produce solo b/i/u/font/div/br, ma un incolla potrebbe
// portare dentro altro).
function sanitizeTrainingHtml(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const stripTags = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'form'];
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 1) {
        if (stripTags.includes(child.tagName.toLowerCase())) {
          child.remove();
          return;
        }
        [...child.attributes].forEach((attr) => {
          const isEventAttr = /^on/i.test(attr.name);
          const isUnsafeUrl = /^(href|src)$/i.test(attr.name) && /^\s*javascript:/i.test(attr.value);
          if (isEventAttr || isUnsafeUrl) {
            child.removeAttribute(attr.name);
          }
        });
        walk(child);
      } else if (child.nodeType !== 3) {
        child.remove();
      }
    });
  };
  walk(temp);
  return temp.innerHTML;
}

// Legge le voci salvate; converte automaticamente il vecchio formato (una
// singola stringa di testo semplice, con o senza marcatori **/*/_) in
// un'unica voce, senza perdere nulla.
function readTrainingEntries() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY_TRAINING_NOTES);
  } catch (error) {
    console.warn('Errore lettura programma allenamento:', error);
    return [];
  }
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          id: entry.id || newTrainingEntryId(),
          title: String(entry.title || ''),
          html: String(entry.html || ''),
        }));
    }
  } catch (error) {
    // Non era JSON valido: è il vecchio formato a testo semplice, si migra sotto.
  }
  const legacyText = String(raw).trim();
  if (!legacyText) {
    return [];
  }
  return [{
    id: newTrainingEntryId(),
    title: 'Programma',
    html: escapeHtml(legacyText).replace(/\n/g, '<br>'),
  }];
}

function saveTrainingEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY_TRAINING_NOTES, JSON.stringify(entries));
  } catch (error) {
    console.error('Impossibile salvare il programma allenamento:', error);
  }
}

function collectTrainingEntriesFromDom() {
  if (!trainingNotesList) {
    return [];
  }
  return [...trainingNotesList.querySelectorAll('.training-entry')].map((el) => ({
    id: el.dataset.id,
    title: el.querySelector('.training-entry-title').value.trim(),
    html: sanitizeTrainingHtml(el.querySelector('.training-entry-editor').innerHTML),
  }));
}

function trainingEntryTemplate(entry, { expanded = false } = {}) {
  const chevron = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
  const trash = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg>';

  const item = document.createElement('div');
  item.className = 'training-entry';
  item.dataset.id = entry.id;
  item.innerHTML = `
    <div class="training-entry-header">
      <input type="text" class="training-entry-title" value="${escapeHtml(entry.title)}" placeholder="Titolo…" />
      <button type="button" class="training-entry-del" aria-label="Elimina voce">${trash}</button>
      <button type="button" class="training-entry-toggle" aria-expanded="${expanded}" aria-label="Apri/chiudi voce">${chevron}</button>
    </div>
    <div class="training-entry-body" ${expanded ? '' : 'hidden'}>
      <div class="training-entry-editor" contenteditable="true" data-placeholder="Scrivi qui…"></div>
    </div>
  `;
  item.querySelector('.training-entry-editor').innerHTML = entry.html || '';
  return item;
}

function renderTrainingEntries(entries) {
  if (!trainingNotesList) {
    return;
  }
  trainingNotesList.innerHTML = '';
  trainingActiveEditor = null;
  const list = entries.length ? entries : [{ id: newTrainingEntryId(), title: '', html: '' }];
  list.forEach((entry, index) => {
    trainingNotesList.appendChild(trainingEntryTemplate(entry, { expanded: index === 0 }));
  });
  const firstEditor = trainingNotesList.querySelector('.training-entry-editor');
  if (firstEditor) {
    trainingActiveEditor = firstEditor;
  }
}

// Una sola voce aperta per volta.
function toggleTrainingEntry(entryEl) {
  const body = entryEl.querySelector('.training-entry-body');
  const toggleBtn = entryEl.querySelector('.training-entry-toggle');
  const wasOpen = body && !body.hidden;

  trainingNotesList.querySelectorAll('.training-entry').forEach((other) => {
    const otherBody = other.querySelector('.training-entry-body');
    const otherToggle = other.querySelector('.training-entry-toggle');
    if (otherBody) otherBody.hidden = true;
    if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
  });

  if (!wasOpen) {
    if (body) body.hidden = false;
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    const editor = entryEl.querySelector('.training-entry-editor');
    if (editor) {
      trainingActiveEditor = editor;
      editor.focus();
    }
  }
}

function openTrainingNotes() {
  if (!trainingNotesOverlay || !trainingNotesBackdrop || !trainingNotesList) {
    return;
  }
  renderTrainingEntries(readTrainingEntries());
  trainingNotesBackdrop.hidden = false;
  trainingNotesOverlay.hidden = false;
  lockBodyScroll();
}

function closeTrainingNotes() {
  if (!trainingNotesOverlay || !trainingNotesBackdrop) {
    return;
  }
  trainingNotesOverlay.hidden = true;
  trainingNotesBackdrop.hidden = true;
  unlockBodyScroll();
}

if (trainingNotesFab) {
  trainingNotesFab.addEventListener('click', openTrainingNotes);
}
if (trainingNotesClose) {
  trainingNotesClose.addEventListener('click', closeTrainingNotes);
}
if (trainingNotesBackdrop) {
  trainingNotesBackdrop.addEventListener('click', closeTrainingNotes);
}
if (trainingNotesAdd) {
  trainingNotesAdd.addEventListener('click', () => {
    const item = trainingEntryTemplate({ id: newTrainingEntryId(), title: '', html: '' }, { expanded: false });
    trainingNotesList.appendChild(item);
    toggleTrainingEntry(item);
    item.querySelector('.training-entry-title').focus();
    item.scrollIntoView({ block: 'end', behavior: 'smooth' });
  });
}
if (trainingNotesSave) {
  trainingNotesSave.addEventListener('click', () => {
    const entries = collectTrainingEntriesFromDom()
      .filter((entry) => entry.title.trim() || entry.html.replace(/<[^>]*>/g, '').trim());
    saveTrainingEntries(entries);
    showToast('Salvato!');
  });
}
if (trainingNotesList) {
  trainingNotesList.addEventListener('click', async (event) => {
    const toggleBtn = event.target.closest('.training-entry-toggle');
    const delBtn = event.target.closest('.training-entry-del');

    if (toggleBtn) {
      toggleTrainingEntry(toggleBtn.closest('.training-entry'));
      return;
    }

    if (delBtn) {
      const entryEl = delBtn.closest('.training-entry');
      const title = entryEl.querySelector('.training-entry-title').value.trim() || 'questa voce';
      const confirmed = await showConfirm(`Eliminare "${title}"?`, {
        detail: 'Diventa definitivo solo premendo Salva.',
        confirmText: 'Elimina',
      });
      if (!confirmed) {
        return;
      }
      if (trainingActiveEditor && entryEl.contains(trainingActiveEditor)) {
        trainingActiveEditor = null;
      }
      entryEl.remove();
    }
  });
  trainingNotesList.addEventListener('focusin', (event) => {
    const editor = event.target.closest('.training-entry-editor');
    if (editor && editor !== trainingActiveEditor) {
      trainingActiveEditor = editor;
    }
  });
}

// Controllo "giorno dopo": ogni atleta ancora "in corso" il cui concorso
// (data dell'ultimo risultato registrato) è passato da almeno un giorno viene
// chiesto uno per volta. "Non lo so ancora" rimanda la domanda a domani senza
// cambiare l'esito; una scelta definitiva (Superato/Non superato) non verrà
// più richiesta. Un atleta viene chiesto al massimo una volta al giorno.
async function checkExpiredConcorsi() {
  const todayKey = todayNativeDateValue();
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const pendingIds = getAthletes()
    .filter((entry) => {
      if (entry.competitionResult) {
        return false;
      }
      if (entry.competitionAskedOn === todayKey) {
        return false;
      }
      const latest = getLatestAthleteTime(entry);
      const concorsoStr = latest ? latest.concorsoDate : '';
      if (!concorsoStr || concorsoStr === '--/--/--') {
        return false;
      }
      const concorsoMs = parseItDate(concorsoStr);
      if (concorsoMs === null) {
        return false;
      }
      const concorsoDay = new Date(concorsoMs);
      concorsoDay.setHours(0, 0, 0, 0);
      const dayAfter = new Date(concorsoDay.getTime() + 24 * 60 * 60 * 1000);
      return todayMidnight.getTime() >= dayAfter.getTime();
    })
    .map((entry) => entry.id);

  if (!pendingIds.length) {
    return;
  }

  for (const id of pendingIds) {
    const athletes = getAthletes();
    const entry = athletes.find((item) => item.id === id);
    if (!entry) {
      continue;
    }
    const label = `${entry.name} ${entry.surname}`.trim() || 'questo atleta';
    const latest = getLatestAthleteTime(entry);
    const concorsoStr = latest ? latest.concorsoDate : '--/--/--';

    const choice = await showChoice(`Concorso di ${label} concluso`, {
      detail: `Il concorso del ${concorsoStr} risulta concluso. Come è andata?`,
      options: [
        { value: 'passed', label: 'Superato', className: 'app-btn-success', icon: thumbsUpIcon(16) },
        { value: 'failed', label: 'Non superato', className: 'app-btn-danger', icon: thumbsDownIcon(16) },
        { value: 'later', label: 'Non lo so ancora', className: 'app-btn-ghost' },
      ],
    });

    const current = getAthletes();
    const index = current.findIndex((item) => item.id === id);
    if (index === -1) {
      continue;
    }

    if (choice === 'passed' || choice === 'failed') {
      current[index] = { ...current[index], competitionResult: choice, competitionAskedOn: null };
    } else {
      // "Non lo so ancora" oppure popup chiuso senza scegliere: richiedi di nuovo domani.
      current[index] = { ...current[index], competitionAskedOn: todayKey };
    }
    await saveEntries(current);
  }

  renderEntries();
}

// ===== Calcolatori di andature: hub + tre moduli (solo militari) =====
// I modelli di calcolo (formule, coefficienti, formattazione) vivono in tre
// moduli puri senza dipendenze dal DOM — ripetute-calc.js (RipeteCalc),
// velocisti-calc.js (VelocistiCalc), mezzofondo-calc.js (MezzofondoCalc) —
// per ritoccare un coefficiente si modifica solo quel file, mai questa UI.
// "VelocistiCalc" è il nome interno del modulo (coerente con la spec); in
// interfaccia la voce si chiama "Andature sprint" per non confondersi con la
// sezione atleti "Velocisti Ass./Master" già presente in Lapsi — sono due
// cose diverse, qui non si tocca alcun dato di atleti.
const calcBackdrop = document.getElementById('calc-backdrop');
const calcOverlay = document.getElementById('calc-overlay');
const calcClose = document.getElementById('calc-close');
const calcTitle = document.getElementById('calc-title');

const CALC_MODULE_TITLES = {
  ripetute: 'Ripetute brevi',
  velocisti: 'Andature sprint',
  mezzofondo: 'Mezzofondo e fondo',
};

// Formattazione automatica di un campo tempo mentre si digita: le ultime due
// cifre sono sempre i secondi (tra ' e "), quelle prima i minuti — stessa
// lettura di RipeteCalc.parseThousand, così "345" diventa "3'45"" e un tempo
// più lento con minuti a due cifre (es. "1035" -> "10'35"") resta corretto.
// Condivisa dal modulo 1 (sempre) e dal modulo 3 (solo quando si parte dal
// 1000 massimale) invece di duplicarla.
function formatTimeMask(digits) {
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, -2)}'${digits.slice(-2)}"`;
}

// Riga cliccabile condivisa dai tre moduli: resta evidenziata, una sola alla
// volta, in qualunque modulo sia attivo (solo una tabella è visibile per
// volta, quindi non serve distinguere per modulo).
function calcAllRows() {
  return calcOverlay ? [...calcOverlay.querySelectorAll('tbody tr')] : [];
}

function calcMarkRow(label) {
  calcAllRows().forEach((row) => {
    row.classList.toggle('is-on', label !== null && row.dataset.label === label);
  });
}

// Ogni calcolatore vive nella sua sezione (militari/velocisti/master) con un
// pulsante flottante dedicato, ma condividono lo stesso overlay: qui si
// sceglie solo quale dei tre corpi mostrare e si inizializza quel modulo.
function openCalcOverlay(name) {
  if (!calcOverlay || !calcBackdrop) {
    return;
  }
  document.querySelectorAll('.calc-module').forEach((el) => {
    el.hidden = el.id !== `calc-module-${name}`;
  });
  if (calcTitle) {
    calcTitle.textContent = CALC_MODULE_TITLES[name] || '';
  }
  if (name === 'ripetute') {
    initRipetuteModule();
  } else if (name === 'velocisti') {
    initCalcSprintModule();
  } else if (name === 'mezzofondo') {
    initCalcMezzofondoModule();
  }
  calcBackdrop.hidden = false;
  calcOverlay.hidden = false;
  lockBodyScroll();
}

function closeCalc() {
  if (!calcOverlay || !calcBackdrop) {
    return;
  }
  calcOverlay.hidden = true;
  calcBackdrop.hidden = true;
  unlockBodyScroll();
}

if (ripetuteFab) {
  ripetuteFab.addEventListener('click', () => openCalcOverlay('ripetute'));
}
if (sprintFab) {
  sprintFab.addEventListener('click', () => openCalcOverlay('velocisti'));
}
if (fondoFab) {
  fondoFab.addEventListener('click', () => openCalcOverlay('mezzofondo'));
}
if (calcClose) {
  calcClose.addEventListener('click', closeCalc);
}
if (calcBackdrop) {
  calcBackdrop.addEventListener('click', closeCalc);
}
if (calcOverlay) {
  calcOverlay.addEventListener('click', (event) => {
    const row = event.target.closest('tbody tr');
    if (!row) {
      return;
    }
    const wasOn = row.classList.contains('is-on');
    calcAllRows().forEach((r) => r.classList.remove('is-on'));
    if (!wasOn) {
      row.classList.add('is-on');
    }
  });
  calcOverlay.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    const row = event.target.closest('tbody tr');
    if (!row) {
      return;
    }
    event.preventDefault();
    row.click();
  });
}

// --- Modulo 1: Ripetute brevi dal 1000 massimale --------------------------
const RIPETUTE_STORAGE_KEY = 'lapsi-calc-ripetute';

const ripetuteInput = document.getElementById('ripetute-t1000');
const ripetuteOutput = document.getElementById('ripetute-output');
const ripetuteVolChips = document.getElementById('ripetute-vol-chips');
const ripetuteRecChips = document.getElementById('ripetute-rec-chips');
const ripetuteStatus = document.getElementById('ripetute-status');
const ripetutePrintSettings = document.getElementById('ripetute-print-settings');
const ripetuteBodyA = document.getElementById('ripetute-body-a');
const ripetuteBodyB = document.getElementById('ripetute-body-b');

let ripetuteState = { t: '', vol: RipeteCalc.VOL_DEFAULT, rec: RipeteCalc.REC_DEFAULT };
// Le cifre "vere" del campo 1km, tenute a parte: il valore mostrato
// nell'input è sempre ricalcolato da qui, non letto/riscritto al contrario,
// per evitare ambiguità quando si cancella un carattere di formattazione.
let ripetuteDigits = '';

function applyRipetuteMask() {
  ripetuteInput.value = formatTimeMask(ripetuteDigits);
  const end = ripetuteInput.value.length;
  ripetuteInput.setSelectionRange(end, end);
}

function readRipetuteState() {
  try {
    const raw = localStorage.getItem(RIPETUTE_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      if (typeof saved.t === 'string') {
        ripetuteState.t = saved.t;
      }
      if (RipeteCalc.isValidVol(saved.vol)) {
        ripetuteState.vol = saved.vol;
      }
      if (RipeteCalc.isValidRec(saved.rec)) {
        ripetuteState.rec = saved.rec;
      }
    }
  } catch (error) {
    console.warn('Impossibile leggere le impostazioni di "Ripetute brevi":', error);
  }
}

function saveRipetuteState() {
  try {
    localStorage.setItem(RIPETUTE_STORAGE_KEY, JSON.stringify(ripetuteState));
  } catch (error) {
    console.warn('Impossibile salvare le impostazioni di "Ripetute brevi":', error);
  }
}

function buildRipetuteChips(container, options, key) {
  if (!container) {
    return;
  }
  container.innerHTML = options.map(([value, label]) => `
    <button type="button" class="fchip" data-value="${value}">${escapeHtml(label)}</button>
  `).join('');
  setChipGroupSelection(container, String(ripetuteState[key]));
}

function ripetuteRowMarkup(T) {
  const label = RipeteCalc.formatLabel(T);
  const cells = RipeteCalc.PCT.map(([dist, pct]) => (
    `<td>${RipeteCalc.formatSeconds(RipeteCalc.repeatSeconds(T, dist, pct, ripetuteState.vol, ripetuteState.rec))}</td>`
  )).join('');
  const isAnchor = T % 30 === 0;
  return `<tr${isAnchor ? ' class="calc-anchor"' : ''} data-label="${escapeHtml(label)}" tabindex="0"><th scope="row">${escapeHtml(label)}</th>${cells}</tr>`;
}

// Righe da 180 a 360s a passo di 5 (37 righe), spezzate in due blocchi
// (19 + 18) come nel prototipo di riferimento.
function renderRipetuteTable() {
  if (!ripetuteBodyA || !ripetuteBodyB) {
    return;
  }
  const rowsA = [];
  const rowsB = [];
  let i = 0;
  for (let T = 180; T <= 360; T += 5) {
    (i < 19 ? rowsA : rowsB).push(ripetuteRowMarkup(T));
    i += 1;
  }
  ripetuteBodyA.innerHTML = rowsA.join('');
  ripetuteBodyB.innerHTML = rowsB.join('');
}

function renderRipetute() {
  renderRipetuteTable();

  const T = RipeteCalc.parseThousand(ripetuteInput.value);
  const volEntry = RipeteCalc.VOL_OPTIONS.find(([v]) => v === ripetuteState.vol);
  const recEntry = RipeteCalc.REC_OPTIONS.find(([r]) => r === ripetuteState.rec);
  const ref = T || 240;
  const dec = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
  const r200 = ripetuteState.rec / RipeteCalc.repeatSeconds(ref, 200, 0.93, ripetuteState.vol, ripetuteState.rec);
  const r600 = ripetuteState.rec / RipeteCalc.repeatSeconds(ref, 600, 1.01, ripetuteState.vol, ripetuteState.rec);
  if (ripetuteStatus) {
    ripetuteStatus.innerHTML = `Lavoro da ${escapeHtml(volEntry[1])}, recupero <b>${escapeHtml(recEntry[1])}</b> fisso tra le prove. `
      + `Su un 1000 da ${escapeHtml(RipeteCalc.formatLabel(ref))} vale ${dec(r200)} volte la durata del 200 e ${dec(r600)} volte quella del 600: `
      + 'per questo le prove lunghe escono più lente al 100.';
  }
  if (ripetutePrintSettings) {
    ripetutePrintSettings.textContent = `Impostazione: lavoro da ${volEntry[1]}, recupero ${recEntry[1]} tra le prove.`;
  }

  if (!T) {
    if (ripetuteOutput) {
      ripetuteOutput.hidden = true;
      ripetuteOutput.innerHTML = '';
    }
    calcMarkRow(null);
  } else {
    if (ripetuteOutput) {
      ripetuteOutput.hidden = false;
      ripetuteOutput.innerHTML = RipeteCalc.repeatTimesFor(T, ripetuteState.vol, ripetuteState.rec)
        .map(({ dist, seconds }) => `<div class="calc-out-tile"><b>${escapeHtml(RipeteCalc.formatSeconds(seconds))}</b><span>${dist} m</span></div>`)
        .join('');
    }
    const near = Math.round(T / 5) * 5;
    calcMarkRow(near >= 180 && near <= 360 ? RipeteCalc.formatLabel(near) : null);
  }

  ripetuteState.t = ripetuteInput.value;
  saveRipetuteState();
}

function initRipetuteModule() {
  readRipetuteState();
  ripetuteDigits = String(ripetuteState.t || '').replace(/[^0-9]/g, '').slice(0, 4);
  applyRipetuteMask();
  buildRipetuteChips(ripetuteVolChips, RipeteCalc.VOL_OPTIONS, 'vol');
  buildRipetuteChips(ripetuteRecChips, RipeteCalc.REC_OPTIONS, 'rec');
  renderRipetute();
}

if (ripetuteInput) {
  // Backspace/Delete si intercettano PRIMA che tolgano un carattere dal
  // valore nativo: se l'ultimo carattere visibile è ' o " (formattazione,
  // non una cifra vera), lasciare fare al browser cancellerebbe solo quello
  // e la maschera lo riaggiungerebbe subito dopo — il tasto sembrerebbe non
  // fare nulla. Gestendo la cancellazione a mano sulle cifre "vere" invece
  // del testo visibile, un backspace toglie sempre una cifra.
  ripetuteInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Backspace' && event.key !== 'Delete') {
      return;
    }
    event.preventDefault();
    ripetuteDigits = ripetuteDigits.slice(0, -1);
    applyRipetuteMask();
    renderRipetute();
  });
  // Digitazione, incolla, autocompletamento: qui il valore nativo è già
  // corretto (il browser gestisce da solo selezione/sostituzione), basta
  // rileggere le sole cifre e riapplicare la maschera.
  ripetuteInput.addEventListener('input', () => {
    ripetuteDigits = ripetuteInput.value.replace(/[^0-9]/g, '').slice(0, 4);
    applyRipetuteMask();
    renderRipetute();
  });
}
[ripetuteVolChips, ripetuteRecChips].forEach((group) => {
  if (!group) {
    return;
  }
  group.addEventListener('click', (event) => {
    const chip = event.target.closest('.fchip');
    if (!chip) {
      return;
    }
    setChipGroupSelection(group, chip.dataset.value);
    if (group === ripetuteVolChips) {
      ripetuteState.vol = Number(chip.dataset.value);
    } else {
      ripetuteState.rec = Number(chip.dataset.value);
    }
    renderRipetute();
  });
});

// --- Modulo 2: Andature sprint dal massimale sui 100 -----------------------
const CALC_SPRINT_STORAGE_KEY = 'lapsi-calc-velocisti';
const CALC_SPRINT_DEFAULT = '12.00';

const calcSprintInput = document.getElementById('velocisti-t100');
const calcSprintOutput = document.getElementById('velocisti-output');
const calcSprintStatus = document.getElementById('velocisti-status');
const calcSprintPrintSettings = document.getElementById('velocisti-print-settings');
const calcSprintHeadA = document.getElementById('velocisti-head-a');
const calcSprintHeadB = document.getElementById('velocisti-head-b');
const calcSprintBodyA = document.getElementById('velocisti-body-a');
const calcSprintBodyB = document.getElementById('velocisti-body-b');

let calcSprintValue = CALC_SPRINT_DEFAULT;

function readCalcSprintState() {
  try {
    const raw = localStorage.getItem(CALC_SPRINT_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const saved = JSON.parse(raw);
    if (saved && typeof saved.t100 === 'string') {
      calcSprintValue = saved.t100;
    }
  } catch (error) {
    console.warn('Impossibile leggere le impostazioni di "Andature sprint":', error);
  }
}

function saveCalcSprintState() {
  try {
    localStorage.setItem(CALC_SPRINT_STORAGE_KEY, JSON.stringify({ t100: calcSprintValue }));
  } catch (error) {
    console.warn('Impossibile salvare le impostazioni di "Andature sprint":', error);
  }
}

function calcSprintHeadMarkup() {
  return `<tr><th scope="col">dist.</th>${VelocistiCalc.PCTS.map((p) => `<th scope="col">${p}%</th>`).join('')}</tr>`;
}

function calcSprintRowMarkup(max100, dist, coef) {
  const label = `${dist} m`;
  const cells = VelocistiCalc.PCTS.map((pct) => `<td>${VelocistiCalc.formatSeconds(VelocistiCalc.timeAt(max100, coef, pct))}</td>`).join('');
  return `<tr${dist === 100 ? ' class="calc-anchor"' : ''} data-label="${escapeHtml(label)}" tabindex="0"><th scope="row">${escapeHtml(label)}</th>${cells}</tr>`;
}

// 12 righe (20-400m), spezzate in due blocchi da 6 come nel prototipo.
function renderCalcSprintTable(max100) {
  if (!calcSprintBodyA || !calcSprintBodyB) {
    return;
  }
  const rowsA = [];
  const rowsB = [];
  VelocistiCalc.COEF.forEach(([dist, coef], i) => {
    (i < 6 ? rowsA : rowsB).push(calcSprintRowMarkup(max100, dist, coef));
  });
  calcSprintBodyA.innerHTML = rowsA.join('');
  calcSprintBodyB.innerHTML = rowsB.join('');
}

function renderCalcSprint() {
  if (calcSprintHeadA) {
    calcSprintHeadA.innerHTML = calcSprintHeadMarkup();
  }
  if (calcSprintHeadB) {
    calcSprintHeadB.innerHTML = calcSprintHeadMarkup();
  }

  const max100 = VelocistiCalc.parseMax100(calcSprintInput.value);
  if (!max100) {
    if (calcSprintStatus) {
      calcSprintStatus.textContent = 'Inserisci il tempo sui 100 m, per esempio 12,00 oppure 11,85.';
    }
    if (calcSprintOutput) {
      calcSprintOutput.hidden = true;
      calcSprintOutput.innerHTML = '';
    }
    if (calcSprintBodyA) calcSprintBodyA.innerHTML = '';
    if (calcSprintBodyB) calcSprintBodyB.innerHTML = '';
    if (calcSprintPrintSettings) calcSprintPrintSettings.textContent = '';
    calcSprintValue = calcSprintInput.value;
    saveCalcSprintState();
    return;
  }

  renderCalcSprintTable(max100);
  // Il 100m è la distanza di riferimento diretta dell'input (coefficiente 1):
  // non serve "arrotondare alla riga più vicina" come negli altri moduli, è
  // sempre quella riga.
  calcMarkRow('100 m');

  const showDists = [60, 200, 300, 400];
  if (calcSprintOutput) {
    calcSprintOutput.hidden = false;
    calcSprintOutput.innerHTML = showDists.map((d) => {
      const coef = VelocistiCalc.COEF.find(([dd]) => dd === d)[1];
      return `<div class="calc-out-tile"><b>${escapeHtml(VelocistiCalc.formatSeconds(max100 * coef))}</b><span>${d} m</span></div>`;
    }).join('');
  }

  const kmh = (100 / max100 * 3.6).toFixed(1).replace('.', ',');
  if (calcSprintStatus) {
    calcSprintStatus.innerHTML = `Massimali stimati da un 100 in <b>${escapeHtml(VelocistiCalc.formatSeconds(max100))}</b> — velocità media sui 100: ${kmh} km/h.`;
  }
  if (calcSprintPrintSettings) {
    calcSprintPrintSettings.textContent = `Atleta con 100 m in ${VelocistiCalc.formatSeconds(max100)}. Tempi in percentuale del massimale sulla distanza.`;
  }

  calcSprintValue = calcSprintInput.value;
  saveCalcSprintState();
}

function initCalcSprintModule() {
  readCalcSprintState();
  calcSprintInput.value = calcSprintValue || CALC_SPRINT_DEFAULT;
  renderCalcSprint();
}

if (calcSprintInput) {
  calcSprintInput.addEventListener('input', renderCalcSprint);
}

// --- Modulo 3: Mezzofondo e fondo dalla VAM --------------------------------
const CALC_FONDO_STORAGE_KEY = 'lapsi-calc-mezzofondo';
const CALC_FONDO_SRC_OPTIONS = [['vam', 'VAM in km/h'], ['k', '1000 massimale']];

const calcFondoSrcChips = document.getElementById('mezzofondo-src-chips');
const calcFondoInput = document.getElementById('mezzofondo-val');
const calcFondoInputLabel = document.getElementById('mezzofondo-val-label');
const calcFondoWarning1000 = document.getElementById('mezzofondo-warning-1000');
const calcFondoOutput = document.getElementById('mezzofondo-output');
const calcFondoStatus = document.getElementById('mezzofondo-status');
const calcFondoPrintSettings = document.getElementById('mezzofondo-print-settings');
const calcFondoHeadA = document.getElementById('mezzofondo-head-a');
const calcFondoHeadB = document.getElementById('mezzofondo-head-b');
const calcFondoBodyA = document.getElementById('mezzofondo-body-a');
const calcFondoBodyB = document.getElementById('mezzofondo-body-b');

let calcFondoState = { src: 'vam', v: '14' };
// Cifre "vere" del campo quando la sorgente è "1000 massimale" — stessa
// tecnica di formatTimeMask del modulo 1 (vedi lì per il perché).
let calcFondoDigits = '';

function readCalcFondoState() {
  try {
    const raw = localStorage.getItem(CALC_FONDO_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      if (saved.src === 'vam' || saved.src === 'k') {
        calcFondoState.src = saved.src;
      }
      if (typeof saved.v === 'string') {
        calcFondoState.v = saved.v;
      }
    }
  } catch (error) {
    console.warn('Impossibile leggere le impostazioni di "Mezzofondo e fondo":', error);
  }
}

function saveCalcFondoState() {
  try {
    localStorage.setItem(CALC_FONDO_STORAGE_KEY, JSON.stringify(calcFondoState));
  } catch (error) {
    console.warn('Impossibile salvare le impostazioni di "Mezzofondo e fondo":', error);
  }
}

function buildCalcFondoSrcChips() {
  if (!calcFondoSrcChips) {
    return;
  }
  calcFondoSrcChips.innerHTML = CALC_FONDO_SRC_OPTIONS.map(([value, label]) => `
    <button type="button" class="fchip" data-value="${value}">${escapeHtml(label)}</button>
  `).join('');
  setChipGroupSelection(calcFondoSrcChips, calcFondoState.src);
}

function applyCalcFondoMask() {
  calcFondoInput.value = formatTimeMask(calcFondoDigits);
  const end = calcFondoInput.value.length;
  calcFondoInput.setSelectionRange(end, end);
}

function calcFondoCurrentVam() {
  return calcFondoState.src === 'vam'
    ? MezzofondoCalc.parseVam(calcFondoInput.value)
    : MezzofondoCalc.parseThousandToVam(calcFondoInput.value);
}

function calcFondoHeadMarkup() {
  return `<tr><th scope="col">VAM</th>${MezzofondoCalc.ZONES.map(([label]) => `<th scope="col">${escapeHtml(label)}</th>`).join('')}</tr>`;
}

function calcFondoRowMarkup(vam) {
  const label = vam.toFixed(1).replace('.', ',');
  const cells = MezzofondoCalc.ZONES.map(([, pct]) => `<td>${MezzofondoCalc.formatPace(MezzofondoCalc.paceMinPerKm(vam, pct))}</td>`).join('');
  const isAnchor = Math.abs(vam - Math.round(vam)) < 0.01;
  return `<tr${isAnchor ? ' class="calc-anchor"' : ''} data-label="${escapeHtml(label)}" tabindex="0"><th scope="row">${escapeHtml(label)}</th>${cells}</tr>`;
}

// VAM da 10,0 a 20,0 a passo 0,5 (21 righe), spezzate 11 + 10 come nel prototipo.
function renderCalcFondoTable() {
  if (!calcFondoBodyA || !calcFondoBodyB) {
    return;
  }
  const rowsA = [];
  const rowsB = [];
  let i = 0;
  for (let n = 100; n <= 200; n += 5) {
    const vam = n / 10;
    (i < 11 ? rowsA : rowsB).push(calcFondoRowMarkup(vam));
    i += 1;
  }
  calcFondoBodyA.innerHTML = rowsA.join('');
  calcFondoBodyB.innerHTML = rowsB.join('');
}

function renderCalcFondo() {
  if (calcFondoHeadA) calcFondoHeadA.innerHTML = calcFondoHeadMarkup();
  if (calcFondoHeadB) calcFondoHeadB.innerHTML = calcFondoHeadMarkup();
  renderCalcFondoTable();

  const isFromThousand = calcFondoState.src === 'k';
  if (calcFondoWarning1000) {
    calcFondoWarning1000.hidden = !isFromThousand;
  }

  const vam = calcFondoCurrentVam();
  const dec1 = (n) => n.toFixed(1).replace('.', ',');

  if (!vam) {
    if (calcFondoStatus) {
      calcFondoStatus.textContent = isFromThousand
        ? 'Inserisci il tempo sul 1000 corso al massimo, per esempio 4\'00".'
        : 'Inserisci la VAM in km/h, per esempio 14 oppure 13,5.';
    }
    if (calcFondoOutput) {
      calcFondoOutput.hidden = true;
      calcFondoOutput.innerHTML = '';
    }
    calcMarkRow(null);
    if (calcFondoPrintSettings) {
      calcFondoPrintSettings.textContent = '';
    }
    calcFondoState.v = calcFondoInput.value;
    saveCalcFondoState();
    return;
  }

  if (calcFondoOutput) {
    calcFondoOutput.hidden = false;
    calcFondoOutput.innerHTML = MezzofondoCalc.pacesForVam(vam)
      .map(({ label, minutes }) => `<div class="calc-out-tile"><b>${escapeHtml(MezzofondoCalc.formatPace(minutes))}</b><span>${escapeHtml(label)}</span></div>`)
      .join('');
  }

  const extra = isFromThousand
    ? `Dal 1000 in ${escapeHtml(calcFondoInput.value)} esce una VAM di <b>${dec1(vam)} km/h</b>. `
    : `VAM <b>${dec1(vam)} km/h</b>. `;
  if (calcFondoStatus) {
    calcFondoStatus.innerHTML = `${extra}Ritmi al chilometro; le ultime due colonne sono anche il tempo della ripetuta.`;
  }
  if (calcFondoPrintSettings) {
    calcFondoPrintSettings.textContent = `VAM di riferimento: ${dec1(vam)} km/h. Ritmi al chilometro.`;
  }

  const near = Math.round(vam * 2) / 2;
  calcMarkRow(near >= 10 && near <= 20 ? dec1(near) : null);

  calcFondoState.v = calcFondoInput.value;
  saveCalcFondoState();
}

function initCalcMezzofondoModule() {
  readCalcFondoState();
  buildCalcFondoSrcChips();
  if (calcFondoInputLabel) {
    calcFondoInputLabel.textContent = calcFondoState.src === 'vam' ? 'VAM' : '1000 in';
  }
  calcFondoInput.placeholder = calcFondoState.src === 'vam' ? '14' : '3\'47"';
  if (calcFondoState.src === 'k') {
    calcFondoDigits = String(calcFondoState.v || '').replace(/[^0-9]/g, '').slice(0, 4);
    applyCalcFondoMask();
  } else {
    calcFondoInput.value = calcFondoState.v || '14';
  }
  renderCalcFondo();
}

if (calcFondoSrcChips) {
  calcFondoSrcChips.addEventListener('click', (event) => {
    const chip = event.target.closest('.fchip');
    if (!chip || chip.dataset.value === calcFondoState.src) {
      return;
    }
    calcFondoState.src = chip.dataset.value;
    setChipGroupSelection(calcFondoSrcChips, calcFondoState.src);
    if (calcFondoInputLabel) {
      calcFondoInputLabel.textContent = calcFondoState.src === 'vam' ? 'VAM' : '1000 in';
    }
    if (calcFondoState.src === 'vam') {
      calcFondoInput.placeholder = '14';
      calcFondoInput.value = '14';
    } else {
      calcFondoInput.placeholder = '3\'47"';
      calcFondoDigits = '400';
      applyCalcFondoMask();
    }
    renderCalcFondo();
  });
}
if (calcFondoInput) {
  calcFondoInput.addEventListener('keydown', (event) => {
    if (calcFondoState.src !== 'k') {
      return;
    }
    if (event.key !== 'Backspace' && event.key !== 'Delete') {
      return;
    }
    event.preventDefault();
    calcFondoDigits = calcFondoDigits.slice(0, -1);
    applyCalcFondoMask();
    renderCalcFondo();
  });
  calcFondoInput.addEventListener('input', () => {
    if (calcFondoState.src === 'k') {
      calcFondoDigits = calcFondoInput.value.replace(/[^0-9]/g, '').slice(0, 4);
      applyCalcFondoMask();
    }
    renderCalcFondo();
  });
}

async function initializeApp() {
  populateInsertionFields();
  await readEntries();
  await checkExpiredConcorsi();
  renderEntries();
  readVelocisti();
  renderVelocisti();
}

initializeApp();
