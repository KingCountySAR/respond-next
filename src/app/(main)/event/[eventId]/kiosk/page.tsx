'use client';

import ActivityKiosk from '@respond/components/activities/ActivityKiosk';

export default function Kiosk({ params }: { params: { eventId: string } }) {
  return <ActivityKiosk activityId={params.eventId} />;
}
