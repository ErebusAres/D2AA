import { state, setState, setRows } from './state.js';
import { connectBungie, initializeBungieSync, scheduleSemiLiveRefresh, shouldRefreshOnFocus, syncBungieInventory } from './data/bungie-sync.js?v=clean62';
import { isSignedIn } from './data/bungie-auth.js?v=clean62';

const setStatus = (status) => setState({ status });
const hasRows = () => state.rows.length > 0;
const ROW_CACHE_KEY = 'd2aa_clean_rows_v1';
const LIVE_REFRESH_MS = 60000;
const LIVE_MIN_GAP_MS = 25000;

let lastLiveRefreshAt = 0;
let liveRefreshTimer = null;
let controlsBound = false;

function bindBungieControls() {
  if (controlsBound) return;
  controlsBound = true;
  refreshLoginState();
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#bungieLoginBtn,#bungieSyncBtn,#refreshBtn');
    if (!button) return;
    if (button.id === 'bungieLoginBtn') {
      event.preventDefault();
      connectBungie();
      return;
    }
    if (button.id === 'bungieSyncBtn') {
      event.preventDefault();
      runSync('manual-sync');
      return;
    }
    if (button.id === 'refreshBtn') {
      event.preventDefault();
      runSync('refresh-button');
    }
  });
  window.addEventListener('d2aa:bungie-sync-request', (event) => {
    const detail = event.detail || {};
    runSync(detail.reason || 'app-request', Boolean(detail.background));
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && shouldRefreshOnFocus()) requestLiveRefresh('focus-refresh');
  });
  window.addEventListener('online', () => requestLiveRefresh('network-online'));
}

async function runSync(reason, background = false) {
  clearOversizedGenericCache();
  const startedVisibleRows = state.rows.length;
  const result = await syncBungieInventory({ setStatus, setRows, reason, background });
  refreshLoginState();
  if (result) {
    lastLiveRefreshAt = Date.now();
    clearOversizedGenericCache();
    scheduleSemiLiveRefresh({ setStatus, setRows, hasRows, delay: LIVE_REFRESH_MS });
    scheduleLivePulse();
    if (background && startedVisibleRows && result.meta) {
      const changed = Number(result.meta.added || 0) + Number(result.meta.moved || 0) + Number(result.meta.changed || 0);
      if (!changed) setStatus(`Live state current. Last checked ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
    }
  }
}

function requestLiveRefresh(reason) {
  if (!isSignedIn()) return refreshLoginState();
  if (document.hidden || !navigator.onLine) return;
  if (Date.now() - lastLiveRefreshAt < LIVE_MIN_GAP_MS) return;
  runSync(reason, true);
}

function scheduleLivePulse() {
  clearTimeout(liveRefreshTimer);
  if (!isSignedIn()) return;
  liveRefreshTimer = setTimeout(() => {
    requestLiveRefresh('live-state-pulse');
    scheduleLivePulse();
  }, LIVE_REFRESH_MS);
}

function refreshLoginState() {
  const login = document.getElementById('bungieLoginBtn');
  const sync = document.getElementById('bungieSyncBtn');
  const signedIn = isSignedIn();
  if (login) {
    const label = login.querySelector('b');
    const detail = login.querySelector('small');
    if (label) label.textContent = signedIn ? 'Destiny Account Connected' : 'Connect Destiny Account';
    if (detail) detail.textContent = signedIn ? 'Session remembered; refresh uses Bungie token' : 'Bungie OAuth login';
    login.disabled = false;
  }
  if (sync) sync.disabled = false;
  document.body.classList.toggle('bungie-signed-in', signedIn);
}

function clearOversizedGenericCache() {
  try {
    const value = localStorage.getItem(ROW_CACHE_KEY) || '';
    if (value.length > 750000) localStorage.removeItem(ROW_CACHE_KEY);
  } catch (_) {}
}

async function bootBungieSidecar() {
  clearOversizedGenericCache();
  bindBungieControls();
  try {
    await initializeBungieSync({ setStatus, setRows, hasRows });
    refreshLoginState();
    scheduleLivePulse();
  } catch (error) {
    console.error('D2AA clean Bungie sidecar failed', error);
    setStatus(error.message || String(error));
    refreshLoginState();
  }
}

bootBungieSidecar();