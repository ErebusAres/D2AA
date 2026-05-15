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
  const ARCHETYPES = {
    bulwark: { stat: 'Health (Base)', fallback: '🛡️', label: 'Bulwark', desc: 'Health-focused armor roll' },
    brawler: { stat: 'Melee (Base)', fallback: '✊', label: 'Brawler', desc: 'Melee-focused armor roll' },
    grenadier: { stat: 'Grenade (Base)', fallback: '💣', label: 'Grenadier', desc: 'Grenade-focused armor roll' },
    specialist: { stat: 'Super (Base)', fallback: '✨', label: 'Specialist', desc: 'Super-focused armor roll' },
    paragon: { stat: 'Class (Base)', fallback: '◇', label: 'Paragon', desc: 'Class ability-focused armor roll' },
    gunner: { stat: 'Weapons (Base)', fallback: '🎯', label: 'Gunner', desc: 'Weapons-focused armor roll' },
    balanced: { stat: '', fallback: '⚖️', label: 'Balanced', desc: 'Evenly distributed armor roll' }
  };
  const STAT_TO_ARCHETYPE = {
    'Health (Base)': 'bulwark',
    'Melee (Base)': 'brawler',
    'Grenade (Base)': 'grenadier',
    'Super (Base)': 'specialist',
    'Class (Base)': 'paragon',
    'Weapons (Base)': 'gunner'
  };
  const RARITY_ICONS = { Legendary: 'https://www.bungie.net/common/destiny2_content/icons/f846f489c2a97afb289b357e431ecf8d.png', Exotic: 'https://www.bungie.net/common/destiny2_content/icons/3e6a698e1a8a5fb446fdcbf1e63c5269.png' };
  const CLASS_ICONS = { Warlock: 'https://www.bungie.net/common/destiny2_content/icons/e4006d9a8fe167bd7e83193d7601c89a.png', Hunter: 'https://www.bungie.net/common/destiny2_content/icons/05e32a388d9a65a0ef59b2193eee2db4.png', Titan: 'https://www.bungie.net/common/destiny2_content/icons/46a19ddd00d0f6ca822230943103b54a.png' };
  const SLOT_ICONS = { Helmet: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/helmet.svg', Gauntlets: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/gloves.svg', 'Chest Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/chest.svg', 'Leg Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/boots.svg', 'Class Item': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/class.svg' };
  const GROUP_COLORS = ['#b57cff', '#66d9ff', '#ffcf66', '#77ffb0', '#ff7ca8', '#ffa66b', '#9cfffb', '#d5ff6b'];
  const $ = (id) => document.getElementById(id);
  const num = (v) => Number(v || 0);
  const normId = (v) => String(v || '').trim();
  const slotLabel = (type) => ['Warlock Bond', 'Hunter Cloak', 'Titan Mark'].includes(type) ? 'Class Item' : type;
  const tagEmoji = (tag) => ({ feed: '✨', favorite: '❤️', keep: '🏷️', junk: '🚫', infuse: '⚡', archive: '📦' }[String(tag || '').toLowerCase()] || '');
  const tagLabel = (tag) => ({ feed: 'Item Feed', favorite: 'Favorite', keep: 'Keep', junk: 'Junk', infuse: 'Infuse', archive: 'Archive', '': 'No tag' }[String(tag || '').toLowerCase()] || 'No tag');
  const statClass = (v) => { const n = num(v); if (n >= 30) return 'stat-cyan'; if (n >= 24) return 'stat-green'; if (n >= 15) return 'stat-yellow'; return 'stat-red'; };
  const rarityClass = (rarity) => `rarity-${String(rarity || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const normalize = (v) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  const locationLabel = (row) => row.Source === 'Bungie' ? (row.IsInVault ? 'Vault' : row.IsEquipped ? 'Equipped' : 'Inventory') : 'DIM';
  const locationIcon = (row) => row.IsInVault ? '🏦' : row.IsEquipped ? '⚔️' : row.Source === 'Bungie' ? '🎒' : '⧉';
  const itemIcon = (row) => row.IconUrl || row.Icon || row.DisplayIcon || row.ScreenshotUrl || '';
  const tierFor = (row) => { const explicit = num(row?.GearTier || row?.Tier); return explicit >= 1 && explicit <= 5 ? explicit : 1; };
  const tierDiamonds = (row) => { const t = Math.max(0, Math.min(5, tierFor(row))); return `<span class="tier-filled">${'◆'.repeat(t)}</span><span class="tier-empty">${'◇'.repeat(5 - t)}</span>`; };
  const firstNumber = (...values) => { for (const value of values) { const match = String(value ?? '').match(/\d{3,5}/); if (match) return Number(match[0]); } return 0; };
  const lightLevel = (row) => firstNumber(row.Light, row.Power, row.PowerLevel, row['Power Level'], row['Light Level'], row.PrimaryStat, row['Primary Stat'], row.Level, row['Item Level'], row.__raw?.Power, row.__raw?.['Power Level'], row.__raw?.['Light Level'], row.__raw?.Level);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const mask = (url, label, cls = 'grid-mask-icon') => `<span class="${cls}" title="${escapeHtml(label)}" style="mask-image:url('${url}');-webkit-mask-image:url('${url}')"></span>`;
  const img = (url, label, cls = 'grid-mini-icon') => url ? `<img class="${cls}" src="${url}" alt="${escapeHtml(label)}" title="${escapeHtml(label)}" loading="lazy">` : '';
  let renderingGrid = false;
  let pendingEnsure = 0;
  let lastGridSignature = '';
  let lastOverviewSignature = '';
  let rowById = new Map();

  function viewMode() { return localStorage.getItem(LS_VIEW) || 'grid'; }
  function setViewMode(mode) {
    localStorage.setItem(LS_VIEW, mode === 'table' ? 'table' : 'grid');
    document.body.classList.toggle('grid-view', mode !== 'table');
    lastGridSignature = '';
    updateViewToggle();
    window.D2AA?.render?.();
    scheduleEnsureGridRendered();
  }
  function state() { return window.D2AA?.getState?.(); }
  function groupColor(row) { if (!row?.Is_Dupe) return ''; const key = `${row.GroupKey || ''}:${row.Dupe_Group || ''}`; let hash = 0; for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0; return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length]; }
  function gridSignature(rows) { return rows.map((row) => [normId(row.Id), row.Tag || '', row.GearTier || row.Tier || '', row.TierSource || '', row.Rank || '', row.Is_Dupe ? 1 : 0, row.Dupe_Group || '', row.GroupKey || '', row.Source || '', row.IsInVault ? 1 : 0, row.IsEquipped ? 1 : 0, row['Total (Base)'] || '', STAT_COLS.map((s) => row[s] || 0).join(',')].join('|')).join('~'); }

  function explicitArchetype(row) {
    const raw = [row.Archetype, row.AAG, row.AAGTag, row['AAG Tag'], row.Role, row.Build, row.Focus, row['Armor Focus'], row.__raw?.Archetype, row.__raw?.AAG, row.__raw?.['AAG Tag'], row.__raw?.Role, row.__raw?.Focus].filter(Boolean).join(' ');
    const value = normalize(raw);
    if (!value) return '';
    for (const key of Object.keys(ARCHETYPES)) if (value.includes(key)) return key;
    if (value.includes('weapon')) return 'gunner';
    if (value.includes('grenade') || value.includes('discipline')) return 'grenadier';
    if (value.includes('melee') || value.includes('strength')) return 'brawler';
    if (value.includes('health') || value.includes('resilience')) return 'bulwark';
    if (value.includes('super') || value.includes('intellect')) return 'specialist';
    if (value.includes('class') || value.includes('ability')) return 'paragon';
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
    const topStats = STAT_COLS.map((stat) => `${stat.replace(' (Base)', '')}: ${num(row[stat])}`).join('\n');
    const icon = data.stat ? img(STAT_ICONS[data.stat], data.label, 'grid-aag-icon') : `<span class="grid-aag-emoji">${data.fallback}</span>`;
    return `<span class="grid-aag-badge" data-aag="${escapeHtml(key)}" title="${escapeHtml(`${data.label}\n${data.desc}\n\n${topStats}`)}" aria-label="${escapeHtml(data.label)} archetype">${icon}</span>`;
  }
  function statSlot(row, stat) {
    const label = stat.replace(' (Base)', '');
    const val = num(row[stat]);
    return `<div class="grid-slot-stat grid-stat ${statClass(val)}" title="${escapeHtml(label)}: ${val}">${img(STAT_ICONS[stat], label)}<span>${val}</span></div>`;
  }
  function renderSlotGrid(row) {
    const tier = tierFor(row);
    const source = row.TierSource ? ` • ${row.TierSource}` : '';
    return `<div class="grid-slot-total grid-total" title="Base stat total">${num(row['Total (Base)'])}</div><div class="grid-slot-tier grid-tier" data-visual-tier="${tier}" data-tier-max="5" title="${escapeHtml(`${row.Rarity || 'Armor'} gear tier ${tier}/5${source}`)}">${tierDiamonds(row)}</div><div class="grid-slot-aag">${archetypeMarkup(row)}</div>${STAT_COLS.map((stat) => statSlot(row, stat)).join('')}`;
  }

  function renderClassOverview() {
    let host = $('gridOverview');
    const tablePanel = document.querySelector('.table-panel');
    if (!tablePanel) return;
    if (!host) { host = document.createElement('div'); host.id = 'gridOverview'; host.className = 'd2aa-grid-overview'; tablePanel.querySelector('.table-topbar')?.after(host); }
    const s = state();
    const rows = s?.rows || [];
    const visible = s?.visible || [];
    const stats = { Warlock: { total: 0, sum: 0, visible: 0, dupes: 0 }, Hunter: { total: 0, sum: 0, visible: 0, dupes: 0 }, Titan: { total: 0, sum: 0, visible: 0, dupes: 0 } };
    for (const row of rows) { const bucket = stats[row.Equippable]; if (!bucket) continue; bucket.total += 1; bucket.sum += num(row['Total (Base)']); }
    for (const row of visible) { const bucket = stats[row.Equippable]; if (!bucket) continue; bucket.visible += 1; if (row.Is_Dupe) bucket.dupes += 1; }
    const sig = ['Warlock', 'Hunter', 'Titan'].map((cls) => `${cls}:${stats[cls].total}:${stats[cls].visible}:${stats[cls].dupes}:${stats[cls].sum}:${s?.classFilter === cls ? 1 : 0}`).join('|');
    if (sig === lastOverviewSignature && host.children.length) return;
    lastOverviewSignature = sig;
    host.innerHTML = ['Warlock', 'Hunter', 'Titan'].map((cls) => {
      const info = stats[cls];
      const avg = info.total ? Math.round(info.sum / info.total) : 0;
      return `<button class="grid-class-card${s?.classFilter === cls ? ' is-active' : ''}" type="button" data-grid-class="${cls}">${mask(CLASS_ICONS[cls], cls, 'grid-class-icon')}<span><span class="grid-class-title">${cls}</span><span class="grid-class-meta"><span class="class-pill">${info.total} armor</span><span class="class-pill">${info.dupes} dupes</span><span class="class-pill">avg ${avg}</span></span></span><span class="grid-class-total">${info.visible}</span></button>`;
    }).join('');
  }
  function buttonText(row) { if (row.Source !== 'Bungie') return 'Copy'; if (row.IsEquipped) return 'Equipped'; return row.IsInVault ? 'Pull' : 'Vault'; }
  function renderGroupButton(row, slot) { if (!row.Is_Dupe) return ''; const label = `${slot} ${row.Dupe_Group}`; return `<button class="grid-action grid-action--group" type="button" data-grid-action="group" title="${row.Source === 'Bungie' ? 'Pull/copy this duplicate group' : 'Copy all DIM IDs in this duplicate group'}">${mask(SLOT_ICONS[slot], label, 'grid-action-slot-icon')}<span>${escapeHtml(row.Dupe_Group)}</span></button>`; }
  function renderGridCard(row) {
    const icon = itemIcon(row);
    const fallback = slotLabel(row.Type).slice(0, 1).toUpperCase();
    const gColor = groupColor(row);
    const style = gColor ? ` style="--group-glow:${gColor}"` : '';
    const slot = slotLabel(row.Type);
    const actionDisabled = row.Source === 'Bungie' && row.IsEquipped ? ' disabled' : '';
    const light = lightLevel(row);
    const tag = tagEmoji(row.Tag);
    const groupBadge = row.Is_Dupe ? `<span class="grid-group-badge" title="${escapeHtml(`${slot} duplicate group ${row.Dupe_Group || 'G'}`)}">${escapeHtml(normId(row.Dupe_Group) || 'G')}</span>` : '';
    return `<article class="grid-card ${rarityClass(row.Rarity)}${row.Is_Dupe ? ' is-dupe' : ''}" data-grid-id="${escapeHtml(normId(row.Id))}"${style}>${groupBadge}<div class="grid-card-top"><div class="grid-item-icon">${icon ? `<img src="${escapeHtml(icon)}" alt="" loading="lazy">` : `<span>${fallback}</span>`}${light ? `<span class="grid-light" title="Light / Power level">${light}</span>` : ''}</div><div class="grid-item-title"><div class="grid-item-name" title="${escapeHtml(row.Name)}">${escapeHtml(row.Name || '(Unnamed item)')}</div><div class="grid-icon-row">${img(RARITY_ICONS[row.Rarity], row.Rarity || 'Rarity')}${mask(SLOT_ICONS[slot], slot)}${mask(CLASS_ICONS[row.Equippable], row.Equippable)}<span class="grid-location" title="${escapeHtml(locationLabel(row))}">${locationIcon(row)}</span>${light ? `<span class="grid-power-pill" title="Light / Power level">✦ ${light}</span>` : ''}</div></div><button class="grid-tag${tag ? ' has-tag' : ' is-empty'}" type="button" data-grid-action="tag" title="${escapeHtml(tagLabel(row.Tag))} — change tag">${tag}</button></div><div class="grid-body" data-slot-grid="1">${renderSlotGrid(row)}</div><div class="grid-actions${row.Is_Dupe ? '' : ' grid-actions--single'}"><button class="grid-action" type="button" data-grid-action="primary"${actionDisabled}>${buttonText(row)}</button>${renderGroupButton(row, slot)}</div></article>`;
  }
  function tableRowFor(row) { return [...document.querySelectorAll('.armor-row')].find((el, index) => state()?.visible?.[index]?.Id === row.Id); }
  function primaryClick(row, btn) { const tableBtn = tableRowFor(row)?.querySelector('.action-stack button'); if (tableBtn) { tableBtn.click(); btn.textContent = '...'; setTimeout(() => window.D2AA?.render?.(), 900); return; } navigator.clipboard?.writeText(`id:${normId(row.Id)}`); }
  function tagClick(row) { const tagBtn = tableRowFor(row)?.querySelector('.tag-btn'); if (tagBtn) tagBtn.click(); }
  async function groupClick(row, btn) { if (!row.Is_Dupe) return; const rows = state()?.visible || []; const groupIds = rows.filter((item) => item.GroupKey === row.GroupKey && item.Dupe_Group === row.Dupe_Group).map((item) => `id:${normId(item.Id)}`).join(' or '); try { await navigator.clipboard.writeText(groupIds); btn.classList.add('is-success'); } catch (_) { btn.classList.add('is-error'); } setTimeout(() => { btn.classList.remove('is-success', 'is-error'); }, 900); }

  function bindGridActions(host) {
    if (!host || host.dataset.gridActionsBound === '1') return;
    host.dataset.gridActionsBound = '1';
    host.addEventListener('click', (event) => {
      const action = event.target.closest('[data-grid-action]');
      const card = event.target.closest('.grid-card');
      if (!action || !card || !host.contains(card)) return;
      const row = rowById.get(card.dataset.gridId);
      if (!row) return;
      if (action.dataset.gridAction === 'tag') tagClick(row);
      if (action.dataset.gridAction === 'primary') primaryClick(row, action);
      if (action.dataset.gridAction === 'group') groupClick(row, action);
    });
  }

  function renderGridIfNeeded(force = false) {
    renderClassOverview();
    if (viewMode() !== 'grid') return;
    const host = $('rows'); const rows = state()?.visible || []; if (!host) return;
    const sig = gridSignature(rows);
    const mustReplaceTable = Boolean(host.querySelector('.armor-row'));
    if (!force && sig === lastGridSignature && host.querySelector('.grid-card') && !mustReplaceTable) return;
    lastGridSignature = sig;
    rowById = new Map(rows.map((row) => [normId(row.Id), row]));
    bindGridActions(host);
    renderingGrid = true;
    host.innerHTML = rows.map(renderGridCard).join('');
    requestAnimationFrame(() => { renderingGrid = false; });
  }
  function updateViewToggle() { document.body.classList.toggle('grid-view', viewMode() === 'grid'); document.querySelectorAll('[data-view-mode]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.viewMode === viewMode())); }
  function ensureGridRendered() {
    updateViewToggle();
    if (viewMode() !== 'grid' || renderingGrid) return;
    const host = $('rows');
    if (!host) return;
    const hasTableRows = Boolean(host.querySelector('.armor-row'));
    const hasGridCards = Boolean(host.querySelector('.grid-card'));
    const visibleCount = state()?.visible?.length || 0;
    if (hasTableRows || (visibleCount > 0 && !hasGridCards)) renderGridIfNeeded(hasTableRows);
  }
  function scheduleEnsureGridRendered() {
    if (pendingEnsure) return;
    pendingEnsure = requestAnimationFrame(() => {
      pendingEnsure = 0;
      ensureGridRendered();
    });
  }
  function injectToggle() { if ($('viewToggle')) return; const nav = document.querySelector('.shell-actions'); const toggle = document.createElement('div'); toggle.id = 'viewToggle'; toggle.className = 'shell-view-toggle'; toggle.innerHTML = `<button type="button" data-view-mode="table" title="Table view">Table</button><button type="button" data-view-mode="grid" title="Grid view">Grid</button>`; toggle.querySelectorAll('[data-view-mode]').forEach((btn) => btn.addEventListener('click', () => setViewMode(btn.dataset.viewMode))); nav?.prepend(toggle); updateViewToggle(); }
  function patchRender() { if (!window.D2AA || window.D2AA.__gridViewPatched) return; const originalRender = window.D2AA.render; window.D2AA.render = () => { originalRender(); renderGridIfNeeded(); updateViewToggle(); }; window.D2AA.__gridViewPatched = true; }
  function observeRows() { const host = $('rows'); if (!host || host.dataset.gridObserved === '1') return; host.dataset.gridObserved = '1'; new MutationObserver(scheduleEnsureGridRendered).observe(host, { childList: true }); }
  function run() {
    if (!window.D2AA) { setTimeout(run, 50); return; }
    if (!localStorage.getItem(LS_VIEW)) localStorage.setItem(LS_VIEW, 'grid');
    injectToggle(); patchRender(); observeRows(); updateViewToggle();
    window.D2AA.render?.();
    scheduleEnsureGridRendered();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();