import { Stack, Typography } from '@mui/material';

import { getOrganizationName, Participant, ParticipantStatus } from '@respond/shared/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';

import { DashboardDraggableContainer } from './DashboardDraggableContainer';

function format24HourTime(value: number) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(value);
}

export default function DashboardParticipantCard({ participant }: { participant: Participant }) {
  const activity = useActivityContext();
  const organizationName = getOrganizationName(activity, participant.organizationId);
  return (
    <DashboardDraggableContainer variant="compact" disabled={participant.timeline[0].status !== ParticipantStatus.Available}>
      <Stack direction="column" spacing={0.25} sx={{ width: '100%' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2">
            {participant.firstname} {participant.lastname}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {participant.eta ? `ETA: ${format24HourTime(participant.eta)}` : ''}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">
            {organizationName} {participant.tags?.join(', ')}
          </Typography>
        </Stack>
      </Stack>
    </DashboardDraggableContainer>
  );
}
