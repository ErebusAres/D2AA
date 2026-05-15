function renderActionCell(row) {
  const action = document.createElement('div');
  action.className = 'right action-stack';

  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = 'copy-btn';

  if (row.Source !== 'Bungie') {
    primary.textContent = 'Copy ID';
    primary.title = 'Copy DIM item ID filter';
    primary.addEventListener('click', async () => {
      try {
        const ok = await copyText(`id:${normId(row.Id)}`);
        primary.textContent = ok ? 'Copied' : 'Failed';
      } catch (err) {
        console.error(err);
        primary.textContent = 'Failed';
        alert(err.message || err);
      }
      setTimeout(() => { primary.textContent = 'Copy ID'; }, 1200);
    });
    action.appendChild(primary);
    return action;
  }

  if (row.IsEquipped) {
    primary.textContent = 'Equipped';
    primary.title = 'Equipped items must be unequipped before they can be vaulted.';
    primary.classList.add('copy-btn--disabled');
    action.appendChild(primary);
    return action;
  }

  if (row.IsInVault) {
    primary.textContent = 'Pull';
    primary.title = 'Pull this vault item to the matching character inventory';
    primary.addEventListener('click', async () => {
      try {
        await copyOrPullSingle(row, primary);
      } catch (err) {
        console.error(err);
        primary.textContent = 'Failed';
        alert(err.message || err);
      }
      setTimeout(() => { primary.textContent = 'Pull'; }, 1200);
    });
    action.appendChild(primary);
    return action;
  }

  primary.textContent = 'Vault';
  primary.title = 'Send this inventory item to the vault';
  primary.classList.add('copy-btn--vault');
  primary.addEventListener('click', async () => {
    try {
      await vaultSingle(row, primary);
    } catch (err) {
      console.error(err);
      primary.textContent = 'Failed';
      alert(err.message || err);
    }
    setTimeout(() => render(), 1200);
  });
  action.appendChild(primary);
  return action;
}

window.renderActionCell = renderActionCell;
window.D2AA?.render?.();
