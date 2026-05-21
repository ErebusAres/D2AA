import { state, setState, setRows, updateTag } from './state.js';
import { connectBungie, initializeBungieSync, scheduleSemiLiveRefresh, shouldRefreshOnFocus, syncBungieInventory } from './data/bungie-sync.js?v=clean62';
import { isSignedIn } from './data/bungie-auth.js?v=clean62';
import { syncDimTags, clearDimApiKey } from './data/dim-tags.js?v=1.6';

const setStatus = (status) => setState({ status });
const hasRows = () => state.rows.length > 0;
const ROW_CACHE_KEY = 'd2aa_clean_rows_v1';
const LIVE_REFRESH_MS = 60000;
const ITEM_FEED_CHECK_MS = 45000;
const LIVE_MIN_GAP_MS = 20000;
const MIN_FEED_SPINNER_MS = 1200;

let lastLiveRefreshAt = 0;
let liveRefreshTimer = null;
let itemFeedPollTimer = null;
let feedPollingClearTimer = null;
let feedPollingStartedAt = 0;
let controlsBound = false;
let activeSyncReason = '';
let lastSyncSummary = 'Live feed waiting';

const dataButtonHtml = (icon, label, detail) => `<span>${icon}</span><b>${label}</b><small>${detail}</small>`;

function bindBungieControls() {
  if (controlsBound) return;
  controlsBound = true;
  refreshLoginState();
  ensureDimSyncButton();
  updateLiveDiagnostics('idle', 'Live feed waiting');

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#bungieLoginBtn,#bungieSyncBtn,#refreshBtn,#dimTagSyncBtn,#dimTagResetBtn');
    if (!button) return;
    if (button.id === 'bungieLoginBtn') { event.preventDefault(); connectBungie(); return; }
    if (button.id === 'bungieSyncBtn') { event.preventDefault(); runSync('manual-sync'); return; }
    if (button.id === 'refreshBtn') { event.preventDefault(); runSync('refresh-button'); return; }
    if (button.id === 'dimTagSyncBtn') { event.preventDefault(); if (!button.disabled) runDimTagSync(button); return; }
    if (button.id === 'dimTagResetBtn') { event.preventDefault(); clearDimApiKey(); setStatus('DIM API key/token cleared from this browser.'); updateDimSyncAvailability(); }
  });

  window.addEventListener('d2aa:bungie-sync-request', (event) => {
    const detail = event.detail || {};
    runSync(detail.reason || 'app-request', Boolean(detail.background));
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateLiveDiagnostics('queued', 'Tab active · sync queued');
      if (shouldRefreshOnFocus()) requestLiveRefresh('tab-visible', true);
      scheduleItemFeedPoll(3000);
    } else {
      setFeedPolling(false, '', true);
      updateLiveDiagnostics('paused', 'Tab hidden · polling paused');
      scheduleItemFeedPoll();
    }
  });

  window.addEventListener('focus', () => {
    updateLiveDiagnostics('queued', 'Window focused · sync queued');
    if (shouldRefreshOnFocus()) requestLiveRefresh('window-focus', true);
    scheduleItemFeedPoll(3000);
  });
  window.addEventListener('blur', () => { setFeedPolling(false, '', true); updateLiveDiagnostics('paused', 'Window blurred · polling paused'); });
  window.addEventListener('online', () => requestLiveRefresh('network-online', true));
  window.addEventListener('offline', () => { setFeedPolling(false, '', true); updateLiveDiagnostics('offline', 'Offline · waiting for network'); });
}

async function runSync(reason, background = false) {
  if (activeSyncReason) {
    updateLiveDiagnostics('busy', `Already syncing · ${shortReason(activeSyncReason)}`);
    return;
  }
  if (!isSignedIn()) {
    refreshLoginState();
    updateLiveDiagnostics('signed-out', 'Not connected · Bungie login needed');
    return setStatus('Connect your Destiny account before syncing armor.');
  }

  activeSyncReason = reason;
  setFeedPolling(true, reason);
  updateLiveDiagnostics('syncing', `Checking Bungie · ${shortReason(reason)}`);
  clearOversizedGenericCache();
  const visibleBefore = state.rows.length;

  try {
    if (background) setStatus(`Live feed checking… ${shortReason(reason)}`);
    const result = await syncBungieInventory({ setStatus, setRows, reason, background });
    refreshLoginState();

    if (result?.error) {
      const message = result.message || 'Unknown sync error';
      updateLiveDiagnostics('error', `Sync failed · ${message}`);
      setStatus(`Bungie sync failed: ${message}`);
      return;
    }

    if (result) {
      lastLiveRefreshAt = Date.now();
      clearOversizedGenericCache();
      scheduleSemiLiveRefresh({ setStatus, setRows, hasRows, delay: LIVE_REFRESH_MS });
      scheduleLivePulse();
      scheduleItemFeedPoll();

      const meta = result.meta || {};
      const added = Number(meta.added || 0);
      const checked = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      lastSyncSummary = added
        ? `Checked ${checked} · New ${added}`
        : `Checked ${checked} · No new armor`;
      updateLiveDiagnostics(added ? 'new' : 'current', lastSyncSummary);
      if (background || visibleBefore) {
        setStatus(added
          ? `Live feed updated ${checked}. New armor: ${added}.`
          : `Live feed current ${checked}. No new armor found.`);
      }
    } else {
      updateLiveDiagnostics('waiting', `Sync skipped · ${lastSyncSummary}`);
    }
  } catch (error) {
    console.error('D2AA Bungie sync failed', error);
    const message = error?.message || String(error);
    updateLiveDiagnostics('error', `Sync failed · ${message}`);
    setStatus(`Bungie sync failed: ${message}`);
  } finally {
    activeSyncReason = '';
    setFeedPolling(false);
  }
}

async function runDimTagSync(button) {
  const original = button?.innerHTML || '';
  if (button) button.innerHTML = dataButtonHtml('⌁', 'Syncing DIM Tags...', 'Read-only pull');
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
    if (button) setTimeout(() => { button.innerHTML = original; updateDimSyncAvailability(); }, 1200);
  }
}

function ensureDimSyncButton() {
  if (document.getElementById('dimTagSyncBtn')) return;
  const sync = document.getElementById('bungieSyncBtn');
  const host = sync?.parentElement;
  if (!host) return;
  const button = document.createElement('button');
  button.id = 'dimTagSyncBtn';
  button.type = 'button';
  button.className = `${sync?.className || 'option-button'} data-secondary-card`;
  host.appendChild(button);
  const reset = document.createElement('button');
  reset.id = 'dimTagResetBtn';
  reset.type = 'button';
  reset.className = `${sync?.className || 'option-button'} data-secondary-card data-reset-card`;
  reset.innerHTML = dataButtonHtml('⟲', 'Reset DIM Key', 'Clear local DIM API token');
  host.appendChild(reset);
  updateDimSyncAvailability();
}

function updateDimSyncAvailability() {
  const button = document.getElementById('dimTagSyncBtn');
  if (!button) return;
  if (canRunLiveDimSync()) {
    button.disabled = false;
    button.title = '';
    button.innerHTML = dataButtonHtml('⌁', 'Sync DIM Tags', 'Pull favorite/keep/junk/infuse/archive');
  } else {
    button.disabled = true;
    button.title = 'DIM blocks automatic app registration from GitHub Pages.';
    button.innerHTML = dataButtonHtml('⌁', 'DIM Tags Unavailable', 'Use DIM CSV import for tags');
  }
}

function canRunLiveDimSync() {
  const host = window.location.hostname || 'localhost';
  const hasKey = Boolean(localStorage.getItem('d2aa_dim_api_key_v1') || localStorage.getItem('dimApiKey') || window.D2AA_DIM_API_KEY);
  const localHost = host === 'localhost' || host === '127.0.0.1';
  return hasKey || localHost;
}

function requestLiveRefresh(reason, bypassGap = false) {
  if (!isSignedIn()) return refreshLoginState();
  if (!isPageLive()) return scheduleItemFeedPoll();
  if (!bypassGap && Date.now() - lastLiveRefreshAt < LIVE_MIN_GAP_MS) {
    updateLiveDiagnostics('waiting', `Waiting · next check soon · ${lastSyncSummary}`);
    return;
  }
  runSync(reason, true);
}

function scheduleLivePulse() {
  clearTimeout(liveRefreshTimer);
  if (!isSignedIn()) return refreshLoginState();
  liveRefreshTimer = setTimeout(() => {
    requestLiveRefresh('live-pulse');
    scheduleLivePulse();
  }, LIVE_REFRESH_MS);
}

function scheduleItemFeedPoll(delay = ITEM_FEED_CHECK_MS) {
  clearTimeout(itemFeedPollTimer);
  if (!isSignedIn()) return refreshLoginState();
  updateLiveDiagnostics(lastLiveRefreshAt ? 'waiting' : 'queued', lastLiveRefreshAt ? `Next feed check queued · ${lastSyncSummary}` : 'Initial feed check queued');
  itemFeedPollTimer = setTimeout(() => {
    if (isPageLive()) requestLiveRefresh('item-feed-poll');
    scheduleItemFeedPoll();
  }, delay);
}

function setFeedPolling(active, reason = '', immediate = false) {
  clearTimeout(feedPollingClearTimer);
  const feed = document.getElementById('itemFeed');
  if (active) {
    feedPollingStartedAt = Date.now();
    document.body.classList.add('feed-polling');
    if (feed) feed.dataset.pollingReason = reason || 'syncing';
    return;
  }
  const clear = () => {
    document.body.classList.remove('feed-polling');
    if (feed) feed.dataset.pollingReason = '';
    feedPollingStartedAt = 0;
  };
  if (immediate || !feedPollingStartedAt) return clear();
  const elapsed = Date.now() - feedPollingStartedAt;
  feedPollingClearTimer = setTimeout(clear, Math.max(0, MIN_FEED_SPINNER_MS - elapsed));
}

function updateLiveDiagnostics(stateName, message) {
  const feed = document.getElementById('itemFeed');
  if (feed) {
    feed.dataset.liveState = stateName;
    feed.dataset.liveText = message;
    feed.title = message;
    const title = feed.querySelector('.feed-head strong');
    if (title) title.dataset.liveText = message;
  }
  document.body.dataset.liveFeedState = stateName;
}

function isPageLive() {
  return !document.hidden && navigator.onLine && (document.hasFocus?.() ?? true);
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
  updateDimSyncAvailability();
  if (!signedIn) updateLiveDiagnostics('signed-out', 'Not connected · Bungie login needed');
}

function clearOversizedGenericCache() {
  try {
    const value = localStorage.getItem(ROW_CACHE_KEY) || '';
    if (value.length > 750000) localStorage.removeItem(ROW_CACHE_KEY);
  } catch (_) {}
}

function shortReason(reason) {
  return String(reason || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

async function bootBungieSidecar() {
  clearOversizedGenericCache();
  bindBungieControls();
  try {
    await initializeBungieSync({ setStatus, setRows, hasRows });
    refreshLoginState();
    scheduleLivePulse();
    scheduleItemFeedPoll(isSignedIn() ? 3000 : ITEM_FEED_CHECK_MS);
  } catch (error) {
    console.error('D2AA clean Bungie sidecar failed', error);
    updateLiveDiagnostics('error', error.message || String(error));
    setStatus(error.message || String(error));
    refreshLoginState();
  }
}

bootBungieSidecar();