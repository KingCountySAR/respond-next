'use client';
import { RosterEdit } from '@respond/components/activities/RosterEdit';

export default function EditRoster({ params }: { params: { activityId: string } }) {
  return <RosterEdit activityId={params.activityId} />;
}
