import { STAT_KEYS, STAT_LABELS } from '../constants.js';

export function renderTable(tbody, rows) {
  tbody.innerHTML = rows.map((row) => `<tr>
    <td><strong>${html(row.Name)}</strong><small>${html(row.Id)}</small></td>
    <td>${html(row.Slot)}</td>
    <td>${html(row.Class)}</td>
    <td class="diamonds">${diamonds(row.Tier, row.TierMax)}</td>
    <td><strong>${row.Total || 0}</strong></td>
    <td class="table-stats">${STAT_KEYS.map((key) => `<span>${STAT_LABELS[key]} ${row[key] || 0}</span>`).join('')}</td>
    <td>${html(row.Tag || '—')}</td>
  </tr>`).join('');
}

function diamonds(tier, max = 5) {
  const n = Math.max(0, Math.min(Number(max || 5), Number(tier || 0)));
  return '◆'.repeat(n) + '◇'.repeat(Math.max(0, Number(max || 5) - n));
}
function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
