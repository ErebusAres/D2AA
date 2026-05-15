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
  const rowForCardKey = (key) => {
    const card = document.querySelector(`#rows .grid-card[data-d2aa-card-key="${CSS.escape(String(key))}"]`);
    return rowForCard(card, card?.querySelector('.grid-action--compare'));
  };
  const sameGroup = (a, b) => a && b && cleanGroup(a.Dupe_Group) === cleanGroup(b.Dupe_Group) && (!a.GroupKey || !b.GroupKey || a.GroupKey === b.GroupKey);
  const groupRows = (row) => {
    const strict = visible().filter((item) => item.Is_Dupe && sameGroup(item, row));
    if (strict.length) return strict;
    return allRows().filter((item) => item.Is_Dupe && cleanGroup(item.Dupe_Group) === cleanGroup(row.Dupe_Group));
  };

  function toast(message) {
    let el = document.getElementById('d2aaCompareDebugToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'd2aaCompareDebugToast';
      el.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:100000;background:rgba(0,0,0,.86);color:#ffd76f;border:1px solid rgba(255,215,111,.35);border-radius:12px;padding:10px 12px;font:700 12px system-ui;box-shadow:0 12px 30px rgba(0,0,0,.45);display:none;';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.display = 'none'; }, 2400);
  }

  function injectCss() {
    if (document.getElementById('d2aaGridDomHotfixV92Css')) return;
    document.getElementById('d2aaGridDomHotfixV89Css')?.remove();
    document.getElementById('d2aaGridDomHotfixV90Css')?.remove();
    document.getElementById('d2aaGridDomHotfixV91Css')?.remove();
    const style = document.createElement('style');
    style.id = 'd2aaGridDomHotfixV92Css';
    style.textContent = `
      body.grid-view .grid-card > .grid-info-badge{position:absolute!important;top:0!important;left:0!important;right:auto!important;bottom:auto!important;z-index:40!important;min-width:24px!important;height:19px!important;width:auto!important;padding:0 6px!important;border-radius:16px 0 8px 0!important;border:0!important;border-right:1px solid rgba(255,210,111,.42)!important;border-bottom:1px solid rgba(255,210,111,.42)!important;background:linear-gradient(135deg,rgba(0,0,0,.94),rgba(20,16,8,.88))!important;box-shadow:0 0 12px rgba(255,190,80,.20)!important;color:#ffd76f!important;text-shadow:0 1px 0 rgba(0,0,0,.75)!important;font-size:10px!important;font-weight:950!important;line-height:1!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:4px!important;white-space:nowrap!important;transform:none!important;cursor:pointer!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;}
      body.grid-view .grid-card:hover > .grid-info-badge,body.grid-view .grid-card:focus-within > .grid-info-badge,body.grid-view .grid-card.is-selected > .grid-info-badge{opacity:1!important;visibility:visible!important;pointer-events:auto!important;}
      body.grid-view .grid-card > .grid-info-badge .grid-info-light{color:#ffd76f!important;font-variant-numeric:tabular-nums!important;}
      body.grid-view .grid-card > .grid-info-badge .grid-info-dot{color:rgba(255,215,111,.68)!important;font-size:10px!important;line-height:1!important;}
      body.grid-view .grid-card > .grid-info-badge .grid-info-tag{font-size:12px!important;line-height:1!important;}
      body.grid-view .grid-card > .grid-info-badge.is-empty{display:none!important;}
      body.grid-view .grid-card .grid-card-top > .grid-tag{display:none!important;}
      body.grid-view .grid-card .grid-light,body.grid-view .grid-card .grid-power-pill{display:none!important;}
      body.grid-view .grid-actions:has(.grid-action--compare){grid-template-columns:1fr 1fr 1fr!important;}
      body.grid-view .grid-action--compare{border-color:color-mix(in srgb,var(--group-glow) 58%,var(--border))!important;background:rgba(0,0,0,.18)!important;color:var(--accent-strong)!important;pointer-events:auto!important;}
      body.grid-view .grid-action--compare:hover{background:color-mix(in srgb,var(--group-glow) 16%,transparent)!important;}
      .d2aa-compare-modal{position:fixed!important;inset:0!important;z-index:99999!important;display:none!important;align-items:center!important;justify-content:center!important;padding:28px!important;}
      .d2aa-compare-modal.is-open{display:flex!important;}
      .d2aa-compare-backdrop{position:absolute!important;inset:0!important;background:rgba(0,0,0,.72)!important;backdrop-filter:blur(8px)!important;}
      .d2aa-compare-panel{position:relative!important;width:min(1120px,96vw)!important;max-height:88vh!important;overflow:auto!important;border:1px solid rgba(255,215,111,.28)!important;border-radius:22px!important;background:linear-gradient(180deg,rgba(20,18,28,.98),rgba(8,8,14,.98))!important;box-shadow:0 24px 80px rgba(0,0,0,.62)!important;color:var(--text,#f5f1ff)!important;padding:18px!important;}
      .d2aa-compare-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;margin-bottom:14px!important;}
      .d2aa-compare-head h2{margin:0!important;font-size:22px!important;}
      .d2aa-compare-close{width:36px!important;height:36px!important;border-radius:12px!important;border:1px solid rgba(255,255,255,.16)!important;background:rgba(255,255,255,.08)!important;color:inherit!important;font-size:24px!important;cursor:pointer!important;}
      .d2aa-compare-tools{display:flex!important;align-items:center!important;justify-content:space-between!important;margin-bottom:12px!important;color:var(--muted,#b8aecf)!important;}
      .d2aa-compare-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))!important;gap:12px!important;}
      .d2aa-compare-item{border:1px solid rgba(255,255,255,.12)!important;border-radius:16px!important;background:rgba(255,255,255,.055)!important;padding:12px!important;}
      .d2aa-compare-title strong{display:block!important;margin-bottom:4px!important;}
      .d2aa-compare-title span,.d2aa-compare-summary{color:var(--muted,#b8aecf)!important;font-size:12px!important;}
      .d2aa-compare-summary{display:flex!important;gap:10px!important;margin:10px 0!important;}
      .d2aa-compare-stats{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:6px!important;}
      .d2aa-compare-stat{border:1px solid rgba(255,255,255,.10)!important;border-radius:10px!important;padding:6px!important;text-align:center!important;background:rgba(0,0,0,.18)!important;}
      .d2aa-compare-stat span{display:block!important;font-size:10px!important;color:var(--muted,#b8aecf)!important;}
      .d2aa-compare-stat strong{font-size:16px!important;}
      .d2aa-compare-stat.is-best{border-color:rgba(255,215,111,.58)!important;background:rgba(255,215,111,.11)!important;}
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

  function ensureCompareButton(card, row, index) {
    const actions = card.querySelector('.grid-actions');
    if (!actions) return;
    const buttons = [...actions.querySelectorAll('[data-grid-action="compare-group"], .grid-action--compare')];
    if (!row?.Is_Dupe) { buttons.forEach((button) => button.remove()); return; }
    const group = cleanGroup(row.Dupe_Group || card.querySelector('.grid-group-badge')?.textContent || card.querySelector('[data-grid-action="group"]')?.textContent);
    const key = `${index}-${group}`;
    card.dataset.d2aaCardKey = key;
    buttons.forEach((button) => button.remove());
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'grid-action grid-action--compare';
    btn.dataset.gridAction = 'compare-group';
    btn.dataset.compareGroupId = group;
    btn.dataset.d2aaCardKey = key;
    btn.textContent = 'Compare group';
    btn.title = `Compare duplicate group ${group}`;
    btn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const resolved = rowForCardKey(key) || row;
      openCompare(resolved);
      return false;
    };
    actions.appendChild(btn);
  }

  function decorate() {
    injectCss();
    document.querySelectorAll('#rows .grid-card').forEach((card, index) => {
      const row = rowForCard(card);
      if (!row) return;
      ensureInfoBadge(card, row);
      ensureCompareButton(card, row, index);
    });
  }

  function openCompare(row) {
    if (!row) { toast('Compare failed: no row found'); return; }
    const group = groupRows(row);
    if (!group.length) { toast(`Compare failed: no rows for group ${cleanGroup(row.Dupe_Group) || '(blank)'}`); return; }
    let modal = document.getElementById('d2aaCompareGroupModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'd2aaCompareGroupModal';
      modal.className = 'd2aa-compare-modal';
      modal.innerHTML = '<div class="d2aa-compare-backdrop" data-compare-close="1"></div><section class="d2aa-compare-panel" role="dialog" aria-modal="true"><header class="d2aa-compare-head"><div><p class="eyebrow">Duplicate group</p><h2 id="d2aaCompareTitle">Compare Group</h2></div><button class="d2aa-compare-close" type="button" data-compare-close="1">×</button></header><div class="d2aa-compare-body" id="d2aaCompareBody"></div></section>';
      modal.addEventListener('click', (event) => { if (event.target.closest('[data-compare-close]')) { modal.classList.remove('is-open'); modal.style.display = 'none'; } });
      document.body.appendChild(modal);
    }
    const best = Object.fromEntries(STAT_COLS.map((stat) => [stat, Math.max(...group.map((item) => num(item[stat])))]));
    document.getElementById('d2aaCompareTitle').textContent = `Group ${esc(row.Dupe_Group || cleanGroup(row.Dupe_Group))}`;
    document.getElementById('d2aaCompareBody').innerHTML = `<div class="d2aa-compare-tools"><span>${group.length} matching items</span></div><div class="d2aa-compare-grid">${group.map((item) => `<article class="d2aa-compare-item"><div class="d2aa-compare-title"><strong>${esc(item.Name || '(Unnamed item)')}</strong><span>${esc(item.Equippable || '')} • ${esc(item.Type || '')} • ${esc(item.Rarity || '')}</span></div><div class="d2aa-compare-summary"><span>${num(item['Total (Base)'])}</span><span>${esc(item.Dupe_Group || '')}</span></div><div class="d2aa-compare-stats">${STAT_COLS.map((stat, i) => `<div class="d2aa-compare-stat${best[stat] === num(item[stat]) ? ' is-best' : ''}"><span>${STAT_LABELS[i]}</span><strong>${num(item[stat])}</strong></div>`).join('')}</div></article>`).join('')}</div>`;
    modal.classList.add('is-open');
    modal.style.display = 'flex';
  }

  window.D2AA_COMPARE_GROUP_HOTFIX = { openCompare, rowForCardKey, decorate };

  let queued = 0;
  function schedule() {
    if (queued) return;
    queued = requestAnimationFrame(() => { queued = 0; decorate(); });
  }

  function patchRender() {
    if (!window.D2AA || window.D2AA.__gridDomHotfixV92) return;
    const original = window.D2AA.render;
    window.D2AA.render = (...args) => {
      const result = original.apply(window.D2AA, args);
      schedule();
      setTimeout(schedule, 0);
      setTimeout(schedule, 120);
      return result;
    };
    window.D2AA.__gridDomHotfixV92 = true;
  }

  function bindClicks() {
    if (document.documentElement.dataset.gridDomHotfixV92Clicks === '1') return;
    document.documentElement.dataset.gridDomHotfixV92Clicks = '1';
    document.addEventListener('click', (event) => {
      const btn = event.target.closest?.('[data-grid-action="compare-group"], .grid-action--compare');
      if (!btn) return;
      const card = btn.closest('.grid-card');
      const row = rowForCard(card, btn);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openCompare(row);
    }, true);
  }

  function observeRows() {
    const host = document.getElementById('rows');
    if (!host || host.dataset.gridDomHotfixV92Observed === '1') return;
    host.dataset.gridDomHotfixV92Observed = '1';
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
