export function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normId(value) {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/^id:/i, '');
}

export function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('JSON parse failed', error);
    return null;
  }
}

export function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn('JSON stringify failed', error);
    return 'null';
  }
}

export function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), wait);
  };
}

export function formatNumber(value) {
  return Number(value).toLocaleString();
}

export function buildStatList(stats, order) {
  return order.map((stat) => stats?.[stat.id] ?? 0);
}

export function sum(values) {
  return values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
}

export async function copyTextSafe(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.warn('Clipboard write failed', error);
    return false;
  }
}

export function guardArray(value) {
  return Array.isArray(value) ? value : [];
}

export function guardObject(value) {
  return value && typeof value === 'object' ? value : {};
}

export function pluck(source, path, fallback = null) {
  if (!source) return fallback;
  const segments = Array.isArray(path) ? path : `${path}`.split('.');
  let cursor = source;
  for (const key of segments) {
    if (cursor && typeof cursor === 'object' && key in cursor) {
      cursor = cursor[key];
    } else {
      return fallback;
    }
  }
  return cursor ?? fallback;
}

export function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list ?? []) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export function isTokenExpired(token) {
  if (!token) return true;
  const { expiresAt } = token;
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - 15000;
}

export function buildExpiresAt(seconds) {
  return Date.now() + seconds * 1000;
}

export function readSearchParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

export function clearSearchParam(name) {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  window.history.replaceState({}, document.title, url.toString());
}

export function toMap(list, key) {
  const map = new Map();
  for (const item of list ?? []) {
    const value = typeof key === 'function' ? key(item) : item?.[key];
    if (value !== undefined && value !== null) {
      map.set(String(value), item);
    }
  }
  return map;
}

export function createBadge(text, title = '') {
  const span = document.createElement('span');
  span.className = 'badge';
  span.textContent = text;
  if (title) span.title = title;
  return span;
}

export function cleanElement(element) {
  if (!element) return element;
  while (element.firstChild) element.removeChild(element.firstChild);
  return element;
}

export function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function mergeDimTag(row, dimInfo) {
  if (!row || !dimInfo) return row;
  const instanceId = row.itemInstanceId ?? row.Id ?? row.id;
  if (!instanceId) return row;
  const info = dimInfo.get(String(instanceId));
  if (!info) return row;
  return {
    ...row,
    dimTag: info.tag ?? null,
    dimNotes: info.notes ?? '',
  };
}

export function statTotals(stats) {
  return Object.values(stats ?? {}).reduce((acc, value) => acc + (value ?? 0), 0);
}

export function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
