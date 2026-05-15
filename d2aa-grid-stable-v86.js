(() => {
  const STAT_COLS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const STAT_LABELS = ['Health', 'Melee', 'Grenade', 'Super', 'Class', 'Weapon'];
  const STAT_EMOJI = { 'Health (Base)': '♥', 'Melee (Base)': '✊', 'Grenade (Base)': '✦', 'Super (Base)': '☀', 'Class (Base)': '◆', 'Weapons (Base)': '⌖' };
  const TAGS = { feed: '✨', favorite: '❤️', keep: '🏷️', junk: '🚫', infuse: '⚡', archive: '📦' };
  const GROUP_COLORS = ['#b57cff', '#66d9ff', '#ffcf66', '#77ffb0', '#ff7ca8', '#ffa66b', '#9cfffb', '#d5ff6b'];
  const norm = (v) => String(v || '').trim();
  const num = (v) => Number(v || 0);
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const state = () => window.D2AA?.getState?.() || {};
  const rows = () => state().visible || [];
  const slotLabel = (type) => ['Warlock Bond', 'Hunter Cloak', 'Titan Mark'].includes(type) ? 'Class Item' : (type || 'Armor');
  const firstNumber = (...values) => {
    for (const value of values) {
      const match = String(value ?? '').match(/\d{1,5}/);
      if (match) return Number(match[0]);
    }
    return 0;
  };
  const lightLevel = (row) => firstNumber(row.Light, row.Power, row.PowerLevel, row.Power_Level, row['Power Level'], row['Light Level'], row.PrimaryStat, row['Primary Stat'], row.Level, row['Item Level'], row.__raw?.Light, row.__raw?.Power, row.__raw?.PowerLevel, row.__raw?.Power_Level, row.__raw?.['Power Level'], row.__raw?.['Light Level'], row.__raw?.PrimaryStat, row.__raw?.['Primary Stat'], row.__raw?.Level);
  const iconUrl = (row) => row.IconUrl || row.Icon || row.DisplayIcon || row.ScreenshotUrl || '';
  const tier = (row) => Math.max(0, Math.min(5, num(row.GearTier || row.Tier || 0)));
  const diamonds = (row) => `${'◆'.repeat(tier(row))}${'◇'.repeat(5 - tier(row))}`;
  const statClass = (v) => { const n = num(v); if (n >= 30) return 'stat-cyan'; if (n >= 24) return 'stat-green'; if (n >= 15) return 'stat-yellow'; return 'stat-red'; };
  function groupColor(row) {
    if (!row?.Is_Dupe) return '';
    const key = `${row.GroupKey || ''}:${row.Dupe_Group || ''}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
  }
  function archetype(row) {
    const top = STAT_COLS.map((stat) => [stat, num(row[stat])]).sort((a, b) => b[1] - a[1])[0]?.[0];
    return STAT_EMOJI[top] || '⚖';
  }
  function infoBadge(row) {
    const light = lightLevel(row);
    const tag = TAGS[String(row.Tag || '').toLowerCase()] || '';
    if (!light && !tag) return '<button class="grid-tag is-empty" type="button" data-grid-action="tag" title="No tag — change tag"></button>';
    return `<button class="grid-tag grid-info-badge${tag ? ' has-tag' : ''}" type="button" data-grid-action="tag" title="${esc(`${light ? `Light / Power ${light}` : ''}${light && tag ? ' • ' : ''}${tag ? 'Tagged' : ''} — change tag`)}">${light ? `<span class="grid-info-light">${light}</span>` : ''}${light && tag ? '<span class="grid-info-dot">•</span>' : ''}${tag ? `<span class="grid-info-tag">${tag}</span>` : ''}</button>`;
  }
  function card(row) {
    const icon = iconUrl(row);
    const color = groupColor(row);
    const style = color ? ` style="--group-glow:${color}"` : '';
    const group = norm(row.Dupe_Group);
    const groupBadge = row.Is_Dupe ? `<span class="grid-group-badge" title="Duplicate group ${esc(group)}">${esc(group)}</span>` : '';
    const compare = row.Is_Dupe ? `<button class="grid-action grid-action--compare" type="button" data-grid-action="compare-group" data-compare-group-id="${esc(group)}">Compare group</button>` : '';
    const groupBtn = row.Is_Dupe ? `<button class="grid-action grid-action--group" type="button" data-grid-action="group" data-compare-group-id="${esc(group)}"><span>${esc(group)}</span></button>` : '';
    return `<article class="grid-card rarity-${esc(String(row.Rarity || 'unknown').toLowerCase())}${row.Is_Dupe ? ' is-dupe' : ''}" data-grid-id="${esc(norm(row.Id))}" data-compare-group-id="${esc(group)}"${style}>${groupBadge}<div class="grid-card-top"><div class="grid-item-icon">${icon ? `<img src="${esc(icon)}" alt="" loading="lazy">` : `<span>${esc(slotLabel(row.Type).slice(0, 1))}</span>`}</div><div class="grid-item-title"><div class="grid-item-name" title="${esc(row.Name)}">${esc(row.Name || '(Unnamed item)')}</div><div class="grid-icon-row"><span>${esc(slotLabel(row.Type))}</span><span>•</span><span>${esc(row.Equippable || '')}</span><span>•</span><span>${esc(row.Rarity || '')}</span></div></div>${infoBadge(row)}</div><div class="grid-body" data-slot-grid="1"><div class="grid-slot-total grid-total" title="Base stat total">${num(row['Total (Base)'])}</div><div class="grid-slot-tier grid-tier" title="Gear tier ${tier(row)}/5">${diamonds(row)}</div><div class="grid-slot-aag"><span class="grid-aag-badge" title="Inferred archetype">${archetype(row)}</span></div>${STAT_COLS.map((stat, i) => `<div class="grid-slot-stat grid-stat ${statClass(row[stat])}" title="${STAT_LABELS[i]}: ${num(row[stat])}"><span>${STAT_EMOJI[stat]}</span><span>${num(row[stat])}</span></div>`).join('')}</div><div class="grid-actions${row.Is_Dupe ? '' : ' grid-actions--single'}"><button class="grid-action" type="button" data-grid-action="primary">${row.Source === 'Bungie' ? (row.IsInVault ? 'Pull' : row.IsEquipped ? 'Equipped' : 'Vault') : 'Copy'}</button>${groupBtn}${compare}</div></article>`;
  }
  function sameGroup(a, b) { return a && b && norm(a.Dupe_Group) === norm(b.Dupe_Group) && (!a.GroupKey || !b.GroupKey || a.GroupKey === b.GroupKey); }
  function rowForCard(card) { return rows().find((row) => norm(row.Id) === norm(card?.dataset?.gridId)); }
  function groupRows(row) { return rows().filter((item) => item.Is_Dupe && sameGroup(item, row)); }
  function renderCompare(row) {
    const group = groupRows(row);
    if (!group.length) return;
    let modal = document.getElementById('d2aaCompareGroupModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'd2aaCompareGroupModal';
      modal.className = 'd2aa-compare-modal';
      modal.innerHTML = '<div class="d2aa-compare-backdrop" data-compare-close="1"></div><section class="d2aa-compare-panel" role="dialog" aria-modal="true"><header class="d2aa-compare-head"><div><p class="eyebrow">Duplicate group</p><h2 id="d2aaCompareTitle">Compare Group</h2></div><button class="d2aa-compare-close" type="button" data-compare-close="1">×</button></header><div class="d2aa-compare-body" id="d2aaCompareBody"></div></section>';
      modal.addEventListener('click', (event) => { if (event.target.closest('[data-compare-close]')) modal.classList.remove('is-open'); });
      document.body.appendChild(modal);
    }
    const best = Object.fromEntries(STAT_COLS.map((stat) => [stat, Math.max(...group.map((item) => num(item[stat])))]));
    document.getElementById('d2aaCompareTitle').textContent = `${slotLabel(row.Type)} Group ${row.Dupe_Group}`;
    document.getElementById('d2aaCompareBody').innerHTML = `<div class="d2aa-compare-tools"><span>${group.length} matching items</span></div><div class="d2aa-compare-grid">${group.map((item) => `<article class="d2aa-compare-item"><div class="d2aa-compare-title"><strong>${esc(item.Name || '(Unnamed item)')}</strong><span>${esc(item.Equippable || '')} • ${esc(slotLabel(item.Type))} • ${esc(item.Rarity || '')}</span></div><div class="d2aa-compare-summary"><span>${num(item['Total (Base)'])}</span><span>${diamonds(item)}</span></div><div class="d2aa-compare-stats">${STAT_COLS.map((stat, i) => `<div class="d2aa-compare-stat${best[stat] === num(item[stat]) ? ' is-best' : ''}"><span>${STAT_LABELS[i]}</span><strong>${num(item[stat])}</strong></div>`).join('')}</div></article>`).join('')}</div>`;
    modal.classList.add('is-open');
  }
  async function copyGroup(row, btn) {
    const text = groupRows(row).map((item) => `id:${norm(item.Id)}`).join(' or ');
    try { await navigator.clipboard.writeText(text); btn.classList.add('is-success'); } catch (_) { btn.classList.add('is-error'); }
    setTimeout(() => btn.classList.remove('is-success', 'is-error'), 900);
  }
  async function primary(row, btn) {
    if (row.Source === 'Bungie' && row.IsInVault && window.D2AA_BUNGIE?.pullItem) { await window.D2AA_BUNGIE.pullItem(row); window.D2AA.render(); return; }
    if (row.Source === 'Bungie' && !row.IsInVault && !row.IsEquipped && window.D2AA_BUNGIE?.vaultItem) { await window.D2AA_BUNGIE.vaultItem(row); window.D2AA.render(); return; }
    try { await navigator.clipboard.writeText(`id:${norm(row.Id)}`); btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = row.Source === 'Bungie' ? (row.IsInVault ? 'Pull' : row.IsEquipped ? 'Equipped' : 'Vault') : 'Copy'; }, 900); } catch (_) {}
  }
  let lastSig = '';
  function sig() { return rows().map((r) => [r.Id, r.Tag, lightLevel(r), r.Is_Dupe, r.Dupe_Group, r.GroupKey, r.IsInVault, r.IsEquipped, r['Total (Base)'], ...STAT_COLS.map((s) => r[s])].join('|')).join('~'); }
  function render(force = false) {
    if ((localStorage.getItem('d2aa_beta2_view_mode_v1') || 'grid') === 'table') return;
    const host = document.getElementById('rows');
    if (!host) return;
    const next = sig();
    if (!force && next === lastSig && host.querySelector('.grid-card')) return;
    lastSig = next;
    host.innerHTML = rows().map(card).join('');
  }
  function bind() {
    if (document.documentElement.dataset.stableGridV86Bound === '1') return;
    document.documentElement.dataset.stableGridV86Bound = '1';
    document.addEventListener('click', (event) => {
      const action = event.target.closest?.('[data-grid-action]');
      const cardEl = event.target.closest?.('.grid-card');
      if (!action || !cardEl) return;
      const row = rowForCard(cardEl);
      if (!row) return;
      if (action.dataset.gridAction === 'tag') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (action.dataset.gridAction === 'compare-group') renderCompare(row);
      if (action.dataset.gridAction === 'group') copyGroup(row, action);
      if (action.dataset.gridAction === 'primary') primary(row, action);
    }, true);
  }
  function patch() {
    if (!window.D2AA || window.D2AA.__stableGridV86) return;
    const original = window.D2AA.render;
    window.D2AA.render = () => { original(); render(true); };
    window.D2AA.__stableGridV86 = true;
  }
  function run() {
    if (!window.D2AA) { setTimeout(run, 50); return; }
    bind();
    patch();
    render(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
