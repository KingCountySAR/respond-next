'use client';

import type { Activity } from '@respond/shared/types/activity';
import { useEffect, useState } from 'react';

import { apiFetch } from '@respond/lib/api';
import { useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector } from '@respond/lib/client/store/activities';

import { ActivityProvider } from './ActivityProvider';

export default function ActivityLayout({ children, activityId }: { children: React.ReactNode; activityId: string }) {
  const activity = useAppSelector(buildActivitySelector(activityId));
  const [fetchedActivity, setFetchedActivity] = useState<Activity | null | undefined>(activity ?? undefined);
  const displayActivity = activity ?? fetchedActivity;

  useEffect(() => {
    if (activity) return;

    let cancelled = false;
    setFetchedActivity(undefined);

    apiFetch<{ data?: Activity }>(`/api/v1/activities/${activityId}`)
      .then((response) => {
        if (cancelled) return;
        setFetchedActivity(response.data ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchedActivity(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activity, activityId]);

  if (displayActivity === undefined) return <div>Loading activity...</div>;
  if (displayActivity === null) return <div>Activity not found</div>;

  return <ActivityProvider activity={displayActivity}>{children}</ActivityProvider>;
}
