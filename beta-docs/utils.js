const DEFAULT_NUMBER_LOCALE = 'en-US';

/**
 * Clamp a numeric value between the provided bounds. Non-numeric input
 * resolves to the lower bound.
 */
export function clamp(value, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return min;
  return Math.min(Math.max(numeric, min), max);
}

/**
 * Sum an iterable of numeric values, coercing each entry to a number.
 */
export function sum(values) {
  let total = 0;
  if (!values) return total;
  for (const value of values) {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      total += numeric;
    }
  }
  return total;
}

/**
 * Format a number for display using the default locale. Nullish values fall
 * back to an em dash so the UI can distinguish missing data.
 */
export function formatNumber(value, { fallback = '—', minimumIntegerDigits } = {}) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return fallback;
  }
  const formatter = new Intl.NumberFormat(DEFAULT_NUMBER_LOCALE, {
    minimumIntegerDigits,
  });
  return formatter.format(value);
}

/**
 * Create a DOM element with convenience helpers for classes, attributes, and
 * children. Text children are automatically wrapped in text nodes.
 */
export function createElement(tag, { className, attrs, textContent, children } = {}) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (attrs) {
    for (const [name, value] of Object.entries(attrs)) {
      if (value === undefined || value === null) continue;
      if (name === 'dataset') {
        for (const [dataKey, dataValue] of Object.entries(value)) {
          if (dataValue === undefined || dataValue === null) continue;
          el.dataset[dataKey] = dataValue;
        }
        continue;
      }
      if (name in el) {
        try {
          el[name] = value;
          continue;
        } catch (_err) {
          // fall back to setAttribute
        }
      }
      el.setAttribute(name, value);
    }
  }
  if (textContent !== undefined && textContent !== null) {
    el.textContent = textContent;
  }
  if (children) {
    for (const child of children) {
      if (child === null || child === undefined) continue;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
  }
  return el;
}

/**
 * Sort an array by the provided iteratee. The input array is not mutated.
 */
export function sortBy(array, iteratee) {
  if (!Array.isArray(array)) return [];
  const decorated = array.map((value, index) => ({
    index,
    value,
    sort: iteratee(value, index),
  }));
  decorated.sort((a, b) => {
    if (a.sort < b.sort) return -1;
    if (a.sort > b.sort) return 1;
    return a.index - b.index;
  });
  return decorated.map((entry) => entry.value);
}

/**
 * Convert a set of keys into an object, using the supplied initializer for
 * values.
 */
export function objectFromKeys(keys, initializer = () => 0) {
  const result = {};
  for (const key of keys) {
    result[key] = typeof initializer === 'function' ? initializer(key) : initializer;
  }
  return result;
}
