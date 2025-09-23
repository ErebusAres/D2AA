export const STAT_COLS = [
  'Health (Base)',
  'Melee (Base)',
  'Grenade (Base)',
  'Super (Base)',
  'Class (Base)',
  'Weapons (Base)'
];

export const STAT_ICONS = {
  'Health (Base)': 'https://www.bungie.net/common/destiny2_content/icons/717b8b218cc14325a54869bef21d2964.png',
  'Melee (Base)': 'https://www.bungie.net/common/destiny2_content/icons/fa534aca76d7f2d7e7b4ba4df4271b42.png',
  'Grenade (Base)': 'https://www.bungie.net/common/destiny2_content/icons/065cdaabef560e5808e821cefaeaa22c.png',
  'Super (Base)': 'https://www.bungie.net/common/destiny2_content/icons/585ae4ede9c3da96b34086fccccdc8cd.png',
  'Class (Base)': 'https://www.bungie.net/common/destiny2_content/icons/7eb845acb5b3a4a9b7e0b2f05f5c43f1.png',
  'Weapons (Base)': 'https://www.bungie.net/common/destiny2_content/icons/bc69675acdae9e6b9a68a02fb4d62e07.png'
};

export const RARITY_ICONS = {
  Legendary: 'https://www.bungie.net/common/destiny2_content/icons/f846f489c2a97afb289b357e431ecf8d.png',
  Exotic: 'https://www.bungie.net/common/destiny2_content/icons/3e6a698e1a8a5fb446fdcbf1e63c5269.png'
};

export const CLASS_OPTIONS = ['Warlock', 'Hunter', 'Titan'];
export const SLOT_OPTIONS = ['All', 'Helmet', 'Gauntlets', 'Chest Armor', 'Leg Armor', 'Class Item'];
export const RARITY_OPTIONS = ['All', 'Legendary', 'Exotic'];
export const DUPES_OPTIONS = ['All', 'Only Dupes', 'Only Same-Name'];

export const CLASS_ICONS = {
  Warlock: 'https://www.bungie.net/common/destiny2_content/icons/e4006d9a8fe167bd7e83193d7601c89a.png',
  Hunter: 'https://www.bungie.net/common/destiny2_content/icons/05e32a388d9a65a0ef59b2193eee2db4.png',
  Titan: 'https://www.bungie.net/common/destiny2_content/icons/46a19ddd00d0f6ca822230943103b54a.png'
};

export const SLOT_ICONS = {
  Helmet: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/helmet.svg',
  Gauntlets: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/gloves.svg',
  'Chest Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/chest.svg',
  'Leg Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/boots.svg',
  'Class Item': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/class.svg'
};

export const TAG_EMOJIS = {
  favorite: '❤️',
  keep: '🏷️',
  junk: '🚫',
  infuse: '⚡',
  archive: '📦'
};

export const TAG_LABELS = {
  favorite: 'Favorite',
  keep: 'Keep',
  junk: 'Junk',
  infuse: 'Infuse',
  archive: 'Archive'
};

export const classItemByClass = {
  Warlock: 'Warlock Bond',
  Hunter: 'Hunter Cloak',
  Titan: 'Titan Mark'
};

export const STORAGE_KEY = 'd2aa_beta_rows_v1';

export function normId(value) {
  return value ? String(value).trim().replace(/^"|"$/g, '') : '';
}

export function normName(value) {
  return String(value || '').trim().toLowerCase();
}

export function num(value) {
  if (value == null || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function slotNumber(type) {
  if (type === 'Helmet') return 1;
  if (type === 'Gauntlets') return 2;
  if (type === 'Chest Armor') return 3;
  if (type === 'Leg Armor') return 4;
  if (['Warlock Bond', 'Hunter Cloak', 'Titan Mark'].includes(type)) return 5;
  return 9;
}

export function statColorCls(value) {
  if (value >= 30) return 'stat-cyan';
  if (value >= 24) return 'stat-green';
  if (value >= 15) return 'stat-yellow';
  return 'stat-red';
}

export function top3Entries(item) {
  const arr = STAT_COLS.map((key) => ({ name: key, value: num(item[key]) }));
  arr.sort((a, b) => (b.value - a.value) || a.name.localeCompare(b.name));
  return arr.slice(0, 3);
}

export function similarTop3(a, b, tol) {
  const ta = top3Entries(a);
  const tb = top3Entries(b);
  for (let i = 0; i < 3; i += 1) {
    if (ta[i].name !== tb[i].name) return false;
    if (Math.abs(ta[i].value - tb[i].value) > tol) return false;
  }
  return true;
}

export async function copyTextSafe(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error('clipboard api not available');
  } catch (err) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (err2) {
      console.error('Copy failed', err2);
      alert('Copy failed.');
      return false;
    }
  }
}
