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
  const statClass = (value) => {
    const n = Number(value || 0);
    if (n >= 30) return 'stat-cyan';
    if (n >= 24) return 'stat-green';
    if (n >= 15) return 'stat-yellow';
    return 'stat-red';
  };

  function injectStyle() {
    if (document.getElementById('d2aaFeedIconPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'd2aaFeedIconPatchStyles';
    style.textContent = `
      .feed-stat-icon-img{width:11px;height:11px;object-fit:contain;opacity:.92;display:block;flex:0 0 auto;}
      .feed-icon img{background:rgba(0,0,0,.18);}
      .feed-stat.stat-cyan{color:#76e9ff;border-color:rgba(118,233,255,.32);background:rgba(118,233,255,.06);}
      .feed-stat.stat-green{color:#91ffbf;border-color:rgba(145,255,191,.28);background:rgba(145,255,191,.055);}
      .feed-stat.stat-yellow{color:#ffe187;border-color:rgba(255,225,135,.28);background:rgba(255,225,135,.055);}
      .feed-stat.stat-red{color:#ff8da0;border-color:rgba(255,141,160,.28);background:rgba(255,141,160,.05);}
    `;
    document.head.appendChild(style);
  }

  function patchStatChips(root = document) {
    root.querySelectorAll('.item-feed-card').forEach((card) => {
      card.querySelectorAll('.feed-stat').forEach((stat, index) => {
        const value = Number(stat.querySelector('strong')?.textContent || 0);
        stat.classList.remove('stat-cyan', 'stat-green', 'stat-yellow', 'stat-red');
        stat.classList.add(statClass(value));

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
    patchStatChips();
    setTimeout(hydrateFeedItemImages, 200);
    setTimeout(hydrateFeedItemImages, 1500);
    const target = document.getElementById('itemFeedList') || document.body;
    new MutationObserver((mutations) => {
      if (!mutations.some((m) => m.addedNodes.length)) return;
      patchStatChips(target);
      hydrateFeedItemImages();
    }).observe(target, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();