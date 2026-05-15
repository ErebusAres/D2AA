(() => {
  const LS_VIEW = 'd2aa_beta2_view_mode_v1';
  const STAT_COLS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const STAT_ICONS = {
    'Health (Base)': 'https://www.bungie.net/common/destiny2_content/icons/717b8b218cc14325a54869bef21d2964.png',
    'Melee (Base)': 'https://www.bungie.net/common/destiny2_content/icons/fa534aca76d7f2d7e7b4ba4df4271b42.png',
    'Grenade (Base)': 'https://www.bungie.net/common/destiny2_content/icons/065cdaabef560e5808e821cefaeaa22c.png',
    'Super (Base)': 'https://www.bungie.net/common/destiny2_content/icons/585ae4ede9c3da96b34086fccccdc8cd.png',
    'Class (Base)': 'https://www.bungie.net/common/destiny2_content/icons/7eb845acb5b3a4a9b7e0b2f05f5c43f1.png',
    'Weapons (Base)': 'https://www.bungie.net/common/destiny2_content/icons/bc69675acdae9e6b9a68a02fb4d62e07.png'
  };
  const RARITY_ICONS = { Legendary: 'https://www.bungie.net/common/destiny2_content/icons/f846f489c2a97afb289b357e431ecf8d.png', Exotic: 'https://www.bungie.net/common/destiny2_content/icons/3e6a698e1a8a5fb446fdcbf1e63c5269.png' };
  const CLASS_ICONS = { Warlock: 'https://www.bungie.net/common/destiny2_content/icons/e4006d9a8fe167bd7e83193d7601c89a.png', Hunter: 'https://www.bungie.net/common/destiny2_content/icons/05e32a388d9a65a0ef59b2193eee2db4.png', Titan: 'https://www.bungie.net/common/destiny2_content/icons/46a19ddd00d0f6ca822230943103b54a.png' };
  const SLOT_ICONS = { Helmet: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/helmet.svg', Gauntlets: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/gloves.svg', 'Chest Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/chest.svg', 'Leg Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/boots.svg', 'Class Item': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/class.svg' };
  const GROUP_COLORS = ['#b57cff', '#66d9ff', '#ffcf66', '#77ffb0', '#ff7ca8', '#ffa66b', '#9cfffb', '#d5ff6b'];
  const $ = (id) => document.getElementById(id);
  const num = (v) => Number(v || 0);
  const normId = (v) => String(v || '').trim();
  const slotLabel = (type) => ['Warlock Bond', 'Hunter Cloak', 'Titan Mark'].includes(type) ? 'Class Item' : type;
  const tagEmoji = (tag) => ({ favorite: '❤️', keep: '🏷️', junk: '🚫', infuse: '⚡', archive: '📦' }[String(tag || '').toLowerCase()] || '＋');
  const tagLabel = (tag) => ({ favorite: 'Favorite', keep: 'Keep', junk: 'Junk', infuse: 'Infuse', archive: 'Archive', '': 'No tag' }[String(tag || '').toLowerCase()] || 'No tag');
  const statClass = (v) => { const n = num(v); if (n >= 30) return 'stat-cyan'; if (n >= 24) return 'stat-green'; if (n >= 15) return 'stat-yellow'; return 'stat-red'; };
  const rarityClass = (rarity) => `rarity-${String(rarity || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const locationLabel = (row) => row.Source === 'Bungie' ? (row.IsInVault ? 'Vault' : row.IsEquipped ? 'Equipped' : 'Inventory') : 'DIM';
  const locationIcon = (row) => row.IsInVault ? '🏦' : row.IsEquipped ? '⚔️' : row.Source === 'Bungie' ? '🎒' : '⧉';
  const itemIcon = (row) => row.IconUrl || row.Icon || row.DisplayIcon || row.ScreenshotUrl || '';
  const tierDiamonds = (row) => { const t = Math.max(0, Math.min(5, num(row.Tier))); return `${'◆'.repeat(t)}${'◇'.repeat(5 - t)}`; };
  const lightLevel = (row) => num(row.Light || row.Power || row['Power Level'] || row['Light Level'] || row.PowerLevel || row.PrimaryStat || row['Primary Stat']);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const mask = (url, label, cls = 'grid-mask-icon') => `<span class="${cls}" title="${escapeHtml(label)}" style="mask-image:url('${url}');-webkit-mask-image:url('${url}')"></span>`;
  const img = (url, label, cls = 'grid-mini-icon') => url ? `<img class="${cls}" src="${url}" alt="${escapeHtml(label)}" title="${escapeHtml(label)}" loading="lazy">` : '';

  function viewMode() { return localStorage.getItem(LS_VIEW) || 'grid'; }
  function setViewMode(mode) { localStorage.setItem(LS_VIEW, mode === 'table' ? 'table' : 'grid'); document.body.classList.toggle('grid-view', mode !== 'table'); updateViewToggle(); window.D2AA?.render?.(); }
  function state() { return window.D2AA?.getState?.(); }
  function groupColor(row) {
    if (!row?.Is_Dupe) return '';
    const key = `${row.GroupKey || ''}:${row.Dupe_Group || ''}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
  }

  function renderStats(row) {
    return `<div class="grid-stats">${STAT_COLS.map((stat) => `<div class="grid-stat ${statClass(row[stat])}" title="${escapeHtml(stat.replace(' (Base)', ''))}: ${num(row[stat])}">${img(STAT_ICONS[stat], stat.replace(' (Base)', ''))}<span>${num(row[stat])}</span></div>`).join('')}</div>`;
  }

  function renderClassOverview() {
    let host = $('gridOverview');
    const tablePanel = document.querySelector('.table-panel');
    if (!tablePanel) return;
    if (!host) {
      host = document.createElement('div');
      host.id = 'gridOverview';
      host.className = 'd2aa-grid-overview';
      tablePanel.querySelector('.table-topbar')?.after(host);
    }
    const s = state();
    const rows = s?.rows || [];
    host.innerHTML = ['Warlock', 'Hunter', 'Titan'].map((cls) => {
      const classRows = rows.filter((row) => row.Equippable === cls);
      const visibleRows = (s?.visible || []).filter((row) => row.Equippable === cls);
      const avg = classRows.length ? Math.round(classRows.reduce((sum, row) => sum + num(row['Total (Base)']), 0) / classRows.length) : 0;
      const dupes = visibleRows.filter((row) => row.Is_Dupe).length;
      return `<button class="grid-class-card${s?.classFilter === cls ? ' is-active' : ''}" type="button" data-grid-class="${cls}">
        ${mask(CLASS_ICONS[cls], cls, 'grid-class-icon')}
        <span><span class="grid-class-title">${cls}</span><span class="grid-class-meta">${classRows.length} armor • ${dupes} shown dupes • avg ${avg}</span></span>
        <span class="grid-class-total">${visibleRows.length}</span>
      </button>`;
    }).join('');
    host.querySelectorAll('[data-grid-class]').forEach((btn) => btn.addEventListener('click', () => { const s2 = state(); if (!s2) return; s2.classFilter = btn.dataset.gridClass; window.D2AA?.render?.(); }));
  }

  function buttonText(row) {
    if (row.Source !== 'Bungie') return 'Copy';
    if (row.IsEquipped) return 'Equipped';
    return row.IsInVault ? 'Pull' : 'Vault';
  }

  function renderGroupButton(row, slot) {
    if (!row.Is_Dupe) return '';
    const label = `${slot} ${row.Dupe_Group}`;
    return `<button class="grid-action grid-action--group" type="button" data-grid-action="group" title="${row.Source === 'Bungie' ? 'Pull/copy this duplicate group' : 'Copy all DIM IDs in this duplicate group'}">
      ${mask(SLOT_ICONS[slot], label, 'grid-action-slot-icon')}<span>${escapeHtml(row.Dupe_Group)}</span>
    </button>`;
  }

  function renderGridCard(row) {
    const icon = itemIcon(row);
    const fallback = slotLabel(row.Type).slice(0, 1).toUpperCase();
    const gColor = groupColor(row);
    const style = gColor ? ` style="--group-glow:${gColor}"` : '';
    const slot = slotLabel(row.Type);
    const actionDisabled = row.Source === 'Bungie' && row.IsEquipped ? ' disabled' : '';
    const groupText = row.Is_Dupe ? `${row.Dupe_Group}` : `${row.Rarity || 'Unknown'}`;
    const light = lightLevel(row);
    return `<article class="grid-card ${rarityClass(row.Rarity)}${row.Is_Dupe ? ' is-dupe' : ''}" data-grid-id="${escapeHtml(normId(row.Id))}"${style}>
      <div class="grid-card-top">
        <div class="grid-item-icon">${icon ? `<img src="${escapeHtml(icon)}" alt="" loading="lazy">` : `<span>${fallback}</span>`}${light ? `<span class="grid-light" title="Light / Power level">${light}</span>` : ''}</div>
        <div class="grid-item-title">
          <div class="grid-item-name" title="${escapeHtml(row.Name)}">${escapeHtml(row.Name || '(Unnamed item)')}</div>
          <div class="grid-icon-row">
            ${img(RARITY_ICONS[row.Rarity], row.Rarity || 'Rarity')}
            ${mask(SLOT_ICONS[slot], slot)}
            ${mask(CLASS_ICONS[row.Equippable], row.Equippable)}
            <span class="grid-location" title="${escapeHtml(locationLabel(row))}">${locationIcon(row)}</span>
          </div>
        </div>
        <button class="grid-tag" type="button" data-grid-action="tag" title="${escapeHtml(tagLabel(row.Tag))} — change tag">${tagEmoji(row.Tag)}</button>
      </div>
      <div class="grid-body">
        <div class="grid-primary-row"><span class="grid-total" title="Base stat total">${num(row['Total (Base)'])}</span><span class="grid-tier" title="Tier ${num(row.Tier)}">${tierDiamonds(row)}</span><span class="grid-rank" title="Rank">${escapeHtml(row.Rank || '')}</span></div>
        ${renderStats(row)}
        <div class="grid-group-row"><span class="grid-group" title="${escapeHtml(row.Is_Dupe ? `${slot} duplicate group ${row.Dupe_Group}` : `${row.Rarity || 'Unknown'} solo item`)}">${row.Is_Dupe ? `${mask(SLOT_ICONS[slot], slot, 'grid-group-slot-icon')}` : ''}<span>${escapeHtml(groupText)}</span></span>${light ? `<span class="grid-power-pill" title="Light / Power level">✦ ${light}</span>` : ''}</div>
      </div>
      <div class="grid-actions${row.Is_Dupe ? '' : ' grid-actions--single'}">
        <button class="grid-action" type="button" data-grid-action="primary"${actionDisabled}>${buttonText(row)}</button>
        ${renderGroupButton(row, slot)}
      </div>
    </article>`;
  }

  function primaryClick(row, btn) {
    const tableRow = [...document.querySelectorAll('.armor-row')].find((el, index) => state()?.visible?.[index]?.Id === row.Id);
    const tableBtn = tableRow?.querySelector('.action-stack button');
    if (tableBtn) { tableBtn.click(); btn.textContent = '...'; setTimeout(() => window.D2AA?.render?.(), 900); return; }
    navigator.clipboard?.writeText(`id:${normId(row.Id)}`);
  }

  function tagClick(row) {
    const tableRow = [...document.querySelectorAll('.armor-row')].find((el, index) => state()?.visible?.[index]?.Id === row.Id);
    const tagBtn = tableRow?.querySelector('.tag-btn');
    if (tagBtn) tagBtn.click();
  }

  async function groupClick(row, btn) {
    if (!row.Is_Dupe) return;
    const rows = state()?.visible || [];
    const groupIds = rows.filter((item) => item.GroupKey === row.GroupKey && item.Dupe_Group === row.Dupe_Group).map((item) => `id:${normId(item.Id)}`).join(' or ');
    try { await navigator.clipboard.writeText(groupIds); btn.classList.add('is-success'); } catch (_) { btn.classList.add('is-error'); }
    setTimeout(() => { btn.classList.remove('is-success', 'is-error'); }, 900);
  }

  function renderGridIfNeeded() {
    renderClassOverview();
    if (viewMode() !== 'grid') return;
    const host = $('rows');
    const rows = state()?.visible || [];
    if (!host) return;
    host.innerHTML = rows.map(renderGridCard).join('');
    host.querySelectorAll('.grid-card').forEach((card) => {
      const row = rows.find((item) => normId(item.Id) === card.dataset.gridId);
      if (!row) return;
      card.querySelector('[data-grid-action="tag"]')?.addEventListener('click', () => tagClick(row));
      card.querySelector('[data-grid-action="primary"]')?.addEventListener('click', (event) => primaryClick(row, event.currentTarget));
      card.querySelector('[data-grid-action="group"]')?.addEventListener('click', (event) => groupClick(row, event.currentTarget));
    });
  }

  function updateViewToggle() {
    document.body.classList.toggle('grid-view', viewMode() === 'grid');
    document.querySelectorAll('[data-view-mode]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.viewMode === viewMode()));
  }

  function injectToggle() {
    if ($('viewToggle')) return;
    const nav = document.querySelector('.shell-actions');
    const toggle = document.createElement('div');
    toggle.id = 'viewToggle';
    toggle.className = 'shell-view-toggle';
    toggle.innerHTML = `<button type="button" data-view-mode="table" title="Table view">Table</button><button type="button" data-view-mode="grid" title="Grid view">Grid</button>`;
    toggle.querySelectorAll('[data-view-mode]').forEach((btn) => btn.addEventListener('click', () => setViewMode(btn.dataset.viewMode)));
    nav?.prepend(toggle);
    updateViewToggle();
  }

  function patchRender() {
    if (!window.D2AA || window.D2AA.__gridViewPatched) return;
    const originalRender = window.D2AA.render;
    window.D2AA.render = () => { originalRender(); renderGridIfNeeded(); updateViewToggle(); };
    window.D2AA.__gridViewPatched = true;
  }

  function run() { injectToggle(); patchRender(); updateViewToggle(); renderGridIfNeeded(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();