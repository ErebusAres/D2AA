const CLEAN_BUILD_VERSION = '1.86';
const statusEl = document.getElementById('statusText');
const brandChip = document.querySelector('.brand-chip');
const STATUS_TIME_ID = 'statusTime';

let updating = false;
let lastRawStatus = '';
let lastStatusAt = Date.now();

function bootStatusChip() {
  assertCleanBuildVersion();
  if (!statusEl || !brandChip) return;
  ensureTimeElement();
  updateFromStatus(true);
  const observer = new MutationObserver(() => updateFromStatus(false));
  observer.observe(statusEl, { childList: true, characterData: true, subtree: true });
}

function assertCleanBuildVersion() {
  window.D2AA_VERSION = CLEAN_BUILD_VERSION;
  document.documentElement.dataset.d2aaRuntimeVersion = CLEAN_BUILD_VERSION;
  const meta = document.querySelector('meta[name="d2aa-version"]');
  if (meta) meta.setAttribute('content', CLEAN_BUILD_VERSION);
  const badge = document.querySelector('.d2aa-version-badge');
  if (badge) {
    badge.textContent = `v${CLEAN_BUILD_VERSION}`;
    badge.setAttribute('title', `D2AA clean runtime v${CLEAN_BUILD_VERSION}`);
  }
}

function ensureTimeElement() {
  if (document.getElementById(STATUS_TIME_ID)) return;
  const time = document.createElement('span');
  time.id = STATUS_TIME_ID;
  time.className = 'brand-status-time';
  time.setAttribute('aria-label', 'Latest status update time');
  brandChip.appendChild(time);
}

function updateFromStatus(force) {
  if (updating || !statusEl) return;
  const raw = String(statusEl.textContent || '').trim() || 'Ready';
  if (!force && raw === lastRawStatus) return;
  lastRawStatus = raw;
  lastStatusAt = Date.now();
  const compact = compactStatus(raw);
  updating = true;
  statusEl.textContent = compact;
  statusEl.title = raw;
  brandChip?.setAttribute('title', `${compact} · ${formatDateTime(lastStatusAt)}`);
  const time = document.getElementById(STATUS_TIME_ID);
  if (time) {
    time.textContent = formatPinnedTime(lastStatusAt);
    time.title = formatDateTime(lastStatusAt);
  }
  updating = false;
}

function compactStatus(rawStatus) {
  const raw = String(rawStatus || '').trim().replace(/\s+/g, ' ');
  const lower = raw.toLowerCase();
  const armorCount = raw.match(/(?:loaded|complete:|synced|applied)\D+(\d+)\s+(?:armor|rows|matching|cached|items?)/i)?.[1]
    || raw.match(/(\d+)\s+(?:armor|rows|items?)/i)?.[1];

  if (!raw || /^ready\.?$/i.test(raw)) return 'Ready';
  if (lower.includes('parsing')) return 'Parsing CSV';
  if (lower.includes('fetching bungie')) return 'Fetching profile';
  if (lower.includes('starting initial sync')) return 'Initial sync';
  if (lower.includes('connect your destiny account')) return 'Sign in needed';
  if (lower.includes('resolving item definitions')) return progressStatus(raw, 'Items');
  if (lower.includes('resolving armor plugs')) return progressStatus(raw, 'Plugs');
  if (lower.includes('resolving stat definitions')) return progressStatus(raw, 'Stats');
  if (lower.includes('building armor rows')) return progressStatus(raw, 'Building');
  if (lower.includes('bungie sync complete')) {
    const added = numberAfter(raw, 'New');
    const moved = numberAfter(raw, 'Moved');
    const changed = numberAfter(raw, 'Changed');
    const delta = added + moved + changed;
    if (delta > 0) return `Synced ${armorCount || ''} · +${added}/${moved}/${changed}`.trim();
    return `Synced ${armorCount || ''}`.trim();
  }
  if (lower.includes('bungie cache')) return `Loaded ${armorCount || 'cache'}`;
  if (lower.includes('cached clean rows')) return `Loaded ${armorCount || 'cache'}`;
  if (lower.includes('loaded') && armorCount) return `Loaded ${armorCount}`;
  if (lower.includes('csv') && lower.includes('loaded')) return `CSV loaded`;
  if (lower.includes('live state current')) return 'Current';
  if (lower.includes('cache cleared')) return 'Cache cleared';
  if (lower.includes('no clean cached')) return 'No cache';
  if (lower.includes('dim tag sync complete')) return `DIM tags ${armorCount || ''}`.trim();
  if (lower.includes('dim api key') && lower.includes('cleared')) return 'DIM key cleared';
  if (lower.includes('action complete')) return 'Action complete';
  if (lower.includes('group action complete')) return 'Group pulled';
  if (lower.includes('failed') || lower.includes('error')) return truncateStatus(`Error: ${raw.replace(/^error:?\s*/i, '')}`, 28);
  return truncateStatus(raw.replace(/[.。]+$/u, ''), 28);
}

function progressStatus(raw, label) {
  const progress = raw.match(/(\d+)\s*\/\s*(\d+)/);
  return progress ? `${label} ${progress[1]}/${progress[2]}` : label;
}

function numberAfter(raw, label) {
  const match = raw.match(new RegExp(`${label}:\\s*(\\d+)`, 'i'));
  return match ? Number(match[1] || 0) : 0;
}

function truncateStatus(text, max) {
  const value = String(text || 'Ready').trim();
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function formatPinnedTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

bootStatusChip();