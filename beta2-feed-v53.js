(() => {
  const LS_FEED = 'd2aa_bungie_item_feed_v1';
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const normId = (value) => String(value || '').trim();
  const firstNumber = (...values) => {
    for (const value of values) {
      const match = String(value ?? '').match(/\d{3,5}/);
      if (match) return Number(match[0]);
    }
    return 0;
  };
  const rows = () => window.D2AA?.getState?.()?.rows || [];
  const rowById = () => new Map(rows().map((row) => [normId(row.Id), row]));
  const lightLevel = (row) => firstNumber(row?.Light, row?.Power, row?.PowerLevel, row?.['Power Level'], row?.['Light Level'], row?.PrimaryStat, row?.['Primary Stat'], row?.Level, row?.['Item Level']);

  function ensureInlinePower() {
    const map = rowById();
    const feed = readJson(LS_FEED, []);
    document.querySelectorAll('.item-feed-card').forEach((card) => {
      const title = card.querySelector('.feed-title')?.getAttribute('title') || card.querySelector('.feed-title')?.textContent || '';
      const item = feed.find((entry) => entry.name === title || card.textContent.includes(entry.name));
      if (!item) return;
      const row = map.get(normId(item.id));
      const power = Number(item.light || 0) || lightLevel(row);
      if (!power) return;
      const side = card.querySelector('.feed-side');
      if (!side) return;
      let chip = side.querySelector('.feed-power-inline');
      if (!chip) {
        chip = document.createElement('div');
        chip.className = 'feed-power-inline';
        chip.title = 'Light / Power level';
        side.prepend(chip);
      }
      chip.textContent = String(power);
    });
  }

  function run() {
    ensureInlinePower();
    const list = document.getElementById('itemFeedList');
    if (list && list.dataset.feedV53Observer !== '1') {
      list.dataset.feedV53Observer = '1';
      new MutationObserver(() => setTimeout(ensureInlinePower, 0)).observe(list, { childList: true, subtree: true });
    }
    window.addEventListener('d2aa:cache-state', () => setTimeout(ensureInlinePower, 50));
    window.addEventListener('storage', () => setTimeout(ensureInlinePower, 50));
    setTimeout(ensureInlinePower, 500);
    setTimeout(ensureInlinePower, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
