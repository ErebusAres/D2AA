(() => {
  const STAT_COLS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const STAT_LABELS = ['Health', 'Melee', 'Grenade', 'Super', 'Class', 'Weapon'];
  const TAGS = { feed: '✨', favorite: '❤️', keep: '🏷️', junk: '🚫', infuse: '⚡', archive: '📦' };
  const norm = (v) => String(v || '').trim();
  const num = (v) => Number(v || 0);
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const state = () => window.D2AA?.getState?.() || {};
  const visible = () => state().visible || [];
  const allRows = () => [...visible(), ...(state().rows || [])];
  const firstNumber = (...values) => {
    for (const value of values) {
      const match = String(value ?? '').match(/\d{1,5}/);
      if (match) return Number(match[0]);
    }
    return 0;
  };
  const cleanGroup = (value) => {
    const raw = norm(value).replace(/\s+/g, ' ');
    const match = raw.match(/\b\d+[A-Z]\b/i);
    return match ? match[0].toUpperCase() : raw;
  };
  const lightLevel = (row, card) => firstNumber(
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
    row?.__raw?.Level,
    card?.querySelector?.('.grid-light')?.textContent,
    card?.querySelector?.('.grid-power-pill')?.textContent
  );
  const rowForCard = (card, button = null) => {
    if (!card) return null;
    const id = norm(card.dataset.gridId);
    const rows = allRows();
    if (id) {
      const byId = rows.find((row) => [row.Id, row.InstanceId, row.ItemInstanceId, row.ItemHash].some((value) => norm(value) === id));
      if (byId) return byId;
    }
    const index = [...document.querySelectorAll('#rows .grid-card')].indexOf(card);
    if (index >= 0 && visible()[index]) return visible()[index];
    const group = cleanGroup(button?.dataset?.compareGroupId || card.dataset.compareGroupId || card.querySelector('.grid-group-badge')?.textContent || card.querySelector('[data-grid-action="group"]')?.textContent);
    const name = card.querySelector('.grid-item-name')?.textContent?.trim();
    return rows.find((row) => row.Is_Dupe && cleanGroup(row.Dupe_Group) === group && (!name || String(row.Name || '').trim() === name))
      || rows.find((row) => row.Is_Dupe && cleanGroup(row.Dupe_Group) === group)
      || rows.find((row) => name && String(row.Name || '').trim() === name)
      || null;
  };
  const sameGroup = (a, b) => a && b && cleanGroup(a.Dupe_Group) === cleanGroup(b.Dupe_Group) && (!a.GroupKey || !b.GroupKey || a.GroupKey === b.GroupKey);
  const groupRows = (row) => {
    const strict = visible().filter((item) => item.Is_Dupe && sameGroup(item, row));
    if (strict.length) return strict;
    return allRows().filter((item) => item.Is_Dupe && cleanGroup(item.Dupe_Group) === cleanGroup(row.Dupe_Group));
  };

  function injectCss() {
    if (document.getElementById('d2aaGridDomHotfixV90Css')) return;
    document.getElementById('d2aaGridDomHotfixV89Css')?.remove();
    const style = document.createElement('style');
    style.id = 'd2aaGridDomHotfixV90Css';
    style.textContent = `
      body.grid-view .grid-card > .grid-info-badge{position:absolute!important;top:0!important;left:0!important;right:auto!important;bottom:auto!important;z-index:40!important;min-width:24px!important;height:19px!important;width:auto!important;padding:0 6px!important;border-radius:16px 0 8px 0!important;border:0!important;border-right:1px solid rgba(255,210,111,.42)!important;border-bottom:1px solid rgba(255,210,111,.42)!important;background:linear-gradient(135deg,rgba(0,0,0,.94),rgba(20,16,8,.88))!important;box-shadow:0 0 12px rgba(255,190,80,.20)!important;color:#ffd76f!important;text-shadow:0 1px 0 rgba(0,0,0,.75)!important;font-size:10px!important;font-weight:950!important;line-height:1!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:4px!important;white-space:nowrap!important;transform:none!important;cursor:pointer!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;}
      body.grid-view .grid-card > .grid-info-badge .grid-info-light{color:#ffd76f!important;font-variant-numeric:tabular-nums!important;}
      body.grid-view .grid-card > .grid-info-badge .grid-info-dot{color:rgba(255,215,111,.68)!important;font-size:10px!important;line-height:1!important;}
      body.grid-view .grid-card > .grid-info-badge .grid-info-tag{font-size:12px!important;line-height:1!important;}
      body.grid-view .grid-card > .grid-info-badge.is-empty{display:none!important;}
      body.grid-view .grid-card .grid-card-top > .grid-tag{display:none!important;}
      body.grid-view .grid-card .grid-light,body.grid-view .grid-card .grid-power-pill{display:none!important;}
      body.grid-view .grid-actions:has(.grid-action--compare){grid-template-columns:1fr 1fr 1fr!important;}
      body.grid-view .grid-action--compare{border-color:color-mix(in srgb,var(--group-glow) 58%,var(--border))!important;background:rgba(0,0,0,.18)!important;color:var(--accent-strong)!important;}
      body.grid-view .grid-action--compare:hover{background:color-mix(in srgb,var(--group-glow) 16%,transparent)!important;}
    `;
    document.head.appendChild(style);
  }

  function ensureInfoBadge(card, row) {
    card.querySelectorAll(':scope > .grid-info-badge').forEach((el, index) => { if (index > 0) el.remove(); });
    let badge = card.querySelector(':scope > .grid-info-badge');
    const light = lightLevel(row, card);
    const tag = TAGS[String(row?.Tag || '').toLowerCase()] || '';
    if (!badge) {
      badge = document.createElement('button');
      badge.type = 'button';
      badge.dataset.gridAction = 'tag';
      card.insertBefore(badge, card.firstChild);
    }
    badge.className = `grid-tag grid-info-badge${tag ? ' has-tag' : ''}${!light && !tag ? ' is-empty' : ''}`;
    badge.dataset.gridAction = 'tag';
    badge.title = `${light ? `Light / Power ${light}` : ''}${light && tag ? ' • ' : ''}${tag ? 'Tag' : 'No tag'} — change tag`;
    badge.innerHTML = `${light ? `<span class="grid-info-light">${light}</span>` : ''}${light && tag ? '<span class="grid-info-dot">•</span>' : ''}${tag ? `<span class="grid-info-tag">${tag}</span>` : ''}`;
  }

  function ensureCompareButton(card, row) {
    const actions = card.querySelector('.grid-actions');
    if (!actions) return;
    const buttons = [...actions.querySelectorAll('[data-grid-action="compare-group"], .grid-action--compare')];
    if (!row?.Is_Dupe) { buttons.forEach((button) => button.remove()); return; }
    const group = cleanGroup(row.Dupe_Group || card.querySelector('.grid-group-badge')?.textContent || card.querySelector('[data-grid-action="group"]')?.textContent);
    buttons.forEach((button) => button.remove());
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'grid-action grid-action--compare';
    btn.dataset.gridAction = 'compare-group';
    btn.dataset.compareGroupId = group;
    btn.textContent = 'Compare group';
    btn.title = `Compare duplicate group ${group}`;
    actions.appendChild(btn);
  }

  function decorate() {
    injectCss();
    document.querySelectorAll('#rows .grid-card').forEach((card) => {
      const row = rowForCard(card);
      if (!row) return;
      ensureInfoBadge(card, row);
      ensureCompareButton(card, row);
    });
  }

  function openCompare(row) {
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
    document.getElementById('d2aaCompareTitle').textContent = `Group ${esc(row.Dupe_Group)}`;
    document.getElementById('d2aaCompareBody').innerHTML = `<div class="d2aa-compare-tools"><span>${group.length} matching items</span></div><div class="d2aa-compare-grid">${group.map((item) => `<article class="d2aa-compare-item"><div class="d2aa-compare-title"><strong>${esc(item.Name || '(Unnamed item)')}</strong><span>${esc(item.Equippable || '')} • ${esc(item.Type || '')} • ${esc(item.Rarity || '')}</span></div><div class="d2aa-compare-summary"><span>${num(item['Total (Base)'])}</span><span>${esc(item.Dupe_Group || '')}</span></div><div class="d2aa-compare-stats">${STAT_COLS.map((stat, i) => `<div class="d2aa-compare-stat${best[stat] === num(item[stat]) ? ' is-best' : ''}"><span>${STAT_LABELS[i]}</span><strong>${num(item[stat])}</strong></div>`).join('')}</div></article>`).join('')}</div>`;
    modal.classList.add('is-open');
  }

  let queued = 0;
  function schedule() {
    if (queued) return;
    queued = requestAnimationFrame(() => { queued = 0; decorate(); });
  }

  function patchRender() {
    if (!window.D2AA || window.D2AA.__gridDomHotfixV90) return;
    const original = window.D2AA.render;
    window.D2AA.render = (...args) => {
      const result = original.apply(window.D2AA, args);
      schedule();
      setTimeout(schedule, 0);
      setTimeout(schedule, 120);
      return result;
    };
    window.D2AA.__gridDomHotfixV90 = true;
  }

  function bindClicks() {
    if (document.documentElement.dataset.gridDomHotfixV90Clicks === '1') return;
    document.documentElement.dataset.gridDomHotfixV90Clicks = '1';
    const handler = (event) => {
      const btn = event.target.closest?.('[data-grid-action="compare-group"], .grid-action--compare');
      if (!btn) return;
      const card = btn.closest('.grid-card');
      const row = rowForCard(card, btn);
      if (!row) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openCompare(row);
    };
    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('click', handler, true);
  }

  function observeRows() {
    const host = document.getElementById('rows');
    if (!host || host.dataset.gridDomHotfixV90Observed === '1') return;
    host.dataset.gridDomHotfixV90Observed = '1';
    new MutationObserver(schedule).observe(host, { childList: true, subtree: true });
  }

  function run() {
    if (!window.D2AA) { setTimeout(run, 50); return; }
    injectCss();
    patchRender();
    bindClicks();
    observeRows();
    schedule();
    setTimeout(schedule, 150);
    setTimeout(schedule, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
