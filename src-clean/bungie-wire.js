import { state, setState, setRows, updateTag } from './state.js';
import { connectBungie, initializeBungieSync, scheduleSemiLiveRefresh, shouldRefreshOnFocus, syncBungieInventory } from './data/bungie-sync.js?v=clean62';
import { isSignedIn } from './data/bungie-auth.js?v=clean62';
import { syncDimTags, clearDimApiKey } from './data/dim-tags.js?v=1.1';

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
  ensureDimSyncButton();
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#bungieLoginBtn,#bungieSyncBtn,#refreshBtn,#dimTagSyncBtn,#dimTagResetBtn');
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
      return;
    }
    if (button.id === 'dimTagSyncBtn') {
      event.preventDefault();
      runDimTagSync(button);
      return;
    }
    if (button.id === 'dimTagResetBtn') {
      event.preventDefault();
      clearDimApiKey();
      setStatus('DIM API key/token cleared from this browser.');
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

async function runDimTagSync(button) {
  const original = button?.innerHTML || '';
  if (button) button.innerHTML = '<b>Syncing DIM Tags...</b><small>Read-only pull</small>';
  try {
    const result = await syncDimTags({ setStatus });
    let changed = 0;
    state.rows.forEach((row) => {
      const tag = result.tags?.[row.InstanceId || row.Id] || result.tags?.[row.Id];
      if (tag && tag !== row.Tag) {
        updateTag(row.Id, tag);
        changed += 1;
      }
    });
    setStatus(`DIM tag sync complete. Applied ${changed} matching tags from ${result.count} DIM-tagged items.`);
  } catch (error) {
    console.error('D2AA DIM tag sync failed', error);
    setStatus(error.message || String(error));
  } finally {
    if (button) setTimeout(() => { button.innerHTML = original; }, 1200);
  }
}

function ensureDimSyncButton() {
  if (document.getElementById('dimTagSyncBtn')) return;
  const sync = document.getElementById('bungieSyncBtn');
  const host = sync?.parentElement || document.querySelector('.sync-actions') || document.querySelector('.option-card');
  if (!host) return;
  const button = document.createElement('button');
  button.id = 'dimTagSyncBtn';
  button.type = 'button';
  button.className = sync?.className || 'option-button';
  button.innerHTML = '<b>Sync DIM Tags</b><small>Pull favorite/keep/junk/infuse/archive</small>';
  host.appendChild(button);
  const reset = document.createElement('button');
  reset.id = 'dimTagResetBtn';
  reset.type = 'button';
  reset.className = sync?.className || 'option-button';
  reset.innerHTML = '<b>Reset DIM Key</b><small>Clear local DIM API token</small>';
  host.appendChild(reset);
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