(() => {
  const C = window.D2AA_CONSTANTS;
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const num = (value) => Number(value || 0);
  const statClass = (value) => num(value) >= 30 ? 'stat-cyan' : num(value) >= 24 ? 'stat-green' : num(value) >= 15 ? 'stat-yellow' : 'stat-red';
  const tagEmoji = (tag) => (C.TAGS.find((item) => item.id === String(tag || '').toLowerCase()) || {}).emoji || '＋';
  const tier = (row) => '◆'.repeat(Math.max(0,Math.min(5,num(row.GearTier || row.Tier)))) + '◇'.repeat(5 - Math.max(0,Math.min(5,num(row.GearTier || row.Tier))));
  function renderTable(state) { const host = document.getElementById('tableHost'); if (!host) return; const statHeads = C.STAT_LABELS.map((label) => `<th>${esc(label)}</th>`).join(''); const rows = state.visible.map((row) => `<tr style="--group-color:${esc(row.GroupColor || 'transparent')}"><td><div class="table-item">${row.IconUrl ? `<img src="${esc(row.IconUrl)}" alt="">` : ''}<span>${esc(row.Name)}</span></div></td><td>${esc(row.Equippable)}</td><td>${esc(row.Slot)}</td><td>${esc(row.Rarity)}</td><td>${num(row.Light || row.Power) || ''}</td><td>${num(row['Total (Base)'])}</td><td>${tier(row)}</td>${C.STAT_COLS.map((stat) => `<td class="table-stat ${statClass(row[stat])}">${num(row[stat])}</td>`).join('')}<td>${row.Is_Dupe ? `<span class="table-group">${esc(row.Dupe_Group)}</span>` : ''}</td><td><button class="table-tag-btn" type="button" data-action="tag" data-id="${esc(row.Id)}">${tagEmoji(row.Tag)}</button></td></tr>`).join(''); host.innerHTML = `<table class="armor-table"><thead><tr><th>Name</th><th>Class</th><th>Slot</th><th>Rarity</th><th>Light</th><th>Total</th><th>Tier</th>${statHeads}<th>Group</th><th>Tag</th></tr></thead><tbody>${rows}</tbody></table>`; }
  window.D2AA_TABLE = { renderTable };
})();
