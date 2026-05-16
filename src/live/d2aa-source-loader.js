(() => {
  const SOURCE_VERSION = new URLSearchParams(location.search).get('v') || '105';
  const withVersion = (path) => `${path}${path.includes('?') ? '&' : '?'}v=${encodeURIComponent(SOURCE_VERSION)}`;

  // Keep this in the same relative order as the archived pre-cleanup live page.
  // The order matters because several legacy modules intentionally layer CSS/patches.
  const cssFiles = [
    'src/live-sources/beta2.css',
    'src/live-sources/beta2-themes.css',
    'src/live-sources/beta2-bungie.css',
    'src/live-sources/beta2-groups.css',
    'src/live-sources/beta2-tags.css',
    'src/live-sources/beta2-shell.css',
    'src/live-sources/beta2-grid-view.css',
    'src/live-sources/beta2-grid-cleanup.css',
    'src/live-sources/beta2-ui-polish.css',
    'src/live-sources/beta2-workflow.css',
    'src/live-sources/beta2-open-grid.css',
    'src/live-sources/beta2-tag-popover.css',
    'src/live-sources/beta2-archetypes.css',
    'src/live-sources/beta2-startup-stability.css',
    'src/live-sources/beta2-refresh-key.css',
    'src/live-sources/beta2-feed-drawer.css',
    'src/live-sources/beta2-feed-clean.css',
    'src/live-sources/d2aa-ux-v64.css',
    'src/live-sources/d2aa-ux-v65.css',
    'src/live-sources/d2aa-ux-v66.css',
    'src/live-sources/d2aa-ux-v68.css',
    'src/live-sources/d2aa-ux-v69.css',
    'src/live-sources/d2aa-ux-v70.css',
    'src/live-sources/d2aa-ux-v71.css',
    'src/live-sources/d2aa-ux-v72.css',
    'src/live-sources/d2aa-ux-v73.css',
    'src/live-sources/d2aa-ux-v74.css',
    'src/live-sources/d2aa-ux-v75.css',
    'src/live-sources/d2aa-ux-v76.css',
    'src/live-sources/d2aa-layout-fix.css',
    'src/live-sources/d2aa-compare-groups.css',
    'src/live-sources/d2aa-card-badges.css',
    'src/live-sources/d2aa-page-frame.css'
  ];

  const jsFiles = [
    'src/live-sources/beta2.js',
    'src/live-sources/beta2-shell.js',
    'src/live-sources/beta2-bungie.js',
    'src/live-sources/beta2-bungie-v2.js',
    'src/live-sources/beta2-item-feed.js',
    'src/live-sources/beta2-item-feed-icons.js',
    'src/live-sources/beta2-item-feed-tier-diamonds.js',
    'src/live-sources/beta2-feed-drawer.js',
    'src/live-sources/beta2-feed-clean-tags.js',
    'src/live-sources/beta2-inventory-cache.js',
    'src/live-sources/beta2-cache-sync-fix.js',
    'src/live-sources/beta2-actions.js',
    'src/live-sources/beta2-groups.js',
    'src/live-sources/beta2-tier-patch.js',
    'src/live-sources/beta2-fast-sync.js',
    'src/live-sources/beta2-grid-view.js',
    'src/live-sources/beta2-workflow.js',
    'src/live-sources/beta2-tag-popover.js',
    'src/live-sources/beta2-startup-stability.js',
    'src/live-sources/beta2-refresh-key.js',
    'src/live-sources/d2aa-ux-v64.js',
    'src/live-sources/d2aa-ux-v73.js',
    'src/live-sources/d2aa-grid-dom-hotfix-v89.js'
  ];

  function loadCss(path) {
    return new Promise((resolve) => {
      if ([...document.styleSheets].some((sheet) => sheet.href && sheet.href.includes(path))) return resolve();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = withVersion(path);
      link.onload = resolve;
      link.onerror = () => {
        console.warn('D2AA source CSS failed to load:', path);
        resolve();
      };
      document.head.appendChild(link);
    });
  }

  function loadScript(path) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = withVersion(path);
      script.onload = resolve;
      script.onerror = () => {
        console.error('D2AA source script failed to load:', path);
        resolve();
      };
      document.body.appendChild(script);
    });
  }

  async function run() {
    for (const path of cssFiles) await loadCss(path);
    for (const path of jsFiles) await loadScript(path);
    document.documentElement.classList.remove('d2aa-preboot');
    document.body.classList.remove('d2aa-booting');
    document.dispatchEvent(new CustomEvent('d2aa:sources-loaded', { detail: { version: SOURCE_VERSION } }));
  }

  run().catch((error) => console.error('D2AA source loader failed:', error));
})();