'use client';

import ActivityKiosk from '@respond/components/activities/ActivityKiosk';

export default function Kiosk({ params }: { params: { missionId: string } }) {
  return <ActivityKiosk activityId={params.missionId} />;
}
