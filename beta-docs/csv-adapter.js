import { STAT_MAP } from './config.js';
import { num, normId } from './utils.js';

function sanitizeRow(row) {
  const cleaned = { ...row };
  for (const stat of STAT_MAP) {
    const baseKey = `${stat.label} (Base)`;
    const totalKey = `${stat.label} (Total)`;
    if (cleaned[baseKey] !== undefined) cleaned[baseKey] = num(cleaned[baseKey]);
    if (cleaned[totalKey] !== undefined) cleaned[totalKey] = num(cleaned[totalKey]);
  }
  if (cleaned.Total !== undefined) cleaned.Total = num(cleaned.Total);
  if (cleaned['Total (Base)'] !== undefined) cleaned['Total (Base)'] = num(cleaned['Total (Base)']);
  if (cleaned.Id) cleaned.Id = normId(cleaned.Id);
  return cleaned;
}

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    if (!window.Papa) {
      reject(new Error('PapaParse is required to parse CSV files'));
      return;
    }
    window.Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = Array.isArray(results?.data) ? results.data.map(sanitizeRow) : [];
        resolve(data);
      },
      error: (error) => reject(error),
    });
  });
}
