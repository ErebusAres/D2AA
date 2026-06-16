import type { ArmorItem, ArmorRarity, ArmorSlot, GuardianClass, StatKey } from '../types/armor';
import { STAT_KEYS } from '../utils/constants';
import { numberValue, totalStats } from '../utils/statMath';

type CsvRecord = Record<string, string>;

const COLUMN_ALIASES = {
  Name: ['Name', 'Item Name', 'name'],
  Id: ['Id', 'ID', 'Instance ID', 'InstanceId', 'InstanceIdHash', 'Item Hash'],
  Class: ['Equippable', 'Bucket Class', 'Class Type', 'Character Class', 'Class'],
  Slot: ['Slot', 'Type', 'Bucket', 'Item Type'],
  Rarity: ['Rarity', 'Tier Type'],
  Power: ['Power', 'Light', 'Power Level'],
  Tier: ['Tier', 'GearTier', 'Gear Tier'],
  Archetype: ['Archetype', 'Plug Archetype', 'Intrinsic', 'Armor Archetype'],
  Icon: ['Icon', 'Icon Url', 'IconUrl'],
  Tag: ['Tag', 'Tags', 'DIM Tag', 'Dim Tag', 'dimTag'],
  Notes: ['Notes', 'Note', 'DIM Notes', 'Dim Notes']
} as const;

const STAT_ALIASES: Record<StatKey, string[]> = {
  Health: ['Health', 'health', 'Resilience', 'resilience'],
  Melee: ['Melee', 'melee', 'Strength', 'strength'],
  Grenade: ['Grenade', 'grenade', 'Discipline', 'discipline'],
  Super: ['Super', 'super', 'Intellect', 'intellect'],
  Weapon: ['Weapon', 'Weapons', 'weapon', 'weapons', 'Recovery', 'recovery'],
  ClassAbility: ['ClassAbility', 'Class Ability', 'Class', 'class', 'Mobility', 'mobility']
};

export async function parseDimCsvFile(file: File): Promise<ArmorItem[]> {
  const text = await file.text();
  return parseDimCsv(text);
}

export function parseDimCsv(text: string): ArmorItem[] {
  const records = parseCsvRecords(text);
  return records
    .map((record, index) => normalizeCsvArmor(record, index))
    .filter((row) => row.Name && isArmorSlot(row.Slot));
}

function normalizeCsvArmor(raw: CsvRecord, index: number): ArmorItem {
  const stats = Object.fromEntries(STAT_KEYS.map((key) => [key, numberValue(pick(raw, STAT_ALIASES[key]))])) as Record<StatKey, number>;
  const total = numberValue(pick(raw, ['Total', 'Base Stat Total', 'Stat Total'])) || totalStats(stats);
  const slot = normalizeSlot(pick(raw, COLUMN_ALIASES.Slot));
  const rarity = normalizeRarity(pick(raw, COLUMN_ALIASES.Rarity));
  const className = normalizeClass(pick(raw, COLUMN_ALIASES.Class));
  const tier = normalizeTier(pick(raw, COLUMN_ALIASES.Tier));
  const id = String(pick(raw, COLUMN_ALIASES.Id) || `dim-csv-${index}-${pick(raw, COLUMN_ALIASES.Name) || 'armor'}`);
  return {
    Id: id,
    Name: pick(raw, COLUMN_ALIASES.Name) || 'Unknown Armor',
    Type: slot,
    Slot: slot,
    Rarity: rarity,
    Class: className,
    Equippable: className,
    Power: numberValue(pick(raw, COLUMN_ALIASES.Power)),
    Light: numberValue(pick(raw, COLUMN_ALIASES.Power)),
    Tier: tier,
    GearTier: tier,
    TierMax: rarity === 'Exotic' ? 2 : 5,
    Archetype: normalizeArchetype(pick(raw, COLUMN_ALIASES.Archetype), slot),
    Icon: normalizeIcon(pick(raw, COLUMN_ALIASES.Icon)),
    IconUrl: normalizeIcon(pick(raw, COLUMN_ALIASES.Icon)),
    Total: total,
    BaseTotal: total,
    CurrentTotal: total,
    Source: 'DIM CSV',
    FoundAt: Date.now() - index,
    Tag: normalizeDimTag(pick(raw, COLUMN_ALIASES.Tag)),
    Notes: pick(raw, COLUMN_ALIASES.Notes),
    ...stats
  };
}

function parseCsvRecords(text: string): CsvRecord[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
  const [headers = [], ...dataRows] = rows;
  const cleanHeaders = headers.map((header) => header.trim());
  return dataRows
    .filter((row) => row.some((value) => value.trim()))
    .map((row) => Object.fromEntries(cleanHeaders.map((header, index) => [header, row[index]?.trim() || ''])));
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  row.push(value);
  rows.push(row);
  return rows;
}

function pick(raw: CsvRecord, keys: readonly string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value.trim() !== '') return value.trim();
  }
  return '';
}

function normalizeClass(value: string): GuardianClass {
  const text = value.toLowerCase();
  if (text.includes('warlock')) return 'Warlock';
  if (text.includes('hunter')) return 'Hunter';
  if (text.includes('titan')) return 'Titan';
  return 'Any';
}

function normalizeSlot(value: string): ArmorSlot | string {
  const text = value.toLowerCase();
  if (text.includes('helmet')) return 'Helmet';
  if (text.includes('gauntlet') || text.includes('arms')) return 'Gauntlets';
  if (text.includes('chest')) return 'Chest Armor';
  if (text.includes('leg')) return 'Leg Armor';
  if (text.includes('class')) return 'Class Item';
  return value || 'Armor';
}

function isArmorSlot(value: unknown): boolean {
  return ['Helmet', 'Gauntlets', 'Chest Armor', 'Leg Armor', 'Class Item'].includes(String(value));
}

function normalizeRarity(value: string): ArmorRarity {
  const text = value.toLowerCase();
  if (text.includes('exotic')) return 'Exotic';
  if (text.includes('rare')) return 'Rare';
  if (text.includes('common')) return 'Common';
  if (text.includes('uncommon')) return 'Uncommon';
  if (text.includes('basic')) return 'Basic';
  return 'Legendary';
}

function normalizeTier(value: string): number {
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function normalizeArchetype(value: string, slot: string): string {
  if (!value || normalizeKey(value) === normalizeKey(slot)) return '—';
  return value;
}

function normalizeIcon(value: string): string {
  if (!value) return '';
  if (value.startsWith('http')) return value;
  if (value.startsWith('/')) return `https://www.bungie.net${value}`;
  return value;
}

function normalizeDimTag(value: string): string {
  const key = normalizeKey(value);
  if (!key || key === 'none' || key === 'notag' || key === 'untagged') return '';
  if (['favorite', 'favourite', 'fav', 'heart'].includes(key)) return 'favorite';
  if (['keep', 'keeper'].includes(key)) return 'keep';
  if (['junk', 'trash', 'delete', 'shard', 'dismantle'].includes(key)) return 'junk';
  if (['infuse', 'infusion', 'upgrade'].includes(key)) return 'infuse';
  if (['archive', 'archived', 'store'].includes(key)) return 'archive';
  return '';
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}
