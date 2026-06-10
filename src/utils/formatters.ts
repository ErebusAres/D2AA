import type { ArmorItem } from '../types/armor';

export function displayName(row: ArmorItem): string {
  const name = String(row.Name || '').trim();
  return name && !name.includes('|') ? name : String(row.Type || row.Slot || 'Unknown Armor');
}

export function locationText(row: ArmorItem): 'Equipped' | 'Vault' | 'Inventory' {
  if (row.IsEquipped) return 'Equipped';
  if (row.IsInVault) return 'Vault';
  return 'Inventory';
}

export function rarityClass(rarity: string | undefined): string {
  return String(rarity || 'common').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizeKey(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}
