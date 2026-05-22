import { state, subscribe } from '../src-clean/state.js';
import { isSignedIn } from '../src-clean/data/bungie-auth.js?v=clean62';

const STATUS_LABELS = {
  signedOut: 'Need account connected. Connect your Destiny account to sync armor.',
  cacheOnly: 'Loaded Bungie cache. Live sync is queued; click Sync to force a check.',
  queued: 'Live sync queued. Waiting for the next Bungie check.',
  syncing: 'Syncing Bungie armor. Resolving profile, sockets, stats, perks, and set metadata...',
  current: 'Live sync current. No new armor found on the last check.',
  new: 'Live sync current. New armor was found on the last check.',
  paused: 'Live polling paused while the tab/window is inactive.',
  error: 'Bungie sync failed. Check the live status tooltip or console for details.'
};

let statusOverride = '';
let lastRows = 0;
let observer = null;

function boot() {
  wireStatusEvents();
  subscribe(() => {
    lastRows = state.rows.length;
    refreshStatusText();
    requestAnimationFrame(polishFeedCards);
    requestAnimationFrame(polishSetBonusPlaceholders);
  });
  observer = new MutationObserver(() => {
    refreshStatusText();
    polishFeedCards();
    polishSetBonusPlaceholders();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-live-feed-state', 'data-live-state', 'class'] });
  setInterval(refreshStatusText, 1500);
  requestAnimationFrame(() => {
    lastRows = state.rows.length;
    refreshStatusText(true);
    polishFeedCards();
    polishSetBonusPlaceholders();
  });
}

function wireStatusEvents() {
  window.addEventListener('d2aa:bungie-sync-request', (event) => {
    const reason = event.detail?.reason || 'sync';
    statusOverride = `Sync queued: ${prettyReason(reason)}.`;
    setStatusText(statusOverride);
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#bungieSyncBtn,#refreshBtn')) {
      statusOverride = 'Manual sync requested. Waiting for Bungie response...';
      setStatusText(statusOverride);
    }
    if (event.target.closest?.('#bungieLoginBtn')) {
      statusOverride = 'Opening Bungie sign-in...';
      setStatusText(statusOverride);
    }
  }, true);
}

function refreshStatusText(initial = false) {
  const el = document.getElementById('statusText');
  if (!el) return;
  const liveState = document.body.dataset.liveFeedState || document.getElementById('liveChip')?.dataset.liveState || '';
  const liveText = document.getElementById('itemFeed')?.dataset.liveText || document.getElementById('liveChip')?.title || '';
  const current = String(state.status || el.textContent || '');
  const staleCache = /^Loaded Bungie cache:/i.test(current) || /^Loaded Bungie cache:/i.test(el.textContent || '');
  let next = '';

  if (!isSignedIn()) next = STATUS_LABELS.signedOut;
  else if (liveState === 'syncing' || liveState === 'busy') next = liveText || STATUS_LABELS.syncing;
  else if (liveState === 'queued' || liveState === 'waiting') next = liveText || STATUS_LABELS.queued;
  else if (liveState === 'new') next = liveText || STATUS_LABELS.new;
  else if (liveState === 'current') next = liveText || STATUS_LABELS.current;
  else if (liveState === 'paused') next = liveText || STATUS_LABELS.paused;
  else if (liveState === 'error') next = liveText || STATUS_LABELS.error;
  else if (staleCache && lastRows) next = STATUS_LABELS.cacheOnly;
  else if (current) next = current;

  if (statusOverride && !/complete|failed|current|no new|new armor/i.test(next)) next = statusOverride;
  if (!next && initial) next = isSignedIn() ? STATUS_LABELS.queued : STATUS_LABELS.signedOut;
  if (next) setStatusText(next);
}

function setStatusText(text) {
  const el = document.getElementById('statusText');
  if (!el || !text) return;
  el.textContent = text;
  el.title = text;
}

function polishFeedCards() {
  const byId = new Map(state.rows.map((row) => [String(row.Id), row]));
  document.querySelectorAll('.feed-card[data-id]').forEach((card) => {
    const row = byId.get(String(card.dataset.id));
    if (!row) return;
    const img = card.querySelector(':scope > img');
    if (!img) return;
    let wrap = card.querySelector(':scope > .feed-icon-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'feed-icon-wrap';
      img.replaceWith(wrap);
      wrap.appendChild(img);
    }
    let rail = wrap.querySelector('.tier-rail.feed-tier-rail');
    if (!rail) {
      rail = document.createElement('div');
      rail.className = 'tier-rail feed-tier-rail';
      wrap.appendChild(rail);
    }
    rail.innerHTML = tierMarks(row).join('');
    card.dataset.tier = String(row.Tier || row.GearTier || '');
  });
}

function polishSetBonusPlaceholders() {
  const rows = new Map(state.rows.map((row) => [String(row.Id), row]));
  document.querySelectorAll('.armor-card[data-id]').forEach((card) => {
    const row = rows.get(String(card.dataset.id));
    if (!row || String(row.Rarity).toLowerCase() === 'exotic') return;
    const host = card.querySelector('.bonus-icons');
    if (!host || host.querySelector('.is-set-bonus')) return;
    const fallback = setBonusFallback(row);
    if (!fallback) return;
    const icon = document.createElement('span');
    icon.className = 'bonus-icon is-set-bonus is-set-fallback';
    icon.tabIndex = 0;
    icon.title = `${fallback.name}: ${fallback.description}`;
    icon.innerHTML = `<span class="set-fallback-mark">◆</span><span class="d2-tooltip"><b>${escapeHtml(fallback.name)}</b><em>${escapeHtml(fallback.label)}</em><p>${escapeHtml(fallback.description)}</p></span>`;
    if (host.classList.contains('is-empty')) host.classList.remove('is-empty');
    host.prepend(icon);
  });
}

function setBonusFallback(row) {
  const raw = [row.ArmorSetName, row.SetName, row.ItemSetName, row.SetBonusName, row.Name, row.Type].filter(Boolean).join(' ');
  const text = raw.toLowerCase();
  if (/class item|helmet|gauntlet|chest|leg armor|warlock bond|hunter cloak|titan mark/.test(text) && !/smoke|jumper|set|piece|bonus|seeker|willbreaker|collective|praefectus|universal/.test(text)) return null;
  const parsed = parseSet(row.ArmorSetBonuses || row.SetBonuses);
  if (parsed.length) return null;
  const setName = inferSetName(row);
  if (!setName) return null;
  return {
    label: 'Armor Set Bonus',
    name: setName,
    description: 'Set bonus metadata was not exposed in the cached row, but this armor appears to belong to an armor set. Re-sync after this patch so Bungie socket/perk metadata can replace this fallback with exact 2-piece/4-piece text when available.'
  };
}

function inferSetName(row) {
  const fields = [row.ArmorSetName, row.SetName, row.ItemSetName, row.SetBonusName].filter(Boolean);
  if (fields.length) return String(fields[0]);
  const name = String(row.Name || '').trim();
  if (!name) return '';
  const base = name.replace(/\b(mask|helm|helmet|grips|gloves|gauntlets|vest|robes|plate|chest|strides|boots|greaves|bond|cloak|mark)\b/ig, '').replace(/\s+/g, ' ').trim();
  if (/smoke|jumper|set|bonus|piece|praefectus|willbreaker|seeker|collective/i.test(base)) return `${base} Set Bonus`.trim();
  return '';
}

function parseSet(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function tierMarks(row) {
  const max = 5;
  const tier = Math.max(0, Math.min(max, number(row.Tier || row.GearTier || 0)));
  const color = tier >= 5 ? 'gold' : tier >= 3 ? 'purple' : 'white';
  return Array.from({ length: max }, (_, i) => {
    const level = max - i;
    return `<span class="tier-mark tier-color-${color} ${level <= tier ? 'is-on' : ''}">◆</span>`;
  });
}

function prettyReason(reason) { return String(reason || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }
function number(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }

boot();
