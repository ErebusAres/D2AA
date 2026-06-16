import type { ArmorItem } from '../types/armor';
import { bungiePost } from './bungieApi';

export function actionLabel(row: ArmorItem): string {
  if (row.Source !== 'Bungie') return 'Copy ID';
  if (row.IsEquipped) return 'Equipped';
  if (row.IsInVault) return 'Pull';
  return 'Vault';
}

export function canRunAction(row: ArmorItem): boolean {
  if (row.Source !== 'Bungie') return Boolean(row.Id);
  if (row.IsEquipped) return false;
  return Boolean(row.ItemHash && row.Id && row.MembershipType && (row.IsInVault ? row.TargetCharacterId : row.OwnerCharacterId));
}

export async function runItemAction(row: ArmorItem): Promise<{ message: string; needsRefresh: boolean }> {
  if (row.Source !== 'Bungie') {
    await copyText(`id:${row.Id}`);
    return { message: 'Copied DIM item filter.', needsRefresh: false };
  }
  if (row.IsEquipped) throw new Error('Equipped items must be unequipped before they can be vaulted.');
  if (row.IsInVault) return pullFromVault(row);
  return moveToVault(row);
}

async function pullFromVault(row: ArmorItem): Promise<{ message: string; needsRefresh: boolean }> {
  await transferItem(row, false, row.TargetCharacterId);
  return { message: `Pulled ${row.Name} from vault. Refresh to confirm location.`, needsRefresh: true };
}

async function moveToVault(row: ArmorItem): Promise<{ message: string; needsRefresh: boolean }> {
  await transferItem(row, true, row.OwnerCharacterId);
  return { message: `Moved ${row.Name} to vault. Refresh to confirm location.`, needsRefresh: true };
}

async function transferItem(row: ArmorItem, transferToVault: boolean, characterId: unknown): Promise<void> {
  if (!characterId) throw new Error('Missing target character for transfer.');
  await bungiePost('/Destiny2/Actions/Items/TransferItem/', {
    itemReferenceHash: Number(row.ItemHash),
    stackSize: 1,
    transferToVault,
    itemId: String(row.Id),
    characterId: String(characterId),
    membershipType: Number(row.MembershipType)
  });
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}
