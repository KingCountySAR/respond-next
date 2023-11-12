'use client';

import { ActivityEditPage } from '@respond/components/activities/ActivityEditPage';

export default function EditEvent({ params }: { params: { eventId: string } }) {
  return <ActivityEditPage activityType="events" activityId={params.eventId} />;
}
