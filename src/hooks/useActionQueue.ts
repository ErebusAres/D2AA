import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { ArmorItem } from '../types/armor';
import { canRunAction, canRunLockAction, runGroupPull, runItemAction, runLockAction } from '../data/actions';

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
  const [runningAction, setRunningAction] = useState<QueuedAction | null>(null);
  const runningRef = useRef(false);
  const verifyTimerRef = useRef<number | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const scheduleVerifySync = useCallback(() => {
    if (verifyTimerRef.current) window.clearTimeout(verifyTimerRef.current);
    verifyTimerRef.current = window.setTimeout(() => {
      verifyTimerRef.current = null;
      if (runningRef.current || externalSyncing) {
        scheduleVerifySync();
        return;
      }
      void sync({ reason: 'queued-action-verify', background: true }).catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : String(error));
      });
    }, 3500);
  }, [externalSyncing, setStatus, sync]);

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
    setRunningAction(next);
    setLoading(true);
    setError('');
    void runQueuedAction(next, { rowsRef, patchRow, setStatus, scheduleVerifySync })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (next.kind === 'lock' && next.row) patchRow(next.row.Id, { LockActionState: 'failed' });
        setError(message);
        setStatus(message);
      })
      .finally(() => {
        runningRef.current = false;
        setRunningAction(null);
        setLoading(false);
      });
  }, [externalSyncing, patchRow, queue, scheduleVerifySync, setError, setLoading, setStatus]);

  useEffect(() => () => {
    if (verifyTimerRef.current) window.clearTimeout(verifyTimerRef.current);
  }, []);

  return useMemo(() => ({
    enqueueTransfer,
    enqueueGroupPull,
    enqueueLock,
    queuedCount: queue.length + (runningAction ? 1 : 0),
    runningLabel: runningAction?.label || ''
  }), [enqueueGroupPull, enqueueLock, enqueueTransfer, queue.length, runningAction]);
}

async function runQueuedAction(action: QueuedAction, options: { rowsRef: MutableRefObject<ArmorItem[]>; patchRow: ActionQueueOptions['patchRow']; setStatus: ActionQueueOptions['setStatus']; scheduleVerifySync: () => void }): Promise<void> {
  const { rowsRef, patchRow, setStatus, scheduleVerifySync } = options;
  setStatus(`Running queued ${action.label}...`);
  if (action.kind === 'transfer' && action.row) {
    const row = latestRow(action.row, rowsRef.current);
    const result = await runItemAction(row);
    if (row.Source === 'Bungie' && result.needsRefresh) patchRow(row.Id, optimisticTransferPatch(row));
    setStatus(result.message);
    if (result.needsRefresh) scheduleVerifySync();
    return;
  }
  if (action.kind === 'group-pull') {
    const latestRows = (action.rows || []).map((row) => latestRow(row, rowsRef.current));
    const pullable = latestRows.filter((row) => row.Source === 'Bungie' && row.IsInVault && canRunAction(row));
    const result = await runGroupPull(latestRows);
    if (result.needsRefresh) {
      for (const row of pullable) patchRow(row.Id, optimisticTransferPatch(row));
    }
    setStatus(result.message);
    if (result.needsRefresh) scheduleVerifySync();
    return;
  }
  if (action.kind === 'lock' && action.row && typeof action.desiredLock === 'boolean') {
    const row = latestRow(action.row, rowsRef.current);
    await runLockAction(row, action.desiredLock);
    patchRow(row.Id, { IsLocked: action.desiredLock, LockActionState: '' });
    setStatus(`${action.desiredLock ? 'Locked' : 'Unlocked'} ${row.Name}.`);
    scheduleVerifySync();
  }
}

function optimisticTransferPatch(row: ArmorItem): Partial<ArmorItem> {
  const now = Date.now();
  if (row.IsInVault) {
    return {
      IsInVault: false,
      IsEquipped: false,
      OwnerCharacterId: String(row.TargetCharacterId || row.OwnerCharacterId || ''),
      ActivityAt: now,
      LocationSignature: ['inventory', row.TargetCharacterId || row.OwnerCharacterId || '', row.BucketHash || ''].join('|')
    };
  }
  return {
    IsInVault: true,
    IsEquipped: false,
    OwnerCharacterId: '',
    ActivityAt: now,
    LocationSignature: ['vault', '', row.BucketHash || ''].join('|')
  };
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
