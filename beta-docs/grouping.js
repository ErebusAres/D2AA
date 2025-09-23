import { normName, num, slotNumber, similarTop3 } from './utils.js';
import { rateLegendary, rateExotic, rankScore } from './ranking.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function buildGroupKey(row) {
  if (!row) return '';
  if ((row.Rarity || '').toLowerCase() === 'exotic') {
    return `${row.Type}|${normName(row.Name)}`;
  }
  return row.Type;
}

export function clusterRows(rows, { tol = 5, sameNameOnly = false } = {}) {
  const byKey = new Map();
  for (const row of rows) {
    const key = buildGroupKey(row);
    if (!byKey.has(key)) {
      byKey.set(key, []);
    }
    byKey.get(key).push({ ...row });
  }

  const out = [];
  for (const [key, items] of byKey) {
    const assigned = Array(items.length).fill(false);
    const rawGroups = [];
    for (let i = 0; i < items.length; i += 1) {
      if (assigned[i]) continue;
      const group = [i];
      assigned[i] = true;
      for (let j = i + 1; j < items.length; j += 1) {
        if (assigned[j]) continue;
        if (sameNameOnly && normName(items[i].Name) !== normName(items[j].Name)) {
          continue;
        }
        if (similarTop3(items[i], items[j], tol)) {
          group.push(j);
          assigned[j] = true;
        }
      }
      rawGroups.push(group);
    }

    rawGroups.sort((groupA, groupB) => {
      const bestA = Math.max(...groupA.map((index) => num(items[index]['Total (Base)'])));
      const bestB = Math.max(...groupB.map((index) => num(items[index]['Total (Base)'])));
      if (bestA !== bestB) return bestB - bestA;
      return String(items[groupA[0]].Id).localeCompare(String(items[groupB[0]].Id));
    });

    const isExoticKey = key.includes('|');
    let letterIdx = 0;
    for (const group of rawGroups) {
      const first = items[group[0]];
      let label = 'X';
      if (group.length > 1) {
        const letter = LETTERS[Math.min(letterIdx, LETTERS.length - 1)];
        label = isExoticKey ? `⚠️🟡${slotNumber(first.Type)}${letter}` : `⚠️${slotNumber(first.Type)}${letter}`;
        letterIdx += 1;
      }
      for (const idx of group) {
        const item = items[idx];
        const total = num(item['Total (Base)']);
        const rarity = (item.Rarity || '').toLowerCase();
        const rank = rarity === 'exotic' ? rateExotic(total) : rarity === 'legendary' ? rateLegendary(total) : String(total);
        out.push({
          ...item,
          GroupKey: key,
          Dupe_Group: label,
          Rank: rank,
          RankScore: rankScore(rank),
          Is_Dupe: label !== 'X',
          Is_Dupe_Exotic: rarity === 'exotic' && label !== 'X'
        });
      }
    }
  }

  out.sort((a, b) => {
    const sa = slotNumber(a.Type);
    const sb = slotNumber(b.Type);
    if (sa !== sb) return sa - sb;

    const ra = a.Rarity === 'Legendary' ? 0 : 1;
    const rb = b.Rarity === 'Legendary' ? 0 : 1;
    if (ra !== rb) return ra - rb;

    const da = a.Dupe_Group !== 'X';
    const db = b.Dupe_Group !== 'X';
    if (da !== db) return Number(db) - Number(da);

    if (da && db) {
      if (a.GroupKey !== b.GroupKey) return String(a.GroupKey).localeCompare(String(b.GroupKey));
      if (a.Dupe_Group !== b.Dupe_Group) return String(a.Dupe_Group).localeCompare(String(b.Dupe_Group));
      if (b.RankScore !== a.RankScore) return b.RankScore - a.RankScore;
      const ta = num(a['Total (Base)']);
      const tb = num(b['Total (Base)']);
      if (tb !== ta) return tb - ta;
      return String(a.Id).localeCompare(String(b.Id));
    }

    if (a.Rarity === 'Exotic' && b.Rarity === 'Exotic') {
      if (a.GroupKey !== b.GroupKey) return String(a.GroupKey).localeCompare(String(b.GroupKey));
      if (b.RankScore !== a.RankScore) return b.RankScore - a.RankScore;
      const ta = num(a['Total (Base)']);
      const tb = num(b['Total (Base)']);
      if (tb !== ta) return tb - ta;
      return String(a.Id).localeCompare(String(b.Id));
    }

    if (a.Rarity === 'Legendary' && b.Rarity === 'Legendary') {
      const na = String(a.Name).toLowerCase();
      const nb = String(b.Name).toLowerCase();
      if (na !== nb) return na.localeCompare(nb);
      if (b.RankScore !== a.RankScore) return b.RankScore - a.RankScore;
      const ta = num(a['Total (Base)']);
      const tb = num(b['Total (Base)']);
      if (tb !== ta) return tb - ta;
      return String(a.Id).localeCompare(String(b.Id));
    }

    return String(a.Id).localeCompare(String(b.Id));
  });

  return out;
}
