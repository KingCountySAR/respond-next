'use client';

import { ActivityPage } from '@respond/components/activities/ActivityPage';

export default function ViewEvent({ params }: { params: { eventId: string } }) {
  return <ActivityPage activityId={params.eventId} />;
}
