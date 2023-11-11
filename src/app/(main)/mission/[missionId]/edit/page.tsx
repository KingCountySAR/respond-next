'use client';

import { ActivityEditPage } from '@respond/components/activities/ActivityEditPage';

export default function EditMission({ params }: { params: { missionId: string } }) {
  return <ActivityEditPage activityType="missions" activityId={params.missionId} />;
}
