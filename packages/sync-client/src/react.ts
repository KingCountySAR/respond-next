import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { EventSnapshot } from '@sync/core';
import type { RejectionNotice, SyncClient, SyncStatus } from './syncClient';

/** The event's current view; re-renders when it changes. The event must already be open. */
export function useEventSnapshot(client: SyncClient, eventId: string): EventSnapshot {
  const subscribe = useCallback((cb: () => void) => client.subscribe(eventId, cb), [client, eventId]);
  return useSyncExternalStore(subscribe, () => client.snapshot(eventId));
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
