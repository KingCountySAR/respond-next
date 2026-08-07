import { Typography } from '@mui/material';

import { getOrganizationName, Participant } from '@respond/shared/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';

import { DashboardDraggableContainer } from './DashboardDraggableContainer';

export default function DashboardParticipantCard({ participant }: { participant: Participant }) {
  const activity = useActivityContext();
  const organizationName = getOrganizationName(activity, participant.organizationId);
  return (
    <DashboardDraggableContainer>
      <Typography variant="subtitle2">
        {participant.firstname} {participant.lastname}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {organizationName} {participant.tags?.join(', ')}
      </Typography>
    </DashboardDraggableContainer>
  );
}
