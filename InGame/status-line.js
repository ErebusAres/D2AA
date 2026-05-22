import { state, subscribe } from '../src-clean/state.js';
import { isSignedIn } from '../src-clean/data/bungie-auth.js?v=clean62';

let lastShown = '';
let pendingTimer = 0;

function statusEl() { return document.getElementById('statusText'); }
function liveChip() { return document.getElementById('liveChip'); }

function show(text, liveState = '') {
  const target = statusEl();
  if (!target || !text || text === lastShown) return;
  lastShown = text;
  target.textContent = text;
  target.title = text;
  const live = liveChip();
  if (liveState && live) live.dataset.liveState = liveState;
}

function classify(raw) {
  const value = String(raw || '').trim();
  if (!navigator.onLine) return ['Offline. Waiting for network before Bungie sync can run.', 'error'];
  if (!isSignedIn()) return ['Need account connected. Connect Destiny Account before syncing armor.', 'signed-out'];
  if (/Fetching Bungie profile/i.test(value)) return ['Syncing Bungie: fetching profile...', 'syncing'];
  if (/Resolving item definitions/i.test(value)) return [value.replace('Resolving item definitions', 'Syncing Bungie: item definitions'), 'syncing'];
  if (/Resolving armor plugs/i.test(value)) return [value.replace('Resolving armor plugs', 'Syncing Bungie: armor plugs'), 'syncing'];
  if (/Resolving stat definitions/i.test(value)) return [value.replace('Resolving stat definitions', 'Syncing Bungie: stat definitions'), 'syncing'];
  if (/Building armor rows/i.test(value)) return [value.replace('Building armor rows', 'Syncing Bungie: building armor rows'), 'syncing'];
  if (/Bungie sync complete/i.test(value)) return [value, /New armor: [1-9]/i.test(value) ? 'new' : 'current'];
  if (/Loaded Bungie cache:/i.test(value)) return [`${value} Waiting for live sync or click Sync.`, 'waiting'];
  if (/Loaded \d+ cached clean rows/i.test(value)) return [`${value} Waiting for Bungie sidecar.`, 'waiting'];
  if (/No Bungie cache/i.test(value)) return [value, 'queued'];
  if (/Connect your Destiny|Need account connected/i.test(value)) return ['Need account connected. Connect Destiny Account before syncing armor.', 'signed-out'];
  if (/Already syncing/i.test(value)) return [value, 'busy'];
  if (/failed|error|invalid|expired/i.test(value)) return [value, 'error'];
  return [value || 'Ready.', isSignedIn() ? 'current' : 'signed-out'];
}

function update() {
  const result = classify(state.status);
  show(result[0], result[1]);
}

function schedulePending(label) {
  clearTimeout(pendingTimer);
  show(label, 'queued');
  pendingTimer = setTimeout(update, 900);
}

document.addEventListener('click', (event) => {
  const btn = event.target.closest?.('#bungieLoginBtn,#bungieSyncBtn,#refreshBtn');
  if (!btn) return;
  if (btn.id === 'bungieLoginBtn') show('Opening Bungie sign-in...', 'queued');
  if (btn.id === 'bungieSyncBtn') schedulePending('Manual Sync requested. Waiting for Bungie response...');
  if (btn.id === 'refreshBtn') schedulePending('Refresh requested. Checking Bungie cache/live state...');
}, true);

window.addEventListener('d2aa:bungie-sync-request', (event) => {
  const reason = String(event.detail?.reason || 'sync').replace(/[-_]/g, ' ');
  show(`Sync queued: ${reason}.`, 'queued');
}, true);

window.addEventListener('online', update);
window.addEventListener('offline', update);
subscribe(update);
queueMicrotask(update);
