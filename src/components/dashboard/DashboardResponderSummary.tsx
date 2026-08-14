import { ParticipantStatus } from '@respond/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';

import { DashboardMetricTile } from './DashboardMetricTile';

export function DashboardResponderSummary() {
  const activity = useActivityContext();

  const participantTotals = Object.values(activity.participants).reduce(
    (counts, participant) => {
      const status = participant.timeline?.[0]?.status;

      if (status === ParticipantStatus.SignedIn) {
        counts.Responding += 1;
      } else if (status === ParticipantStatus.Available) {
        counts.Available += 1;
      } else if (status === ParticipantStatus.Assigned) {
        counts.Assigned += 1;
      }

      return counts;
    },
    { Responding: 0, Available: 0, Assigned: 0 },
  );

  const fieldResources = Object.values(activity.teams ?? [])?.reduce((count, team) => {
    if (['In Base', 'Disbanded'].includes(team.status)) return count;
    return count + team.assignedParticipants.length;
  }, 0);

  const summaryLines = [
    ['Responding', participantTotals.Responding],
    ['Available', participantTotals.Available],
    // ['Assigned', participantTotals.Assigned],
    ['Field', fieldResources],
  ] as const;

  return (
    <>
      {summaryLines.map(([label, count]) => (
        <DashboardMetricTile key={label} label={label} value={count.toString()} />
      ))}
    </>
  );
}
