(() => {
  const C = window.D2AA_CONSTANTS;
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const num = (value) => Number(value || 0);
  const statClass = (value) => num(value) >= 30 ? 'stat-cyan' : num(value) >= 24 ? 'stat-green' : num(value) >= 15 ? 'stat-yellow' : 'stat-red';
  const tagEmoji = (tag) => (C.TAGS.find((item) => item.id === String(tag || '').toLowerCase()) || {}).emoji || '';
  const mask = (url, label) => url ? `<span class="mask-icon" title="${esc(label)}" style="mask-image:url('${esc(url)}');-webkit-mask-image:url('${esc(url)}')"></span>` : '';
  const img = (url, label) => url ? `<img class="mini-icon" src="${esc(url)}" alt="${esc(label)}" title="${esc(label)}" loading="lazy">` : '';
  const tierDiamonds = (tier) => `<span class="tier-filled">${'◆'.repeat(Math.max(0,Math.min(5,num(tier))))}</span><span class="tier-empty">${'◇'.repeat(5 - Math.max(0,Math.min(5,num(tier))))}</span>`;
  function archetype(row) { const entries = C.STAT_COLS.map((stat) => [stat, num(row[stat])]).sort((a,b) => b[1] - a[1]); const top = entries[0]; const second = entries[1]; if (!top || top[1] <= 0 || (second && Math.abs(top[1] - second[1]) <= 2)) return 'Balanced'; return C.STAT_LABELS[C.STAT_COLS.indexOf(top[0])] || 'Balanced'; }
  function infoBadge(row) { const light = num(row.Light || row.Power); const emoji = tagEmoji(row.Tag); if (!light && !emoji) return ''; return `<button class="info-badge" type="button" data-action="tag" data-id="${esc(row.Id)}">${light ? `<span>${light}</span>` : ''}${light && emoji ? '<span>•</span>' : ''}${emoji ? `<span>${emoji}</span>` : ''}</button>`; }
  function statCell(row, stat) { const label = stat.replace(' (Base)',''); const value = num(row[stat]); return `<div class="grid-cell ${statClass(value)}"><span class="grid-cell-label">${esc(label)}</span><span class="grid-cell-value">${img(C.STAT_ICONS[stat], label)}${value}</span></div>`; }
  function card(row) { const color = row.GroupColor || 'transparent'; const actionsClass = row.Is_Dupe ? 'card-actions' : 'card-actions single'; return `<article class="armor-card${row.Is_Dupe ? ' is-dupe' : ''}" style="--group-color:${esc(color)}" data-id="${esc(row.Id)}">
    ${infoBadge(row)}${row.Is_Dupe ? `<span class="group-badge">${esc(row.Dupe_Group)}</span>` : ''}
    <div class="card-top"><div class="item-icon">${row.IconUrl ? `<img src="${esc(row.IconUrl)}" alt="" loading="lazy">` : `<span>${esc((row.Slot || 'A').slice(0,1))}</span>`}</div><div class="item-name" title="${esc(row.Name)}">${esc(row.Name)}</div><div class="identifier-icons">${img(C.RARITY_ICONS[row.Rarity], row.Rarity)}${mask(C.SLOT_ICONS[row.Slot], row.Slot)}${mask(C.CLASS_ICONS[row.Equippable], row.Equippable)}</div></div>
    <div class="card-grid"><div class="grid-cell total-cell"><span class="grid-cell-label">Total</span><span class="grid-cell-value">${num(row['Total (Base)'])}</span></div><div class="grid-cell"><span class="grid-cell-label">Tier</span><span class="grid-cell-value">${tierDiamonds(row.GearTier || row.Tier)}</span></div><div class="grid-cell"><span class="grid-cell-label">Archetype</span><span class="grid-cell-value">${esc(archetype(row))}</span></div>${C.STAT_COLS.map((stat) => statCell(row, stat)).join('')}</div>
    <div class="${actionsClass}"><button class="card-action" type="button" data-action="copy" data-id="${esc(row.Id)}">Copy ID</button>${row.Is_Dupe ? `<button class="card-action" type="button" data-action="copy-group" data-group="${esc(row.GroupKey)}">Copy group</button>` : ''}</div>
  </article>`; }
  function renderGrid(state) { const host = document.getElementById('gridHost'); if (!host) return; host.innerHTML = state.visible.map(card).join('') || '<p class="status-text">No armor rows match the current filters.</p>'; }
  window.D2AA_GRID = { renderGrid };
})();
