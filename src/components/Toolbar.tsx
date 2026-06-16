import { useRef } from 'react';

interface ToolbarProps {
  onImportCsv: (file: File) => void;
  onRestore: () => void;
  onClear: () => void;
}

export default function Toolbar({ onImportCsv, onRestore, onClear }: ToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <section className="panel-card">
      <h2>Options</h2>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImportCsv(file);
          event.currentTarget.value = '';
        }}
      />
      <button type="button" className="action-card" onClick={() => inputRef.current?.click()}><span>⇧</span><b>Upload DIM CSV</b><small>Parse and cache local armor rows</small></button>
      <button type="button" className="action-card" onClick={onRestore}><span>↻</span><b>Restore Cache</b><small>Load locally cached rows</small></button>
      <button type="button" className="action-card action-card--danger" onClick={onClear}><span>×</span><b>Clear Cache</b><small>Keep tags and dismissed feed state</small></button>
    </section>
  );
}
