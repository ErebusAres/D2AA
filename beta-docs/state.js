import { STORAGE_KEY } from './utils.js';

export const appState = {
  source: 'csv',
  rows: [],
  groupedRows: [],
  classFilter: 'All',
  slotFilter: 'All',
  rarityFilter: 'All',
  dupesFilter: 'All',
  tol: 5,
  sameNameOnly: false,
  view: 'base',
  accessToken: null,
  membershipId: null,
  membershipType: null,
  dim: { accessToken: null, expires: 0, reason: null },
  dimTagsByInstanceId: {},
  listeners: new Set()
};

function notify() {
  for (const listener of appState.listeners) {
    try {
      listener(appState);
    } catch (err) {
      console.error('state listener failed', err);
    }
  }
}

export function subscribe(listener) {
  appState.listeners.add(listener);
  return () => appState.listeners.delete(listener);
}

export function patchState(patch) {
  Object.assign(appState, patch);
  notify();
}

export function setRows(rows, { source = appState.source } = {}) {
  appState.rows = Array.isArray(rows) ? rows : [];
  appState.source = source;
  notify();
}

export function setDimTags(map) {
  appState.dimTagsByInstanceId = map || {};
  notify();
}

export function updateDimAuth(dimState) {
  if (dimState && typeof dimState === 'object') {
    appState.dim = {
      accessToken: null,
      expires: 0,
      reason: null,
      ...dimState
    };
  } else {
    appState.dim = { accessToken: null, expires: 0, reason: null };
  }
  notify();
}

export function saveRowsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.rows));
  } catch (err) {
    console.warn('Failed to persist rows', err);
  }
}

export function loadRowsFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to read cached rows', err);
  }
  return null;
}
