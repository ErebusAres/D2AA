import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { ArmorItem } from '../types/armor';
import { canRunLockAction, runGroupPull, runItemAction, runLockAction } from '../data/actions';

type QueueKind = 'transfer' | 'group-pull' | 'lock';
type QueueReason = 'manual-lock' | 'auto-lock';

interface QueuedAction {
  id: string;
  kind: QueueKind;
  priority: number;
  label: string;
  row?: ArmorItem;
  rows?: ArmorItem[];
  desiredLock?: boolean;
  reason?: QueueReason;
}

interface ActionQueueOptions {
  rows: ArmorItem[];
  externalSyncing: boolean;
  sync: (options?: { reason?: string; background?: boolean }) => Promise<ArmorItem[]>;
  patchRow: (id: string, patch: Partial<ArmorItem>) => void;
  setStatus: (status: string) => void;
  setError: (message: string) => void;
  setLoading: (loading: boolean) => void;
}

export function useActionQueue({ rows, externalSyncing, sync, patchRow, setStatus, setError, setLoading }: ActionQueueOptions) {
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const runningRef = useRef(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const enqueue = useCallback((action: QueuedAction) => {
    setQueue((current) => sortQueue(dedupeQueue([...current, action])));
    setStatus(`Queued ${action.label}.`);
  }, [setStatus]);

  const enqueueTransfer = useCallback((row: ArmorItem) => {
    enqueue({ id: `transfer:${row.Id}:${Date.now()}`, kind: 'transfer', priority: 10, label: `move ${row.Name}`, row });
  }, [enqueue]);

  const enqueueGroupPull = useCallback((nextRows: ArmorItem[]) => {
    enqueue({ id: `group:${nextRows.map((row) => row.Id).join(',')}:${Date.now()}`, kind: 'group-pull', priority: 10, label: `pull group (${nextRows.length})`, rows: nextRows });
  }, [enqueue]);

  const enqueueLock = useCallback((row: ArmorItem, desiredLock: boolean, reason: QueueReason) => {
    if (!canRunLockAction(row)) {
      patchRow(row.Id, { LockActionState: 'failed' });
      setStatus('Lock action is only available for synced Bungie armor.');
      return;
    }
    patchRow(row.Id, { IsLocked: desiredLock, LockActionState: 'pending' });
    enqueue({
      id: `lock:${row.Id}:${desiredLock}`,
      kind: 'lock',
      priority: 5,
      label: `${desiredLock ? 'lock' : 'unlock'} ${row.Name}`,
      row,
      desiredLock,
      reason
    });
  }, [enqueue, patchRow, setStatus]);

  useEffect(() => {
    if (externalSyncing || runningRef.current || !queue.length) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    runningRef.current = true;
    setLoading(true);
    setError('');
    void runQueuedAction(next, { rowsRef, sync, patchRow, setStatus })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (next.kind === 'lock' && next.row) patchRow(next.row.Id, { LockActionState: 'failed' });
        setError(message);
        setStatus(message);
      })
      .finally(() => {
        runningRef.current = false;
        setLoading(false);
      });
  }, [externalSyncing, patchRow, queue, setError, setLoading, setStatus, sync]);

  return useMemo(() => ({ enqueueTransfer, enqueueGroupPull, enqueueLock, queuedCount: queue.length }), [enqueueGroupPull, enqueueLock, enqueueTransfer, queue.length]);
}

async function runQueuedAction(action: QueuedAction, options: { rowsRef: MutableRefObject<ArmorItem[]>; sync: ActionQueueOptions['sync']; patchRow: ActionQueueOptions['patchRow']; setStatus: ActionQueueOptions['setStatus'] }): Promise<void> {
  const { rowsRef, sync, patchRow, setStatus } = options;
  setStatus(`Running queued ${action.label}...`);
  if (action.kind === 'transfer' && action.row) {
    const row = latestRow(action.row, rowsRef.current);
    const result = await runItemAction(row);
    setStatus(result.message);
    if (result.needsRefresh) await sync({ reason: 'queued-transfer' });
    return;
  }
  if (action.kind === 'group-pull') {
    const result = await runGroupPull((action.rows || []).map((row) => latestRow(row, rowsRef.current)));
    setStatus(result.message);
    if (result.needsRefresh) await sync({ reason: 'queued-group-pull' });
    return;
  }
  if (action.kind === 'lock' && action.row && typeof action.desiredLock === 'boolean') {
    const row = latestRow(action.row, rowsRef.current);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await runLockAction(row, action.desiredLock);
      } catch (error) {
        if (attempt >= 3) throw error;
      }

      await wait(1000 * attempt);
      const synced = await sync({ reason: action.reason || 'queued-lock' });
      const confirmed = synced.find((item) => item.Id === row.Id);
      if (confirmed?.IsLocked === action.desiredLock) {
        patchRow(row.Id, { IsLocked: action.desiredLock, LockActionState: '' });
        setStatus(`${action.desiredLock ? 'Locked' : 'Unlocked'} ${row.Name}.`);
        return;
      }
      patchRow(row.Id, { IsLocked: action.desiredLock, LockActionState: attempt >= 3 ? 'failed' : 'pending' });
      setStatus(`Verifying ${action.desiredLock ? 'lock' : 'unlock'} for ${row.Name}...`);
    }
    throw new Error(`Could not confirm ${action.desiredLock ? 'lock' : 'unlock'} for ${row.Name}.`);
  }
}

function latestRow(row: ArmorItem, rows: ArmorItem[]): ArmorItem {
  return rows.find((item) => item.Id === row.Id) || row;
}

function sortQueue(queue: QueuedAction[]): QueuedAction[] {
  return queue.slice().sort((a, b) => b.priority - a.priority);
}

function dedupeQueue(queue: QueuedAction[]): QueuedAction[] {
  const seen = new Set<string>();
  const out: QueuedAction[] = [];
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const item = queue[index];
    const key = item.kind === 'lock' ? `${item.kind}:${item.row?.Id}:${item.desiredLock}` : item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.unshift(item);
  }
  return out;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
