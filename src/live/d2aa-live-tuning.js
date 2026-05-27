(() => {
  const STAT_COLS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const STAT_HASH_TO_COL = { 392767087: 'Health (Base)', 4244567218: 'Melee (Base)', 1735777505: 'Grenade (Base)', 144602215: 'Super (Base)', 2996146975: 'Class (Base)', 1943323491: 'Weapons (Base)' };
  const STAT_LABELS = { 'Health (Base)': 'Health', 'Melee (Base)': 'Melee', 'Grenade (Base)': 'Grenade', 'Super (Base)': 'Super', 'Class (Base)': 'Class Ability', 'Weapons (Base)': 'Weapons' };
  const BUNGIE_ORIGIN = 'https://www.bungie.net';
  const KEY = '__d2aaLiveTuningPatch';
  if (window[KEY]) return;
  window[KEY] = true;

  function iconUrl(value) { const text = String(value || '').trim(); if (!text) return ''; return text.startsWith('http') ? text : text.startsWith('/') ? `${BUNGIE_ORIGIN}${text}` : text; }
  function normalize(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' '); }
  function html(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
  function colFromHash(hash) { return STAT_HASH_TO_COL[Number(hash) >>> 0] || ''; }
  function statsFromInvestment(stats) { const out = {}; for (const stat of stats || []) { const col = colFromHash(stat.statTypeHash); const value = Number(stat.value ?? stat.statValue ?? 0); if (col && value) out[col] = (out[col] || 0) + value; } return out; }
  function summarize(stats) { return Object.entries(stats || {}).filter(([, value]) => Number(value)).map(([col, value]) => `${value > 0 ? '+' : ''}${value} ${STAT_LABELS[col] || col.replace(' (Base)', '')}`).join(' / '); }
  function detectTuning(row) {
    if (!row) return null;
    if (row.__d2aaTuning !== undefined) return row.__d2aaTuning;
    const explicit = row.ArmorTuning || row.Tuning || null;
    if (explicit && typeof explicit === 'object') {
      row.__d2aaTuning = { name: explicit.name || explicit.Name || 'Armor Tuning', icon: iconUrl(explicit.icon || explicit.Icon || explicit.TuningIcon), stats: explicit.stats || explicit.Stats || {}, mode: explicit.mode || explicit.Mode || 'focused', source: explicit.source || explicit.Source || 'Row data' };
      row.__d2aaTuning.summary = explicit.summary || explicit.Summary || summarize(row.__d2aaTuning.stats);
      return row.__d2aaTuning;
    }
    const plugs = row.ActivePlugDefs || row.ActivePlugs || row.StatAudit?.activePlugs || [];
    let best = null;
    for (const plug of plugs) {
      const dp = plug.displayProperties || {};
      const name = plug.name || dp.name || 'Armor Tuning';
      const text = normalize(`${name} ${plug.description || dp.description || ''} ${plug.itemTypeDisplayName || plug.type || ''} ${plug.plug?.plugCategoryIdentifier || plug.category || ''}`);
      const stats = statsFromInvestment(plug.investmentStats || plug.stats || []);
      const vals = Object.values(stats).map(Number).filter(Boolean);
      if (!vals.length) continue;
      const positives = vals.filter((v) => v > 0);
      const negatives = vals.filter((v) => v < 0);
      const mentions = /\b(tuning|tuned|attunement|stat focus|focusing)\b/i.test(text);
      const smallShift = positives.length && negatives.length && Math.max(...positives) <= 5 && Math.max(...negatives.map((v) => Math.abs(v))) <= 5;
      const balanced = positives.length >= 3 && !negatives.length && positives.every((v) => v > 0 && v <= 2) && mentions;
      if (!mentions && !smallShift) continue;
      best = { name, icon: iconUrl(plug.icon || dp.icon || ''), stats, summary: summarize(stats), mode: balanced ? 'balanced' : 'focused', source: 'Active tuning socket' };
      if (mentions) break;
    }
    row.__d2aaTuning = best || null;
    return row.__d2aaTuning;
  }
  function title(tuning, col) { const value = Number(tuning?.stats?.[col] || 0); const stat = value ? `${value > 0 ? '+' : ''}${value} ${STAT_LABELS[col] || col}` : tuning?.summary || ''; return `${tuning?.name || 'Armor Tuning'}${stat ? `: ${stat}` : ''}${tuning?.summary && stat !== tuning.summary ? ` (${tuning.summary})` : ''}`; }
  function decorateRow(rowEl, row) {
    const tuning = detectTuning(row);
    if (!tuning?.icon) return;
    const chips = rowEl.querySelectorAll('.stat-chip');
    STAT_COLS.forEach((col, index) => {
      const value = Number(tuning.stats?.[col] || 0);
      if (!value) return;
      const chip = chips[index];
      if (!chip || chip.querySelector('.d2aa-tuning-icon')) return;
      chip.classList.add('has-d2aa-tuning');
      const img = document.createElement('img');
      img.className = `d2aa-tuning-icon ${value < 0 ? 'tune-negative' : tuning.mode === 'balanced' ? 'tune-balanced' : 'tune-positive'}`;
      img.src = tuning.icon;
      img.alt = '';
      img.loading = 'lazy';
      img.title = title(tuning, col);
      chip.insertBefore(img, chip.firstChild);
      chip.title = `${chip.title || STAT_LABELS[col] || col} · ${img.title}`;
    });
    const meta = rowEl.querySelector('.item-meta');
    if (meta && !meta.querySelector('.d2aa-tuning-summary')) {
      const summary = document.createElement('span');
      summary.className = 'd2aa-tuning-summary';
      summary.title = `${tuning.name}${tuning.summary ? `: ${tuning.summary}` : ''}`;
      summary.innerHTML = `<img src="${html(tuning.icon)}" alt="" loading="lazy"> ${html(tuning.summary || tuning.name)}`;
      meta.appendChild(summary);
    }
  }
  function decorate() {
    const state = window.D2AA?.getState?.();
    const rows = state?.visible || [];
    const rowEls = document.querySelectorAll('#rows .armor-row');
    rowEls.forEach((el, i) => decorateRow(el, rows[i]));
  }
  function scheduleDecorate() { requestAnimationFrame(() => requestAnimationFrame(decorate)); }
  document.addEventListener('d2aa:bundle-loaded', scheduleDecorate);
  document.addEventListener('DOMContentLoaded', scheduleDecorate);
  const rowsHost = document.getElementById('rows');
  if (rowsHost) new MutationObserver(scheduleDecorate).observe(rowsHost, { childList: true });
  const original = window.D2AA?.render;
  if (typeof original === 'function') {
    window.D2AA.render = function patchedRender(...args) { const result = original.apply(this, args); scheduleDecorate(); return result; };
  }
  scheduleDecorate();
})();
