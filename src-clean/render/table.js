import { STAT_KEYS, STAT_LABELS, STAT_ICONS, RARITY_ICONS, CLASS_ICONS, SLOT_ICONS, TAGS } from '../constants.js';
import { actionLabel, canRunAction } from '../data/actions.js';
import { detectArmorTuning, tuningBadgeHtml } from '../data/armor-tuning.js';
import { ensureTuningStyles } from './grid-v200.js';

export function renderTable(tbody, rows, onAction) {
  ensureTuningStyles();
  rows.forEach((row) => detectArmorTuning(row));
  tbody.innerHTML = rows.map((row) => `<tr class="${row.Group ? 'is-grouped ' + row.GroupColor : ''}">
    <td class="table-item-cell"><div class="table-item-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '◇'}</div><div><strong>${html(row.Name)}</strong><small class="table-meta-icons">${metaIcons(row)} ${row.Group ? '• ' + html(row.Group) : ''}</small></div></td>
    <td>${slotIcon(row)} ${html(row.Slot)}</td>
    <td>${iconImg(CLASS_ICONS[row.Class], row.Class)} ${html(row.Class)}</td>
    <td class="diamonds">${diamonds(row.Tier, row.TierMax)}</td>
    <td><strong>${row.Total || 0}</strong></td>
    <td class="table-stats">${STAT_KEYS.map((key) => `<span title="${html(statTitle(row, key))}"><span class="stat-icon-stack">${tuningBadgeHtml(row, key)}<img class="stat-icon" src="${html(STAT_ICONS[key])}" alt="${html(STAT_LABELS[key])}" loading="lazy"></span>${row[key] || 0}</span>`).join('')}</td>
    <td>${tagLabel(row.Tag)}</td>
    <td><button type="button" class="table-action" data-table-action="${html(row.Id)}" ${canRunAction(row) ? '' : 'disabled'}>${html(actionLabel(row))}</button></td>
  </tr>`).join('');
  tbody.querySelectorAll('[data-table-action]').forEach((button) => button.addEventListener('click', () => onAction?.(button.dataset.tableAction, button)));
}

function statTitle(row, key) {
  const tuning = detectArmorTuning(row);
  const value = Number(tuning?.stats?.[key] || 0);
  return value ? `${STAT_LABELS[key]}: ${row[key] || 0} · ${tuning.name}: ${value > 0 ? '+' : ''}${value}` : `${STAT_LABELS[key]}: ${row[key] || 0}`;
}
function metaIcons(row) {
  return [iconImg(CLASS_ICONS[row.Class], row.Class), slotIcon(row), iconImg(RARITY_ICONS[row.Rarity], row.Rarity), html(row.Rarity)].filter(Boolean).join(' ');
}
function slotIcon(row) {
  return SLOT_ICONS[row.Slot] ? `<span class="meta-mask table-mask" style="--icon:url('${html(SLOT_ICONS[row.Slot])}')" title="${html(row.Slot)}" aria-label="${html(row.Slot)}"></span>` : '';
}
function iconImg(src, label) {
  return src ? `<img class="meta-icon" src="${html(src)}" alt="${html(label || '')}" title="${html(label || '')}" loading="lazy">` : '';
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
