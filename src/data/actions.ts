import type { ArmorItem } from '../types/armor';
import { bungiePost } from './bungieApi';

export function actionLabel(row: ArmorItem): string {
  if (row.Source !== 'Bungie') return 'Copy ID';
  if (row.IsEquipped) return 'Equipped';
  if (row.IsInVault) return 'Pull';
  return 'Vault';
}

export function canRunAction(row: ArmorItem): boolean {
  if (!row) return false;
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

export async function runGroupPull(rows: ArmorItem[]): Promise<{ message: string; needsRefresh: boolean }> {
  const groupRows = Array.isArray(rows) ? rows : [];
  const bungieRows = groupRows.filter((row) => row.Source === 'Bungie');
  if (!bungieRows.length) {
    await copyText(groupRows.map((row) => `id:${row.Id}`).join(' or '));
    return { message: `Copied ${groupRows.length} DIM item IDs.`, needsRefresh: false };
  }

  const pullable = bungieRows.filter((row) => row.IsInVault && canRunAction(row));
  const alreadyOut = bungieRows.length - pullable.length;
  if (!pullable.length) return { message: 'No vault items in this group need pulling.', needsRefresh: false };

  const results: Array<{ row: ArmorItem; ok: boolean; error?: unknown }> = [];
  for (const row of pullable) {
    try {
      await pullFromVault(row);
      results.push({ row, ok: true });
    } catch (error: unknown) {
      console.error('D2AA group pull failed for item', row, error);
      results.push({ row, ok: false, error });
    }
  }

  const ok = results.filter((item) => item.ok).length;
  const failed = results.length - ok;
  const skipped = alreadyOut > 0 ? ` ${alreadyOut} already not in vault/skipped.` : '';
  const failText = failed ? ` ${failed} failed.` : '';
  return { message: `Pulled ${ok}/${pullable.length} vault items from group.${skipped}${failText}`, needsRefresh: ok > 0 };
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
