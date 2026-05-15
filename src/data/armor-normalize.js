(() => {
  const { STAT_COLS, SLOTS, RARITIES } = window.D2AA_CONSTANTS;
  const num = (value) => { const match = String(value ?? '').match(/-?\d+(\.\d+)?/); return match ? Number(match[0]) : 0; };
  const norm = (value) => String(value || '').trim();
  const lower = (value) => norm(value).toLowerCase();
  const first = (row, names) => { for (const name of names) { if (row[name] !== undefined && row[name] !== '') return row[name]; } return ''; };
  function slotFrom(row) { const raw = lower(first(row, ['Type','Bucket','Slot','Item Type','ItemType','Category'])); if (raw.includes('helmet')) return 'Helmet'; if (raw.includes('gauntlet') || raw.includes('glove')) return 'Gauntlets'; if (raw.includes('chest')) return 'Chest Armor'; if (raw.includes('leg') || raw.includes('boot')) return 'Leg Armor'; if (raw.includes('class') || raw.includes('bond') || raw.includes('cloak') || raw.includes('mark')) return 'Class Item'; return SLOTS.includes(norm(row.Type)) ? norm(row.Type) : 'Armor'; }
  function classFrom(row) { const raw = norm(first(row, ['Equippable','Class','Class Type','Owner','Equippable Class'])); const hit = ['Warlock','Hunter','Titan'].find((cls) => raw.toLowerCase().includes(cls.toLowerCase())); return hit || raw || 'Unknown'; }
  function rarityFrom(row) { const raw = norm(first(row, ['Rarity','Tier','Item Tier','Quality'])); const hit = RARITIES.find((rarity) => raw.toLowerCase().includes(rarity.toLowerCase())); return hit || raw || 'Unknown'; }
  function lightFrom(row) { return num(first(row, ['Light','Power','PowerLevel','Power Level','Light Level','PrimaryStat','Primary Stat','Level','Item Level'])); }
  function gearTierFrom(row, total) { const direct = num(first(row, ['GearTier','Gear Tier','Tier','Armor Tier'])); if (direct >= 1 && direct <= 5) return direct; if (total >= 73) return 5; if (total >= 65) return 4; if (total >= 59) return 3; if (total >= 54) return 2; return total ? 1 : 0; }
  function statValue(row, key) { const aliases = { 'Health (Base)': ['Health (Base)','Health','Resilience','RES'], 'Melee (Base)': ['Melee (Base)','Melee','Strength','STR'], 'Grenade (Base)': ['Grenade (Base)','Grenade','Discipline','DIS'], 'Super (Base)': ['Super (Base)','Super','Intellect','INT'], 'Class (Base)': ['Class (Base)','Class','Mobility','MOB'], 'Weapons (Base)': ['Weapons (Base)','Weapons','Weapon','Recovery','REC'] }; return num(first(row, aliases[key] || [key])); }
  function normalizeArmorRow(raw, index = 0) { const row = { __raw: raw };
    row.Name = norm(first(raw, ['Name','Item Name','Item','Display Name'])) || '(Unnamed item)';
    row.Id = norm(first(raw, ['Id','ID','Instance ID','InstanceId','Item Instance ID','ItemInstanceId','Hash'])) || `dim-${index}-${row.Name}`;
    row.Slot = slotFrom(raw);
    row.Type = row.Slot;
    row.Rarity = rarityFrom(raw);
    row.Equippable = classFrom(raw);
    row.Light = lightFrom(raw);
    row.Power = row.Light;
    row.IconUrl = norm(first(raw, ['IconUrl','Icon URL','Icon','DisplayIcon','Image','Item Icon']));
    for (const stat of STAT_COLS) row[stat] = statValue(raw, stat);
    row['Total (Base)'] = num(first(raw, ['Total (Base)','Base Total','Total','Stat Total'])) || STAT_COLS.reduce((sum, stat) => sum + Number(row[stat] || 0), 0);
    row.Tier = gearTierFrom(raw, row['Total (Base)']);
    row.GearTier = row.Tier;
    row.TierSource = row.Tier ? 'DIM/Fallback' : '';
    row.TierMax = 5;
    row.Source = 'DIM';
    row.Tag = norm(first(raw, ['Tag','D2AA Tag'])).toLowerCase();
    return row;
  }
  function normalizeRows(rows) { return (rows || []).map(normalizeArmorRow).filter((row) => row.Name && row.Slot !== 'Armor' && ['Warlock','Hunter','Titan'].includes(row.Equippable)); }
  window.D2AA_NORMALIZE = { normalizeArmorRow, normalizeRows };
})();
