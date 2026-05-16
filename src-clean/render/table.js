import { STAT_KEYS, STAT_LABELS, TAGS } from '../constants.js';
import { actionLabel, canRunAction } from '../data/actions.js';

export function renderTable(tbody, rows, onAction) {
  tbody.innerHTML = rows.map((row) => `<tr class="${row.Group ? 'is-grouped ' + row.GroupColor : ''}">
    <td class="table-item-cell"><div class="table-item-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '◇'}</div><div><strong>${html(row.Name)}</strong><small>${html(row.Class)} • ${html(row.Slot)} • ${html(row.Rarity)} ${row.Group ? '• ' + html(row.Group) : ''}</small></div></td>
    <td>${html(row.Slot)}</td>
    <td>${html(row.Class)}</td>
    <td class="diamonds">${diamonds(row.Tier, row.TierMax)}</td>
    <td><strong>${row.Total || 0}</strong></td>
    <td class="table-stats">${STAT_KEYS.map((key) => `<span>${STAT_LABELS[key]} ${row[key] || 0}</span>`).join('')}</td>
    <td>${tagLabel(row.Tag)}</td>
    <td><button type="button" class="table-action" data-table-action="${html(row.Id)}" ${canRunAction(row) ? '' : 'disabled'}>${html(actionLabel(row))}</button></td>
  </tr>`).join('');
  tbody.querySelectorAll('[data-table-action]').forEach((button) => button.addEventListener('click', () => onAction?.(button.dataset.tableAction, button)));
}

function tagLabel(value) {
  const tag = TAGS.find((item) => item.value === value);
  return tag?.value ? `${tag.emoji} ${html(tag.label)}` : '—';
}
function diamonds(tier, max = 5) {
  const m = Number(max || 5);
  const n = Math.max(0, Math.min(m, Number(tier || 0)));
  return '◆'.repeat(n) + '◇'.repeat(Math.max(0, m - n));
}
function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
