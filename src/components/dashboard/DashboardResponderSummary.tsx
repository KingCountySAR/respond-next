import { Typography } from '@mui/material';

import { ParticipantStatus } from '@respond/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';

import { DashboardBoxWithTitle } from './DashboardBoxWithTitle';

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
    ['Field', fieldResources],
    ['Assigned', participantTotals.Assigned],
    ['Available', participantTotals.Available],
    ['Responding', participantTotals.Responding],
  ] as const;

  return (
    <DashboardBoxWithTitle title="Responders" collapsible>
      {summaryLines.map(([label, count]) => (
        <Typography key={label} variant="subtitle1">
          {`${label} (${count})`}
        </Typography>
      ))}
    </DashboardBoxWithTitle>
  );
}
