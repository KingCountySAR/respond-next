'use client';

import { ActivityEditForm } from '../../../../../components/activities/ActivityEditForm';

export default function EditMission({ params }: { params: { missionId: string } }) {
  return <ActivityEditForm activityType="missions" activityId={params.missionId} />;
}
