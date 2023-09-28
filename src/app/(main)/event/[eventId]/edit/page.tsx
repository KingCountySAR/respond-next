'use client';

import { EventEditor } from '../../../EventEditor';

export default function EditEvent({ params }: { params: { eventId: string } }) {
  return <EventEditor activityType="events" eventId={params.eventId} />;
}
