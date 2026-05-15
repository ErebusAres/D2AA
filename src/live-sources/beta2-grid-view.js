(() => {
  const LS_VIEW = 'd2aa_beta2_view_mode_v1';
  const STAT_COLS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const STAT_LABELS = ['Health', 'Melee', 'Grenade', 'Super', 'Class', 'Weapon'];
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
  const ARCHETYPES = {
    bulwark: { stat: 'Health (Base)', fallback: '🛡️', label: 'Bulwark' },
    brawler: { stat: 'Melee (Base)', fallback: '✊', label: 'Brawler' },
    grenadier: { stat: 'Grenade (Base)', fallback: '💣', label: 'Grenadier' },
    specialist: { stat: 'Super (Base)', fallback: '✨', label: 'Specialist' },
    paragon: { stat: 'Class (Base)', fallback: '◇', label: 'Paragon' },
    gunner: { stat: 'Weapons (Base)', fallback: '🎯', label: 'Gunner' },
    balanced: { stat: '', fallback: '⚖️', label: 'Balanced' }
  };
  const STAT_TO_ARCHETYPE = { 'Health (Base)': 'bulwark', 'Melee (Base)': 'brawler', 'Grenade (Base)': 'grenadier', 'Super (Base)': 'specialist', 'Class (Base)': 'paragon', 'Weapons (Base)': 'gunner' };
  const GROUP_COLORS = ['#b57cff', '#66d9ff', '#ffcf66', '#77ffb0', '#ff7ca8', '#ffa66b', '#9cfffb', '#d5ff6b'];
  const $ = (id) => document.getElementById(id);
  const num = (v) => Number(v || 0);
  const normId = (v) => String(v || '').trim();
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const slotLabel = (type) => ['Warlock Bond', 'Hunter Cloak', 'Titan Mark'].includes(type) ? 'Class Item' : (type || 'Armor');
  const tagEmoji = (tag) => ({ feed: '✨', favorite: '❤️', keep: '🏷️', junk: '🚫', infuse: '⚡', archive: '📦' }[String(tag || '').toLowerCase()] || '');
  const tagLabel = (tag) => ({ feed: 'Item Feed', favorite: 'Favorite', keep: 'Keep', junk: 'Junk', infuse: 'Infuse', archive: 'Archive', '': 'No tag' }[String(tag || '').toLowerCase()] || 'No tag');
  const state = () => window.D2AA?.getState?.() || {};
  const visibleRows = () => state().visible || [];
  const allRows = () => state().rows || [];
  const statClass = (v) => { const n = num(v); if (n >= 30) return 'stat-cyan'; if (n >= 24) return 'stat-green'; if (n >= 15) return 'stat-yellow'; return 'stat-red'; };
  const rarityClass = (rarity) => `rarity-${String(rarity || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const mask = (url, label, cls = 'grid-mask-icon') => `<span class="${cls}" title="${esc(label)}" style="mask-image:url('${url}');-webkit-mask-image:url('${url}')"></span>`;
  const img = (url, label, cls = 'grid-mini-icon') => url ? `<img class="${cls}" src="${url}" alt="${esc(label)}" title="${esc(label)}" loading="lazy">` : '';
  const itemIcon = (row) => row.IconUrl || row.Icon || row.DisplayIcon || row.ScreenshotUrl || '';
  const firstNumber = (...values) => { for (const value of values) { const match = String(value ?? '').match(/\d{1,5}/); if (match) return Number(match[0]); } return 0; };
  const lightLevel = (row) => firstNumber(row.Light, row.Power, row.PowerLevel, row.Power_Level, row['Power Level'], row['Light Level'], row.PrimaryStat, row['Primary Stat'], row.Level, row['Item Level'], row.__raw?.Light, row.__raw?.Power, row.__raw?.PowerLevel, row.__raw?.Power_Level, row.__raw?.['Power Level'], row.__raw?.['Light Level'], row.__raw?.PrimaryStat, row.__raw?.['Primary Stat'], row.__raw?.Level);
  const tierFor = (row) => {
    if (row?.TierSource === 'BaseStatFallback') return 0;
    const explicit = num(row?.GearTier);
    const legacy = num(row?.Tier);
    const tier = explicit || legacy;
    return Math.max(0, Math.min(5, tier));
  };
  const tierDiamonds = (row) => `<span class="tier-filled">${'◆'.repeat(tierFor(row))}</span><span class="tier-empty">${'◇'.repeat(5 - tierFor(row))}</span>`;
  let lastGridSignature = '';
  let lastOverviewSignature = '';
  let rowById = new Map();

  function viewMode() { return localStorage.getItem(LS_VIEW) || 'grid'; }
  function groupColor(row) { if (!row?.Is_Dupe) return ''; const key = `${row.GroupKey || ''}:${row.Dupe_Group || ''}`; let hash = 0; for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0; return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length]; }
  function locationLabel(row) { return row.Source === 'Bungie' ? (row.IsInVault ? 'Vault' : row.IsEquipped ? 'Equipped' : 'Inventory') : 'DIM'; }
  function locationIcon(row) { return row.IsInVault ? '🏦' : row.IsEquipped ? '⚔️' : row.Source === 'Bungie' ? '🎒' : '⧉'; }
  function normalize(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function explicitArchetype(row) {
    const raw = [row.Archetype, row.AAG, row.AAGTag, row['AAG Tag'], row.Role, row.Build, row.Focus, row.__raw?.Archetype, row.__raw?.AAG, row.__raw?.['AAG Tag']].filter(Boolean).join(' ');
    const value = normalize(raw);
    if (!value) return '';
    for (const key of Object.keys(ARCHETYPES)) if (value.includes(key)) return key;
    if (value.includes('weapon')) return 'gunner';
    if (value.includes('grenade') || value.includes('discipline')) return 'grenadier';
    if (value.includes('melee') || value.includes('strength')) return 'brawler';
    if (value.includes('health') || value.includes('resilience')) return 'bulwark';
    if (value.includes('super') || value.includes('intellect')) return 'specialist';
    if (value.includes('class') || value.includes('ability') || value.includes('mobility')) return 'paragon';
    return '';
  }
  function inferredArchetype(row) {
    const entries = STAT_COLS.map((stat) => ({ stat, value: num(row[stat]) })).sort((a, b) => b.value - a.value);
    const top = entries[0];
    const second = entries[1];
    if (!top || top.value <= 0) return 'balanced';
    if (second && Math.abs(top.value - second.value) <= 2) return 'balanced';
    return STAT_TO_ARCHETYPE[top.stat] || 'balanced';
  }
  function archetypeMarkup(row) {
    const key = explicitArchetype(row) || inferredArchetype(row);
    const data = ARCHETYPES[key] || ARCHETYPES.balanced;
    const icon = data.stat ? img(STAT_ICONS[data.stat], data.label, 'grid-aag-icon') : `<span class="grid-aag-emoji">${data.fallback}</span>`;
    return `<span class="grid-aag-badge" data-aag="${esc(key)}" title="${esc(data.label)}">${icon}</span>`;
  }
  function infoBadge(row) {
    const light = lightLevel(row);
    const tag = tagEmoji(row.Tag);
    if (!light && !tag) return `<button class="grid-tag is-empty" type="button" data-grid-action="tag" title="No tag — change tag"></button>`;
    return `<button class="grid-tag grid-info-badge${tag ? ' has-tag' : ''}" type="button" data-grid-action="tag" title="${esc(`${light ? `Light / Power ${light}` : ''}${light && tag ? ' • ' : ''}${tag ? `${tagLabel(row.Tag)} tag` : ''} — change tag`)}">${light ? `<span class="grid-info-light">${light}</span>` : ''}${light && tag ? '<span class="grid-info-dot">•</span>' : ''}${tag ? `<span class="grid-info-tag">${tag}</span>` : ''}</button>`;
  }
  function statSlot(row, stat) {
    const label = stat.replace(' (Base)', '');
    const val = num(row[stat]);
    return `<div class="grid-slot-stat grid-stat ${statClass(val)}" title="${esc(label)}: ${val}">${img(STAT_ICONS[stat], label)}<span>${val}</span></div>`;
  }
  function slotGrid(row) {
    const tier = tierFor(row);
    return `<div class="grid-slot-total grid-total" title="Base stat total">${num(row['Total (Base)'])}</div><div class="grid-slot-tier grid-tier" data-visual-tier="${tier}" data-tier-max="5" title="${esc(`Gear tier ${tier}/5${row.TierSource ? ` • ${row.TierSource}` : ''}`)}">${tierDiamonds(row)}</div><div class="grid-slot-aag">${archetypeMarkup(row)}</div>${STAT_COLS.map((stat) => statSlot(row, stat)).join('')}`;
  }
  function renderCompareButton(row) { return row.Is_Dupe ? `<button class="grid-action grid-action--compare" type="button" data-grid-action="compare-group" data-compare-group-id="${esc(normId(row.Dupe_Group))}" title="Compare duplicate group ${esc(normId(row.Dupe_Group))}">Compare group</button>` : ''; }
  function renderGroupButton(row, slot) { return row.Is_Dupe ? `<button class="grid-action grid-action--group" type="button" data-grid-action="group" data-compare-group-id="${esc(normId(row.Dupe_Group))}" title="${row.Source === 'Bungie' ? 'Pull/copy this duplicate group' : 'Copy all DIM IDs in this duplicate group'}">${mask(SLOT_ICONS[slot], `${slot} ${row.Dupe_Group}`, 'grid-action-slot-icon')}<span>${esc(row.Dupe_Group)}</span></button>` : ''; }
  function renderGridCard(row) {
    const icon = itemIcon(row);
    const fallback = slotLabel(row.Type).slice(0, 1).toUpperCase();
    const color = groupColor(row);
    const style = color ? ` style="--group-glow:${color}"` : '';
    const slot = slotLabel(row.Type);
    const disabled = row.Source === 'Bungie' && row.IsEquipped ? ' disabled' : '';
    const groupBadge = row.Is_Dupe ? `<span class="grid-group-badge" title="${esc(`${slot} duplicate group ${row.Dupe_Group || 'G'}`)}">${esc(normId(row.Dupe_Group) || 'G')}</span>` : '';
    return `<article class="grid-card ${rarityClass(row.Rarity)}${row.Is_Dupe ? ' is-dupe' : ''}" data-grid-id="${esc(normId(row.Id))}" data-compare-group-id="${esc(normId(row.Dupe_Group))}"${style}>${groupBadge}<div class="grid-card-top"><div class="grid-item-icon">${icon ? `<img src="${esc(icon)}" alt="" loading="lazy">` : `<span>${esc(fallback)}</span>`}</div><div class="grid-item-title"><div class="grid-item-name" title="${esc(row.Name)}">${esc(row.Name || '(Unnamed item)')}</div><div class="grid-icon-row">${img(RARITY_ICONS[row.Rarity], row.Rarity || 'Rarity')}${mask(SLOT_ICONS[slot], slot)}${mask(CLASS_ICONS[row.Equippable], row.Equippable)}<span class="grid-location" title="${esc(locationLabel(row))}">${locationIcon(row)}</span></div></div>${infoBadge(row)}</div><div class="grid-body" data-slot-grid="1">${slotGrid(row)}</div><div class="grid-actions${row.Is_Dupe ? '' : ' grid-actions--single'}"><button class="grid-action" type="button" data-grid-action="primary"${disabled}>${buttonText(row)}</button>${renderGroupButton(row, slot)}${renderCompareButton(row)}</div></article>`;
  }
  function buttonText(row) { if (row.Source !== 'Bungie') return 'Copy'; if (row.IsEquipped) return 'Equipped'; return row.IsInVault ? 'Pull' : 'Vault'; }
  function gridSignature(rows) { return rows.map((row) => [normId(row.Id), row.Tag || '', row.GearTier || row.Tier || '', row.TierSource || '', lightLevel(row), row.Rank || '', row.Is_Dupe ? 1 : 0, row.Dupe_Group || '', row.GroupKey || '', row.Source || '', row.IsInVault ? 1 : 0, row.IsEquipped ? 1 : 0, row['Total (Base)'] || '', STAT_COLS.map((s) => row[s] || 0).join(',')].join('|')).join('~'); }
  function renderClassOverview() {
    let host = $('gridOverview');
    const tablePanel = document.querySelector('.table-panel');
    if (!tablePanel) return;
    if (!host) { host = document.createElement('div'); host.id = 'gridOverview'; host.className = 'd2aa-grid-overview'; tablePanel.querySelector('.table-topbar')?.after(host); }
    const s = state();
    const stats = { Warlock: { total: 0, sum: 0, visible: 0, dupes: 0 }, Hunter: { total: 0, sum: 0, visible: 0, dupes: 0 }, Titan: { total: 0, sum: 0, visible: 0, dupes: 0 } };
    for (const row of allRows()) { const bucket = stats[row.Equippable]; if (bucket) { bucket.total++; bucket.sum += num(row['Total (Base)']); } }
    for (const row of visibleRows()) { const bucket = stats[row.Equippable]; if (bucket) { bucket.visible++; if (row.Is_Dupe) bucket.dupes++; } }
    const sig = ['Warlock', 'Hunter', 'Titan'].map((cls) => `${cls}:${stats[cls].total}:${stats[cls].visible}:${stats[cls].dupes}:${stats[cls].sum}:${s.classFilter === cls ? 1 : 0}`).join('|');
    if (sig === lastOverviewSignature && host.children.length) return;
    lastOverviewSignature = sig;
    host.innerHTML = ['Warlock', 'Hunter', 'Titan'].map((cls) => {
      const info = stats[cls];
      const avg = info.total ? Math.round(info.sum / info.total) : 0;
      return `<button class="grid-class-card${s.classFilter === cls ? ' is-active' : ''}${info.total ? '' : ' is-empty'}" type="button" data-grid-class="${cls}">${mask(CLASS_ICONS[cls], cls, 'grid-class-icon')}<span><span class="grid-class-title">${cls}</span><span class="grid-class-meta"><span class="class-pill">${info.total} armor</span><span class="class-pill">${info.dupes} dupes</span><span class="class-pill">avg ${avg}</span></span></span><span class="grid-class-total">${info.visible}</span></button>`;
    }).join('');
  }
  function renderGrid(force = false) {
    renderClassOverview();
    if (viewMode() !== 'grid') return;
    const host = $('rows');
    if (!host) return;
    const rows = visibleRows();
    const sig = gridSignature(rows);
    const mustReplaceTable = Boolean(host.querySelector('.armor-row'));
    if (!force && sig === lastGridSignature && host.querySelector('.grid-card') && !mustReplaceTable) return;
    lastGridSignature = sig;
    rowById = new Map(rows.map((row) => [normId(row.Id), row]));
    host.innerHTML = rows.map(renderGridCard).join('');
  }
  function tableRowFor(row) { return [...document.querySelectorAll('.armor-row')].find((el, index) => visibleRows()[index]?.Id === row.Id); }
  function tagClick(row) { tableRowFor(row)?.querySelector('.tag-btn')?.click(); }
  async function primaryClick(row, btn) {
    const tableBtn = tableRowFor(row)?.querySelector('.action-stack button');
    if (tableBtn) { tableBtn.click(); btn.textContent = '...'; setTimeout(() => window.D2AA?.render?.(), 900); return; }
    try { await navigator.clipboard.writeText(`id:${normId(row.Id)}`); btn.textContent = 'Copied'; } catch (_) { btn.textContent = 'Failed'; }
    setTimeout(() => { btn.textContent = buttonText(row); }, 900);
  }
  function sameGroup(a, b) { return a && b && normId(a.Dupe_Group) === normId(b.Dupe_Group) && (!a.GroupKey || !b.GroupKey || a.GroupKey === b.GroupKey); }
  function getGroupRows(row) { return visibleRows().filter((item) => item.Is_Dupe && sameGroup(item, row)); }
  async function groupClick(row, btn) {
    const text = getGroupRows(row).map((item) => `id:${normId(item.Id)}`).join(' or ');
    try { await navigator.clipboard.writeText(text); btn.classList.add('is-success'); } catch (_) { btn.classList.add('is-error'); }
    setTimeout(() => btn.classList.remove('is-success', 'is-error'), 900);
  }
  function openCompare(row) {
    const group = getGroupRows(row);
    if (!group.length) return;
    let modal = $('d2aaCompareGroupModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'd2aaCompareGroupModal';
      modal.className = 'd2aa-compare-modal';
      modal.innerHTML = '<div class="d2aa-compare-backdrop" data-compare-close="1"></div><section class="d2aa-compare-panel" role="dialog" aria-modal="true"><header class="d2aa-compare-head"><div><p class="eyebrow">Duplicate group</p><h2 id="d2aaCompareTitle">Compare Group</h2></div><button class="d2aa-compare-close" type="button" data-compare-close="1">×</button></header><div class="d2aa-compare-body" id="d2aaCompareBody"></div></section>';
      modal.addEventListener('click', (e) => { if (e.target.closest('[data-compare-close]')) modal.classList.remove('is-open'); });
      document.body.appendChild(modal);
    }
    const best = Object.fromEntries(STAT_COLS.map((stat) => [stat, Math.max(...group.map((item) => num(item[stat])))]));
    $('d2aaCompareTitle').textContent = `${slotLabel(row.Type)} Group ${row.Dupe_Group}`;
    $('d2aaCompareBody').innerHTML = `<div class="d2aa-compare-tools"><span>${group.length} matching items</span></div><div class="d2aa-compare-grid">${group.map((item) => `<article class="d2aa-compare-item"><div class="d2aa-compare-title"><strong>${esc(item.Name || '(Unnamed item)')}</strong><span>${esc(item.Equippable || '')} • ${esc(slotLabel(item.Type))} • ${esc(item.Rarity || '')}</span></div><div class="d2aa-compare-summary"><span>${num(item['Total (Base)'])}</span><span>${tierDiamonds(item)}</span></div><div class="d2aa-compare-stats">${STAT_COLS.map((stat, i) => `<div class="d2aa-compare-stat${best[stat] === num(item[stat]) ? ' is-best' : ''}"><span>${STAT_LABELS[i]}</span><strong>${num(item[stat])}</strong></div>`).join('')}</div></article>`).join('')}</div>`;
    modal.classList.add('is-open');
  }
  function bindActions() {
    const host = $('rows');
    if (!host || host.dataset.gridActionsBound === '1') return;
    host.dataset.gridActionsBound = '1';
    host.addEventListener('click', (event) => {
      const action = event.target.closest('[data-grid-action]');
      const card = event.target.closest('.grid-card');
      if (!action || !card || !host.contains(card)) return;
      const row = rowById.get(card.dataset.gridId);
      if (!row) return;
      if (action.dataset.gridAction === 'tag') return tagClick(row);
      event.preventDefault();
      event.stopPropagation();
      if (action.dataset.gridAction === 'primary') primaryClick(row, action);
      if (action.dataset.gridAction === 'group') groupClick(row, action);
      if (action.dataset.gridAction === 'compare-group') openCompare(row);
    });
  }
  function updateViewToggle() { document.body.classList.toggle('grid-view', viewMode() === 'grid'); document.querySelectorAll('[data-view-mode]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.viewMode === viewMode())); }
  function setViewMode(mode) { localStorage.setItem(LS_VIEW, mode === 'table' ? 'table' : 'grid'); lastGridSignature = ''; updateViewToggle(); window.D2AA?.render?.(); }
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
    window.D2AA.render = () => { originalRender(); updateViewToggle(); renderGrid(true); };
    window.D2AA.__gridViewPatched = true;
  }
  function run() {
    if (!window.D2AA) { setTimeout(run, 50); return; }
    if (!localStorage.getItem(LS_VIEW)) localStorage.setItem(LS_VIEW, 'grid');
    injectToggle();
    bindActions();
    patchRender();
    updateViewToggle();
    window.D2AA.render?.();
    renderGrid(true);
    setTimeout(() => { if (viewMode() === 'grid') setViewMode('grid'); }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
