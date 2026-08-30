import { Stack, Typography } from '@mui/material';

import { getOrganizationName, Participant, ParticipantStatus } from '@respond/shared/types/activity';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';

import { DashboardDraggableContainer } from './DashboardDraggableContainer';
import { DashboardParticipantStatusButton } from './DashboardParticipantStatusButton';

export function DashboardTeamMember({ participant }: { participant: Participant }) {
  const activity = useActivityContext();
  const participantStatus: ParticipantStatus = participant.timeline?.[0]?.status;
  const organizationName = getOrganizationName(activity, participant.organizationId);
  const isAssigned = participantStatus === ParticipantStatus.Assigned;
  return (
    <DashboardDraggableContainer variant="compact" sx={{ bgcolor: !isAssigned ? '#f0bcbc' : 'background.paper' }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          flex: 1,
          minWidth: 0,
          width: '100%',
        }}
      >
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {participant.firstname} {participant.lastname} ({organizationName})
        </Typography>
        {!isAssigned && <DashboardParticipantStatusButton participant={participant} status={ParticipantStatus.Assigned} />}
      </Stack>
    </DashboardDraggableContainer>
  );
}
