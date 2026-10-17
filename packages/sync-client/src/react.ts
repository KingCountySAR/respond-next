import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ActivitySnapshot } from '@sync/core';
import type { RejectionNotice, SyncClient, SyncStatus } from './syncClient';

/** The activity's current view; re-renders when it changes. The activity must already be open. */
export function useActivitySnapshot(client: SyncClient, activityId: string): ActivitySnapshot {
  const subscribe = useCallback((cb: () => void) => client.subscribe(activityId, cb), [client, activityId]);
  return useSyncExternalStore(subscribe, () => client.snapshot(activityId));
}

export function useSyncStatus(client: SyncClient): SyncStatus {
  const subscribe = useCallback((cb: () => void) => client.onStatus(cb), [client]);
  return useSyncExternalStore(subscribe, () => client.status);
}

/** The most recent rejections, newest first. */
export function useRejections(client: SyncClient, limit = 10): RejectionNotice[] {
  const [items, setItems] = useState<RejectionNotice[]>([]);
  useEffect(() => client.onReject((r) => setItems((prev) => [r, ...prev].slice(0, limit))), [client, limit]);
  return items;
}
