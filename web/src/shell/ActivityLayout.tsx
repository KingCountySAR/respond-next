import type { ReactNode } from 'react';
import { ActivityModelProvider, observer, useFieldActivity } from '@sync/model/react';
import { useSyncClient } from './sync';

/**
 * Opens an activity on the session's SyncClient for the pages under it, which read it with
 * `useFieldActivity()` or `useCommandActivity()`. The legacy ActivityLayout's loading and
 * not-found text.
 */
export function ActivityLayout({ activityId, children }: { activityId: string; children: ReactNode }) {
  return (
    <ActivityModelProvider client={useSyncClient()} activityId={activityId} fallback={<div>Loading activity...</div>}>
      <WhenLoaded>{children}</WhenLoaded>
    </ActivityModelProvider>
  );
}

/**
 * Until the activity record arrives; "Activity not found" once the server says it doesn't have it,
 * or it's been removed. Offline, an activity this browser hasn't seen stays loading.
 */
const WhenLoaded = observer(function WhenLoaded({ children }: { children: ReactNode }) {
  const activity = useFieldActivity();
  const rec = activity.record;
  if (rec && rec.removedAt === null) return <>{children}</>;
  return <div>{rec || activity.missing ? 'Activity not found' : 'Loading activity...'}</div>;
});
