interface ToolbarProps {
  onRestore: () => void;
  onClear: () => void;
}

export default function Toolbar({ onRestore, onClear }: ToolbarProps) {
  return (
    <section className="panel-card">
      <h2>Options</h2>
      <button type="button" className="action-card" onClick={onRestore}><span>↻</span><b>Restore Cache</b><small>Load locally cached rows</small></button>
      <button type="button" className="action-card action-card--danger" onClick={onClear}><span>×</span><b>Clear Cache</b><small>Keep tags and dismissed feed state</small></button>
    </section>
  );
}
