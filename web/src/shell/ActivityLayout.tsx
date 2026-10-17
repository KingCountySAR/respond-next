import type { ReactNode } from 'react';
import { ActivityModelProvider, observer, useFieldActivity } from '@sync/model/react';
import { useSyncClient } from './sync';

/**
 * Opens an activity on the session's SyncClient for the pages under it, which read it with
 * `useFieldActivity()` or `useCommandActivity()`. The legacy ActivityLayout's loading text.
 */
export function ActivityLayout({ activityId, children }: { activityId: string; children: ReactNode }) {
  return (
    <ActivityModelProvider client={useSyncClient()} activityId={activityId} fallback={<div>Loading activity...</div>}>
      <WhenLoaded>{children}</WhenLoaded>
    </ActivityModelProvider>
  );
}

/**
 * Until the activity record arrives. The client can't yet tell "not on the server" from "not
 * synced yet", so there's no "Activity not found" until it can.
 */
const WhenLoaded = observer(function WhenLoaded({ children }: { children: ReactNode }) {
  return useFieldActivity().record ? <>{children}</> : <div>Loading activity...</div>;
});
