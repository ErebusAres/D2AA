import { bungiePost } from './bungie-api.js';

export function actionLabel(row) {
  if (row.Source !== 'Bungie') return 'Copy ID';
  if (row.IsEquipped) return 'Equipped';
  if (row.IsInVault) return 'Pull';
  return 'Vault';
}

export function canRunAction(row) {
  if (!row) return false;
  if (row.Source !== 'Bungie') return Boolean(row.Id);
  if (row.IsEquipped) return false;
  return Boolean(row.ItemHash && row.Id && row.MembershipType && (row.IsInVault ? row.TargetCharacterId : row.OwnerCharacterId));
}

export async function runItemAction(row) {
  if (!row) throw new Error('No row selected.');
  if (row.Source !== 'Bungie') {
    await copyText(`id:${row.Id}`);
    return { message: 'Copied DIM item filter.' };
  }
  if (row.IsEquipped) throw new Error('Equipped items must be unequipped before they can be vaulted.');
  if (row.IsInVault) return pullFromVault(row);
  return moveToVault(row);
}

async function pullFromVault(row) {
  await transferItem(row, false, row.TargetCharacterId);
  return { message: `Pulled ${row.Name} from vault.`, needsRefresh: true };
}

async function moveToVault(row) {
  await transferItem(row, true, row.OwnerCharacterId);
  return { message: `Moved ${row.Name} to vault.`, needsRefresh: true };
}

async function transferItem(row, transferToVault, characterId) {
  if (!characterId) throw new Error('Missing target character for transfer.');
  await bungiePost('/Destiny2/Actions/Items/TransferItem/', {
    itemReferenceHash: Number(row.ItemHash),
    stackSize: 1,
    transferToVault: Boolean(transferToVault),
    itemId: String(row.Id),
    characterId: String(characterId),
    membershipType: Number(row.MembershipType)
  });
}

async function copyText(text) {
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
