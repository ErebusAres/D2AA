import { CORE_STAT_KEYS } from './armor-stats.js';
import { clamp, createElement, formatNumber } from './utils.js';

const STAT_LABELS = {
  mobility: 'Mobility',
  resilience: 'Resilience',
  recovery: 'Recovery',
  discipline: 'Discipline',
  intellect: 'Intellect',
  strength: 'Strength',
};

const STAT_BAR_MAX = 42;

function buildTableHead() {
  const thead = document.createElement('thead');
  const row = document.createElement('tr');
  const headers = [
    { key: 'item', label: 'Item' },
    { key: 'slot', label: 'Slot / Type' },
    { key: 'rarity', label: 'Rarity' },
    { key: 'power', label: 'Power' },
    { key: 'total', label: 'Total' },
    ...CORE_STAT_KEYS.map((key) => ({ key, label: STAT_LABELS[key] })),
  ];

  headers.forEach((header) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = header.label;
    if (header.key === 'item') th.classList.add('col-item');
    if (header.key === 'slot') th.classList.add('col-slot');
    if (header.key === 'total') th.classList.add('col-total');
    if (CORE_STAT_KEYS.includes(header.key)) th.classList.add('col-stat');
    row.appendChild(th);
  });
  thead.appendChild(row);
  return thead;
}

function buildItemCell(row) {
  const cell = document.createElement('td');
  cell.className = 'cell-item';
  const content = createElement('div', { className: 'item-cell' });
  if (row.icon) {
    const img = createElement('img', {
      className: 'item-icon',
      attrs: { src: row.icon, alt: '' },
    });
    content.appendChild(img);
  }
  const text = createElement('div', { className: 'item-text' });
  const name = createElement('div', { className: 'item-name', textContent: row.name });
  const metaChildren = [];
  if (row.className) metaChildren.push(row.className);
  if (row.isEquipped) metaChildren.push('Equipped');
  if (row.power !== null && row.power !== undefined) {
    metaChildren.push(`Power ${formatNumber(row.power, { fallback: '–' })}`);
  }
  const meta = createElement('div', {
    className: 'item-meta',
    textContent: metaChildren.join(' • '),
  });
  text.append(name, meta);
  content.appendChild(text);
  cell.appendChild(content);
  return cell;
}

function buildSlotCell(row) {
  const cell = document.createElement('td');
  cell.className = 'cell-slot';
  const slot = createElement('div', { className: 'slot-name', textContent: row.slot });
  const type = createElement('div', { className: 'slot-type', textContent: row.typeName });
  cell.append(slot, type);
  return cell;
}

function buildRarityCell(row) {
  const cell = document.createElement('td');
  const rarityClass = row.rarityClass ? `rarity-${row.rarityClass}` : '';
  cell.className = `cell-rarity ${rarityClass}`.trim();
  cell.textContent = row.tier;
  return cell;
}

function buildPowerCell(row) {
  const cell = document.createElement('td');
  cell.className = 'cell-power';
  cell.textContent = row.power !== null && row.power !== undefined ? formatNumber(row.power) : '–';
  return cell;
}

function buildTotalCell(statBlock) {
  const cell = document.createElement('td');
  cell.className = 'cell-total';
  cell.textContent = formatNumber(statBlock?.total ?? 0);
  return cell;
}

function buildStatCell(value) {
  const cell = document.createElement('td');
  cell.className = 'cell-stat';
  const valueEl = createElement('div', {
    className: 'stat-value',
    textContent: formatNumber(value, { fallback: '0' }),
  });
  const bar = createElement('div', { className: 'stat-bar' });
  const fill = createElement('div', { className: 'stat-bar__fill' });
  const width = clamp((Number(value) / STAT_BAR_MAX) * 100, 0, 100);
  fill.style.width = `${width}%`;
  bar.appendChild(fill);
  cell.append(valueEl, bar);
  return cell;
}

function buildEmptyRow(colspan) {
  const row = document.createElement('tr');
  row.className = 'empty-row';
  const cell = document.createElement('td');
  cell.colSpan = colspan;
  cell.textContent = 'No armor found for this character.';
  row.appendChild(cell);
  return row;
}

export function renderTable(container, initialRows, { state } = {}) {
  if (!container) return null;
  let rows = Array.isArray(initialRows) ? [...initialRows] : [];
  const root = createElement('div', { className: 'beta-layout' });
  const controls = createElement('div', { className: 'beta-controls' });
  const label = createElement('span', {
    className: 'beta-controls__label',
    textContent: 'Stat view:',
  });
  const toggleBase = createElement('button', {
    className: 'beta-toggle',
    textContent: 'Base',
  });
  const toggleCurrent = createElement('button', {
    className: 'beta-toggle',
    textContent: 'Current',
  });
  controls.append(label, toggleBase, toggleCurrent);

  const table = createElement('table', { className: 'armor-table' });
  const thead = buildTableHead();
  const tbody = document.createElement('tbody');
  table.append(thead, tbody);

  root.append(controls, table);
  container.innerHTML = '';
  container.appendChild(root);

  let statView = state?.getState().statView ?? 'base';

  function updateToggleUI() {
    toggleBase.classList.toggle('is-active', statView === 'base');
    toggleCurrent.classList.toggle('is-active', statView === 'current');
  }

  function renderRows() {
    tbody.innerHTML = '';
    if (!rows.length) {
      tbody.appendChild(buildEmptyRow(thead.querySelectorAll('th').length));
      return;
    }
    for (const row of rows) {
      const statBlock = statView === 'base' ? row.baseStats : row.currentStats;
      const tr = document.createElement('tr');
      tr.append(
        buildItemCell(row),
        buildSlotCell(row),
        buildRarityCell(row),
        buildPowerCell(row),
        buildTotalCell(statBlock),
        ...CORE_STAT_KEYS.map((key) => buildStatCell(statBlock?.[key] ?? 0))
      );
      tbody.appendChild(tr);
    }
  }

  function setStatView(next) {
    if (next !== 'base' && next !== 'current') return;
    if (statView === next) return;
    statView = next;
    if (state) {
      state.setState({ statView: next });
    }
    updateToggleUI();
    renderRows();
  }

  toggleBase.addEventListener('click', () => setStatView('base'));
  toggleCurrent.addEventListener('click', () => setStatView('current'));

  if (state) {
    state.subscribe((nextState) => {
      const nextView = nextState?.statView ?? 'base';
      if (nextView !== statView) {
        statView = nextView;
        updateToggleUI();
        renderRows();
      }
    });
  }

  updateToggleUI();
  renderRows();

  return {
    update(newRows) {
      rows = Array.isArray(newRows) ? [...newRows] : [];
      renderRows();
    },
  };
}
