import { state, setState, subscribe } from '../src-clean/state.js';

let queued = false;

function installStyles() {
  if (document.getElementById('d2aa-id-copy-style')) return;
  const style = document.createElement('style');
  style.id = 'd2aa-id-copy-style';
  style.textContent = `
    .id-copy-chip {
      display:inline-grid!important;
      place-items:center!important;
      width:21px!important;
      height:18px!important;
      padding:0!important;
      border:1px solid rgba(255,255,255,.22)!important;
      background:rgba(6,9,14,.62)!important;
      color:#dbe8ff!important;
      font-size:12px!important;
      line-height:1!important;
      cursor:pointer!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important;
      transform:translateY(0)!important;
    }
    .id-copy-chip:hover,
    .id-copy-chip:focus-visible {
      border-color:rgba(216,180,91,.68)!important;
      background:rgba(216,180,91,.18)!important;
      color:#fff!important;
      outline:none!important;
    }
    .id-copy-chip.is-copied {
      border-color:rgba(118,227,154,.75)!important;
      background:rgba(28,82,49,.78)!important;
      color:#e6fff0!important;
    }
    .feed-card .id-copy-chip { width:20px!important; height:18px!important; font-size:11px!important; }
  `;
  document.head.appendChild(style);
}

function scheduleDecorate() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    addIdCopyButtons();
  });
}

function addIdCopyButtons() {
  document.querySelectorAll('.armor-card[data-id], .feed-card[data-id], .compare-card[data-id]').forEach((card) => {
    const id = card.dataset.id || '';
    if (!id) return;
    const meta = card.querySelector('.meta-line, .feed-meta, .compare-meta');
    if (!meta || meta.querySelector(':scope > .id-copy-chip')) return;
    const rank = meta.querySelector(':scope > .grade-chip, :scope > b.grade-chip, :scope > span.grade-chip');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'id-copy-chip';
    button.dataset.copyItemId = id;
    button.title = `Copy item instance ID: ${id}`;
    button.setAttribute('aria-label', `Copy item instance ID ${id}`);
    button.textContent = '🆔';
    if (rank) meta.insertBefore(button, rank);
    else meta.appendChild(button);
  });
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const ok = document.execCommand('copy');
  input.remove();
  return ok;
}

async function handleClick(event) {
  const button = event.target.closest?.('[data-copy-item-id]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const id = button.dataset.copyItemId || '';
  if (!id) return;
  try {
    await copyText(id);
    button.classList.add('is-copied');
    button.textContent = '✓';
    const row = state.rows.find((item) => String(item.Id) === String(id));
    setState({ status: `Copied item ID${row?.Name ? ` for ${row.Name}` : ''}: ${id}` });
    window.setTimeout(() => {
      button.classList.remove('is-copied');
      button.textContent = '🆔';
    }, 1200);
  } catch (error) {
    setState({ status: `Could not copy item ID: ${error?.message || error}` });
  }
}

installStyles();
document.addEventListener('click', handleClick, true);
subscribe((_, detail = {}) => { if (!detail.statusOnly) scheduleDecorate(); });
const observer = new MutationObserver((mutations) => {
  if (mutations.some((mutation) => mutation.addedNodes?.length)) scheduleDecorate();
});
observer.observe(document.body, { childList: true, subtree: true });
scheduleDecorate();
