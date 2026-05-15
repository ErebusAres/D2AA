(() => {
  function tierToDiamonds(rawText) {
    const match = String(rawText || '').match(/T\s*(\d+)/i);
    const tier = Math.max(0, Math.min(5, Number(match?.[1] || 0)));
    if (!tier) return '◇◇◇◇◇';
    return `${'◆'.repeat(tier)}${'◇'.repeat(5 - tier)}`;
  }

  function injectStyle() {
    if (document.getElementById('d2aaFeedTierDiamondStyles')) return;
    const style = document.createElement('style');
    style.id = 'd2aaFeedTierDiamondStyles';
    style.textContent = `
      .feed-tier-badge{font-size:10px;letter-spacing:-.04em;line-height:1;color:var(--accent-strong);text-shadow:0 0 10px color-mix(in srgb,var(--accent) 35%,transparent);}
    `;
    document.head.appendChild(style);
  }

  function patchTierBadges(root = document) {
    root.querySelectorAll('.feed-tier-badge').forEach((badge) => {
      if (badge.dataset.diamondPatched === '1') return;
      const original = badge.textContent || '';
      badge.dataset.diamondPatched = '1';
      badge.dataset.tierText = original;
      badge.title = `Stat tier ${original.replace(/^T/i, '') || '0'}`;
      badge.textContent = tierToDiamonds(original);
    });
  }

  function run() {
    injectStyle();
    patchTierBadges();
    const target = document.getElementById('itemFeedList') || document.body;
    new MutationObserver((mutations) => {
      if (mutations.some((m) => m.addedNodes.length)) patchTierBadges(target);
    }).observe(target, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();