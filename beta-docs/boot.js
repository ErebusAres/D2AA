import { getBungieAccessToken, getMembershipId } from './auth-bungie.js';
import { getProfile } from './bungie-client.js';
import { createManifestClient } from './manifest.js';
import {
  adaptItems,
  selectDefaultCharacterId,
  summarizeCharacters,
} from './items-adapter.js';
import { renderTable } from './ui-render.js';
import { createState } from './state.js';

const BUNGIE_API_KEY = '96e154014bdd44c0a537e482709b7473';
const CLIENT_ID = '50794';
const REDIRECT_URI = 'https://erebusares.github.io/D2AA/beta.html';

const state = createState();

async function boot() {
  const mount = document.getElementById('app');
  try {
    const token = getBungieAccessToken({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
    });
    if (!token) return; // Redirecting for OAuth
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

    renderTable(mount, rows, { state });
  } catch (error) {
    console.error('[D2AA][beta] Failed to boot application', error);
    if (mount) {
      mount.innerHTML = '';
      const message = document.createElement('div');
      message.className = 'beta-error';
      message.textContent = error.message || 'Something went wrong while loading armor.';
      mount.appendChild(message);
    }
  }
}

boot();
