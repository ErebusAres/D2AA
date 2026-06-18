import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import AuthButtons from './AuthButtons';
import type { ArmorItem } from '../types/armor';
import type { AuthState } from '../types/auth';
import type { FilterState } from '../types/filters';
import { APP_VERSION, CLASS_ORDER } from '../utils/constants';
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
  queuedActions: number;
}

export default function Header({ status, auth, filters, allRows, onFiltersChange, onOptionsToggle, onSync, isSyncing, liveEnabled, lastSyncAt, queuedActions }: HeaderProps) {
  const liveLabel = queuedActions ? `Queued ${queuedActions}` : isSyncing ? 'Syncing' : liveEnabled ? 'Live' : 'Manual';
  const lastSyncLabel = lastSyncAt ? `Last sync ${new Date(lastSyncAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : status;
  const liveState = queuedActions ? 'queued' : isSyncing ? 'syncing' : auth.isSignedIn ? liveEnabled ? 'current' : 'manual' : 'signed-out';
  const activeProgress = useMemo(() => parseProgressStatus(status), [status]);
  const [recentProgress, setRecentProgress] = useState<ProgressStatus | null>(null);
  const [showCompleteFlash, setShowCompleteFlash] = useState(false);

  useEffect(() => {
    if (activeProgress) {
      setRecentProgress(activeProgress);
      setShowCompleteFlash(activeProgress.percent >= 100);
      return;
    }
    if (!isSyncing && recentProgress) {
      setShowCompleteFlash(true);
      const timeout = window.setTimeout(() => {
        setRecentProgress(null);
        setShowCompleteFlash(false);
      }, 650);
      return () => window.clearTimeout(timeout);
    }
    if (!isSyncing) setShowCompleteFlash(false);
  }, [activeProgress, isSyncing, recentProgress]);

  const shownProgress = activeProgress || (showCompleteFlash ? recentProgress : null);
  return (
    <header className="command-bar">
      <button type="button" className="gear-button" aria-label="Options" onClick={onOptionsToggle}>⚙</button>
      <div className={`live-chip ${isSyncing ? 'is-syncing' : ''} ${queuedActions ? 'is-queued' : ''} ${liveEnabled ? 'is-live' : 'is-manual'}`} data-live-state={liveState} title={queuedActions ? `${queuedActions} queued Bungie action${queuedActions === 1 ? '' : 's'}. ${lastSyncLabel}` : lastSyncLabel}><span />{liveLabel}</div>
      <div className="brand-lockup">
        <span className="brand-diamond">◆</span>
        <div>
          <span className="brand-title-row"><strong>D2 Armor Analyzer</strong><b>{APP_VERSION}</b></span>
          <StatusLine status={status} progress={shownProgress} complete={showCompleteFlash} />
        </div>
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

interface ProgressStatus {
  label: string;
  current: number;
  total: number;
  percent: number;
}

function StatusLine({ status, progress, complete }: { status: string; progress: ProgressStatus | null; complete: boolean }) {
  if (!progress) return <span>{status}</span>;
  const style = { '--progress': `${progress.percent}%` } as CSSProperties;
  return (
    <span className={`status-progress ${complete ? 'is-complete' : ''}`} style={style}>
      <span>{progress.label}: {progress.current}/{progress.total}</span>
    </span>
  );
}

function parseProgressStatus(status: string): ProgressStatus | null {
  const match = /^(.+?):\s*(\d+)\s*\/\s*(\d+)/.exec(status.trim());
  if (!match) return null;
  const current = Number(match[2]);
  const total = Number(match[3]);
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return null;
  return {
    label: match[1],
    current,
    total,
    percent: Math.max(0, Math.min(100, (current / total) * 100))
  };
}
