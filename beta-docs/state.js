import { DEFAULT_TOLERANCE, STORAGE_KEYS } from './config.js';
import { safeJsonParse, safeJsonStringify } from './utils.js';

const FILTER_DEFAULTS = {
  classType: 'Any',
  rarity: 'Any',
  slot: 'Any',
  dupes: 'All',
};

export function createInitialState() {
  return {
    source: 'csv',
    rows: [],
    tol: DEFAULT_TOLERANCE,
    filters: { ...FILTER_DEFAULTS },
    view: 'BASE',
    manifest: {
      status: 'idle',
      lastLoaded: null,
      inventoryItem: {},
      statDefs: {},
      classDefs: {},
      energyDefs: {},
    },
    bungie: {
      status: 'idle',
      membershipId: null,
      membershipType: null,
      profile: null,
      characters: [],
      rawItems: [],
      tokens: null,
    },
    dim: {
      status: 'idle',
      token: null,
      tagsByInstance: new Map(),
      error: null,
    },
    messages: [],
    ui: {
      busy: false,
    },
  };
}

export class StateStore {
  constructor(initialState = createInitialState()) {
    this.state = initialState;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState() {
    return this.state;
  }

  setState(updater) {
    const next = typeof updater === 'function' ? updater(this.state) : updater;
    this.state = { ...this.state, ...next };
    this.emit();
  }

  patch(path, value) {
    const segments = Array.isArray(path) ? path : `${path}`.split('.');
    const next = structuredClone(this.state);
    let cursor = next;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const key = segments[i];
      if (!(key in cursor)) {
        cursor[key] = {};
      }
      cursor = cursor[key];
    }
    cursor[segments.at(-1)] = value;
    this.state = next;
    this.emit();
  }

  emit() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export function persistRows(rows) {
  try {
    localStorage.setItem(STORAGE_KEYS.rows, safeJsonStringify(rows));
  } catch (error) {
    console.warn('Unable to persist rows', error);
  }
}

export function restoreRows() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.rows);
    if (!raw) return null;
    const rows = safeJsonParse(raw);
    return Array.isArray(rows) ? rows : null;
  } catch (error) {
    console.warn('Unable to restore rows', error);
    return null;
  }
}

export function clearRows() {
  try {
    localStorage.removeItem(STORAGE_KEYS.rows);
  } catch (error) {
    console.warn('Unable to clear saved rows', error);
  }
}

export function persistBungieTokens(tokens) {
  try {
    sessionStorage.setItem(STORAGE_KEYS.bungieTokens, safeJsonStringify(tokens));
  } catch (error) {
    console.warn('Unable to persist Bungie tokens', error);
  }
}

export function restoreBungieTokens() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.bungieTokens);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed) return null;
    return parsed;
  } catch (error) {
    console.warn('Unable to restore Bungie tokens', error);
    return null;
  }
}

export function clearBungieTokens() {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.bungieTokens);
  } catch (error) {
    console.warn('Unable to clear Bungie tokens', error);
  }
}

export function persistDimTokens(tokens) {
  try {
    sessionStorage.setItem(STORAGE_KEYS.dimTokens, safeJsonStringify(tokens));
  } catch (error) {
    console.warn('Unable to persist DIM tokens', error);
  }
}

export function restoreDimTokens() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.dimTokens);
    if (!raw) return null;
    return safeJsonParse(raw);
  } catch (error) {
    console.warn('Unable to restore DIM tokens', error);
    return null;
  }
}

export function clearDimTokens() {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.dimTokens);
  } catch (error) {
    console.warn('Unable to clear DIM tokens', error);
  }
}

export function updateManifest(store, manifest) {
  store.setState((current) => ({
    manifest: {
      ...current.manifest,
      ...manifest,
      status: manifest?.status ?? current.manifest.status,
      lastLoaded: manifest?.lastLoaded ?? current.manifest.lastLoaded,
    },
  }));
}

export function updateMessages(store, message) {
  store.setState((current) => ({
    messages: message === null ? [] : [...current.messages, message],
  }));
}

export function setView(store, view) {
  store.setState({ view });
}

export function setTolerance(store, tol) {
  store.setState({ tol });
}

export function setRows(store, rows, source = 'csv') {
  store.setState({ rows, source });
  persistRows(rows);
}

export function resetFilters(store) {
  store.setState({ filters: { ...FILTER_DEFAULTS } });
}

export function updateFilter(store, key, value) {
  store.setState((current) => ({
    filters: {
      ...current.filters,
      [key]: value,
    },
  }));
}

export function updateBungieState(store, updater) {
  store.setState((current) => ({
    bungie: {
      ...current.bungie,
      ...(typeof updater === 'function' ? updater(current.bungie) : updater),
    },
  }));
}

export function updateDimState(store, updater) {
  store.setState((current) => ({
    dim: {
      ...current.dim,
      ...(typeof updater === 'function' ? updater(current.dim) : updater),
    },
  }));
}

export function setBusy(store, busy) {
  store.setState((current) => ({
    ui: {
      ...current.ui,
      busy,
    },
  }));
}
