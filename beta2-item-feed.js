(() => {
  const LS_SEEN = 'd2aa_bungie_seen_item_ids_v1';
  const LS_FEED = 'd2aa_bungie_item_feed_v1';
  const LS_OPEN = 'd2aa_item_feed_open_v1';
  const LS_DISMISSED = 'd2aa_item_feed_dismissed_ids_v1';
  const MAX_FEED = 25;
  const FEED_SEED_COUNT = 12;
  const STAT_KEYS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const STAT_ICONS = ['♥', '✊', '💣', '✦', '◆', '⚔'];
  const TAGS = [['', '＋', 'No tag'], ['favorite', '❤️', 'Favorite'], ['keep', '🏷️', 'Keep'], ['junk', '🚫', 'Junk'], ['infuse', '⚡', 'Infuse'], ['archive', '📦', 'Archive']];

  const $ = (id) => document.getElementById(id);
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const normId = (value) => String(value || '').trim();
  const dismissedSet = () => new Set(readJson(LS_DISMISSED, []).map(normId).filter(Boolean));
  const saveDismissedSet = (set) => writeJson(LS_DISMISSED, [...set].slice(-250));
  const isBungieRows = (rows, label) => /bungie/i.test(String(label || '')) || (rows || []).some((row) => row?.Source === 'Bungie');
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

  function normalizeFeed(items) {
    const dismissed = dismissedSet();
    return (items || [])
      .filter((item) => normId(item?.id) && !item.dismissed && !dismissed.has(normId(item.id)))
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
  function slotGlyph(type) { const t = String(type || '').toLowerCase(); if (t.includes('helmet')) return '◉'; if (t.includes('gauntlet')) return '▣'; if (t.includes('chest')) return '⬟'; if (t.includes('leg')) return '▰'; return '◇'; }
  function idSortValue(row) { const id = normId(row?.Id); return id.length ? id.padStart(24, '0') : ''; }

  function buildFeedEntry(row, options = {}) {
    const stats = Object.fromEntries(STAT_KEYS.map((key) => [key, Number(row[key] || 0)]));
    return {
      id: normId(row.Id), name: row.Name || 'Unknown Armor', type: row.Type || 'Armor', rarity: row.Rarity || 'Unknown', equippable: row.Equippable || '',
      total: Number(row['Total (Base)'] || 0), tier: Number(row.Tier || 0), rank: Number(row.Rank || 0), location: locationLabel(row), icon: locationIcon(row),
      itemIcon: row.IconUrl || row.Icon || row.DisplayIcon || '', stats, tag: normalizeTag(row.Tag), foundAt: options.foundAt || new Date().toISOString(), seeded: Boolean(options.seeded), dismissed: false
    };
  }

  function mergeFeedEntries(rows, options = {}) {
    const existing = getFeed();
    const dismissed = dismissedSet();
    const byId = new Map(existing.map((item) => [item.id, item]));
    for (const row of rows || []) {
      const id = normId(row?.Id);
      if (!id || dismissed.has(id)) continue;
      const entry = buildFeedEntry(row, options);
      const old = byId.get(entry.id);
      byId.set(entry.id, { ...old, ...entry, tag: old?.tag || entry.tag, foundAt: old?.foundAt || entry.foundAt, dismissed: false });
    }
    saveFeed([...byId.values()]);
  }

  function seedFeedFromRows(rows, force = false) {
    if (!force && getFeed().length) return;
    const dismissed = dismissedSet();
    const seedRows = [...(rows || [])]
      .filter((row) => normId(row?.Id) && !dismissed.has(normId(row.Id)))
      .sort((a, b) => idSortValue(b).localeCompare(idSortValue(a)))
      .slice(0, FEED_SEED_COUNT);
    if (!seedRows.length) return;
    const now = Date.now();
    const entries = seedRows.map((row, index) => buildFeedEntry(row, { seeded: true, foundAt: new Date(now - index * 1000).toISOString() }));
    saveFeed(entries);
  }

  function seedFromCurrentState() {
    if (getFeed().length) return;
    const state = window.D2AA?.getState?.();
    const rows = state?.allRows || state?.rows || [];
    if (rows.length) seedFeedFromRows(rows, true);
  }

  function decorateIncomingRows(rows, label) {
    if (!Array.isArray(rows) || !isBungieRows(rows, label)) return rows;
    const previous = seenSet();
    const firstSnapshot = previous.size === 0;
    const newRows = firstSnapshot ? [] : rows.filter((row) => normId(row.Id) && !previous.has(normId(row.Id)));
    const newIds = new Set(newRows.map((row) => normId(row.Id)));
    if (newRows.length) { mergeFeedEntries(newRows); setDrawerOpen(true); }
    else seedFeedFromRows(rows);
    saveSeen(rows);
    return rows.map((row) => ({ ...row, RecentlyFound: newIds.has(normId(row.Id)) }));
  }

  function injectStyles() {
    if ($('d2aaItemFeedStyles')) return;
    const style = document.createElement('style');
    style.id = 'd2aaItemFeedStyles';
    style.textContent = `
      .tag-cell,.tag-btn{display:flex;align-items:center;justify-content:center}.tag-btn{width:30px;height:30px;min-width:30px;min-height:30px;padding:0;line-height:1;border-radius:9px;text-align:center;font-size:15px;}
      .item-feed-launcher{position:fixed;right:18px;bottom:18px;z-index:80;display:flex;align-items:center;gap:8px;min-height:42px;padding:9px 12px;border:1px solid color-mix(in srgb,var(--accent) 50%,var(--border));border-radius:999px;background:linear-gradient(135deg,color-mix(in srgb,var(--panel) 92%,black),color-mix(in srgb,var(--accent) 12%,var(--panel)));box-shadow:0 18px 44px rgba(0,0,0,.42);color:var(--text);cursor:pointer}.item-feed-launcher:hover{border-color:var(--accent);color:var(--accent-strong)}.item-feed-count{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:var(--accent);color:var(--accent-contrast,#111);font-weight:800;font-size:12px}
      .item-feed-drawer{position:fixed;right:18px;bottom:72px;z-index:79;width:min(500px,calc(100vw - 36px));max-height:min(710px,calc(100vh - 100px));display:flex;flex-direction:column;border:1px solid color-mix(in srgb,var(--accent) 42%,var(--border));border-radius:18px;background:linear-gradient(145deg,color-mix(in srgb,var(--panel) 96%,black),color-mix(in srgb,var(--accent) 10%,var(--panel)));box-shadow:0 28px 70px rgba(0,0,0,.55);overflow:hidden;transform:translateY(14px) scale(.98);opacity:0;pointer-events:none;transition:opacity .16s ease,transform .16s ease}.item-feed-drawer.is-open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}.item-feed-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:13px 14px;border-bottom:1px solid var(--border)}.item-feed-head h2{margin:0;font-size:16px}.item-feed-close{width:30px;height:30px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.04);color:var(--text);cursor:pointer}.item-feed-close:hover{border-color:var(--accent);color:var(--accent-strong)}
      .item-feed-list{display:grid;gap:6px;overflow:auto;padding:9px 10px 12px;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--accent) 62%,transparent) rgba(255,255,255,.06)}.item-feed-list::-webkit-scrollbar{width:8px}.item-feed-list::-webkit-scrollbar-track{background:rgba(255,255,255,.045);border-radius:999px}.item-feed-list::-webkit-scrollbar-thumb{background:linear-gradient(var(--accent),var(--accent-strong));border-radius:999px}.item-feed-empty{color:var(--muted);font-size:12px;line-height:1.3;margin:0}
      .item-feed-card{position:relative;display:grid;grid-template-columns:48px minmax(0,1fr) 74px;gap:8px;align-items:center;min-height:66px;border:1px solid var(--border);border-radius:9px;padding:6px 28px 6px 6px;background:linear-gradient(90deg,rgba(255,255,255,.062),rgba(255,255,255,.022));box-shadow:inset 3px 0 0 color-mix(in srgb,var(--accent) 55%,transparent);overflow:hidden}.feed-rarity-exotic{background:linear-gradient(90deg,rgba(210,160,58,.22),rgba(255,255,255,.025))}.feed-rarity-legendary{background:linear-gradient(90deg,rgba(82,45,125,.31),rgba(255,255,255,.025))}.feed-rarity-rare{background:linear-gradient(90deg,rgba(55,94,155,.28),rgba(255,255,255,.025))}
      .feed-icon{width:48px;height:48px;border-radius:5px;display:grid;place-items:center;position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.2);background:radial-gradient(circle at 35% 25%,rgba(255,255,255,.18),rgba(0,0,0,.2)),linear-gradient(135deg,color-mix(in srgb,var(--accent) 40%,#111),#17131d);font-weight:900;font-size:24px}.feed-icon img{width:100%;height:100%;object-fit:cover;display:block}.feed-type-glyph{position:absolute;right:2px;bottom:2px;display:grid;place-items:center;width:16px;height:16px;border-radius:3px;background:rgba(0,0,0,.62);font-size:10px;color:#fff}
      .feed-main{min-width:0;display:grid;gap:3px}.feed-kicker{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.feed-title{font-weight:800;font-size:13px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.feed-meta{color:var(--muted);font-size:10px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .feed-stats{display:flex;flex-wrap:nowrap;gap:3px;min-width:0;overflow:hidden}.feed-stat{display:flex;align-items:center;justify-content:center;gap:2px;height:18px;min-width:30px;padding:0 3px;border:1px solid rgba(255,255,255,.08);border-radius:5px;background:rgba(0,0,0,.16);font-size:10px}.feed-stat-icon{opacity:.78;font-size:9px}.feed-stat strong{font-size:10px}.feed-side{display:grid;align-content:center;justify-items:end;gap:4px;min-width:0}.feed-total-badge{min-width:34px;text-align:center;border:1px solid color-mix(in srgb,var(--accent) 55%,var(--border));border-radius:999px;padding:2px 6px;color:var(--accent-strong);background:color-mix(in srgb,var(--accent) 13%,transparent);font-size:12px;font-weight:900}.feed-tier-badge{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.feed-tag-row{display:flex;justify-content:flex-end;gap:3px;max-width:74px;overflow:hidden}.feed-tag-btn{width:18px;height:18px;display:grid;place-items:center;border:1px solid var(--border);border-radius:5px;background:rgba(255,255,255,.035);cursor:pointer;font-size:10px;line-height:1;padding:0}.feed-tag-btn:hover,.feed-tag-btn.is-active{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent-strong)}
      .feed-dismiss{position:absolute;right:4px;top:4px;width:18px;height:18px;display:grid;place-items:center;border:1px solid transparent;border-radius:5px;background:rgba(0,0,0,.2);color:var(--muted);cursor:pointer;font-size:13px;line-height:1}.feed-dismiss:hover{border-color:var(--accent);color:var(--accent-strong)}
      .armor-row.is-recent-found{outline:1px solid color-mix(in srgb,var(--accent) 38%,transparent);box-shadow:inset 3px 0 0 var(--accent)}.recent-pill{display:inline-flex;align-items:center;gap:3px;margin-left:5px;padding:1px 5px;border:1px solid color-mix(in srgb,var(--accent) 55%,var(--border));border-radius:999px;color:var(--accent-strong);background:color-mix(in srgb,var(--accent) 10%,transparent);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em}.item-feed-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:0 12px 10px}.mini-feed-btn{min-height:30px;padding:5px 7px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.035);cursor:pointer;font-size:12px}.mini-feed-btn:hover{border-color:var(--accent);color:var(--accent-strong)}
    `;
    document.head.appendChild(style);
  }

  function updateLauncherCount() { const count = $('itemFeedCount'); if (count) count.textContent = String(getFeed().length); }
  function setDrawerOpen(open) { localStorage.setItem(LS_OPEN, open ? '1' : '0'); $('itemFeedDrawer')?.classList.toggle('is-open', open); $('itemFeedLauncher')?.setAttribute('aria-expanded', open ? 'true' : 'false'); }

  function assignTag(id, tag) {
    const normalized = normalizeTag(tag);
    const feed = getFeed().map((item) => item.id === id ? { ...item, tag: normalized } : item);
    saveFeed(feed);
    const state = window.D2AA?.getState?.();
    const row = (state?.allRows || state?.rows || []).find((item) => normId(item.Id) === id);
    if (row && window.D2AA?.setTag) window.D2AA.setTag(row, normalized);
    renderFeed();
    window.D2AA?.render?.();
  }

  function dismissFeedItem(id) {
    const dismissed = dismissedSet();
    dismissed.add(normId(id));
    saveDismissedSet(dismissed);
    saveFeed(getFeed().filter((item) => item.id !== id));
    renderFeed();
    window.D2AA?.render?.();
  }

  function dismissAllFeedItems() {
    const dismissed = dismissedSet();
    for (const item of getFeed()) dismissed.add(normId(item.id));
    saveDismissedSet(dismissed);
    saveFeed([]);
    renderFeed();
    window.D2AA?.render?.();
  }

  function renderStats(item) {
    const stats = item.stats || {};
    return `<div class="feed-stats">${STAT_KEYS.map((key, index) => `<div class="feed-stat" title="${esc(key.replace(' (Base)', ''))}"><span class="feed-stat-icon">${STAT_ICONS[index]}</span><strong>${Number(stats[key] || 0)}</strong></div>`).join('')}</div>`;
  }

  function renderTags(item) {
    return `<div class="feed-tag-row">${TAGS.map(([value, emoji, label]) => `<button type="button" class="feed-tag-btn${normalizeTag(item.tag) === value ? ' is-active' : ''}" data-tag="${esc(value)}" title="Set ${esc(label)}">${emoji}</button>`).join('')}</div>`;
  }

  function renderFeed() {
    seedFromCurrentState();
    ensurePanel();
    const list = $('itemFeedList');
    if (!list) return;
    const feed = getFeed();
    list.textContent = '';
    updateLauncherCount();
    if (!feed.length) {
      const empty = document.createElement('p');
      empty.className = 'item-feed-empty';
      empty.textContent = 'No recent loot in the feed yet. Sync Bungie once, then this will auto-populate.';
      list.appendChild(empty);
      return;
    }
    for (const item of feed) {
      const card = document.createElement('div');
      card.className = `item-feed-card ${rarityClass(item.rarity)}`;
      const when = item.foundAt ? new Date(item.foundAt).toLocaleString([], { hour: 'numeric', minute: '2-digit' }) : 'recently';
      const iconHtml = item.itemIcon ? `<img src="${esc(item.itemIcon)}" alt="" loading="lazy" />` : `<span>${slotGlyph(item.type)}</span>`;
      const verb = item.seeded ? 'Recent' : 'Received';
      card.innerHTML = `
        <button class="feed-dismiss" type="button" title="Dismiss from feed" aria-label="Dismiss ${esc(item.name)}">×</button>
        <div class="feed-icon">${iconHtml}<span class="feed-type-glyph">${slotGlyph(item.type)}</span></div>
        <div class="feed-main">
          <div class="feed-kicker">${verb} ${esc(when)} • ${esc(item.icon || '')} ${esc(item.location || 'Unknown')}</div>
          <div class="feed-title" title="${esc(item.name)}">${esc(item.name)}</div>
          <div class="feed-meta">${esc(item.rarity || 'Unknown')} • ${esc(item.type || 'Armor')} • ${esc(item.equippable || '')}</div>
          ${renderStats(item)}
        </div>
        <div class="feed-side"><div class="feed-total-badge" title="Base stat total">${Number(item.total || 0)}</div><div class="feed-tier-badge">T${Number(item.tier || 0) || '-'}</div>${renderTags(item)}</div>
      `;
      card.querySelector('.feed-dismiss')?.addEventListener('click', () => dismissFeedItem(item.id));
      card.querySelectorAll('.feed-tag-btn').forEach((btn) => btn.addEventListener('click', () => assignTag(item.id, btn.dataset.tag || '')));
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
    drawer.innerHTML = `<div class="item-feed-head"><div><h2 id="itemFeedTitle">Item Feed</h2><p class="muted compact">Recent armor feed: newest at the top, older recent drops below.</p></div><button id="itemFeedClose" class="item-feed-close" type="button" aria-label="Close item feed">×</button></div><div class="item-feed-actions"><button id="refreshFeedBtn" class="mini-feed-btn" type="button">Refresh</button><button id="clearFeedBtn" class="mini-feed-btn" type="button">Dismiss all</button></div><div id="itemFeedList" class="item-feed-list" aria-live="polite"></div>`;
    document.body.append(drawer, launcher);
    $('itemFeedClose')?.addEventListener('click', () => setDrawerOpen(false));
    $('refreshFeedBtn')?.addEventListener('click', () => $('bungieImportV2Btn')?.click());
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
    cards.forEach((card, index) => {
      const row = visible[index];
      const isRecent = recentIds.has(normId(row?.Id));
      card.classList.toggle('is-recent-found', isRecent);
      if (isRecent && !card.querySelector('.recent-pill')) {
        const meta = card.querySelector('.item-meta');
        const pill = document.createElement('span');
        pill.className = 'recent-pill';
        pill.textContent = '✨ Feed';
        meta?.append(' ', pill);
      }
      if (!isRecent) card.querySelector('.recent-pill')?.remove();
    });
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