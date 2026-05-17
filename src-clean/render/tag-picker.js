import { TAGS } from '../constants.js';

let picker;
let activeId = '';
let activeRows = [];
let activeOnTag = null;

export function attachTagPicker(root, rows, onTag) {
  activeRows = rows;
  activeOnTag = onTag;
  ensurePicker();
  root.addEventListener('click', handleRootClick, { once: true });
}

function handleRootClick(event) {
  const trigger = event.target.closest('[data-card-id],[data-tag-trigger]');
  if (!trigger || event.target.closest('[data-action-id],[data-tag-choice]')) return;
  const card = trigger.closest('[data-card-id]') || trigger;
  const id = card.dataset.cardId || trigger.dataset.id;
  const row = activeRows.find((item) => String(item.Id) === String(id));
  if (!row) return;
  event.preventDefault();
  event.stopPropagation();
  openPicker(row, trigger);
}

function ensurePicker() {
  if (picker) return picker;
  picker = document.createElement('div');
  picker.className = 'floating-tag-picker';
  picker.hidden = true;
  picker.innerHTML = `<div class="tag-picker-card" role="menu" aria-label="Tag picker">
    <div class="tag-picker-head"><strong>Tag item</strong><button type="button" data-close-tag-picker>×</button></div>
    <div class="tag-picker-options">${TAGS.map((tag) => `<button type="button" data-picker-tag="${escapeAttr(tag.value)}" title="${escapeAttr(tag.label)}"><span>${tag.emoji}</span><small>${escapeHtml(tag.label)}</small></button>`).join('')}</div>
  </div>`;
  document.body.appendChild(picker);
  picker.addEventListener('click', (event) => {
    const close = event.target.closest('[data-close-tag-picker]');
    if (close) return closePicker();
    const choice = event.target.closest('[data-picker-tag]');
    if (!choice) return;
    activeOnTag?.(activeId, choice.dataset.pickerTag);
    closePicker();
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePicker(); });
  document.addEventListener('click', (event) => {
    if (!picker.hidden && !event.target.closest('.floating-tag-picker') && !event.target.closest('[data-card-id],[data-tag-trigger]')) closePicker();
  });
  return picker;
}

function openPicker(row, trigger) {
  activeId = row.Id;
  const rect = trigger.getBoundingClientRect();
  const x = Math.min(window.innerWidth - 260, Math.max(12, rect.left + rect.width / 2 - 125));
  const y = Math.min(window.innerHeight - 170, Math.max(12, rect.top + 28));
  picker.style.left = `${x}px`;
  picker.style.top = `${y}px`;
  picker.querySelector('.tag-picker-head strong').textContent = row.Name || 'Tag item';
  picker.querySelectorAll('[data-picker-tag]').forEach((button) => button.classList.toggle('is-active', button.dataset.pickerTag === (row.Tag || '')));
  picker.hidden = false;
}

function closePicker() {
  if (picker) picker.hidden = true;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
function escapeAttr(value) { return escapeHtml(value); }
