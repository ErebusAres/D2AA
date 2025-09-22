import {
  beginBungieOAuth,
  clearStoredBungieAccessToken,
  getStoredBungieAccessToken,
  getMembershipId,
} from './auth-bungie.js';
import { getProfile } from './bungie-client.js';
import { createManifestClient } from './manifest.js';
import {
  adaptItems,
  selectDefaultCharacterId,
  summarizeCharacters,
} from './items-adapter.js';
import { renderTable } from './ui-render.js';
import { createState } from './state.js';
import { createElement } from './utils.js';

const BUNGIE_API_KEY = '96e154014bdd44c0a537e482709b7473';
const CLIENT_ID = '50794';
const REDIRECT_URI = 'https://erebusares.github.io/D2AA/beta.html';

const state = createState();

const mount = document.getElementById('app');
let tableController = null;

function resetState() {
  state.setState({
    accessToken: null,
    membershipId: null,
    membershipType: null,
    characters: [],
    selectedCharacterId: null,
  });
}

function renderCard(children, { className } = {}) {
  if (!mount) return;
  mount.innerHTML = '';
  const card = createElement('div', {
    className: ['beta-card', className].filter(Boolean).join(' '),
    children,
  });
  mount.appendChild(card);
}

function renderSignIn({ status, tone = 'info' } = {}) {
  const children = [];
  children.push(
    createElement('h2', {
      className: 'beta-card__title',
      textContent: 'Sign in to Bungie.net',
    })
  );
  children.push(
    createElement('p', {
      className: 'beta-card__text',
      textContent:
        'Connect to load your live Destiny 2 armor with base stat comparisons just like the CSV analyzer.',
    })
  );
  if (status) {
    const statusClasses = ['beta-card__status'];
    if (tone === 'error') {
      statusClasses.push('beta-card__status--error');
    }
    children.push(
      createElement('div', {
        className: statusClasses.join(' '),
        textContent: status,
      })
    );
  }

  const button = createElement('button', {
    className: 'beta-button',
    textContent: 'Sign in with Bungie',
  });
  button.addEventListener('click', () => {
    renderLoading('Redirecting to Bungie…');
    beginBungieOAuth({ clientId: CLIENT_ID, redirectUri: REDIRECT_URI });
  });
  children.push(button);
  children.push(
    createElement('p', {
      className: 'beta-card__hint',
      textContent: 'You\'ll be redirected to Bungie.net and back once authorization succeeds.',
    })
  );

  renderCard(children, { className: 'beta-card--centered' });
}

function renderLoading(message = 'Loading your armor…') {
  renderCard(
    [
      createElement('p', {
        className: 'beta-card__text',
        textContent: message,
      }),
    ],
    { className: 'beta-card--centered' }
  );
}

function renderError(message) {
  const retryButton = createElement('button', {
    className: 'beta-button',
    textContent: 'Try again',
  });
  retryButton.addEventListener('click', () => {
    boot();
  });

  const signInButton = createElement('button', {
    className: 'beta-button beta-button--ghost',
    textContent: 'Sign in again',
  });
  signInButton.addEventListener('click', () => {
    handleSignOut({ showMessage: false });
  });

  renderCard(
    [
      createElement('h2', {
        className: 'beta-card__title',
        textContent: 'Unable to load armor',
      }),
      createElement('div', {
        className: 'beta-card__status beta-card__status--error',
        textContent: message,
      }),
      createElement('div', {
        className: 'beta-card__actions',
        children: [retryButton, signInButton],
      }),
    ],
    { className: 'beta-card--centered' }
  );
}

function handleSignOut({ showMessage, status, statusTone } = {}) {
  if (tableController && typeof tableController.destroy === 'function') {
    tableController.destroy();
  }
  tableController = null;
  clearStoredBungieAccessToken();
  resetState();
  if (typeof status === 'string' && status.trim().length) {
    renderSignIn({ status, tone: statusTone });
  } else if (showMessage) {
    renderSignIn({
      status: 'You have signed out. Sign in again to reload your armor.',
      tone: 'info',
    });
  } else {
    renderSignIn();
  }
}

async function boot() {
  if (!mount) return;
  if (tableController && typeof tableController.destroy === 'function') {
    tableController.destroy();
    tableController = null;
  }
  try {
    const token = getStoredBungieAccessToken();
    if (!token) {
      handleSignOut({ showMessage: false });
      return;
    }

    renderLoading();
    state.setState({ accessToken: token });

    const { membershipId, membershipType } = await getMembershipId(BUNGIE_API_KEY, token);
    state.setState({ membershipId, membershipType });

    const components = [100, 200, 201, 205, 102, 300, 304, 305, 308].join(',');
    const profile = await getProfile(
      membershipType,
      membershipId,
      BUNGIE_API_KEY,
      token,
      components
    );

    const manifest = createManifestClient({ apiKey: BUNGIE_API_KEY });

    const defaultCharacterId = selectDefaultCharacterId(profile);
    const characters = summarizeCharacters(profile);
    state.setState({
      characters,
      selectedCharacterId: defaultCharacterId,
    });

    const rows = await adaptItems({
      profile,
      membershipId,
      membershipType,
      manifest,
      selectedCharacterId: defaultCharacterId,
    });

    if (tableController && typeof tableController.destroy === 'function') {
      tableController.destroy();
    }
    tableController = renderTable(mount, rows, {
      state,
      onSignOut: () => handleSignOut({ showMessage: true }),
    });
  } catch (error) {
    console.error('[D2AA][beta] Failed to boot application', error);
    const message = error?.message || 'Something went wrong while loading armor.';
    const lower = message.toLowerCase();
    if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('access token')) {
      handleSignOut({
        status: 'Your Bungie session expired. Sign in again to continue.',
        statusTone: 'error',
      });
      return;
    }
    renderError(message);
  }
}

boot();
