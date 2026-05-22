import { state, subscribe } from '../src-clean/state.js';
import { TAGS } from '../src-clean/constants.js';

const TAG_BY_LABEL = new Map(TAGS.map((tag) => [String(tag.label || '').trim(), tag]));
const TAG_BY_VALUE = new Map(TAGS.map((tag) => [String(tag.value || '').trim(), tag]));
let queued = false;

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    fixTagChips();
    fixStatusText();
  });
}

function fixTagChips() {
  document.querySelectorAll('.tag-chip').forEach((chip) => {
    const id = chip.dataset.id;
    const row = id ? state.rows.find((item) => String(item.Id) === String(id)) : null;
    const tagValue = row?.Tag || state.tags?.[id] || '';
    const found = TAG_BY_VALUE.get(String(tagValue)) || TAG_BY_LABEL.get(String(chip.textContent || '').trim());
    if (!found || !found.emoji) return;
    chip.textContent = found.emoji;
    chip.title = found.label || found.value || 'Tag';
    chip.setAttribute('aria-label', found.label || found.value || 'Tag');
  });
}

function fixStatusText() {
  const el = document.getElementById('statusText');
  if (!el) return;
  const text = String(el.textContent || '');
  if (/^Loaded Bungie cache:/i.test(text)) {
    const next = `${text} Click Sync for live Bungie refresh.`;
    el.textContent = next;
    el.title = next;
  }
}

subscribe(schedule);
schedule();
