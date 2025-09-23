import { STAT_COLS, normId, num } from './utils.js';

const DIM_TO_CORE = {
  'Class (Base)': 'mobility',
  'Health (Base)': 'resilience',
  'Weapons (Base)': 'recovery',
  'Grenade (Base)': 'discipline',
  'Super (Base)': 'intellect',
  'Melee (Base)': 'strength'
};

export const buildRowsFromCsv = {
  registerUploadHandler(selector, onRows) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      const text = await file.text();
      const rows = parseCsvToRows(text);
      onRows(rows, { file, fileName: file.name || 'Selected file' });
    });
  }
};

export function parseCsvToRows(text) {
  const { headers, records } = parseCsv(text);
  if (!headers.length) {
    return [];
  }
  return records.map((raw) => normalizeRow(raw));
}

function normalizeRow(raw) {
  const row = { ...raw };
  row.Id = normId(raw.Id ?? raw.id ?? raw.DimId ?? raw.DimID ?? raw.itemInstanceId);
  row.Name = raw.Name ?? raw.Item ?? raw.ItemName ?? '';
  row.Type = raw.Type ?? raw.Slot ?? '';
  row.Equippable = raw.Equippable ?? raw.Class ?? '';
  row.Rarity = raw.Rarity ?? raw.Tier ?? '';
  row.Tier = num(raw['Tier']);

  for (const key of STAT_COLS) {
    row[key] = num(raw[key]);
  }
  row['Total (Base)'] = num(raw['Total (Base)']);

  const base = buildCoreBlock(row, DIM_TO_CORE, 'Base');
  const current = buildCoreBlock(row, DIM_TO_CORE, '');
  if ((current.total || 0) === 0 && (base.total || 0) > 0) {
    Object.assign(current, base);
  }

  row._betaStats = {
    base,
    current
  };
  row.dimId = row.Id;
  return row;
}

function buildCoreBlock(row, mapping, suffixToken) {
  const block = {
    mobility: 0,
    resilience: 0,
    recovery: 0,
    discipline: 0,
    intellect: 0,
    strength: 0
  };
  for (const [dimKey, coreKey] of Object.entries(mapping)) {
    const key = suffixToken ? dimKey : dimKey.replace(' (Base)', '');
    const value = num(row[key]);
    block[coreKey] = value;
  }
  block.total = Object.values(block).reduce((sum, v) => sum + v, 0);
  return block;
}

function parseCsv(text) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      current.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (char === '\r') {
      i += 1;
      continue;
    }
    if (char === '\n') {
      current.push(field);
      rows.push(current);
      current = [];
      field = '';
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length || current.length) {
    current.push(field);
    rows.push(current);
  }
  if (!rows.length) {
    return { headers: [], records: [] };
  }
  const headers = rows[0];
  const records = rows.slice(1).filter((cells) => cells.some((c) => c && c.trim().length)).map((cells) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = cells[index] ?? '';
    });
    return obj;
  });
  return { headers, records };
}
