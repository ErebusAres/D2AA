import AuthButtons from './AuthButtons';
import type { ArmorItem } from '../types/armor';
import type { AuthState } from '../types/auth';
import type { FilterState } from '../types/filters';
import { CLASS_ORDER } from '../utils/constants';
import { rowMatchesClass } from '../data/armorNormalization';

interface HeaderProps {
  status: string;
  auth: AuthState & { login: () => void; logout: () => void };
  filters: FilterState;
  allRows: ArmorItem[];
  onFiltersChange: (value: FilterState | ((current: FilterState) => FilterState)) => void;
  onOptionsToggle: () => void;
  onSync: () => void;
  isSyncing: boolean;
  liveEnabled: boolean;
  lastSyncAt: number;
}

export default function Header({ status, auth, filters, allRows, onFiltersChange, onOptionsToggle, onSync, isSyncing, liveEnabled, lastSyncAt }: HeaderProps) {
  const liveLabel = isSyncing ? 'Syncing' : liveEnabled ? 'Live' : 'Manual';
  const lastSyncLabel = lastSyncAt ? `Last sync ${new Date(lastSyncAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : status;
  const liveState = isSyncing ? 'syncing' : auth.isSignedIn ? liveEnabled ? 'current' : 'manual' : 'signed-out';
  return (
    <header className="command-bar">
      <button type="button" className="gear-button" aria-label="Options" onClick={onOptionsToggle}>⚙</button>
      <div className={`live-chip ${isSyncing ? 'is-syncing' : ''} ${liveEnabled ? 'is-live' : 'is-manual'}`} data-live-state={liveState} title={lastSyncLabel}><span />{liveLabel}</div>
      <div className="brand-lockup">
        <span className="brand-diamond">◆</span>
        <div><strong>D2 Armor Analyzer</strong><span>{status}</span></div>
      </div>
      <nav className="class-toggle" aria-label="Class filter">
        {CLASS_ORDER.map((className) => (
          <button
            type="button"
            key={className}
            className={filters.filters.class === className ? 'is-active' : ''}
            onClick={() => onFiltersChange((current) => ({ ...current, filters: { ...current.filters, class: className } }))}
          >
            {className} <b>{allRows.filter((row) => rowMatchesClass(row, className)).length}</b>
          </button>
        ))}
      </nav>
      <label className="search-wrap">
        <span>Search</span>
        <input
          type="search"
          placeholder="Armor name, slot, tag, group..."
          value={filters.search}
          onChange={(event) => onFiltersChange((current) => ({ ...current, search: event.target.value }))}
        />
      </label>
      <AuthButtons auth={auth} onSync={onSync} isSyncing={isSyncing} />
    </header>
  );
}
