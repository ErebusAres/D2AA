import { useEffect, useRef, useState } from 'react';

interface LiveSyncState {
  enabled: boolean;
  isSyncing: boolean;
  lastSyncAt: number;
}

interface LiveSyncOptions {
  enabled: boolean;
  sync: (options?: { reason?: string; background?: boolean }) => Promise<void>;
  onStatus: (status: string) => void;
  intervalMs?: number;
}

export function useLiveSync({ enabled, sync, onStatus, intervalMs = 60_000 }: LiveSyncOptions): LiveSyncState {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(0);
  const inFlight = useRef(false);
  const lastAttemptAt = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setIsSyncing(false);
      return undefined;
    }

    let cancelled = false;
    let timer: number | undefined;

    const run = async (trigger: 'timer' | 'visible' | 'online' | 'initial') => {
      if (cancelled || inFlight.current) return;
      if (document.visibilityState !== 'visible' || navigator.onLine === false) return;
      const now = Date.now();
      if (trigger !== 'initial' && now - lastAttemptAt.current < intervalMs * 0.75) return;
      inFlight.current = true;
      lastAttemptAt.current = now;
      setIsSyncing(true);
      try {
        await sync({ reason: 'live-sync', background: true });
        setLastSyncAt(Date.now());
      } catch (error: unknown) {
        onStatus(error instanceof Error ? error.message : String(error));
      } finally {
        inFlight.current = false;
        if (!cancelled) setIsSyncing(false);
      }
    };

    const schedule = () => {
      timer = window.setInterval(() => void run('timer'), intervalMs);
      window.setTimeout(() => void run('initial'), Math.min(15_000, intervalMs));
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void run('visible'); };
    const onOnline = () => void run('online');

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    schedule();

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, intervalMs, onStatus, sync]);

  return { enabled, isSyncing, lastSyncAt };
}
