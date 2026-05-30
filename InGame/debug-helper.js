import { state } from '../src-clean/state.js';

function compactPlug(plug) {
  return {
    name: plug?.name,
    hash: plug?.hash,
    type: plug?.type,
    category: plug?.category,
    stats: plug?.stats
  };
}

function debugItemById(id) {
  const itemId = String(id || '').trim();
  const r = state.rows.find((row) => String(row.Id) === itemId);
  if (!r) return { error: `No row found for ID ${itemId}`, id: itemId };
  const out = {
    Id: r.Id,
    Name: r.Name,
    Power: r.Power,
    BaseTotal: r.BaseTotal,
    CurrentTotal: r.CurrentTotal,
    StatBonusTotal: r.StatBonusTotal,
    StatSource: r.StatSource,
    Base: {
      Health: r.BaseHealth,
      Melee: r.BaseMelee,
      Grenade: r.BaseGrenade,
      Super: r.BaseSuper,
      Class: r.BaseClassAbility,
      Weapon: r.BaseWeapon
    },
    Current: {
      Health: r.CurrentHealth,
      Melee: r.CurrentMelee,
      Grenade: r.CurrentGrenade,
      Super: r.CurrentSuper,
      Class: r.CurrentClassAbility,
      Weapon: r.CurrentWeapon
    },
    Bonuses: {
      Masterwork: r.MasterworkBonusTotal,
      Mod: r.ModBonusTotal,
      Artifice: r.ArtificeBonusTotal,
      Other: r.OtherBonusTotal
    },
    ApiAuditBreakdown: r.StatAudit?.apiAuditBreakdown,
    IgnoredPlugs: r.StatAudit?.apiAuditIgnoredPlugs,
    ActivePlugs: r.StatAudit?.activePlugs?.map(compactPlug)
  };
  console.log(out);
  return out;
}

function debugVisibleCards() {
  const out = [...document.querySelectorAll('.armor-card[data-id]')].map((card, index) => {
    const r = state.rows.find((row) => String(row.Id) === String(card.dataset.id));
    return {
      index,
      id: card.dataset.id,
      name: r?.Name,
      power: r?.Power,
      baseTotal: r?.BaseTotal,
      currentTotal: r?.CurrentTotal,
      statBonusTotal: r?.StatBonusTotal,
      text: card.innerText.slice(0, 180)
    };
  });
  console.table(out);
  return out;
}

window.d2aaDebugItem = debugItemById;
window.d2aaDebugVisibleCards = debugVisibleCards;
window.d2aaRows = () => state.rows;
