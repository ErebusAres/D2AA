import type { ArmorItem } from '../types/armor';
import { STAT_ICONS, STAT_KEYS, STAT_LABELS } from '../utils/constants';
import { baseTotal, currentTotal, statModel } from '../utils/statMath';
import { detectArmorTuning, tuningTitle } from '../data/armorTuning';

interface ArmorStatsProps {
  row: ArmorItem;
}

export default function ArmorStats({ row }: ArmorStatsProps) {
  const tuning = detectArmorTuning(row);
  return (
    <div className="stat-bars">
      {STAT_KEYS.map((key) => {
        const model = statModel(row, key);
        const tuningValue = Number(tuning?.stats?.[key] || 0);
        return (
          <div className={`stat-row ${tuningValue > 0 ? 'has-positive-tuning' : ''}`} key={key} title={`${STAT_LABELS[key]}: base ${model.base}`}>
            <img src={STAT_ICONS[key]} alt="" />
            {tuningValue > 0 ? (
              <span className="stat-tuning-marker" tabIndex={0} title={tuningTitle(tuning, key)}>
                {tuning?.icon ? <img src={tuning.icon} alt="" /> : '◆'}
                <span className="d2-tooltip">
                  <b>{tuning?.name || 'Armor Tuning'}</b>
                  <em>{tuningValue > 0 ? `+${tuningValue}` : tuningValue} {STAT_LABELS[key]}</em>
                  <p>{tuningTitle(tuning, key)}</p>
                </span>
              </span>
            ) : null}
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
