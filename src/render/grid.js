(() => {
  const C = window.D2AA_CONSTANTS;
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  const num = (value) => Number(value || 0);
  const clean = (value) => String(value || '').trim();
  const statClass = (value) => { const n = num(value); if (n >= 30) return 'stat-cyan'; if (n >= 24) return 'stat-green'; if (n >= 15) return 'stat-yellow'; return 'stat-red'; };
  const rarityClass = (rarity) => `rarity-${String(rarity || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const tagEmoji = (tag) => (C.TAGS.find((item) => item.id === String(tag || '').toLowerCase()) || {}).emoji || '';
  const tagLabel = (tag) => (C.TAGS.find((item) => item.id === String(tag || '').toLowerCase()) || {}).label || 'No tag';
  const iconUrl = (row) => row.IconUrl || row.Icon || row.DisplayIcon || row.ScreenshotUrl || '';
  const slotLabel = (row) => row.Slot || row.Type || 'Armor';
  const tierFor = (row) => Math.max(0, Math.min(5, num(row.GearTier || row.Tier || 0)));
  const tierDiamonds = (row) => `<span class="tier-filled">${'◆'.repeat(tierFor(row))}</span><span class="tier-empty">${'◇'.repeat(5 - tierFor(row))}</span>`;
  const img = (url, label, cls = 'grid-mini-icon') => url ? `<img class="${cls}" src="${esc(url)}" alt="${esc(label)}" title="${esc(label)}" loading="lazy">` : '';
  const mask = (url, label, cls = 'grid-mask-icon') => url ? `<span class="${cls}" title="${esc(label)}" style="mask-image:url('${esc(url)}');-webkit-mask-image:url('${esc(url)}')"></span>` : '';

  const ARCHETYPES = {
    health: { stat: 'Health (Base)', label: 'Health' },
    melee: { stat: 'Melee (Base)', label: 'Melee' },
    grenade: { stat: 'Grenade (Base)', label: 'Grenade' },
    super: { stat: 'Super (Base)', label: 'Super' },
    class: { stat: 'Class (Base)', label: 'Class' },
    weapon: { stat: 'Weapons (Base)', label: 'Weapon' },
    balanced: { stat: '', label: 'Balanced', emoji: '⚖️' }
  };
  function archetypeKey(row) {
    const entries = C.STAT_COLS.map((stat) => ({ stat, value: num(row[stat]) })).sort((a, b) => b.value - a.value);
    const top = entries[0];
    const second = entries[1];
    if (!top || top.value <= 0 || (second && Math.abs(top.value - second.value) <= 2)) return 'balanced';
    return { 'Health (Base)':'health', 'Melee (Base)':'melee', 'Grenade (Base)':'grenade', 'Super (Base)':'super', 'Class (Base)':'class', 'Weapons (Base)':'weapon' }[top.stat] || 'balanced';
  }
  function archetypeMarkup(row) {
    const data = ARCHETYPES[archetypeKey(row)] || ARCHETYPES.balanced;
    const body = data.stat ? img(C.STAT_ICONS[data.stat], data.label, 'grid-aag-icon') : `<span class="grid-aag-emoji">${data.emoji}</span>`;
    return `<span class="grid-aag-badge" title="${esc(data.label)}">${body}</span>`;
  }
  function infoBadge(row) {
    const light = num(row.Light || row.Power);
    const tag = tagEmoji(row.Tag);
    if (!light && !tag) return '';
    return `<button class="grid-tag grid-info-badge${tag ? ' has-tag' : ''}" type="button" data-action="tag" data-id="${esc(row.Id)}" title="${esc(`${light ? `Light / Power ${light}` : ''}${light && tag ? ' • ' : ''}${tag ? `${tagLabel(row.Tag)} tag` : ''} — change tag`)}">${light ? `<span class="grid-info-light">${light}</span>` : ''}${light && tag ? '<span class="grid-info-dot">•</span>' : ''}${tag ? `<span class="grid-info-tag">${tag}</span>` : ''}</button>`;
  }
  function statSlot(row, stat) {
    const label = stat.replace(' (Base)', '');
    const val = num(row[stat]);
    return `<div class="grid-slot-stat grid-stat ${statClass(val)}" title="${esc(label)}: ${val}">${img(C.STAT_ICONS[stat], label)}<span>${val}</span></div>`;
  }
  function slotGrid(row) {
    const tier = tierFor(row);
    return `<div class="grid-slot-total grid-total" title="Base stat total">${num(row['Total (Base)'])}</div><div class="grid-slot-tier grid-tier" data-visual-tier="${tier}" data-tier-max="5" title="${esc(`Gear tier ${tier}/5${row.TierSource ? ` • ${row.TierSource}` : ''}`)}">${tierDiamonds(row)}</div><div class="grid-slot-aag">${archetypeMarkup(row)}</div>${C.STAT_COLS.map((stat) => statSlot(row, stat)).join('')}`;
  }
  function locationIcon(row) { return row.Source === 'Bungie' ? (row.IsInVault ? '🏦' : row.IsEquipped ? '⚔️' : '🎒') : '⧉'; }
  function card(row) {
    const slot = slotLabel(row);
    const icon = iconUrl(row);
    const fallback = slot.slice(0, 1).toUpperCase();
    const color = row.GroupColor || '';
    const style = color ? ` style="--group-glow:${esc(color)};--group-color:${esc(color)}"` : '';
    const groupBadge = row.Is_Dupe ? `<span class="grid-group-badge" title="${esc(`${slot} duplicate group ${row.Dupe_Group || 'G'}`)}">${esc(clean(row.Dupe_Group) || 'G')}</span>` : '';
    const actionClass = row.Is_Dupe ? 'grid-actions' : 'grid-actions grid-actions--single';
    return `<article class="grid-card ${rarityClass(row.Rarity)}${row.Is_Dupe ? ' is-dupe' : ''}" data-grid-id="${esc(clean(row.Id))}" data-id="${esc(clean(row.Id))}" data-compare-group-id="${esc(clean(row.Dupe_Group))}"${style}>${groupBadge}<div class="grid-card-top"><div class="grid-item-icon">${icon ? `<img src="${esc(icon)}" alt="" loading="lazy">` : `<span>${esc(fallback)}</span>`}</div><div class="grid-item-title"><div class="grid-item-name" title="${esc(row.Name)}">${esc(row.Name || '(Unnamed item)')}</div><div class="grid-icon-row">${img(C.RARITY_ICONS[row.Rarity], row.Rarity || 'Rarity')}${mask(C.SLOT_ICONS[slot], slot)}${mask(C.CLASS_ICONS[row.Equippable], row.Equippable)}<span class="grid-location" title="${esc(row.Source || 'DIM')}">${locationIcon(row)}</span></div></div>${infoBadge(row)}</div><div class="grid-body" data-slot-grid="1">${slotGrid(row)}</div><div class="${actionClass}"><button class="grid-action" type="button" data-action="copy" data-id="${esc(clean(row.Id))}">${row.Source === 'Bungie' ? 'Vault/Pull' : 'Copy'}</button>${row.Is_Dupe ? `<button class="grid-action grid-action--group" type="button" data-action="copy-group" data-group="${esc(row.GroupKey)}">${mask(C.SLOT_ICONS[slot], `${slot} ${row.Dupe_Group}`, 'grid-action-slot-icon')}<span>${esc(clean(row.Dupe_Group))}</span></button>` : ''}</div></article>`;
  }
  function renderGrid(state) {
    const host = document.getElementById('gridHost');
    if (!host) return;
    host.innerHTML = state.visible.map(card).join('') || '<p class="status-text">No armor rows match the current filters.</p>';
  }
  window.D2AA_GRID = { renderGrid };
})();
