import ActivityLayout from '@respond/components/activities/ActivityLayout';

export default function EventActivityLayout({ children, params }: { children: React.ReactNode; params: { eventId: string } }) {
  return <ActivityLayout activityId={params.eventId}>{children}</ActivityLayout>;
}
