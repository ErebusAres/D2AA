(() => {
  function moveArchetypes() {
    document.querySelectorAll('body.grid-view .grid-card').forEach((card) => {
      const badge = card.querySelector('.grid-aag-badge');
      const primary = card.querySelector('.grid-primary-row');
      const group = card.querySelector('.grid-group-badge');
      if (!badge || !primary) return;
      if (badge.parentElement === primary) return;
      if (group) primary.insertBefore(badge, group);
      else primary.appendChild(badge);
    });
  }
  function run() {
    moveArchetypes();
    const rows = document.getElementById('rows');
    if (rows && rows.dataset.archetypeMoveObserver !== '1') {
      rows.dataset.archetypeMoveObserver = '1';
      new MutationObserver(() => setTimeout(moveArchetypes, 0)).observe(rows, { childList: true, subtree: true });
    }
    const original = window.D2AA?.render;
    if (original && !window.D2AA.__archetypeMovePatch) {
      window.D2AA.render = () => { original(); setTimeout(moveArchetypes, 0); };
      window.D2AA.__archetypeMovePatch = true;
    }
    setTimeout(moveArchetypes, 100);
    setTimeout(moveArchetypes, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
