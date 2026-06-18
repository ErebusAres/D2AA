import type { ArmorItem } from '../types/armor';
import { STAT_ICONS, STAT_KEYS, STAT_LABELS } from '../utils/constants';
import { baseTotal, currentTotal, statModel, totalBonusParts } from '../utils/statMath';
import { detectArmorTuning, tuningTitle } from '../data/armorTuning';

interface ArmorStatsProps {
  row: ArmorItem;
}

export default function ArmorStats({ row }: ArmorStatsProps) {
  const tuning = detectArmorTuning(row);
  const totalBase = baseTotal(row);
  const totalCurrent = currentTotal(row);
  const totalParts = totalBonusParts(row);
  return (
    <div className="stat-bars">
      {STAT_KEYS.map((key) => {
        const model = statModel(row, key);
        const tuningValue = Number(tuning?.stats?.[key] || 0);
        const hasTuning = tuningValue !== 0;
        const title = statCalculationTitle(key, model, row);
        let left = Math.min(100, Math.max(0, model.base));
        return (
          <div className={`stat-row has-tooltip ${hasTuning ? 'has-tuning' : ''}`} key={key} title={title}>
            <img src={STAT_ICONS[key]} alt="" />
            {hasTuning ? (
              <span className="stat-tuning-marker" tabIndex={0} title={tuningTitle(tuning, key)}>
                <TunedStatIcon />
                <span className="d2-tooltip">
                  <b>{tuning?.name || 'Armor Tuning'}</b>
                  <em>{tuningValue > 0 ? `+${tuningValue}` : tuningValue} {STAT_LABELS[key]}</em>
                  <p>{tuningTitle(tuning, key)}</p>
                </span>
              </span>
            ) : null}
            <div className="bar">
              <span className="bar-base" style={{ width: `${Math.min(100, model.base)}%` }} />
              {model.parts.map((part, index) => {
                const start = part.value < 0 ? Math.max(0, Math.min(100, model.base + part.value)) : left;
                const width = part.value < 0 ? Math.min(100, Math.abs(part.value)) : Math.max(0, Math.min(100 - left, part.value));
                if (part.value > 0) left += width;
                return <span key={`${part.type}-${index}`} className={`bar-bonus bonus-${part.type} ${part.value < 0 ? 'bonus-negative' : ''}`} style={{ left: `${start}%`, width: `${width}%` }} title={`${part.type}: ${formatSigned(part.value)}`} />;
              })}
            </div>
            <b>{String(model.current).padStart(2, ' ')}</b>
            <span className="d2-tooltip stat-calc-tooltip">
              <b>{STAT_LABELS[key]} calculation</b>
              <em>{model.source}</em>
              <p>{title}</p>
            </span>
          </div>
        );
      })}
      <div className="stat-total" title={totalCalculationTitle(totalBase, totalCurrent, totalParts)}>
        <span className="total-label">Total</span>
        <div className="total-value">
          <span className="base-total">{totalBase}</span>
          {totalParts.map((part, index) => <span key={`${part.type}-${index}`} className={`bonus-total bonus-${part.type} ${part.value < 0 ? 'bonus-negative-text' : ''}`} title={`${part.type} adjustment`}>{formatSigned(part.value)}</span>)}
        </div>
        <strong className="absolute-total">{totalCurrent}</strong>
      </div>
    </div>
  );
}

function TunedStatIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path fill="currentColor" d="M2,14.25 h28 v3.5 h-28zM2,10.5 l7,-7 l7,7 h-4.5 l-2.5,-2.5 l-2.5,2.5 zM30,21.5 l-7,7 l-7,-7 h4.5 l2.5,2.5 l2.5,-2.5 z" />
    </svg>
  );
}

function statCalculationTitle(key: (typeof STAT_KEYS)[number], model: ReturnType<typeof statModel>, row: ArmorItem): string {
  const parts = model.parts.length ? `, ${model.parts.map((part) => `${part.type} ${formatSigned(part.value)}`).join(', ')}` : '';
  const warningCount = row.StatAudit?.warnings?.length || 0;
  const warning = warningCount ? ` ${warningCount} audit warning${warningCount === 1 ? '' : 's'} present.` : '';
  return `${STAT_LABELS[key]} calculation: base ${model.base}${parts}. Current ${model.current}. Base source: ${model.source}.${warning}`;
}

function totalCalculationTitle(base: number, current: number, parts: Array<{ type: string; value: number }>): string {
  const detail = parts.length ? `, ${parts.map((part) => `${part.type} ${formatSigned(part.value)}`).join(', ')}` : '';
  return `Total calculation: base ${base}${detail}. Absolute total: ${current}.`;
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
