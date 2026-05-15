(() => {
  const LS_OPEN = 'd2aa_item_feed_open_v1';
  const normId = (v) => String(v || '').trim();
  const getState = () => window.D2AA?.getState?.();

  function allRows() { return getState()?.allRows || getState()?.rows || getState()?.visible || []; }
  function findRow(id) { return allRows().find((row) => normId(row.Id) === normId(id)); }
  function dupeRows(row) {
    if (!row?.Is_Dupe) return [];
    return allRows().filter((item) => item.Is_Dupe && item.GroupKey === row.GroupKey && item.Dupe_Group === row.Dupe_Group);
  }

  function syncBodyOpenClass() {
    const open = document.getElementById('itemFeedDrawer')?.classList.contains('is-open') || localStorage.getItem(LS_OPEN) === '1';
    document.body.classList.toggle('feed-drawer-open', Boolean(open));
  }

  function patchOpenState() {
    const launcher = document.getElementById('itemFeedLauncher');
    const close = document.getElementById('itemFeedClose');
    if (launcher && launcher.dataset.feedDrawerPatched !== '1') {
      launcher.dataset.feedDrawerPatched = '1';
      launcher.addEventListener('click', () => setTimeout(syncBodyOpenClass, 0));
    }
    if (close && close.dataset.feedDrawerPatched !== '1') {
      close.dataset.feedDrawerPatched = '1';
      close.addEventListener('click', () => setTimeout(syncBodyOpenClass, 0));
    }
    syncBodyOpenClass();
  }

  function enhanceCards() {
    document.querySelectorAll('.item-feed-card').forEach((card) => {
      if (card.dataset.feedEnhanced === '1') return;
      const title = card.querySelector('.feed-title')?.getAttribute('title') || card.querySelector('.feed-title')?.textContent || '';
      const feed = JSON.parse(localStorage.getItem('d2aa_bungie_item_feed_v1') || '[]');
      const item = feed.find((entry) => entry.name === title || card.textContent.includes(entry.name));
      const row = item ? findRow(item.id) : null;
      if (!row) return;
      card.dataset.feedEnhanced = '1';
      const dupes = dupeRows(row);
      card.classList.toggle('is-dupe', dupes.length > 1);
      if (dupes.length > 1) {
        const meta = card.querySelector('.feed-meta');
        if (meta && !meta.querySelector('.feed-dupe-badge')) {
          meta.insertAdjacentHTML('beforeend', ` <span class="feed-dupe-badge" title="${dupes.length} items in this duplicate group">DUPE ${dupes.length}</span>`);
        }
        const side = card.querySelector('.feed-side');
        if (side && !side.querySelector('.feed-compare-btn')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'feed-compare-btn';
          btn.textContent = 'Compare';
          btn.title = 'Compare this duplicate group';
          btn.addEventListener('click', (event) => {
            event.stopPropagation();
            window.D2AAWorkflow?.openCompare?.(row.Id);
          });
          side.appendChild(btn);
        }
      }
    });
  }

  function runEnhance() {
    patchOpenState();
    enhanceCards();
  }

  function wait() {
    runEnhance();
    const drawer = document.getElementById('itemFeedDrawer');
    const list = document.getElementById('itemFeedList');
    if (!drawer || !list) { setTimeout(wait, 100); return; }
    if (drawer.dataset.feedDrawerObserver !== '1') {
      drawer.dataset.feedDrawerObserver = '1';
      new MutationObserver(runEnhance).observe(drawer, { attributes: true, attributeFilter: ['class'], subtree: false });
      new MutationObserver(runEnhance).observe(list, { childList: true, subtree: true });
    }
    window.addEventListener('storage', runEnhance);
    window.addEventListener('d2aa:cache-state', () => setTimeout(runEnhance, 50));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wait);
  else wait();
})();
