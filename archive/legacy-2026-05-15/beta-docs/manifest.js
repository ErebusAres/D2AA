import {
  BUNGIE_BASE_URL,
  BUNGIE_PLATFORM_URL,
  MANIFEST_COMPONENTS,
  STORAGE_KEYS,
  getBungieHeaders,
} from './config.js';
import { guardObject, safeJsonParse, safeJsonStringify } from './utils.js';
import { updateManifest } from './state.js';

async function fetchManifestIndex() {
  const res = await fetch(`${BUNGIE_PLATFORM_URL}/Destiny2/Manifest/`, {
    headers: getBungieHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Manifest load failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  if (data?.ErrorStatus !== 'Success') {
    throw new Error(`Manifest load error: ${data?.ErrorStatus ?? 'Unknown'}`);
  }
  return data.Response;
}

async function fetchDefinitionComponent(path) {
  const url = `${BUNGIE_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: getBungieHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Definition fetch failed: ${res.status} ${text}`);
  }
  return res.json();
}

function persistManifest(manifest) {
  try {
    sessionStorage.setItem(STORAGE_KEYS.manifest, safeJsonStringify(manifest));
  } catch (error) {
    console.warn('Unable to persist manifest cache', error);
  }
}

function restoreManifest() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.manifest);
    if (!raw) return null;
    return safeJsonParse(raw);
  } catch (error) {
    console.warn('Unable to restore manifest cache', error);
    return null;
  }
}

export async function loadManifest(store) {
  const cached = restoreManifest();
  if (cached) {
    updateManifest(store, {
      status: 'ready',
      lastLoaded: cached.lastLoaded,
      inventoryItem: cached.inventoryItem ?? {},
      statDefs: cached.statDefs ?? {},
      classDefs: cached.classDefs ?? {},
      energyDefs: cached.energyDefs ?? {},
    });
    return cached;
  }

  updateManifest(store, { status: 'loading' });
  const index = await fetchManifestIndex();
  const locale = 'en';
  const worldPaths = guardObject(index.jsonWorldComponentContentPaths?.Destiny2?.[locale] ?? index.jsonWorldComponentContentPaths?.[locale]);
  const inventoryPath = worldPaths[MANIFEST_COMPONENTS.InventoryItem];
  const statPath = worldPaths[MANIFEST_COMPONENTS.Stat];
  const classPath = worldPaths[MANIFEST_COMPONENTS.Class];
  const energyPath = worldPaths[MANIFEST_COMPONENTS.EnergyType];

  const [inventoryItem, statDefs, classDefs, energyDefs] = await Promise.all([
    inventoryPath ? fetchDefinitionComponent(inventoryPath) : {},
    statPath ? fetchDefinitionComponent(statPath) : {},
    classPath ? fetchDefinitionComponent(classPath) : {},
    energyPath ? fetchDefinitionComponent(energyPath) : {},
  ]);

  const manifest = {
    status: 'ready',
    lastLoaded: Date.now(),
    inventoryItem,
    statDefs,
    classDefs,
    energyDefs,
  };

  persistManifest(manifest);
  updateManifest(store, manifest);
  return manifest;
}
