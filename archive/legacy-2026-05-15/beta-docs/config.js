const globalConfig = window.D2AA_CONFIG ?? {};

export const STORAGE_KEYS = {
  rows: 'd2aa-beta-rows',
  bungieTokens: 'd2aa-beta-bungie-tokens',
  bungieOAuthState: 'd2aa-beta-bungie-oauth-state',
  manifest: 'd2aa-beta-manifest',
  dimTokens: 'd2aa-beta-dim-tokens',
  dimProfile: 'd2aa-beta-dim-profile-cache',
};

export const BUNGIE_API_KEY = globalConfig.bungieApiKey ?? '';
export const BUNGIE_CLIENT_ID = globalConfig.bungieClientId ?? '';
export const BUNGIE_REDIRECT_URI =
  globalConfig.bungieRedirectUri ?? `${window.location.origin}${window.location.pathname}`;
export const BUNGIE_SCOPES = [
  'ReadBasicUserProfile',
  'ReadDestinyInventoryAndVault',
  'ReadDestinyVendorsAndAdvisors',
  'Destiny2.ReadGroups',
  'MoveEquipDestinyItems',
];

export const BUNGIE_BASE_URL = 'https://www.bungie.net';
export const BUNGIE_PLATFORM_URL = `${BUNGIE_BASE_URL}/Platform`;

export const DIM_BASE_URL = globalConfig.dimBaseUrl ?? 'https://app.destinyitemmanager.com';

export const DIM_API_ENV = globalConfig.dimApiEnv ?? globalConfig.dimEnvironment ?? 'prod';
export const DIM_PROD_API_URL = globalConfig.dimProdApiUrl ?? 'https://api.destinyitemmanager.com';
export const DIM_DEV_API_URL = globalConfig.dimDevApiUrl ?? 'https://dev-api.destinyitemmanager.com';
export const DIM_API_URL =
  globalConfig.dimApiUrl ?? (DIM_API_ENV === 'dev' ? DIM_DEV_API_URL : DIM_PROD_API_URL);

export const DIM_CLIENT_ID_PROD = globalConfig.dimClientIdProd ?? globalConfig.dimClientId ?? '';
export const DIM_CLIENT_ID_DEV = globalConfig.dimClientIdDev ?? '';
export const DIM_CLIENT_ID =
  DIM_API_ENV === 'dev'
    ? DIM_CLIENT_ID_DEV || DIM_CLIENT_ID_PROD
    : DIM_CLIENT_ID_PROD || DIM_CLIENT_ID_DEV;
export const DIM_SCOPES = ['dim:profile:read', 'dim:profile:write'];

export const MANIFEST_COMPONENTS = {
  InventoryItem: 'DestinyInventoryItemDefinition',
  Stat: 'DestinyStatDefinition',
  Class: 'DestinyClassDefinition',
  EnergyType: 'DestinyEnergyTypeDefinition',
};

export const STAT_MAP = [
  { id: 2996146975, label: 'Health', short: 'Mobility' },
  { id: 392767087, label: 'Melee', short: 'Resilience' },
  { id: 1943323491, label: 'Grenade', short: 'Recovery' },
  { id: 1735777505, label: 'Super', short: 'Discipline' },
  { id: 144602215, label: 'Class', short: 'Intellect' },
  { id: 4244567218, label: 'Weapons', short: 'Strength' },
];

export const DEFAULT_TOLERANCE = 5;

export const CSV_FILE_HINT = 'Choose DIM Armor.csv';

export const UI_IDS = {
  fileInput: 'file',
  uploadTrigger: 'uploadTrigger',
  uploadHint: 'uploadHint',
  restoreBtn: 'restoreBtn',
  clearBtn: 'clearBtn',
  tolInput: 'tol',
  rows: 'rows',
  empty: 'empty',
  classSeg: 'classSeg',
  raritySeg: 'raritySeg',
  slotSeg: 'slotSeg',
  dupesSeg: 'dupesSeg',
  themeToggle: 'themeToggle',
  signInBtn: 'signInWithBungie',
  statToggle: 'statToggle',
  appMount: 'app',
  actionHeader: 'actionHeader',
};

export const FILTERS = {
  classType: ['Any', 'Hunter', 'Titan', 'Warlock'],
  rarity: ['Any', 'Legendary', 'Exotic'],
  slot: ['Any', 'Helmet', 'Gauntlets', 'Chest Armor', 'Leg Armor', 'Class Item'],
  dupes: ['All', 'Only Dupes', 'Hide Dupes'],
};

export const DIM_TAGS = {
  favorite: { label: 'Favorite', icon: '★' },
  keep: { label: 'Keep', icon: '🔒' },
  infuse: { label: 'Infuse', icon: '⬆️' },
  junk: { label: 'Junk', icon: '🗑️' },
};

export function getBungieHeaders(accessToken) {
  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  if (BUNGIE_API_KEY) headers.set('X-API-Key', BUNGIE_API_KEY);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return headers;
}

export function buildDimHeaders(accessToken) {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return headers;
}

export function getRequiredConfig() {
  if (!BUNGIE_CLIENT_ID) {
    throw new Error('Missing Bungie client id. Configure window.D2AA_CONFIG.bungieClientId before loading the beta script.');
  }
  if (!BUNGIE_API_KEY) {
    console.warn('No Bungie API key configured; manifest and profile requests will likely fail.');
  }
  return {
    BUNGIE_CLIENT_ID,
    BUNGIE_API_KEY,
  };
}
