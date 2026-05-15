(() => {
  const LS_META = 'd2aa_bungie_cached_meta_v1';
  const AUTH_KEY = 'd2aa_bungie_token_v1';
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const hasAuth = () => Object.keys(readJson(AUTH_KEY, {})).length > 0;
  const meta = () => readJson(LS_META, null);
  const ageMs = (iso) => { const time = Date.parse(iso || ''); return Number.isFinite(time) ? Date.now() - time : Infinity; };

  function formatRelative(iso) {
    const ms = ageMs(iso);
    if (!Number.isFinite(ms)) return 'never';
    if (ms < 15000) return 'just now';
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'less than 1 min ago';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  function formatAbsolute(iso) {
    if (!iso) return 'Never synced';
    try { return new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }); }
    catch (_) { return 'Unknown'; }
  }

  function tipText() {
    const m = meta();
    const auth = hasAuth();
    const stale = ageMs(m?.savedAt) > 5 * 60 * 1000;
    const lines = [
      'Refresh inventory [R]',
      `Last sync: ${m?.savedAt ? `${formatRelative(m.savedAt)} (${formatAbsolute(m.savedAt)})` : 'never'}`,
      m?.count ? `Cached armor: ${m.count}` : 'Cached armor: none',
      auth ? (stale ? 'Status: refresh recommended' : 'Status: cache fresh') : 'Status: connect Bungie to refresh'
    ];
    return lines.join('\n');
  }

  function setRefreshing(value) {
    const btn = document.getElementById('d2aaRefreshKey');
    if (!btn) return;
    btn.classList.toggle('is-refreshing', Boolean(value));
    btn.querySelector('span').textContent = value ? 'Refreshing' : 'Refresh';
    updateTooltip();
  }

  function updateTooltip() {
    const btn = document.getElementById('d2aaRefreshKey');
    if (btn) btn.dataset.tip = tipText();
  }

  function doRefresh() {
    const btn = document.getElementById('d2aaRefreshKey');
    setRefreshing(true);
    if (window.D2AAInventoryCache?.refresh?.()) {
      setTimeout(() => setRefreshing(false), 6500);
      return;
    }
    const sync = document.getElementById('bungieImportV2Btn');
    const restore = document.getElementById('restoreBtn');
    if (sync && hasAuth()) sync.click();
    else restore?.click();
    setTimeout(() => setRefreshing(false), 3500);
    if (btn) btn.blur();
  }

  function ensureButton() {
    if (document.getElementById('d2aaRefreshKey')) return;
    const actions = document.querySelector('.shell-actions');
    if (!actions) return;
    const old = document.getElementById('shellRefreshBtn');
    if (old) old.remove();
    const btn = document.createElement('button');
    btn.id = 'd2aaRefreshKey';
    btn.type = 'button';
    btn.className = 'd2aa-refresh-key';
    btn.innerHTML = '<kbd>R</kbd><span>Refresh</span>';
    btn.addEventListener('click', doRefresh);
    const filtersBtn = actions.querySelector('[data-shell-panel-btn="filters"]');
    actions.insertBefore(btn, filtersBtn || actions.children[1] || null);
    updateTooltip();
  }

  function bindHotkey() {
    if (window.__d2aaRefreshKeyBound) return;
    window.__d2aaRefreshKeyBound = true;
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'r') return;
      const target = event.target;
      if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      doRefresh();
    });
  }

  function run() {
    ensureButton();
    bindHotkey();
    updateTooltip();
    setInterval(updateTooltip, 30000);
    window.addEventListener('storage', updateTooltip);
    const status = document.getElementById('bungieStatus');
    if (status && status.dataset.refreshObserver !== '1') {
      status.dataset.refreshObserver = '1';
      new MutationObserver(() => {
        updateTooltip();
        const text = status.textContent || '';
        if (/loaded cached|sync complete|imported|saved|ready/i.test(text)) setRefreshing(false);
      }).observe(status, { childList: true, characterData: true, subtree: true });
    }
  }

  function wait() {
    if (!document.querySelector('.shell-actions')) { setTimeout(wait, 50); return; }
    run();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wait);
  else wait();
})();
