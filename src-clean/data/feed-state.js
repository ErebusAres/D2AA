export const ACTIVE_FEED_LIMIT = 20;

export function isActiveFeedItem(row) {
  return Boolean(row && row.Id && !row.Tag && (row.RecentStatus === 'new' || row.RecentlyFound === true));
}

export function getActiveFeedRows(rows, limit = ACTIVE_FEED_LIMIT) {
  return (Array.isArray(rows) ? rows : [])
    .slice()
    .filter(isActiveFeedItem)
    .sort(compareFeedItems)
    .slice(0, limit);
}

export function compareFeedItems(a, b) {
  const aTime = feedSortTime(a);
  const bTime = feedSortTime(b);
  return bTime - aTime || compareInstanceIdsDesc(a?.Id, b?.Id) || String(a?.Name || '').localeCompare(String(b?.Name || ''));
}

export function feedSortTime(row) {
  return Number(row?.ActivityAt || row?.FoundAt || Date.parse(row?.LastChangedAt || '') || 0);
}

export function compareInstanceIdsDesc(a, b) {
  const left = digitsOnly(a);
  const right = digitsOnly(b);
  if (left.length !== right.length) return right.length - left.length;
  return right.localeCompare(left);
}

function digitsOnly(value) {
  return String(value || '').split('').filter((char) => char >= '0' && char <= '9').join('').replace(/^0+/, '');
}
