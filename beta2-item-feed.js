(() => {
  const LS_SEEN = 'd2aa_bungie_seen_item_ids_v1';
  const LS_FEED = 'd2aa_bungie_item_feed_v1';
  const LS_OPEN = 'd2aa_item_feed_open_v1';
  const MAX_FEED = 25;
  const TAGS = [
    ['', '＋', 'No tag'],
    ['favorite', '❤️', 'Favorite'],
    ['keep', '🏷️', 'Keep'],
    ['junk', '🚫', 'Junk'],
    ['infuse', '⚡', 'Infuse'],
    ['archive', '📦', 'Archive']
  ];
  let feedOnly = false;

  const $ = (id) => document.getElementById(id);
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const normId = (value) => String(value || '').trim();
  const isBungieRows = (rows, label) => /bungie/i.test(String(label || '')) || (rows || []).some((row) => row?.Source === 'Bungie');
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

  function normalizeFeed(items) {
    return (items || [])
      .filter((item) => normId(item?.id) && !item.dismissed)
      .sort((a, b) => String(b.foundAt || '').localeCompare(String(a.foundAt || '')))
      .slice(0, MAX_FEED);
  }

  function getFeed() { return normalizeFeed(readJson(LS_FEED, [])); }
  function saveFeed(items) { writeJson(LS_FEED, normalizeFeed(items)); updateLauncherCount(); }
  function seenSet() { return new Set(readJson(LS_SEEN, []).map(normId).filter(Boolean)); }
  function saveSeen(rows) { writeJson(LS_SEEN, [...new Set((rows || []).map((row) => normId(row?.Id)).filter(Boolean))]); }
  function rarityClass(rarity) { return `feed-rarity-${String(rarity || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; }
  function locationLabel(row) { return row?.IsInVault ? 'Vault' : row?.IsEquipped ? 'Equipped' : row?.Source === 'Bungie' ? 'Inventory' : 'DIM'; }
  function locationIcon(row) { return row?.IsInVault ? '🏦' : row?.IsEquipped ? '⚔️' : '🎒'; }
  function normalizeTag(tag) { const value = String(tag || '').trim().toLowerCase(); return TAGS.some(([t]) => t === value) ? value : ''; }

  function buildFeedEntry(row) {
    return {
      id: normId(row.Id),
      name: row.Name || 'Unknown Armor',
      type: row.Type || 'Armor',
      rarity: row.Rarity || 'Unknown',
      equippable: row.Equippable || '',
      total: Number(row['Total (Base)'] || 0),
      location: locationLabel(row),
      icon: locationIcon(row),
      tag: normalizeTag(row.Tag),
      foundAt: new Date().toISOString(),
      dismissed: false
    };
  }

  function mergeFeedEntries(newRows) {
    const existing = getFeed();
    const byId = new Map(existing.map((item) => [item.id, item]));
    for (const row of newRows) {
      const entry = buildFeedEntry(row);
      const old = byId.get(entry.id);
      byId.set(entry.id, { ...old, ...entry, tag: old?.tag || entry.tag, dismissed: false });
    }
    saveFeed([...byId.values()]);
  }

  function decorateIncomingRows(rows, label) {
    if (!Array.isArray(rows) || !isBungieRows(rows, label)) return rows;
    const previous = seenSet();
    const firstSnapshot = previous.size === 0;
    const newRows = firstSnapshot ? [] : rows.filter((row) => normId(row.Id) && !previous.has(normId(row.Id)));
    const newIds = new Set(newRows.map((row) => normId(row.Id)));

    if (newRows.length) {
      mergeFeedEntries(newRows);
      setDrawerOpen(true);
    }

    saveSeen(rows);
    return rows.map((row) => ({ ...row, RecentlyFound: newIds.has(normId(row.Id)) }));
  }

  function injectStyles() {
    if ($('d2aaItemFeedStyles')) return;
    const style = document.createElement('style');
    style.id = 'd2aaItemFeedStyles';
    style.textContent = `
      .tag-cell,.tag-btn{display:flex;align-items:center;justify-content:center}.tag-btn{width:30px;height:30px;min-width:30px;min-height:30px;padding:0;line-height:1;border-radius:9px;text-align:center;font-size:15px;}
      .item-feed-launcher{position:fixed;right:18px;bottom:18px;z-index:80;display:flex;align-items:center;gap:8px;min-height:42px;padding:9px 12px;border:1px solid color-mix(in srgb,var(--accent) 50%,var(--border));border-radius:999px;background:linear-gradient(135deg,color-mix(in srgb,var(--panel) 92%,black),color-mix(in srgb,var(--accent) 12%,var(--panel)));box-shadow:0 18px 44px rgba(0,0,0,.42);color:var(--text);cursor:pointer}.item-feed-launcher:hover{border-color:var(--accent);color:var(--accent-strong)}.item-feed-count{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:var(--accent);color:var(--accent-contrast,#111);font-weight:800;font-size:12px}.item-feed-drawer{position:fixed;right:18px;bottom:72px;z-index:79;width:min(420px,calc(100vw - 36px));max-height:min(650px,calc(100vh - 100px));display:flex;flex-direction:column;border:1px solid color-mix(in srgb,var(--accent) 42%,var(--border));border-radius:18px;background:linear-gradient(145deg,color-mix(in srgb,var(--panel) 96%,black),color-mix(in srgb,var(--accent) 10%,var(--panel)));box-shadow:0 28px 70px rgba(0,0,0,.55);overflow:hidden;transform:translateY(14px) scale(.98);opacity:0;pointer-events:none;transition:opacity .16s ease,transform .16s ease}.item-feed-drawer.is-open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}.item-feed-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:13px 14px;border-bottom:1px solid var(--border)}.item-feed-head h2{margin:0;font-size:16px}.item-feed-close{width:30px;height:30px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.04);color:var(--text);cursor:pointer}.item-feed-close:hover{border-color:var(--accent);color:var(--accent-strong)}
      .item-feed-list{display:grid;gap:8px;overflow:auto;padding:10px 12px 12px;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--accent) 62%,transparent) rgba(255,255,255,.06)}.item-feed-list::-webkit-scrollbar{width:8px}.item-feed-list::-webkit-scrollbar-track{background:rgba(255,255,255,.045);border-radius:999px}.item-feed-list::-webkit-scrollbar-thumb{background:linear-gradient(var(--accent),var(--accent-strong));border-radius:999px}.item-feed-empty{color:var(--muted);font-size:12px;line-height:1.3;margin:0}.item-feed-card{position:relative;border:1px solid var(--border);border-radius:14px;padding:9px 38px 9px 9px;background:rgba(255,255,255,.04)}.item-feed-card.is-new{border-color:color-mix(in srgb,var(--accent) 62%,var(--border));box-shadow:inset 3px 0 0 var(--accent)}.feed-dismiss{position:absolute;right:8px;top:8px;width:24px;height:24px;display:grid;place-items:center;border:1px solid var(--border);border-radius:8px;background:rgba(255,255,255,.035);color:var(--muted);cursor:pointer}.feed-dismiss:hover{border-color:var(--accent);color:var(--accent-strong)}.feed-title{display:flex;gap:7px;align-items:center;font-weight:800;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.feed-meta{margin-top:4px;color:var(--muted);font-size:11px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.feed-total{color:var(--accent-strong);font-weight:800}.feed-rarity-exotic .feed-title{color:#ffe4a6}.feed-rarity-legendary .feed-title{color:#dfb8ff}.feed-tag-row{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.feed-tag-btn{width:28px;height:28px;display:grid;place-items:center;border:1px solid var(--border);border-radius:9px;background:rgba(255,255,255,.035);cursor:pointer;font-size:14px;line-height:1}.feed-tag-btn:hover,.feed-tag-btn.is-active{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent-strong)}
      .armor-row.is-recent-found{outline:1px solid color-mix(in srgb,var(--accent) 38%,transparent);box-shadow:inset 3px 0 0 var(--accent)}.recent-pill{display:inline-flex;align-items:center;gap:3px;margin-left:5px;padding:1px 5px;border:1px solid color-mix(in srgb,var(--accent) 55%,var(--border));border-radius:999px;color:var(--accent-strong);background:color-mix(in srgb,var(--accent) 10%,transparent);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em}.item-feed-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;padding:0 12px 12px}.mini-feed-btn{min-height:30px;padding:5px 7px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.035);cursor:pointer;font-size:12px}.mini-feed-btn:hover{border-color:var(--accent);color:var(--accent-strong)}
    `;
    document.head.appendChild(style);
  }

  function updateLauncherCount() {
    const count = $('itemFeedCount');
    if (count) count.textContent = String(getFeed().length);
  }

  function setDrawerOpen(open) {
    localStorage.setItem(LS_OPEN, open ? '1' : '0');
    $('itemFeedDrawer')?.classList.toggle('is-open', open);
    $('itemFeedLauncher')?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function assignTag(id, tag) {
    const normalized = normalizeTag(tag);
    const feed = getFeed().map((item) => item.id === id ? { ...item, tag: normalized } : item);
    saveFeed(feed);
    const state = window.D2AA?.getState?.();
    const row = state?.rows?.find((item) => normId(item.Id) === id);
    if (row && window.D2AA?.setTag) window.D2AA.setTag(row, normalized);
    renderFeed();
    window.D2AA?.render?.();
  }

  function dismissFeedItem(id) {
    saveFeed(getFeed().filter((item) => item.id !== id));
    renderFeed();
    window.D2AA?.render?.();
  }

  function dismissAllFeedItems() {
    saveFeed([]);
    feedOnly = false;
    if ($('showRecentBtn')) $('showRecentBtn').textContent = 'Show recent';
    renderFeed();
    window.D2AA?.render?.();
  }

  function renderFeed() {
    ensurePanel();
    const list = $('itemFeedList');
    if (!list) return;
    const feed = getFeed();
    list.textContent = '';
    updateLauncherCount();
    if (!feed.length) {
      const empty = document.createElement('p');
      empty.className = 'item-feed-empty';
      empty.textContent = 'No recent loot in the feed. Refresh Bungie after finding items to add them here.';
      list.appendChild(empty);
      return;
    }
    for (const item of feed) {
      const card = document.createElement('div');
      card.className = `item-feed-card is-new ${rarityClass(item.rarity)}`;
      const when = item.foundAt ? new Date(item.foundAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'recently';
      card.innerHTML = `<button class="feed-dismiss" type="button" title="Dismiss from feed" aria-label="Dismiss ${esc(item.name)}">×</button><div class="feed-title"><span>✨</span><span>${esc(item.name)}</span></div><div class="feed-meta">${esc(item.icon || '')} ${esc(item.location || 'Unknown')} • ${esc(item.type || 'Armor')} • ${esc(item.equippable || '')} • <span class="feed-total">${Number(item.total || 0)}</span></div><div class="feed-meta">Received ${esc(when)}</div>`;
      card.querySelector('.feed-dismiss')?.addEventListener('click', () => dismissFeedItem(item.id));
      const tags = document.createElement('div');
      tags.className = 'feed-tag-row';
      for (const [value, emoji, label] of TAGS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `feed-tag-btn${normalizeTag(item.tag) === value ? ' is-active' : ''}`;
        btn.textContent = emoji;
        btn.title = `Set ${label}`;
        btn.addEventListener('click', () => assignTag(item.id, value));
        tags.appendChild(btn);
      }
      card.appendChild(tags);
      list.appendChild(card);
    }
  }

  function ensurePanel() {
    injectStyles();
    const actions = $('actionsTitle')?.closest('.control-block');
    if (actions && !$('bungieRefreshBtn')) {
      const refresh = document.createElement('button');
      refresh.id = 'bungieRefreshBtn';
      refresh.className = 'action-card action-card--bungie';
      refresh.type = 'button';
      refresh.innerHTML = `<span class="action-icon" aria-hidden="true">↻</span><span><span class="action-title">Refresh Bungie</span><span class="action-sub">Resync and update item feed</span></span>`;
      refresh.addEventListener('click', () => $('bungieImportV2Btn')?.click());
      actions.appendChild(refresh);
    }

    if ($('itemFeedDrawer')) return;
    const launcher = document.createElement('button');
    launcher.id = 'itemFeedLauncher';
    launcher.className = 'item-feed-launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-controls', 'itemFeedDrawer');
    launcher.innerHTML = `<span>✨ Item Feed</span><span id="itemFeedCount" class="item-feed-count">0</span>`;
    launcher.addEventListener('click', () => setDrawerOpen(!$('itemFeedDrawer')?.classList.contains('is-open')));

    const drawer = document.createElement('aside');
    drawer.id = 'itemFeedDrawer';
    drawer.className = 'item-feed-drawer';
    drawer.setAttribute('aria-labelledby', 'itemFeedTitle');
    drawer.innerHTML = `<div class="item-feed-head"><div><h2 id="itemFeedTitle">Item Feed</h2><p class="muted compact">Recent received armor. Items stay until dismissed, or until the feed trims past ${MAX_FEED} items.</p></div><button id="itemFeedClose" class="item-feed-close" type="button" aria-label="Close item feed">×</button></div><div class="item-feed-actions"><button id="showRecentBtn" class="mini-feed-btn" type="button">Show recent</button><button id="refreshFeedBtn" class="mini-feed-btn" type="button">Refresh</button><button id="clearFeedBtn" class="mini-feed-btn" type="button">Dismiss all</button></div><div id="itemFeedList" class="item-feed-list" aria-live="polite"></div>`;
    document.body.append(drawer, launcher);

    $('itemFeedClose')?.addEventListener('click', () => setDrawerOpen(false));
    $('refreshFeedBtn')?.addEventListener('click', () => $('bungieImportV2Btn')?.click());
    $('showRecentBtn')?.addEventListener('click', () => { feedOnly = !feedOnly; $('showRecentBtn').textContent = feedOnly ? 'Show all' : 'Show recent'; window.D2AA?.render?.(); });
    $('clearFeedBtn')?.addEventListener('click', dismissAllFeedItems);
    setDrawerOpen(localStorage.getItem(LS_OPEN) === '1');
    updateLauncherCount();
  }

  function decorateRenderedRows() {
    const state = window.D2AA?.getState?.();
    const host = $('rows');
    if (!state || !host) return;
    const visible = state.visible || [];
    const cards = [...host.querySelectorAll('.armor-row')];
    const recentIds = new Set(getFeed().map((item) => item.id));
    let shown = 0, dupeShown = 0, total = 0;
    const groups = new Set();

    cards.forEach((card, index) => {
      const row = visible[index];
      const isRecent = Boolean(row?.RecentlyFound) || recentIds.has(normId(row?.Id));
      card.classList.toggle('is-recent-found', isRecent);
      if (isRecent && !card.querySelector('.recent-pill')) {
        const meta = card.querySelector('.item-meta');
        const pill = document.createElement('span');
        pill.className = 'recent-pill';
        pill.textContent = '✨ New';
        meta?.append(' ', pill);
      }
      if (!isRecent) card.querySelector('.recent-pill')?.remove();
      const shouldShow = !feedOnly || isRecent;
      card.style.display = shouldShow ? '' : 'none';
      if (shouldShow) {
        shown++;
        total += Number(row?.['Total (Base)'] || 0);
        if (row?.Is_Dupe) { dupeShown++; groups.add(`${row.GroupKey}::${row.Dupe_Group}`); }
      }
    });

    if (feedOnly) {
      if ($('summaryShown')) $('summaryShown').textContent = shown;
      if ($('summaryDupes')) $('summaryDupes').textContent = dupeShown;
      if ($('summaryGroups')) $('summaryGroups').textContent = groups.size;
      if ($('summaryAvg')) $('summaryAvg').textContent = shown ? Math.round(total / shown) : 0;
      if ($('resultCount')) $('resultCount').textContent = `${shown} recent shown`;
      $('empty')?.classList.toggle('is-hidden', shown > 0);
    }
  }

  function patchD2AA() {
    if (!window.D2AA || window.D2AA.__itemFeedPatched) return;
    const originalLoadRows = window.D2AA.loadRows;
    const originalRender = window.D2AA.render;
    window.D2AA.loadRows = (rows, label) => {
      const decorated = decorateIncomingRows(rows, label);
      const recentCount = decorated.filter((row) => row.RecentlyFound).length;
      originalLoadRows(decorated, recentCount ? `${label} • ${recentCount} received` : label);
      renderFeed();
      decorateRenderedRows();
    };
    window.D2AA.render = () => { originalRender(); renderFeed(); decorateRenderedRows(); };
    window.D2AA.__itemFeedPatched = true;
  }

  function init() { ensurePanel(); patchD2AA(); renderFeed(); decorateRenderedRows(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();