(() => {
  const STAT_COLS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const STAT_LABELS = ['Health', 'Melee', 'Grenade', 'Super', 'Class', 'Weapon'];
  const TAGS = [
    { id: '', icon: '–', label: 'No tag' },
    { id: 'favorite', icon: '❤️', label: 'Favorite' },
    { id: 'keep', icon: '🏷️', label: 'Keep' },
    { id: 'junk', icon: '🚫', label: 'Junk' },
    { id: 'infuse', icon: '⚡', label: 'Infuse' },
    { id: 'archive', icon: '📦', label: 'Archive' }
  ];
  const normId = (v) => String(v || '').trim();
  const num = (v) => Number(v || 0);
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const state = () => window.D2AA?.getState?.() || {};
  const visibleRows = () => state().visible || state().filtered || state().rows || [];
  const allRows = () => {
    const seen = new Set();
    return [...(state().visible || []), ...(state().filtered || []), ...(state().rows || [])].filter((row) => {
      const key = normId(row.Id || row.InstanceId || row.ItemInstanceId) || `${row.Name}|${row.Dupe_Group}|${row.GroupKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const itemIcon = (row) => row.IconUrl || row.Icon || row.DisplayIcon || row.ScreenshotUrl || '';
  const slotLabel = (type) => ['Warlock Bond', 'Hunter Cloak', 'Titan Mark'].includes(type) ? 'Class Item' : (type || 'Armor');
  const tagIcon = (tag) => ({ favorite: '❤️', keep: '🏷️', junk: '🚫', infuse: '⚡', archive: '📦', feed: '✨' }[String(tag || '').toLowerCase()] || '');
  const tier = (row) => Math.max(0, Math.min(5, num(row.GearTier || row.Tier)));
  const diamonds = (row) => `${'◆'.repeat(tier(row))}${'◇'.repeat(5 - tier(row))}`;
  let activeGroup = null;
  let lastOpenAt = 0;
  let queuedEnsure = 0;
  let lastButtonSig = '';

  function groupRowsFor(row) {
    const rows = visibleRows();
    const strict = rows.filter((item) => item.Is_Dupe && item.GroupKey === row.GroupKey && item.Dupe_Group === row.Dupe_Group);
    if (strict.length) return strict;
    const loose = rows.filter((item) => item.Is_Dupe && normId(item.Dupe_Group) === normId(row.Dupe_Group));
    if (loose.length) return loose;
    return allRows().filter((item) => item.Is_Dupe && normId(item.Dupe_Group) === normId(row.Dupe_Group));
  }

  function firstRowForGroup(groupText) {
    const group = normId(groupText);
    if (!group) return null;
    return allRows().find((row) => row.Is_Dupe && normId(row.Dupe_Group) === group)
      || allRows().find((row) => normId(row.Dupe_Group) === group)
      || null;
  }

  function rowForCard(card) {
    if (!card) return null;
    const id = normId(card.dataset.gridId || card.getAttribute('data-grid-id') || card.dataset.id || card.getAttribute('data-id'));
    const rows = allRows();
    if (id) {
      const byId = rows.find((row) => normId(row.Id) === id || normId(row.InstanceId) === id || normId(row.ItemInstanceId) === id || normId(row.ItemHash) === id);
      if (byId) return byId;
    }
    const group = normId(card.querySelector('.grid-group-badge')?.textContent || card.querySelector('[data-grid-action="group"]')?.textContent);
    const byGroup = firstRowForGroup(group);
    if (byGroup) return byGroup;
    const name = card.querySelector('.grid-item-name')?.textContent?.trim();
    if (name) return rows.find((row) => String(row.Name || '').trim() === name && row.Is_Dupe) || null;
    return null;
  }

  function ensureModal() {
    let modal = document.getElementById('d2aaCompareGroupModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'd2aaCompareGroupModal';
    modal.className = 'd2aa-compare-modal';
    modal.innerHTML = `<div class="d2aa-compare-backdrop" data-compare-close="1"></div><section class="d2aa-compare-panel" role="dialog" aria-modal="true" aria-labelledby="d2aaCompareTitle"><header class="d2aa-compare-head"><div><p class="eyebrow">Duplicate group</p><h2 id="d2aaCompareTitle">Compare Group</h2></div><button class="d2aa-compare-close" type="button" data-compare-close="1" aria-label="Close comparison">×</button></header><div class="d2aa-compare-body" id="d2aaCompareBody"></div></section>`;
    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-compare-close]')) closeModal();
      const tagBtn = event.target.closest('[data-compare-tag]');
      if (tagBtn) {
        const id = tagBtn.closest('[data-compare-id]')?.dataset.compareId;
        const row = allRows().find((item) => normId(item.Id) === id || normId(item.InstanceId) === id || normId(item.ItemInstanceId) === id);
        if (!row) return;
        window.D2AA?.setTag?.(row, tagBtn.dataset.compareTag);
        window.D2AA?.render?.();
        if (activeGroup) requestAnimationFrame(() => openModal(activeGroup));
      }
      const copyBtn = event.target.closest('[data-compare-copy]');
      if (copyBtn) {
        const rows = activeGroup ? groupRowsFor(activeGroup) : [];
        navigator.clipboard?.writeText(rows.map((item) => `id:${normId(item.Id)}`).join(' or '));
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy group IDs'; }, 900);
      }
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
    document.body.appendChild(modal);
    return modal;
  }

  function itemCard(row, bestByStat) {
    const icon = itemIcon(row);
    const tag = tagIcon(row.Tag);
    return `<article class="d2aa-compare-item" data-compare-id="${esc(normId(row.Id || row.InstanceId || row.ItemInstanceId))}"><div class="d2aa-compare-item-top"><div class="d2aa-compare-icon">${icon ? `<img src="${esc(icon)}" alt="" loading="lazy">` : `<span>${esc(slotLabel(row.Type).slice(0, 1))}</span>`}</div><div class="d2aa-compare-title"><strong>${esc(row.Name || '(Unnamed item)')}</strong><span>${esc(row.Equippable || '')} • ${esc(slotLabel(row.Type))} • ${esc(row.Rarity || '')}</span></div><div class="d2aa-compare-tag-display">${tag}</div></div><div class="d2aa-compare-summary"><span title="Base stat total">${num(row['Total (Base)'])}</span><span title="Gear tier">${diamonds(row)}</span><span>${esc(row.Source || '')}</span></div><div class="d2aa-compare-stats">${STAT_COLS.map((stat, index) => { const val = num(row[stat]); const isBest = bestByStat[stat] === val && val > 0; return `<div class="d2aa-compare-stat${isBest ? ' is-best' : ''}"><span>${STAT_LABELS[index]}</span><strong>${val}</strong></div>`; }).join('')}</div><div class="d2aa-compare-tags" aria-label="Change tag for ${esc(row.Name || 'item')}">${TAGS.map((tagOpt) => `<button type="button" data-compare-tag="${tagOpt.id}" class="${String(row.Tag || '') === tagOpt.id ? 'is-active' : ''}" title="${tagOpt.label}">${tagOpt.icon}</button>`).join('')}</div></article>`;
  }

  function openModal(row) {
    if (!row) return;
    activeGroup = row;
    const rows = groupRowsFor(row);
    if (!rows.length) return;
    const modal = ensureModal();
    const body = document.getElementById('d2aaCompareBody');
    const title = document.getElementById('d2aaCompareTitle');
    const slot = slotLabel(row.Type);
    const bestByStat = Object.fromEntries(STAT_COLS.map((stat) => [stat, Math.max(...rows.map((item) => num(item[stat])))]));
    title.textContent = `${slot} Group ${row.Dupe_Group || ''}`.trim();
    body.innerHTML = `<div class="d2aa-compare-tools"><span>${rows.length} matching items</span><button type="button" data-compare-copy="1">Copy group IDs</button></div><div class="d2aa-compare-grid">${rows.map((item) => itemCard(item, bestByStat)).join('')}</div>`;
    modal.classList.add('is-open');
  }

  function closeModal() {
    ensureModal().classList.remove('is-open');
    activeGroup = null;
  }

  function openFromButton(button, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    const now = Date.now();
    if (now - lastOpenAt < 180) return;
    lastOpenAt = now;
    const card = button.closest('.grid-card');
    const row = rowForCard(card);
    if (row) openModal(row);
  }

  function ensureCompareButtons(force = false) {
    queuedEnsure = 0;
    const sig = visibleRows().map((row) => `${normId(row.Id || row.InstanceId || row.ItemInstanceId)}:${row.Is_Dupe ? 1 : 0}:${row.Dupe_Group || ''}:${row.GroupKey || ''}`).join('|');
    if (!force && sig === lastButtonSig && document.querySelector('[data-grid-action="compare-group"]')) return;
    lastButtonSig = sig;
    document.querySelectorAll('.grid-card.is-dupe .grid-actions').forEach((actions) => {
      const groupBtn = actions.querySelector('[data-grid-action="group"]');
      if (!groupBtn) return;
      groupBtn.title = 'Group action';
      groupBtn.dataset.compareGroupId = groupBtn.textContent.trim();
      const dupes = [...actions.querySelectorAll('[data-grid-action="compare-group"], .grid-action--compare')];
      let compareBtn = dupes[0];
      dupes.slice(1).forEach((btn) => btn.remove());
      if (!compareBtn) { compareBtn = document.createElement('button'); actions.appendChild(compareBtn); }
      compareBtn.type = 'button';
      compareBtn.className = 'grid-action grid-action--compare';
      compareBtn.dataset.gridAction = 'compare-group';
      compareBtn.title = 'Compare duplicate group';
      compareBtn.textContent = 'Compare group';
    });
  }

  function scheduleEnsure(force = false) {
    if (queuedEnsure) return;
    queuedEnsure = requestAnimationFrame(() => ensureCompareButtons(force));
  }

  function patchRender() {
    if (!window.D2AA || window.D2AA.__compareGroupsPatched) return;
    const original = window.D2AA.render;
    window.D2AA.render = () => { original(); scheduleEnsure(true); };
    window.D2AA.__compareGroupsPatched = true;
  }

  function run() {
    if (!window.D2AA) { setTimeout(run, 50); return; }
    ensureModal();
    patchRender();
    scheduleEnsure(true);
    const rows = document.getElementById('rows');
    if (rows && rows.dataset.compareClickBound !== '1') {
      rows.dataset.compareClickBound = '1';
      rows.addEventListener('pointerdown', (event) => {
        const btn = event.target.closest?.('[data-grid-action="compare-group"], .grid-action--compare');
        if (btn) openFromButton(btn, event);
      }, true);
      rows.addEventListener('click', (event) => {
        const btn = event.target.closest?.('[data-grid-action="compare-group"], .grid-action--compare');
        if (btn) openFromButton(btn, event);
      }, true);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
