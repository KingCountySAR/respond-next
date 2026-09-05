import { Stack, Typography } from '@mui/material';

import { getOrganizationName, Participant, ParticipantStatus } from '@respond/shared/types/activity';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';

import { DashboardDraggableContainer } from './DashboardDraggableContainer';
import { DashboardParticipantStatusButton } from './DashboardParticipantStatusButton';

function format24HourTime(value: number) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(value);
}

export default function DashboardParticipantCard({ participant }: { participant: Participant }) {
  const activity = useActivityContext();
  const organizationName = getOrganizationName(activity, participant.organizationId);
  const isAvailable = participant.timeline[0].status === ParticipantStatus.Available;

  return (
    <DashboardDraggableContainer variant="compact" disabled={!isAvailable}>
      <Stack direction="column" spacing={0.25} sx={{ width: '100%' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">
            {participant.firstname} {participant.lastname}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {!isAvailable && participant.eta ? `ETA: ${format24HourTime(participant.eta)}` : ''}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {organizationName} {participant.tags?.join(', ')}
          </Typography>
          {!isAvailable && <DashboardParticipantStatusButton participant={participant} status={ParticipantStatus.Available} />}
        </Stack>
      </Stack>
    </DashboardDraggableContainer>
  );
}
