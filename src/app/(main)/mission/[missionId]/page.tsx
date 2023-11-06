'use client';

import { ActivityPage } from '@respond/components/activities/ActivityPage';

export default function ViewMission({ params }: { params: { missionId: string } }) {
  return <ActivityPage activityId={params.missionId} />;
}
