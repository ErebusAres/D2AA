import { STAT_KEYS } from '../constants.js';

const columnAliases = {
  Name: ['Name', 'Item Name', 'name'],
  Id: ['Id', 'ID', 'Instance ID', 'InstanceId', 'InstanceIdHash', 'Item Hash'],
  Class: ['Class', 'Equippable', 'Bucket Class'],
  Slot: ['Slot', 'Type', 'Bucket', 'Item Type'],
  Rarity: ['Rarity', 'Tier Type'],
  Power: ['Power', 'Light', 'Power Level'],
  Tier: ['Tier', 'GearTier', 'Gear Tier'],
  Archetype: ['Archetype', 'Plug Archetype', 'Intrinsic'],
  Icon: ['Icon', 'Icon Url', 'IconUrl']
};

export function normalizeArmorRow(raw, index = 0, source = 'DIM') {
  const row = {};
  Object.entries(columnAliases).forEach(([key, aliases]) => { row[key] = pick(raw, aliases); });
  STAT_KEYS.forEach((key) => { row[key] = number(pick(raw, [key, key.toLowerCase()])); });
  const total = number(pick(raw, ['Total', 'Base Stat Total', 'Stat Total'])) || STAT_KEYS.reduce((sum, key) => sum + number(row[key]), 0);
  const id = String(row.Id || raw.id || raw.instanceId || `${source}-${index}-${row.Name || 'armor'}`);
  const tierNumber = normalizeTier(row.Tier, total, row.Rarity);
  return {
    Id: id,
    Name: String(row.Name || 'Unknown Armor'),
    Class: normalizeClass(row.Class),
    Slot: normalizeSlot(row.Slot),
    Rarity: normalizeRarity(row.Rarity),
    Power: number(row.Power),
    Tier: tierNumber,
    TierMax: normalizeRarity(row.Rarity) === 'Exotic' ? 2 : 5,
    TierSource: row.Tier ? source : 'Fallback',
    Archetype: String(row.Archetype || '—'),
    Icon: normalizeIcon(row.Icon),
    Total: total,
    Source: source,
    FoundAt: Date.now() - index,
    ...Object.fromEntries(STAT_KEYS.map((key) => [key, number(row[key])]))
  };
}

function pick(raw, keys) {
  for (const key of keys) if (raw?.[key] !== undefined && raw[key] !== '') return raw[key];
  return '';
}
function number(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }
function normalizeClass(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('warlock')) return 'Warlock';
  if (text.includes('hunter')) return 'Hunter';
  if (text.includes('titan')) return 'Titan';
  return 'Any';
}
function normalizeSlot(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('helmet')) return 'Helmet';
  if (text.includes('gauntlet') || text.includes('arms')) return 'Gauntlets';
  if (text.includes('chest')) return 'Chest Armor';
  if (text.includes('leg')) return 'Leg Armor';
  if (text.includes('class')) return 'Class Item';
  return String(value || 'Armor');
}
function normalizeRarity(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('exotic')) return 'Exotic';
  if (text.includes('rare')) return 'Rare';
  return 'Legendary';
}
function normalizeTier(value, total, rarity) {
  const match = String(value || '').match(/(\d+)/);
  let tier = match ? Number(match[1]) : fallbackTier(total);
  if (normalizeRarity(rarity) === 'Exotic') tier = Math.min(tier, 2);
  return Math.max(1, Math.min(5, tier));
}
function fallbackTier(total) {
  if (total >= 73) return 5;
  if (total >= 65) return 4;
  if (total >= 59) return 3;
  if (total >= 54) return 2;
  return 1;
}
function normalizeIcon(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text.startsWith('http')) return text;
  if (text.startsWith('/')) return `https://www.bungie.net${text}`;
  return text;
}
