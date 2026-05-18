import { STORAGE_KEYS } from '../constants.js';
import { normalizeArmorRow } from './normalize-armor.js';
import { readJson, writeJson } from '../state.js';

export function parseDimCsv(file) {
  return new Promise((resolve, reject) => {
    if (!window.Papa) {
      reject(new Error('PapaParse is not loaded.'));
      return;
    }
    window.Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data.map((raw, index) => normalizeArmorRow(raw, index, 'DIM CSV')).filter((row) => row.Name && row.Slot);
        syncDimTagsToLocal(rows);
        resolve(rows);
      },
      error: reject
    });
  });
}

function syncDimTagsToLocal(rows) {
  const tags = readJson(STORAGE_KEYS.tags, {});
  let changed = false;
  for (const row of rows) {
    if (!row?.Id) continue;
    if (row.Tag) {
      tags[row.Id] = row.Tag;
      changed = true;
    }
  }
  if (changed) writeJson(STORAGE_KEYS.tags, tags);
}
