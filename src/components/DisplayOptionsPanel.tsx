import type { DisplayOptions } from '../types/filters';

interface DisplayOptionsPanelProps {
  value: DisplayOptions;
  onChange: (value: DisplayOptions) => void;
}

const OPTIONS: Array<{ key: keyof DisplayOptions; label: string }> = [
  { key: 'showEquipped', label: 'Show equipped' },
  { key: 'showVault', label: 'Show vault' },
  { key: 'showInventory', label: 'Show inventory' },
  { key: 'showLocked', label: 'Show locked' },
  { key: 'onlyNewItems', label: 'Only new items' },
  { key: 'onlyGroupedItems', label: 'Only grouped items' },
  { key: 'onlySameNameStatGroups', label: 'Only same-name exact-stat groups' }
];

export default function DisplayOptionsPanel({ value, onChange }: DisplayOptionsPanelProps) {
  return (
    <section className="panel-card">
      <h2>Display</h2>
      <div className="display-list">
        {OPTIONS.map((option) => (
          <label className="display-toggle" key={option.key}>
            <span>{option.label}</span>
            <input type="checkbox" checked={value[option.key]} onChange={(event) => onChange({ ...value, [option.key]: event.target.checked })} />
          </label>
        ))}
      </div>
    </section>
  );
}
