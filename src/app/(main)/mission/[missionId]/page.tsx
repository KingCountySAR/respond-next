'use client';

import { EventPage } from '../../EventPage';

export default function ViewMission({ params }: { params: { missionId: string } }) {
  return <EventPage eventId={params.missionId} />;
}
