'use client';
import { RosterReview } from '@respond/components/activities/RosterView';

export default function ViewRoster({ params }: { params: { activityId: string } }) {
  return <RosterReview activityId={params.activityId} />;
}
