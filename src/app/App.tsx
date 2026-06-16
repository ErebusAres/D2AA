import { Component, useCallback, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import Header from '../components/Header';
import Toolbar from '../components/Toolbar';
import FiltersPanel from '../components/FiltersPanel';
import DisplayOptionsPanel from '../components/DisplayOptionsPanel';
import StatsSummary from '../components/StatsSummary';
import ActiveFilterChips from '../components/ActiveFilterChips';
import ArmorGrid from '../components/ArmorGrid';
import ItemFeed from '../components/ItemFeed';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../hooks/useAuth';
import { useArmorFilters } from '../hooks/useArmorFilters';
import { useArmorInventory } from '../hooks/useArmorInventory';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { defaultFilterState, normalizeFilterState } from '../state/filterState';
import { STORAGE_KEYS } from '../utils/constants';
import { runItemAction } from '../data/actions';
import type { ArmorItem } from '../types/armor';
import type { FilterState } from '../types/filters';

interface AppErrorBoundaryState {
  errorMessage: string;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { errorMessage: '' };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { errorMessage: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('D2AA render failure', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.errorMessage) {
      return (
        <div className="app-shell">
          <header className="command-bar">
            <div className="brand-lockup">
              <span className="brand-diamond">◆</span>
              <div><strong>D2 Armor Analyzer</strong><span>D2AA loaded with a recoverable render error.</span></div>
            </div>
          </header>
          <ErrorState message={`D2AA loaded, but a React render error occurred: ${this.state.errorMessage}`} />
          <main>
            <EmptyState hasRows={false} />
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}

function D2AAApp() {
  const [status, setStatus] = useState('Ready.');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [filters, setFilters] = useLocalStorage<FilterState>(STORAGE_KEYS.settings, defaultFilterState, normalizeFilterState);
  const auth = useAuth(setStatus);
  const inventory = useArmorInventory(setStatus);
  const { groupedRows, filteredRows } = useArmorFilters(inventory.rows, filters);

  const runAction = useCallback(async (action: () => Promise<void>) => {
    setLoading(true);
    setError('');
    try {
      await action();
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const runArmorAction = useCallback((row: ArmorItem) => {
    runAction(async () => {
      const result = await runItemAction(row);
      setStatus(result.message);
      if (result.needsRefresh) await inventory.sync();
    });
  }, [inventory, runAction]);

  return (
    <div className={`app-shell ${optionsOpen ? 'options-open' : ''}`}>
      <Header
        status={status}
        auth={auth}
        filters={filters}
        allRows={groupedRows}
        onFiltersChange={setFilters}
        onOptionsToggle={() => setOptionsOpen((open) => !open)}
        onSync={() => runAction(inventory.sync)}
      />
      <aside className={`side-panel ${optionsOpen ? 'is-open' : ''}`} aria-label="Options panel">
        <Toolbar onRestore={() => runAction(inventory.restoreCache)} onClear={() => runAction(inventory.clearCache)} />
        <FiltersPanel rows={groupedRows} value={filters} onChange={setFilters} />
        <DisplayOptionsPanel value={filters.display} onChange={(display) => setFilters((current) => ({ ...current, display }))} />
      </aside>
      <StatsSummary allRows={groupedRows} shownRows={filteredRows} activeClass={filters.filters.class} />
      <ActiveFilterChips value={filters} onChange={setFilters} />
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState label="Working" /> : null}
      <main>
        {filteredRows.length ? (
          <ArmorGrid rows={filteredRows} onTag={inventory.updateTag} onAction={runArmorAction} />
        ) : (
          <EmptyState hasRows={inventory.rows.length > 0} />
        )}
      </main>
      <ItemFeed rows={groupedRows} onDismiss={inventory.dismissRecent} onRefresh={() => runAction(inventory.sync)} onTag={inventory.updateTag} />
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <D2AAApp />
    </AppErrorBoundary>
  );
}
