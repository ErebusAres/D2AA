(() => {
  const LS_SEEN = 'd2aa_bungie_seen_item_ids_v1';
  const LS_FEED = 'd2aa_bungie_item_feed_v1';
  const MAX_FEED = 30;
  let feedOnly = false;

  const $ = (id) => document.getElementById(id);
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const normId = (value) => String(value || '').trim();
  const isBungieRows = (rows, label) => /bungie/i.test(String(label || '')) || (rows || []).some((row) => row?.Source === 'Bungie');

  function getFeed() { return readJson(LS_FEED, []); }
  function saveFeed(items) { writeJson(LS_FEED, (items || []).slice(0, MAX_FEED)); }
  function seenSet() { return new Set(readJson(LS_SEEN, []).map(normId).filter(Boolean)); }
  function saveSeen(rows) { writeJson(LS_SEEN, [...new Set((rows || []).map((row) => normId(row?.Id)).filter(Boolean))]); }
  function rarityClass(rarity) { return `feed-rarity-${String(rarity || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; }
  function locationLabel(row) { return row?.IsInVault ? 'Vault' : row?.IsEquipped ? 'Equipped' : row?.Source === 'Bungie' ? 'Inventory' : 'DIM'; }
  function locationIcon(row) { return row?.IsInVault ? '🏦' : row?.IsEquipped ? '⚔️' : '🎒'; }

  function buildFeedEntry(row) {
    return { id: normId(row.Id), name: row.Name || 'Unknown Armor', type: row.Type || 'Armor', rarity: row.Rarity || 'Unknown', equippable: row.Equippable || '', total: Number(row['Total (Base)'] || 0), location: locationLabel(row), icon: locationIcon(row), foundAt: new Date().toISOString() };
  }

  function decorateIncomingRows(rows, label) {
    if (!Array.isArray(rows) || !isBungieRows(rows, label)) return rows;
    const previous = seenSet();
    const firstSnapshot = previous.size === 0;
    const newRows = firstSnapshot ? [] : rows.filter((row) => normId(row.Id) && !previous.has(normId(row.Id)));
    const newIds = new Set(newRows.map((row) => normId(row.Id)));

    if (newRows.length) {
      const merged = [...newRows.map(buildFeedEntry), ...getFeed()].filter((entry, index, arr) => arr.findIndex((x) => x.id === entry.id) === index);
      saveFeed(merged);
    }

    saveSeen(rows);
    return rows.map((row) => ({ ...row, RecentlyFound: newIds.has(normId(row.Id)) }));
  }

  function injectStyles() {
    if ($('d2aaItemFeedStyles')) return;
    const style = document.createElement('style');
    style.id = 'd2aaItemFeedStyles';
    style.textContent = `
      .item-feed-list{display:grid;gap:7px;margin-top:8px;max-height:210px;overflow:auto;padding-right:2px;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--accent) 62%,transparent) rgba(255,255,255,.06)}
      .item-feed-list::-webkit-scrollbar{width:8px}.item-feed-list::-webkit-scrollbar-track{background:rgba(255,255,255,.045);border-radius:999px}.item-feed-list::-webkit-scrollbar-thumb{background:linear-gradient(var(--accent),var(--accent-strong));border-radius:999px}
      .item-feed-empty{color:var(--muted);font-size:12px;line-height:1.2;margin:8px 0 0}.item-feed-card{border:1px solid var(--border);border-radius:12px;padding:7px;background:rgba(255,255,255,.035)}
      .item-feed-card.is-new{border-color:color-mix(in srgb,var(--accent) 62%,var(--border));box-shadow:inset 3px 0 0 var(--accent)}.feed-title{display:flex;gap:6px;align-items:center;font-weight:700;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.feed-meta{margin-top:3px;color:var(--muted);font-size:11px;line-height:1.12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.feed-total{color:var(--accent-strong);font-weight:700}.feed-rarity-exotic .feed-title{color:#ffe4a6}.feed-rarity-legendary .feed-title{color:#dfb8ff}
      .armor-row.is-recent-found{outline:1px solid color-mix(in srgb,var(--accent) 38%,transparent);box-shadow:inset 3px 0 0 var(--accent)}.recent-pill{display:inline-flex;align-items:center;gap:3px;margin-left:5px;padding:1px 5px;border:1px solid color-mix(in srgb,var(--accent) 55%,var(--border));border-radius:999px;color:var(--accent-strong);background:color-mix(in srgb,var(--accent) 10%,transparent);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em}
      .item-feed-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px}.mini-feed-btn{min-height:28px;padding:4px 7px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.035);cursor:pointer;font-size:12px}.mini-feed-btn:hover{border-color:var(--accent);color:var(--accent-strong)}
    `;
    document.head.appendChild(style);
  }

  function renderFeed() {
    ensurePanel();
    const list = $('itemFeedList');
    if (!list) return;
    const feed = getFeed();
    list.textContent = '';
    if (!feed.length) {
      const empty = document.createElement('p');
      empty.className = 'item-feed-empty';
      empty.textContent = 'No new armor yet. Refresh after finding loot to populate this feed.';
      list.appendChild(empty);
      return;
    }
    for (const item of feed.slice(0, MAX_FEED)) {
      const card = document.createElement('div');
      card.className = `item-feed-card is-new ${rarityClass(item.rarity)}`;
      const when = item.foundAt ? new Date(item.foundAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'recently';
      card.innerHTML = `<div class="feed-title"><span>✨</span><span>${item.name}</span></div><div class="feed-meta">${item.icon || ''} ${item.location || 'Unknown'} • ${item.type || 'Armor'} • ${item.equippable || ''} • <span class="feed-total">${item.total || 0}</span></div><div class="feed-meta">Found ${when}</div>`;
      list.appendChild(card);
    }
  }

  function ensurePanel() {
    if ($('itemFeedPanel')) return;
    injectStyles();
    const rightRail = document.querySelector('.right-rail');
    const actions = $('actionsTitle')?.closest('.control-block');
    if (!rightRail || !actions) return;

    const refresh = document.createElement('button');
    refresh.id = 'bungieRefreshBtn';
    refresh.className = 'action-card action-card--bungie';
    refresh.type = 'button';
    refresh.innerHTML = `<span class="action-icon" aria-hidden="true">↻</span><span><span class="action-title">Refresh Bungie</span><span class="action-sub">Resync and update item feed</span></span>`;
    refresh.addEventListener('click', () => $('bungieImportV2Btn')?.click());
    actions.appendChild(refresh);

    const panel = document.createElement('section');
    panel.id = 'itemFeedPanel';
    panel.className = 'control-block';
    panel.setAttribute('aria-labelledby', 'itemFeedTitle');
    panel.innerHTML = `<h2 id="itemFeedTitle">Item Feed</h2><p class="muted compact">New armor found since your previous Bungie sync.</p><div class="item-feed-actions"><button id="showRecentBtn" class="mini-feed-btn" type="button">Show recent</button><button id="clearFeedBtn" class="mini-feed-btn" type="button">Clear feed</button></div><div id="itemFeedList" class="item-feed-list" aria-live="polite"></div>`;
    rightRail.insertBefore(panel, actions.nextSibling);

    $('showRecentBtn')?.addEventListener('click', () => {
      feedOnly = !feedOnly;
      $('showRecentBtn').textContent = feedOnly ? 'Show all' : 'Show recent';
      window.D2AA?.render?.();
    });
    $('clearFeedBtn')?.addEventListener('click', () => { saveFeed([]); feedOnly = false; $('showRecentBtn').textContent = 'Show recent'; renderFeed(); window.D2AA?.render?.(); });
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
      originalLoadRows(decorated, recentCount ? `${label} • ${recentCount} new` : label);
      renderFeed();
      decorateRenderedRows();
    };
    window.D2AA.render = () => { originalRender(); renderFeed(); decorateRenderedRows(); };
    window.D2AA.__itemFeedPatched = true;
  }

  function init() { ensurePanel(); patchD2AA(); renderFeed(); decorateRenderedRows(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
