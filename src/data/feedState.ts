import type { ArmorItem } from '../types/armor';

export const ACTIVE_FEED_LIMIT = 20;

export function getActiveFeedRows(rows: ArmorItem[], limit = ACTIVE_FEED_LIMIT): ArmorItem[] {
  return rows
    .slice()
    .filter((row) => Boolean(row.Id && !row.Tag && (row.RecentStatus === 'new' || row.RecentlyFound === true)))
    .sort((a, b) => feedSortTime(b) - feedSortTime(a) || compareInstanceIdsDesc(a.Id, b.Id) || a.Name.localeCompare(b.Name))
    .slice(0, limit);
}

function feedSortTime(row: ArmorItem): number {
  return Number(row.ActivityAt || row.FoundAt || Date.parse(row.LastChangedAt || '') || 0);
}

function compareInstanceIdsDesc(a: string, b: string): number {
  const left = digitsOnly(a);
  const right = digitsOnly(b);
  if (left.length !== right.length) return right.length - left.length;
  return right.localeCompare(left);
}

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, '').replace(/^0+/, '');
}
