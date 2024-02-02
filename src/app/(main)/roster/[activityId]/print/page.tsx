'use client';
import { RosterPrint } from '@respond/components/activities/RosterView';

export default function ViewPrintRoster({ params }: { params: { activityId: string } }) {
  return <RosterPrint activityId={params.activityId} />;
}
