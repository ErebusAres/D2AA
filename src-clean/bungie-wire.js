import { state, setState, setRows } from './state.js';
import { connectBungie, initializeBungieSync, scheduleSemiLiveRefresh, shouldRefreshOnFocus, syncBungieInventory } from './data/bungie-sync.js';

const setStatus = (status) => setState({ status });
const hasRows = () => state.rows.length > 0;

function bindBungieControls() {
  const login = document.getElementById('bungieLoginBtn');
  const sync = document.getElementById('bungieSyncBtn');
  const refresh = document.getElementById('refreshBtn');
  login?.addEventListener('click', connectBungie);
  sync?.addEventListener('click', () => runSync('manual-sync'));
  refresh?.addEventListener('click', () => runSync('refresh-button'));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && shouldRefreshOnFocus()) runSync('focus-refresh', true);
  });
}

async function runSync(reason, background = false) {
  const result = await syncBungieInventory({ setStatus, setRows, reason, background });
  if (result) scheduleSemiLiveRefresh({ setStatus, setRows, hasRows });
}

async function bootBungieSidecar() {
  bindBungieControls();
  try {
    await initializeBungieSync({ setStatus, setRows, hasRows });
  } catch (error) {
    console.error('D2AA clean Bungie sidecar failed', error);
    setStatus(error.message || String(error));
  }
}

bootBungieSidecar();
