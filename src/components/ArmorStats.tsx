import type { ArmorItem } from '../types/armor';
import { STAT_ICONS, STAT_KEYS, STAT_LABELS } from '../utils/constants';
import { baseTotal, currentTotal, statModel } from '../utils/statMath';

interface ArmorStatsProps {
  row: ArmorItem;
}

export default function ArmorStats({ row }: ArmorStatsProps) {
  return (
    <div className="stat-bars">
      {STAT_KEYS.map((key) => {
        const model = statModel(row, key);
        return (
          <div className="stat-row" key={key} title={`${STAT_LABELS[key]}: base ${model.base}`}>
            <img src={STAT_ICONS[key]} alt="" />
            <div className="bar">
              <span className="bar-base" style={{ width: `${Math.min(100, model.base)}%` }} />
              {model.parts.map((part, index) => <span key={`${part.type}-${index}`} className={`bar-bonus bonus-${part.type}`} style={{ left: `${Math.min(100, model.base)}%`, width: `${Math.min(100 - model.base, part.value)}%` }} />)}
            </div>
            <b>{String(model.current).padStart(2, ' ')}</b>
          </div>
        );
      })}
      <div className="stat-total"><span>Total</span><b>{baseTotal(row)}</b><strong>{currentTotal(row)}</strong></div>
    </div>
  );
}
