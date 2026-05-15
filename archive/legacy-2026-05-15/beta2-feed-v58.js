(() => {
  function disableOldTagMenu() {
    document.querySelectorAll('.feed-tag-row').forEach((row) => {
      row.classList.remove('is-menu-open');
      row.querySelectorAll('.feed-tag-current, .feed-tag-menu-panel').forEach((el) => el.remove());
      row.querySelectorAll('.feed-tag-btn').forEach((btn) => row.appendChild(btn));
      row.dataset.tagMenuEnhanced = 'v58-disabled';
    });
  }

  function init() {
    disableOldTagMenu();
    const list = document.getElementById('itemFeedList');
    if (list && list.dataset.feedV58Observer !== '1') {
      list.dataset.feedV58Observer = '1';
      new MutationObserver(() => setTimeout(disableOldTagMenu, 0)).observe(list, { childList: true, subtree: true });
    }
    setTimeout(disableOldTagMenu, 250);
    setTimeout(disableOldTagMenu, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
