(() => {
  const version = new URLSearchParams(location.search).get('v') || '106';
  const withVersion = (path) => `${path}${path.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;

  function loadCss(path) {
    return new Promise((resolve) => {
      const existing = [...document.styleSheets].some((sheet) => sheet.href && sheet.href.includes(path));
      if (existing) return resolve();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = withVersion(path);
      link.onload = resolve;
      link.onerror = () => {
        console.warn('D2AA CSS failed to load:', path);
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
        console.error('D2AA script failed to load:', path);
        resolve();
      };
      document.body.appendChild(script);
    });
  }

  async function run() {
    // Temporary rollback: source-file loading caused cache autoload/feed/layout regressions.
    // Load the stable bundled app again while cleanup continues safely in source files.
    await loadCss('src/styles/d2aa-live.css');
    await loadScript('src/live/d2aa-live.js');
    document.dispatchEvent(new CustomEvent('d2aa:bundle-loaded', { detail: { version } }));
  }

  run().catch((error) => console.error('D2AA bundled loader failed:', error));
})();