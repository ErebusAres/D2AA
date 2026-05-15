(() => {
  function restoreVisibleTags() {
    document.querySelectorAll('.feed-tag-row').forEach((row) => {
      row.classList.remove('is-menu-open');
      row.querySelectorAll('.feed-tag-menu-panel').forEach((panel) => {
        [...panel.querySelectorAll('.feed-tag-btn')].forEach((btn) => row.appendChild(btn));
        panel.remove();
      });
      row.querySelectorAll('.feed-tag-current').forEach((el) => el.remove());
      row.dataset.tagMenuEnhanced = 'visible-tags';
    });
  }

  function init() {
    restoreVisibleTags();
    const list = document.getElementById('itemFeedList');
    if (list && list.dataset.visibleTagsObserver !== '1') {
      list.dataset.visibleTagsObserver = '1';
      new MutationObserver(() => setTimeout(restoreVisibleTags, 0)).observe(list, { childList: true, subtree: true });
    }
    setTimeout(restoreVisibleTags, 250);
    setTimeout(restoreVisibleTags, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
