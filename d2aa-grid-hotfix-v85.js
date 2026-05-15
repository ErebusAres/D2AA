(() => {
  const STAT_COLS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const norm = (v) => String(v || '').trim();
  const num = (v) => Number(v || 0);
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const tagEmoji = (tag) => ({ feed: '✨', favorite: '❤️', keep: '🏷️', junk: '🚫', infuse: '⚡', archive: '📦' }[String(tag || '').toLowerCase()] || '');
  const tagLabel = (tag) => ({ feed: 'Item Feed', favorite: 'Favorite', keep: 'Keep', junk: 'Junk', infuse: 'Infuse', archive: 'Archive', '': 'No tag' }[String(tag || '').toLowerCase()] || 'No tag');
  const state = () => window.D2AA?.getState?.() || {};
  const rows = () => [...(state().visible || []), ...(state().rows || [])];
  const firstNumber = (...values) => {
    for (const value of values) {
      const match = String(value ?? '').match(/\d{1,5}/);
      if (match) return Number(match[0]);
    }
    return 0;
  };
  const lightLevel = (row) => firstNumber(
    row?.Light,
    row?.Power,
    row?.PowerLevel,
    row?.Power_Level,
    row?.['Power Level'],
    row?.['Light Level'],
    row?.PrimaryStat,
    row?.['Primary Stat'],
    row?.Level,
    row?.['Item Level'],
    row?.__raw?.Light,
    row?.__raw?.Power,
    row?.__raw?.PowerLevel,
    row?.__raw?.Power_Level,
    row?.__raw?.['Power Level'],
    row?.__raw?.['Light Level'],
    row?.__raw?.PrimaryStat,
    row?.__raw?.['Primary Stat'],
    row?.__raw?.Level
  );
  function rowForCard(card) {
    const id = norm(card?.dataset?.gridId);
    if (!id) return null;
    return rows().find((row) => [row.Id, row.InstanceId, row.ItemInstanceId, row.ItemHash].some((value) => norm(value) === id)) || null;
  }
  function sameGroup(a, b) {
    return a && b && norm(a.Dupe_Group) === norm(b.Dupe_Group) && (!a.GroupKey || !b.GroupKey || a.GroupKey === b.GroupKey);
  }
  function decorateBadge(card, row) {
    const btn = card.querySelector('.grid-tag');
    if (!btn) return;
    const light = lightLevel(row) || firstNumber(card.querySelector('.grid-info-light')?.textContent, card.querySelector('.grid-light')?.textContent, card.querySelector('.grid-power-pill')?.textContent);
    const tag = tagEmoji(row?.Tag);
    card.querySelectorAll('.grid-light,.grid-power-pill').forEach((el) => el.remove());
    if (!light && !tag) {
      btn.className = 'grid-tag is-empty';
      btn.textContent = '';
      btn.title = 'No tag — change tag';
      return;
    }
    btn.className = `grid-tag grid-info-badge${tag ? ' has-tag' : ''}`;
    btn.title = `${light ? `Light / Power ${light}` : ''}${light && tag ? ' • ' : ''}${tag ? `${tagLabel(row?.Tag)} tag` : ''} — change tag`;
    btn.innerHTML = `${light ? `<span class="grid-info-light">${light}</span>` : ''}${light && tag ? '<span class="grid-info-dot">•</span>' : ''}${tag ? `<span class="grid-info-tag">${tag}</span>` : ''}`;
  }
  function ensureCompareButton(card, row) {
    if (!row?.Is_Dupe) return;
    const actions = card.querySelector('.grid-actions');
    if (!actions) return;
    const groupId = norm(row.Dupe_Group);
    const existing = [...actions.querySelectorAll('[data-grid-action="compare-group"], .grid-action--compare')];
    let btn = existing[0];
    existing.slice(1).forEach((extra) => extra.remove());
    if (!btn) {
      btn = document.createElement('button');
      actions.appendChild(btn);
    }
    card.dataset.compareGroupId = groupId;
    btn.type = 'button';
    btn.className = 'grid-action grid-action--compare';
    btn.dataset.gridAction = 'compare-group';
    btn.dataset.compareGroupId = groupId;
    btn.textContent = 'Compare group';
    btn.title = `Compare duplicate group ${groupId}`;
  }
  function decorate() {
    document.querySelectorAll('.grid-card').forEach((card) => {
      const row = rowForCard(card);
      decorateBadge(card, row);
      ensureCompareButton(card, row);
    });
  }
  function groupRows(row) {
    return (state().visible || []).filter((item) => item.Is_Dupe && sameGroup(item, row));
  }
  function openCompare(row) {
    const group = groupRows(row);
    if (!group.length || !window.D2AA_COMPARE?.openRows) return false;
    window.D2AA_COMPARE.openRows(group, row);
    return true;
  }
  function fallbackOpenCompare(row) {
    const group = groupRows(row);
    if (!group.length) return;
    let modal = document.getElementById('d2aaCompareGroupModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'd2aaCompareGroupModal';
      modal.className = 'd2aa-compare-modal';
      modal.innerHTML = '<div class="d2aa-compare-backdrop" data-compare-close="1"></div><section class="d2aa-compare-panel" role="dialog" aria-modal="true"><header class="d2aa-compare-head"><div><p class="eyebrow">Duplicate group</p><h2 id="d2aaCompareTitle">Compare Group</h2></div><button class="d2aa-compare-close" type="button" data-compare-close="1">×</button></header><div class="d2aa-compare-body" id="d2aaCompareBody"></div></section>';
      modal.addEventListener('click', (e) => { if (e.target.closest('[data-compare-close]')) modal.classList.remove('is-open'); });
      document.body.appendChild(modal);
    }
    const best = Object.fromEntries(STAT_COLS.map((stat) => [stat, Math.max(...group.map((item) => num(item[stat])))]));
    document.getElementById('d2aaCompareTitle').textContent = `Group ${esc(row.Dupe_Group)}`;
    document.getElementById('d2aaCompareBody').innerHTML = `<div class="d2aa-compare-tools"><span>${group.length} matching items</span></div><div class="d2aa-compare-grid">${group.map((item) => `<article class="d2aa-compare-item"><div class="d2aa-compare-title"><strong>${esc(item.Name || '(Unnamed item)')}</strong><span>${esc(item.Equippable || '')} • ${esc(item.Type || '')} • ${esc(item.Rarity || '')}</span></div><div class="d2aa-compare-summary"><span>${num(item['Total (Base)'])}</span><span>${esc(item.Dupe_Group || '')}</span></div><div class="d2aa-compare-stats">${STAT_COLS.map((stat) => `<div class="d2aa-compare-stat${best[stat] === num(item[stat]) ? ' is-best' : ''}"><span>${esc(stat.replace(' (Base)', ''))}</span><strong>${num(item[stat])}</strong></div>`).join('')}</div></article>`).join('')}</div>`;
    modal.classList.add('is-open');
  }
  let queued = 0;
  function schedule() {
    if (queued) return;
    queued = requestAnimationFrame(() => { queued = 0; decorate(); });
  }
  function patchRender() {
    if (!window.D2AA || window.D2AA.__gridHotfixV85) return;
    const original = window.D2AA.render;
    window.D2AA.render = () => { original(); schedule(); };
    window.D2AA.__gridHotfixV85 = true;
  }
  function bindClicks() {
    if (document.documentElement.dataset.gridHotfixV85Clicks === '1') return;
    document.documentElement.dataset.gridHotfixV85Clicks = '1';
    document.addEventListener('click', (event) => {
      const btn = event.target.closest?.('[data-grid-action="compare-group"], .grid-action--compare');
      if (!btn) return;
      const card = btn.closest('.grid-card');
      const row = rowForCard(card);
      if (!row) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!openCompare(row)) fallbackOpenCompare(row);
    }, true);
  }
  function run() {
    if (!window.D2AA) { setTimeout(run, 50); return; }
    patchRender();
    bindClicks();
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
