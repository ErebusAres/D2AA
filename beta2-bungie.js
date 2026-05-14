(() => {
  const status = document.getElementById('bungieStatus');
  const setupBtn = document.getElementById('bungieSetupBtn');
  const loginBtn = document.getElementById('bungieLoginBtn');
  const importBtn = document.getElementById('bungieImportBtn');
  const STORAGE_KEY = 'd2aa_bungie_public_config_v1';

  function getConfig() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function setStatus(message, ready = false) {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-ready', ready);
    status.classList.toggle('is-missing', !ready);
  }

  function refreshStatus() {
    const cfg = getConfig();
    if (!cfg.apiKey || !cfg.clientId || !cfg.redirectUri) {
      setStatus('Bungie API setup needed: API key, OAuth Client ID, and Redirect URL.', false);
      return;
    }
    setStatus('Bungie API details saved locally. OAuth/data fetch wiring is next.', true);
  }

  function openSetup() {
    const current = getConfig();
    const apiKey = prompt('Bungie API Key. Stored only in this browser localStorage.', current.apiKey || '');
    if (apiKey === null) return;
    const clientId = prompt('Bungie OAuth Client ID. Use a Public OAuth client.', current.clientId || '');
    if (clientId === null) return;
    const redirectUri = prompt('Redirect URL registered in Bungie.net application settings.', current.redirectUri || `${location.origin}${location.pathname}`);
    if (redirectUri === null) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey: apiKey.trim(), clientId: clientId.trim(), redirectUri: redirectUri.trim() }));
    refreshStatus();
  }

  function notReadyYet() {
    const cfg = getConfig();
    if (!cfg.apiKey || !cfg.clientId || !cfg.redirectUri) {
      openSetup();
      return;
    }
    alert('Bungie API setup is saved. The next implementation step is OAuth token exchange and inventory normalization. DIM CSV import still works normally.');
  }

  setupBtn?.addEventListener('click', openSetup);
  loginBtn?.addEventListener('click', notReadyYet);
  importBtn?.addEventListener('click', notReadyYet);
  refreshStatus();
})();
