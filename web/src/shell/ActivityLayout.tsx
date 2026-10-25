import type { ReactNode } from 'react';
import type { ActivityList } from '@sync/model';
import { ActivityModelProvider, observer, useActivityList, useRespondActivity } from '@sync/model/react';
import { useSyncClient } from './sync';

/**
 * Opens an activity on the session's SyncClient for the pages under it, which read it with
 * `useRespondActivity()` or `useManageActivity()`. The legacy ActivityLayout's loading and
 * not-found text.
 *
 * Only an open activity is live. One the activity list has as closed, or doesn't have (closed long
 * ago), is read once over HTTP and not kept offline; it goes live if the list shows it open again
 * (someone reactivated it) or when a change is made to it here.
 */
export function ActivityLayout({ activityId, children }: { activityId: string; children: ReactNode }) {
  const list = useActivityList(useSyncClient());
  if (!list) return <div>Loading activity...</div>;
  return (
    <Opened list={list} activityId={activityId}>
      {children}
    </Opened>
  );
}

const Opened = observer(function Opened({ list, activityId, children }: { list: ActivityList; activityId: string; children: ReactNode }) {
  const live = list.item(activityId)?.isActive ?? false;
  return (
    <ActivityModelProvider client={useSyncClient()} activityId={activityId} live={live} fallback={<div>Loading activity...</div>}>
      <WhenLoaded>{children}</WhenLoaded>
    </ActivityModelProvider>
  );
});

/**
 * Until the activity record arrives; "Activity not found" once the server says it doesn't have it,
 * or it's been removed. Offline, an activity this browser hasn't seen stays loading.
 */
const WhenLoaded = observer(function WhenLoaded({ children }: { children: ReactNode }) {
  const activity = useRespondActivity();
  const rec = activity.record;
  if (rec && rec.removedAt === null) return <>{children}</>;
  return <div>{rec || activity.missing ? 'Activity not found' : 'Loading activity...'}</div>;
});
