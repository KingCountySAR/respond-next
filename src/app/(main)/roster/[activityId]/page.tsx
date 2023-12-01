'use client';
import { RosterView } from '@respond/components/activities/RosterView';

export default function EditRoster({ params }: { params: { activityId: string } }) {
  return <RosterView activityId={params.activityId} />;
}
