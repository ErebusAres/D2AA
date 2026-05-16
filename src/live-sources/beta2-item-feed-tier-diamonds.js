(() => {
  function tierToDiamonds(rawText, maxTier = 5) {
    const match = String(rawText || '').match(/T\s*(\d+)/i);
    const max = Math.max(1, Math.min(5, Number(maxTier || 5)));
    const tier = Math.max(0, Math.min(max, Number(match?.[1] || 0)));
    if (!tier) return `${'◇'.repeat(max)}`;
    return `${'◆'.repeat(tier)}${'◇'.repeat(max - tier)}`;
  }

  function itemNameForBadge(badge) {
    const card = badge.closest('.item-feed-card');
    return String(card?.querySelector('.feed-title')?.getAttribute('title') || card?.querySelector('.feed-title')?.textContent || '').trim().toLowerCase();
  }

  function maxTierForBadge(badge) {
    const cardText = String(badge.closest('.item-feed-card')?.textContent || '').toLowerCase();
    return cardText.includes('exotic') ? 2 : 5;
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
      const original = badge.dataset.tierText || badge.textContent || '';
      const max = maxTierForBadge(badge);
      const visual = tierToDiamonds(original, max);
      badge.dataset.diamondPatched = '1';
      badge.dataset.tierText = original;
      badge.dataset.tierMax = String(max);
      badge.title = `Stat tier ${original.replace(/^T/i, '') || '0'}/${max}${max === 2 ? ' • Exotic armor cap' : ''}`;
      if (badge.textContent !== visual) badge.textContent = visual;
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