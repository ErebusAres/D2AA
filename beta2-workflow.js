(() => {
  const LS_MODE = 'd2aa_beta2_workflow_mode_v1';
  const MODES = [
    { id: 'all', icon: '◇', label: 'All' },
    { id: 'dupes', icon: '⚠', label: 'Dupes' },
    { id: 'same', icon: '≡', label: 'Same-name' },
    { id: 'high', icon: '★', label: 'High rolls' },
    { id: 'exotic', icon: '◆', label: 'Exotics' }
  ];
  const TAGS = [
    { id: '', icon: '○', label: 'No tag' },
    { id: 'favorite', icon: '❤️', label: 'Favorite' },
    { id: 'keep', icon: '🏷️', label: 'Keep' },
    { id: 'junk', icon: '🚫', label: 'Junk' },
    { id: 'infuse', icon: '⚡', label: 'Infuse' },
    { id: 'archive', icon: '📦', label: 'Archive' }
  ];
  const STAT_COLS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const STAT_ICONS = {
    'Health (Base)': 'https://www.bungie.net/common/destiny2_content/icons/717b8b218cc14325a54869bef21d2964.png',
    'Melee (Base)': 'https://www.bungie.net/common/destiny2_content/icons/fa534aca76d7f2d7e7b4ba4df4271b42.png',
    'Grenade (Base)': 'https://www.bungie.net/common/destiny2_content/icons/065cdaabef560e5808e821cefaeaa22c.png',
    'Super (Base)': 'https://www.bungie.net/common/destiny2_content/icons/585ae4ede9c3da96b34086fccccdc8cd.png',
    'Class (Base)': 'https://www.bungie.net/common/destiny2_content/icons/7eb845acb5b3a4a9b7e0b2f05f5c43f1.png',
    'Weapons (Base)': 'https://www.bungie.net/common/destiny2_content/icons/bc69675acdae9e6b9a68a02fb4d62e07.png'
  };
  const $ = (id) => document.getElementById(id);
  const num = (v) => Number(v || 0);
  const normId = (v) => String(v || '').trim();
  const normTag = (v) => TAGS.some((t) => t.id === String(v || '').trim().toLowerCase()) ? String(v || '').trim().toLowerCase() : '';
  const esc = (v) => String(v ?? '').replace(/[&<>'\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' }[c]));
  const iconUrl = (row) => row.IconUrl || row.Icon || row.DisplayIcon || row.ScreenshotUrl || '';
  const slotLabel = (type) => ['Warlock Bond', 'Hunter Cloak', 'Titan Mark'].includes(type) ? 'Class Item' : type;
  const getState = () => window.D2AA?.getState?.();
  const mode = () => localStorage.getItem(LS_MODE) || 'all';
  const statClass = (v) => { const n = num(v); if (n >= 30) return 'stat-cyan'; if (n >= 24) return 'stat-green'; if (n >= 15) return 'stat-yellow'; return 'stat-red'; };

  function groupColor(row) {
    const key = `${row?.GroupKey || ''}:${row?.Dupe_Group || ''}`;
    const colors = ['#b57cff', '#66d9ff', '#ffcf66', '#77ffb0', '#ff7ca8', '#ffa66b', '#9cfffb', '#d5ff6b'];
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    return colors[Math.abs(hash) % colors.length];
  }

  function syncModeToState() {
    const s = getState();
    if (!s) return;
    const current = mode();
    if (current === 'dupes') s.dupesFilter = 'Only Dupes';
    else if (current === 'same') s.dupesFilter = 'Only Same-Name';
    else s.dupesFilter = 'All';
    if (current === 'exotic') s.rarityFilter = 'Exotic';
    else if (s.rarityFilter === 'Exotic') s.rarityFilter = 'All';
    if (current === 'high') s.sortBy = 'rankDesc';
    else if (s.sortBy === 'rankDesc') s.sortBy = 'default';
    const sort = $('sortBy');
    if (sort) sort.value = s.sortBy;
  }

  function setMode(next) {
    localStorage.setItem(LS_MODE, next);
    syncModeToState();
    renderModeBar();
    window.D2AA?.render?.();
  }

  function renderModeBar() {
    let host = $('d2aaModeBar');
    const tablePanel = document.querySelector('.table-panel');
    if (!tablePanel) return;
    if (!host) {
      host = document.createElement('div');
      host.id = 'd2aaModeBar';
      host.className = 'd2aa-mode-bar';
      tablePanel.querySelector('.table-topbar')?.after(host);
    }
    host.innerHTML = MODES.map((item) => `<button type="button" class="d2aa-mode-btn${mode() === item.id ? ' is-active' : ''}" data-mode="${item.id}"><strong>${item.icon}</strong><span>${item.label}</span></button>`).join('');
    host.querySelectorAll('[data-mode]').forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  }

  function allRows() { return getState()?.allRows || getState()?.rows || getState()?.visible || []; }
  function groupRows(row) {
    const rows = allRows();
    return rows.filter((item) => item.Is_Dupe && item.GroupKey === row.GroupKey && item.Dupe_Group === row.Dupe_Group)
      .sort((a, b) => num(b['Total (Base)']) - num(a['Total (Base)']) || String(a.Name).localeCompare(String(b.Name)));
  }

  function statMarkup(row, bestRow) {
    return `<div class="compare-stats">${STAT_COLS.map((stat) => {
      const value = num(row[stat]);
      const delta = value - num(bestRow?.[stat]);
      const deltaText = delta === 0 ? '' : `<span class="compare-delta ${delta > 0 ? 'is-pos' : 'is-neg'}">${delta > 0 ? '+' : ''}${delta}</span>`;
      return `<div class="compare-stat ${statClass(value)}"><img src="${STAT_ICONS[stat]}" alt="${esc(stat)}"><span>${value}</span>${deltaText}</div>`;
    }).join('')}</div>`;
  }

  function tagMarkup(row) {
    const current = normTag(row.Tag);
    return `<div class="compare-tags" aria-label="Assign tag">${TAGS.map((tag) => `<button type="button" class="compare-tag-btn${current === tag.id ? ' is-active' : ''}" data-compare-tag="${esc(tag.id)}" data-compare-row="${esc(normId(row.Id))}" title="${esc(tag.label)}">${tag.icon}</button>`).join('')}</div>`;
  }

  function itemMarkup(row, bestRow) {
    const icon = iconUrl(row);
    const fallback = slotLabel(row.Type).slice(0, 1).toUpperCase();
    const best = normId(row.Id) === normId(bestRow?.Id);
    const style = `style="--group-glow:${groupColor(row)}"`;
    return `<article class="compare-item${best ? ' is-best' : ''}" data-compare-item="${esc(normId(row.Id))}" ${style}>
      <div class="compare-top">
        <div class="compare-icon">${icon ? `<img src="${esc(icon)}" alt="">` : `<span>${esc(fallback)}</span>`}</div>
        <div><div class="compare-name">${esc(row.Name || '(Unnamed item)')}</div><div class="compare-meta">${esc(slotLabel(row.Type))} • ${esc(row.Rarity)} • ${esc(row.Source === 'Bungie' ? (row.IsInVault ? 'Vault' : row.IsEquipped ? 'Equipped' : 'Inventory') : 'DIM')}</div></div>
        <div class="compare-score"><span class="compare-total">${num(row['Total (Base)'])}</span><span class="compare-rank">${esc(row.Rank || '')}</span>${best ? '<span class="compare-best">Best</span>' : ''}</div>
      </div>
      ${statMarkup(row, bestRow)}
      <div class="compare-actions"><button type="button" data-copy-id="${esc(normId(row.Id))}">Copy ID</button>${tagMarkup(row)}</div>
    </article>`;
  }

  function ensureDrawer() {
    let layer = $('compareLayer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'compareLayer';
    layer.className = 'compare-layer';
    layer.innerHTML = `<div class="compare-scrim" data-compare-close="1"></div><aside class="compare-drawer" role="dialog" aria-modal="true" aria-label="Compare duplicate group"><div class="compare-head"><div><h2 id="compareTitle">Compare Group</h2><div id="compareSub" class="compare-sub"></div></div><button class="compare-close" type="button" data-compare-close="1">×</button></div><div id="compareBody" class="compare-body"></div><button id="compareCopyGroup" class="compare-copy" type="button">Copy group DIM filter</button></aside>`;
    document.body.appendChild(layer);
    layer.addEventListener('click', (event) => { if (event.target?.dataset?.compareClose) closeDrawer(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDrawer(); });
    return layer;
  }

  function closeDrawer() { $('compareLayer')?.classList.remove('is-open'); }
  async function copyText(text) { try { await navigator.clipboard.writeText(text); return true; } catch (_) { return false; } }
  function findRowById(id) { return allRows().find((row) => normId(row.Id) === normId(id)); }
  function assignCompareTag(id, tag) {
    const row = findRowById(id);
    if (!row || !window.D2AA?.setTag) return;
    window.D2AA.setTag(row, tag || '');
    document.querySelectorAll(`[data-compare-row="${CSS.escape(normId(id))}"]`).forEach((btn) => btn.classList.toggle('is-active', btn.dataset.compareTag === normTag(tag)));
    window.D2AA.render?.();
  }

  function openCompare(rowOrId) {
    const row = typeof rowOrId === 'string' ? findRowById(rowOrId) : rowOrId;
    if (!row) return false;
    const rows = groupRows(row);
    if (!rows.length) return false;
    const bestRow = rows[0];
    const layer = ensureDrawer();
    $('compareTitle').textContent = `${slotLabel(row.Type)} Group ${row.Dupe_Group}`;
    $('compareSub').textContent = `${rows.length} matching armor pieces • best base total ${num(bestRow['Total (Base)'])}`;
    $('compareBody').innerHTML = rows.map((item) => itemMarkup(item, bestRow)).join('');
    $('compareCopyGroup').onclick = async () => {
      const ok = await copyText(rows.map((item) => `id:${normId(item.Id)}`).join(' or '));
      $('compareCopyGroup').textContent = ok ? 'Copied group filter' : 'Copy failed';
      setTimeout(() => { $('compareCopyGroup').textContent = 'Copy group DIM filter'; }, 1100);
    };
    $('compareBody').querySelectorAll('[data-copy-id]').forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await copyText(`id:${btn.dataset.copyId}`);
      btn.textContent = ok ? 'Copied' : 'Failed';
      setTimeout(() => { btn.textContent = 'Copy ID'; }, 900);
    }));
    $('compareBody').querySelectorAll('[data-compare-tag]').forEach((btn) => btn.addEventListener('click', () => assignCompareTag(btn.dataset.compareRow, btn.dataset.compareTag || '')));
    layer.classList.add('is-open');
    return true;
  }

  function injectCompareButtons() {
    const rows = getState()?.visible || [];
    document.querySelectorAll('.grid-card').forEach((card) => {
      if (card.querySelector('[data-grid-action="compare"]')) return;
      const row = rows.find((item) => normId(item.Id) === card.dataset.gridId);
      if (!row?.Is_Dupe) return;
      const actions = card.querySelector('.grid-actions');
      if (!actions) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'grid-action grid-action--compare';
      btn.dataset.gridAction = 'compare';
      btn.textContent = 'Compare group';
      btn.addEventListener('click', () => openCompare(row));
      actions.appendChild(btn);
    });
  }

  function patchRender() {
    if (!window.D2AA || window.D2AA.__workflowPatched) return;
    const original = window.D2AA.render;
    window.D2AA.render = () => { syncModeToState(); original(); renderModeBar(); setTimeout(injectCompareButtons, 0); };
    window.D2AA.__workflowPatched = true;
  }

  window.D2AAWorkflow = { openCompare, closeCompare: closeDrawer };

  function run() {
    if (!window.D2AA) { setTimeout(run, 50); return; }
    patchRender();
    syncModeToState();
    renderModeBar();
    window.D2AA.render?.();
    setTimeout(injectCompareButtons, 100);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();