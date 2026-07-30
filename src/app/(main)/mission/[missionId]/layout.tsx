import ActivityLayout from '@respond/components/activities/ActivityLayout';

export default function MissionActivityLayout({ children, params }: { children: React.ReactNode; params: { missionId: string } }) {
  return <ActivityLayout activityId={params.missionId}>{children}</ActivityLayout>;
}
