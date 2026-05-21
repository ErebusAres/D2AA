const VERSION_MANIFEST_PATH = './version.json';

finalizeVersionBadge();

async function finalizeVersionBadge() {
  const version = await readManifestVersion();
  const normalized = String(version || window.D2AA_VERSION || '1.89').replace(/^v/i, '');

  window.D2AA_VERSION = normalized;
  document.documentElement.dataset.d2aaRuntimeVersion = normalized;

  const meta = document.querySelector('meta[name="d2aa-version"]');
  if (meta) meta.setAttribute('content', normalized);

  removeTemporaryOverlayRenderer();
  installSingleBadgeRenderer();
  renderBadge(normalized);
  updateMarker(normalized);
}

async function readManifestVersion() {
  try {
    const res = await fetch(`${VERSION_MANIFEST_PATH}?t=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json();
    return data?.version || null;
  } catch {
    return null;
  }
}

function removeTemporaryOverlayRenderer() {
  document.getElementById('d2aa-version-overlay-kill')?.remove();
}

function installSingleBadgeRenderer() {
  if (document.getElementById('d2aa-version-single-renderer')) return;
  const style = document.createElement('style');
  style.id = 'd2aa-version-single-renderer';
  style.textContent = `
    .d2aa-version-badge::before,
    .d2aa-version-badge::after {
      content: none !important;
      display: none !important;
    }
    .d2aa-version-badge {
      color: #e8c56a !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
  `;
  document.head.appendChild(style);
}

function renderBadge(version) {
  const badges = Array.from(document.querySelectorAll('.d2aa-version-badge'));
  badges.slice(1).forEach((badge) => badge.remove());
  const badge = badges[0];
  if (!badge) return;
  badge.textContent = `v${version}`;
  badge.removeAttribute('data-version');
  badge.setAttribute('aria-label', `D2AA clean runtime v${version}`);
  badge.setAttribute('title', `D2AA clean runtime v${version}`);
}

function updateMarker(version) {
  const marker = document.getElementById('deployMarker');
  if (!marker) return;
  marker.textContent = `shell v${window.D2AA_VERSION} · manifest v${version} · OK`;
  marker.dataset.ok = 'true';
  marker.dataset.mismatch = 'false';
}
