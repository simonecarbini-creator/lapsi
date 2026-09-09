const APP_BUILD = '2026-09-09m';
console.log('[Lapsi] build', APP_BUILD, '— persistenza su localStorage (deploy statico)');

const STORAGE_KEY = 'run-tracker-athletes';
const ACTIVITY_OPTIONS = [
  { label: '100mt', meters: 100 },
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
const athleteSearchInput = document.getElementById('athlete-search');
const distanceChips = document.getElementById('distance-chips');
const sortChips = document.getElementById('sort-chips');
const filtersApplyButton = document.getElementById('filters-apply');
const filtersResetButton = document.getElementById('filters-reset');
const athleteSuggestions = document.getElementById('athlete-suggestions');

const FILTER_DEFAULTS = { distance: 'Tutte', sort: 'best' };
// activeDistance/activeSort = ciò che la lista mostra ora (anche l'anteprima live
// mentre il pannello filtri è aperto). filterSnapshot = valori confermati da
// ripristinare se si chiude senza premere "Applica".
let activeDistance = FILTER_DEFAULTS.distance;
let activeSort = FILTER_DEFAULTS.sort;
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
const appShell = document.querySelector('.app-shell');
const enterMilitariButton = document.getElementById('enter-militari');
const backHomeButton = document.getElementById('back-home');

if (splashScreen) {
  setTimeout(() => {
    splashScreen.classList.add('is-hiding');
    setTimeout(() => splashScreen.remove(), 550);
  }, 2800);
}

function showAppSection() {
  if (homeScreen) homeScreen.hidden = true;
  if (appShell) appShell.hidden = false;
  window.scrollTo(0, 0);
}

function showHomeScreen() {
  if (appShell) appShell.hidden = true;
  if (homeScreen) homeScreen.hidden = false;
  window.scrollTo(0, 0);
}

if (enterMilitariButton) {
  enterMilitariButton.addEventListener('click', showAppSection);
}
if (backHomeButton) {
  backHomeButton.addEventListener('click', showHomeScreen);
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

function normalizeAthlete(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

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
    activeDistance = FILTER_DEFAULTS.distance;
    activeSort = FILTER_DEFAULTS.sort;
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
    return activityMatch && searchMatch;
  });

  filtered.sort((a, b) => {
    if (sortValue === 'az' || sortValue === 'za') {
      const aName = `${a.name} ${a.surname}`.trim().toLowerCase();
      const bName = `${b.name} ${b.surname}`.trim().toLowerCase();
      const cmp = aName.localeCompare(bName, 'it');
      return sortValue === 'az' ? cmp : -cmp;
    }

    if (sortValue === 'recent' || sortValue === 'oldest') {
      const aDate = new Date(getLatestAthleteTime(a)?.createdAt || 0).getTime();
      const bDate = new Date(getLatestAthleteTime(b)?.createdAt || 0).getTime();
      return sortValue === 'recent' ? bDate - aDate : aDate - bDate;
    }

    const aBest = getBestAthleteTime(a);
    const bBest = getBestAthleteTime(b);
    const aSeconds = aBest ? parseTimeToSeconds(aBest.time) : Number.MAX_SAFE_INTEGER;
    const bSeconds = bBest ? parseTimeToSeconds(bBest.time) : Number.MAX_SAFE_INTEGER;
    return sortValue === 'worst' ? bSeconds - aSeconds : aSeconds - bSeconds;
  });

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
  const pastSection = (pastRuns.length || pastJumps.length) ? `
    <div class="edit-section">
      <div class="edit-section-title">Modifica risultati precedenti</div>
      <div class="edit-subgroup">
        <div class="edit-subtitle">Corsa</div>
        ${pastRuns.length ? pastRuns.map(pastRunRow).join('') : '<div class="edit-past-empty">Nessun risultato</div>'}
      </div>
      <div class="edit-subgroup">
        <div class="edit-subtitle">Salto in alto</div>
        ${pastJumps.length ? pastJumps.map(pastJumpRow).join('') : '<div class="edit-past-empty">Nessun risultato</div>'}
      </div>
    </div>
  ` : '';

  editForm.innerHTML = `
    <div class="edit-section">
      <div class="edit-section-title">Anagrafica</div>
      <div class="field-group">
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

    <div class="edit-section">
      <div class="edit-section-title">Aggiungi risultati</div>
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
      </div>
      <div class="field-group">
        <label>Salto in alto</label>
        <select name="edit-new-foot">
          <option value="">Piede di stacco</option>
          <option value="Sinistro">Sinistro</option>
          <option value="Destro">Destro</option>
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
      </div>
    </div>

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

  return editForm;
}

function formatConcorsoDate() {
  const dayInput = document.getElementById('concorsoDay');
  const monthInput = document.getElementById('concorsoMonth');
  const yearInput = document.getElementById('concorsoYear');

  if (!dayInput || !monthInput || !yearInput) {
    return '';
  }

  return `${pad(Number(dayInput.value) || 0)}/${pad(Number(monthInput.value) || 0)}/${pad(Number(yearInput.value) || 0)}`;
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

  return '<svg class="foot-icon" viewBox="0 0 32 22" width="34" height="22" aria-hidden="true" focusable="false">'
    + single(2, foot === 'Sinistro')
    + single(17, foot === 'Destro')
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
  const scaleFor = (points, { invert = false, snap = 0 } = {}) => {
    const values = points.map((point) => point.v);
    let lo = Math.min(...values);
    let hi = Math.max(...values);

    if (snap) {
      const unit = Math.round(snap * 100);
      let loUnits = Math.floor(Math.round(lo * 100) / unit) * unit;
      let hiUnits = Math.ceil(Math.round(hi * 100) / unit) * unit;
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
    const scale = scaleFor(runPoints, { invert: true });
    runLayer = seriesSvg(runPoints, scale, CHART_RUN_COLOR);
    runTicks = axisTicks(scale, formatChartClock, mL - 5, 'end', CHART_RUN_COLOR);
  }

  let jumpLayer = '';
  let jumpTicks = '';
  if (hasJump) {
    const scale = scaleFor(jumpPoints, { snap: 0.05 });
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
        <span><i style="background:${CHART_RUN_COLOR}"></i>Corsa</span>
        <span><i style="background:${CHART_JUMP_COLOR}"></i>Salto in alto</span>
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

// Paginazione adattiva: numeri se poche pagine, "Pagina X / Y" se tante.
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

  const prev = `<button type="button" class="page-btn page-arrow" data-page="${currentPage - 1}" aria-label="Pagina precedente"${currentPage === 1 ? ' disabled' : ''}>‹</button>`;
  const next = `<button type="button" class="page-btn page-arrow" data-page="${currentPage + 1}" aria-label="Pagina successiva"${currentPage === totalPages ? ' disabled' : ''}>›</button>`;

  let middle = '';
  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page += 1) {
      middle += `<button type="button" class="page-btn${page === currentPage ? ' is-current' : ''}" data-page="${page}">${page}</button>`;
    }
  } else {
    middle = `<span class="page-label">Pagina ${currentPage} / ${totalPages}</span>`;
  }

  nav.innerHTML = prev + middle + next;
}

function renderEntries() {
  const entries = getFilteredEntries();
  const searchQuery = athleteSearchInput.value.trim().toLowerCase();
  athletesList.innerHTML = '';

  const countEl = document.getElementById('athlete-count');
  if (countEl) {
    countEl.textContent = String(entries.length);
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
      <div class="v2-head">
        ${avatarMarkup}
        <div class="v2-id">
          <div class="v2-name">${highlightMatch(entry.name, searchQuery)} ${highlightMatch(entry.surname, searchQuery)}</div>
          <div class="v2-meta">
            <span class="v2-corp">${escapeHtml(entry.military || 'Nessun corpo')}</span>
            <span class="v2-concorso">${targetIcon(11)}${escapeHtml(concorsoDate)}</span>
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

async function handleListClick(event) {
  const deleteButton = event.target.closest('.delete-btn');
  const projectionButton = event.target.closest('.projection-toggle');
  const editButton = event.target.closest('.edit-btn');
  const cancelButton = event.target.closest('.cancel-edit-btn');
  const suggestionButton = event.target.closest('.suggestion-item');
  const pastDeleteButton = event.target.closest('.past-del-btn');
  const notesButton = event.target.closest('.notes-btn');
  const notesClearButton = event.target.closest('.notes-clear');

  if (notesClearButton) {
    await handleNotesClear(notesClearButton);
    return;
  }

  if (notesButton) {
    await handleNotesAdd(notesButton);
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
      return;
    }

    if (editForm.hidden) {
      collapseOtherCards(item);
    }
    editForm.hidden = !editForm.hidden;
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
  const concorso = shortYearDate(now.date);
  const newId = () => `time-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const added = [];

  const newTime = formatTimeFromParts({
    hours: editVal('edit-nt-hours'),
    minutes: editVal('edit-nt-minutes'),
    seconds: editVal('edit-nt-seconds'),
    tenths: editVal('edit-nt-tenths'),
  });
  if (newTime !== '00:00:00.0') {
    added.push({
      id: newId(),
      activity: editForm.querySelector('[name="edit-new-activity"]').value || '1km',
      time: newTime,
      date: now.date,
      timeInserted: now.time,
      createdAt: now.iso,
      concorsoDate: concorso,
    });
  }

  const jumpM = editVal('edit-nh-m');
  const jumpCm = editVal('edit-nh-cm');
  const takeoffFoot = editForm.querySelector('[name="edit-new-foot"]').value;
  if (jumpM > 0 || jumpCm > 0 || takeoffFoot) {
    added.push({
      id: newId(),
      activity: 'Salto in alto',
      time: '00:00:00.0',
      date: now.date,
      timeInserted: now.time,
      createdAt: now.iso,
      concorsoDate: concorso,
      takeoffFoot,
      jumpHeight: `${jumpM}.${pad(jumpCm)}`,
    });
  }

  if (added.length) {
    const baseTs = Date.parse(now.iso);
    added.forEach((record, index) => {
      record.createdAt = new Date(baseTs + index).toISOString();
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

  updatedEntry.times = [...times, ...added];

  athletes[targetIndex] = updatedEntry;
  await saveEntries(athletes);
  renderEntries();
}

function exportEntriesAsJson() {
  const entries = getAthletes();

  if (!entries.length) {
    alert('Nessun dato da esportare.');
    return;
  }

  const blob = new Blob([JSON.stringify(entries, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'atleti-run.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

function initConcorsoDate(date = new Date()) {
  const dayInput = document.getElementById('concorsoDay');
  const monthInput = document.getElementById('concorsoMonth');
  const yearInput = document.getElementById('concorsoYear');
  const nativeInput = document.getElementById('concorso-date');

  if (!dayInput || !monthInput || !yearInput) {
    return;
  }

  dayInput.value = pad(date.getDate());
  monthInput.value = pad(date.getMonth() + 1);
  yearInput.value = pad(date.getFullYear() % 100);

  if (nativeInput) {
    nativeInput.value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}

function syncConcorsoFromNative() {
  const nativeInput = document.getElementById('concorso-date');
  if (!nativeInput || !nativeInput.value) {
    return;
  }
  const [year, month, day] = nativeInput.value.split('-').map(Number);
  if (year && month && day) {
    document.getElementById('concorsoDay').value = pad(day);
    document.getElementById('concorsoMonth').value = pad(month);
    document.getElementById('concorsoYear').value = pad(year % 100);
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
exportButton.addEventListener('click', exportEntriesAsJson);
athleteSearchInput.addEventListener('input', () => {
  currentPage = 1;
  renderEntries();
});

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
}

function revertFiltersDraft() {
  if (!filterSnapshot) {
    return;
  }
  activeDistance = filterSnapshot.distance;
  activeSort = filterSnapshot.sort;
  filterSnapshot = null;
  currentPage = 1;
  syncFilterChips();
  renderEntries();
}

[distanceChips, sortChips].forEach((group) => {
  group.addEventListener('click', (event) => {
    const chip = event.target.closest('.fchip');
    if (!chip || !group.contains(chip)) {
      return;
    }
    setChipGroupSelection(group, chip.dataset.value);
    if (group === distanceChips) {
      activeDistance = chip.dataset.value;
    } else {
      activeSort = chip.dataset.value;
    }
    currentPage = 1;
    renderEntries();
  });
});

filtersApplyButton.addEventListener('click', () => {
  filterSnapshot = null;
  setCollapsibleOpen(toggleFiltersButton, filtersPanel, false);
  toggleFiltersButton.setAttribute('aria-label', 'Mostra filtri');
});

filtersResetButton.addEventListener('click', () => {
  activeDistance = FILTER_DEFAULTS.distance;
  activeSort = FILTER_DEFAULTS.sort;
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
  document.body.classList.add('register-open');
  registerScreen.scrollTop = 0;
  populateInsertionFields();
  nameInput.focus();
}

function closeRegisterScreen() {
  registerScreen.hidden = true;
  document.body.classList.remove('register-open');
}

if (openRegisterButton) {
  openRegisterButton.addEventListener('click', openRegisterScreen);
}
if (closeRegisterButton) {
  closeRegisterButton.addEventListener('click', closeRegisterScreen);
}
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && registerScreen && !registerScreen.hidden) {
    closeRegisterScreen();
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
    filterSnapshot = { distance: activeDistance, sort: activeSort };
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

async function initializeApp() {
  populateInsertionFields();
  await readEntries();
  renderEntries();
}

initializeApp();
