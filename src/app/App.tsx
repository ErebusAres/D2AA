import { useCallback, useState } from 'react';
import Header from '../components/Header';
import Toolbar from '../components/Toolbar';
import FiltersPanel from '../components/FiltersPanel';
import DisplayOptionsPanel from '../components/DisplayOptionsPanel';
import StatsSummary from '../components/StatsSummary';
import ArmorGrid from '../components/ArmorGrid';
import ItemFeed from '../components/ItemFeed';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../hooks/useAuth';
import { useArmorFilters } from '../hooks/useArmorFilters';
import { useArmorInventory } from '../hooks/useArmorInventory';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { defaultFilterState } from '../state/filterState';
import { STORAGE_KEYS } from '../utils/constants';
import type { FilterState } from '../types/filters';

export default function App() {
  const [status, setStatus] = useState('Ready.');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [filters, setFilters] = useLocalStorage<FilterState>(STORAGE_KEYS.settings, defaultFilterState);
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
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState label="Working" /> : null}
      <main>
        {filteredRows.length ? (
          <ArmorGrid rows={filteredRows} onTag={inventory.updateTag} />
        ) : (
          <EmptyState hasRows={inventory.rows.length > 0} />
        )}
      </main>
      <ItemFeed rows={groupedRows} onDismiss={inventory.dismissRecent} onTag={inventory.updateTag} />
    </div>
  );
}
