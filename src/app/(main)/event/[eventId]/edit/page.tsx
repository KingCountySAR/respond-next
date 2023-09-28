'use client';

import { ActivityEditForm } from '@respond/components/activities/ActivityEditForm';

export default function EditEvent({ params }: { params: { eventId: string } }) {
  return <ActivityEditForm activityType="events" activityId={params.eventId} />;
}
