import { normalizeArmorRow } from './normalize-armor.js';

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
        resolve(rows);
      },
      error: reject
    });
  });
}
