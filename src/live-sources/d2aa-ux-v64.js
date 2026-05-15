(() => {
  const $ = (id) => document.getElementById(id);
  const LS_LAUNCH_SEEN = 'd2aa_launch_seen_v1';
  const hasRows = () => (window.D2AA?.getState?.()?.rows?.length || 0) > 0;

  function enhanceCommandBar() {
    const actions = document.querySelector('.shell-actions');
    if (!actions || document.getElementById('shellMoreWrap')) return;
    const summaryBtn = actions.querySelector('[data-shell-panel-btn="summary"]');
    const themeBtn = actions.querySelector('[data-shell-panel-btn="theme"]');
    const filtersBtn = actions.querySelector('[data-shell-panel-btn="filters"]');
    const wrap = document.createElement('div');
    wrap.id = 'shellMoreWrap';
    wrap.className = 'shell-more-wrap';
    wrap.innerHTML = `<button id="shellMoreBtn" class="shell-btn" type="button" title="More options"><span class="shell-btn-icon">☰</span><span>More</span></button><div class="shell-more-menu" role="menu"></div>`;
    const menu = wrap.querySelector('.shell-more-menu');
    if (filtersBtn) menu.appendChild(filtersBtn.cloneNode(true));
    if (summaryBtn) menu.appendChild(summaryBtn.cloneNode(true));
    if (themeBtn) menu.appendChild(themeBtn.cloneNode(true));
    actions.appendChild(wrap);
    menu.querySelectorAll('[data-shell-panel-btn]').forEach((btn) => btn.addEventListener('click', () => {
      document.querySelector(`[data-shell-panel-btn="${btn.dataset.shellPanelBtn}"]`)?.click();
      wrap.classList.remove('is-open');
    }));
    $('shellMoreBtn')?.addEventListener('click', (event) => { event.stopPropagation(); wrap.classList.toggle('is-open'); });
    document.addEventListener('click', (event) => { if (!wrap.contains(event.target)) wrap.classList.remove('is-open'); });
  }

  function buildLaunchPrompt() {
    if ($('d2aaLaunchLayer')) return;
    const layer = document.createElement('div');
    layer.id = 'd2aaLaunchLayer';
    layer.className = 'd2aa-launch-layer';
    layer.innerHTML = `<div class="d2aa-launch-card" role="dialog" aria-modal="true" aria-labelledby="d2aaLaunchTitle"><h2 id="d2aaLaunchTitle">Load your Destiny armor</h2><p>Connect your Bungie account for live inventory tools, or upload a DIM Armor.csv for quick duplicate review.</p><div class="d2aa-launch-actions"><button class="d2aa-launch-action" id="launchBungieBtn" type="button"><strong>Connect Destiny Account</strong><span>Bungie / Steam sign-in, vault + character armor, item movement tools.</span></button><button class="d2aa-launch-action" id="launchUploadBtn" type="button"><strong>Upload DIM CSV</strong><span>Use a local DIM armor export without signing in.</span></button></div><div class="d2aa-launch-foot"><button id="launchDismissBtn" class="d2aa-launch-close" type="button">Not now</button></div></div>`;
    document.body.appendChild(layer);
    const close = () => { layer.classList.remove('is-open'); try { localStorage.setItem(LS_LAUNCH_SEEN, '1'); } catch (_) {} };
    $('launchDismissBtn')?.addEventListener('click', close);
    $('launchBungieBtn')?.addEventListener('click', () => { close(); $('bungieLoginBtn')?.click(); });
    $('launchUploadBtn')?.addEventListener('click', () => { close(); $('file')?.click(); });
    setTimeout(() => {
      let seen = false;
      try { seen = localStorage.getItem(LS_LAUNCH_SEEN) === '1'; } catch (_) {}
      if (!hasRows() && !seen) layer.classList.add('is-open');
    }, 1800);
  }

  function cardSelection() {
    document.addEventListener('click', (event) => {
      const card = event.target.closest?.('.grid-card');
      if (!card || event.target.closest('button')) return;
      document.querySelectorAll('.grid-card.is-selected').forEach((el) => { if (el !== card) el.classList.remove('is-selected'); });
      card.classList.toggle('is-selected');
    });
  }

  function run() { enhanceCommandBar(); buildLaunchPrompt(); cardSelection(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
