(() => {
  const LS_FEED = 'd2aa_bungie_item_feed_v1';
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const normId = (value) => String(value || '').trim();
  const firstNumber = (...values) => {
    for (const value of values) {
      const match = String(value ?? '').match(/\d{3,5}/);
      if (match) return Number(match[0]);
    }
    return 0;
  };
  const lightLevel = (row) => firstNumber(row?.Light, row?.Power, row?.PowerLevel, row?.['Power Level'], row?.['Light Level'], row?.PrimaryStat, row?.['Primary Stat'], row?.Level, row?.['Item Level']);
  const getRows = () => window.D2AA?.getState?.()?.rows || [];

  function feed() { return readJson(LS_FEED, []); }
  function rowById() { return new Map(getRows().map((row) => [normId(row.Id), row])); }

  function backfillFeedPower() {
    const map = rowById();
    let changed = false;
    const next = feed().map((item) => {
      const row = map.get(normId(item.id));
      const power = Number(item.light || 0) || lightLevel(row);
      if (power && power !== Number(item.light || 0)) {
        changed = true;
        return { ...item, light: power };
      }
      return item;
    });
    if (changed) writeJson(LS_FEED, next);
  }

  function ensurePowerChips() {
    backfillFeedPower();
    const map = rowById();
    const items = new Map(feed().map((item) => [normId(item.id), item]));
    document.querySelectorAll('.item-feed-card').forEach((card) => {
      const title = card.querySelector('.feed-title')?.getAttribute('title') || card.querySelector('.feed-title')?.textContent || '';
      const item = [...items.values()].find((entry) => entry.name === title || card.textContent.includes(entry.name));
      if (!item) return;
      const row = map.get(normId(item.id));
      const power = Number(item.light || 0) || lightLevel(row);
      const icon = card.querySelector('.feed-icon');
      if (!icon || !power) return;
      let chip = icon.querySelector('.feed-power, .feed-power-chip');
      if (!chip) {
        chip = document.createElement('span');
        chip.className = 'feed-power-chip';
        chip.title = 'Light / Power level';
        icon.appendChild(chip);
      }
      chip.textContent = String(power);
    });
  }

  function run() {
    ensurePowerChips();
    const list = document.getElementById('itemFeedList');
    if (list && list.dataset.powerObserver !== '1') {
      list.dataset.powerObserver = '1';
      new MutationObserver(() => setTimeout(ensurePowerChips, 0)).observe(list, { childList: true, subtree: true });
    }
    window.addEventListener('d2aa:cache-state', () => setTimeout(ensurePowerChips, 50));
    window.addEventListener('storage', () => setTimeout(ensurePowerChips, 50));
    setTimeout(ensurePowerChips, 500);
    setTimeout(ensurePowerChips, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
