(() => {
  const FEED_KEY = 'd2aa_bungie_item_feed_v1';
  const STAT_ORDER = [
    ['Health', 'https://www.bungie.net/common/destiny2_content/icons/717b8b218cc14325a54869bef21d2964.png'],
    ['Melee', 'https://www.bungie.net/common/destiny2_content/icons/fa534aca76d7f2d7e7b4ba4df4271b42.png'],
    ['Grenade', 'https://www.bungie.net/common/destiny2_content/icons/065cdaabef560e5808e821cefaeaa22c.png'],
    ['Super', 'https://www.bungie.net/common/destiny2_content/icons/585ae4ede9c3da96b34086fccccdc8cd.png'],
    ['Class', 'https://www.bungie.net/common/destiny2_content/icons/7eb845acb5b3a4a9b7e0b2f05f5c43f1.png'],
    ['Weapons', 'https://www.bungie.net/common/destiny2_content/icons/bc69675acdae9e6b9a68a02fb4d62e07.png']
  ];

  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } };
  const normId = (value) => String(value || '').trim();
  const itemIconFromRow = (row) => row?.IconUrl || row?.Icon || row?.DisplayIcon || row?.ScreenshotUrl || '';

  function injectStyle() {
    if (document.getElementById('d2aaFeedIconPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'd2aaFeedIconPatchStyles';
    style.textContent = `
      .feed-stat-icon-img{width:11px;height:11px;object-fit:contain;opacity:.92;display:block;flex:0 0 auto;}
      .feed-icon img{background:rgba(0,0,0,.18);}
    `;
    document.head.appendChild(style);
  }

  function patchStatIcons(root = document) {
    root.querySelectorAll('.item-feed-card').forEach((card) => {
      card.querySelectorAll('.feed-stat').forEach((stat, index) => {
        if (stat.querySelector('.feed-stat-icon-img')) return;
        const icon = STAT_ORDER[index];
        if (!icon) return;
        const old = stat.querySelector('.feed-stat-icon');
        const img = document.createElement('img');
        img.className = 'feed-stat-icon-img';
        img.src = icon[1];
        img.alt = icon[0];
        img.title = icon[0];
        if (old) old.replaceWith(img);
        else stat.prepend(img);
      });
    });
  }

  function hydrateFeedItemImages() {
    const state = window.D2AA?.getState?.();
    const rows = state?.allRows || state?.rows || [];
    if (!rows.length) return false;

    const iconById = new Map(rows.map((row) => [normId(row?.Id), itemIconFromRow(row)]).filter(([, icon]) => icon));
    if (!iconById.size) return false;

    const feed = readJson(FEED_KEY, []);
    let changed = false;
    const next = feed.map((item) => {
      const icon = iconById.get(normId(item?.id));
      if (!icon || item.itemIcon === icon) return item;
      changed = true;
      return { ...item, itemIcon: icon };
    });

    if (changed) {
      writeJson(FEED_KEY, next);
      window.D2AA?.render?.();
    }
    return changed;
  }

  function run() {
    injectStyle();
    patchStatIcons();
    setTimeout(hydrateFeedItemImages, 200);
    setTimeout(hydrateFeedItemImages, 1500);
    const target = document.getElementById('itemFeedList') || document.body;
    new MutationObserver((mutations) => {
      if (!mutations.some((m) => m.addedNodes.length)) return;
      patchStatIcons(target);
      hydrateFeedItemImages();
    }).observe(target, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();