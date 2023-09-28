'use client';

import { EventEditor } from '../../../EventEditor';

export default function EditMission({ params }: { params: { missionId: string } }) {
  return <EventEditor activityType="missions" eventId={params.missionId} />;
}
