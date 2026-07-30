import { Box, Typography } from '@mui/material';

import { getOrganizationName, Participant } from '@respond/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';
import { Draggable } from '../DragAndDrop/DnDComponents';

export default function DashboardParticipantCard({ participant }: { participant: Participant }) {
  const activity = useActivityContext();
  const organizationName = getOrganizationName(activity, participant.organizationId);
  return (
    <Draggable key={participant.id} type="participant" item={participant}>
      <Box key={participant.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1, cursor: 'grab', bgcolor: 'background.paper' }}>
        <Typography variant="subtitle2">
          {participant.firstname} {participant.lastname}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {organizationName} {participant.tags?.join(', ')}
        </Typography>
      </Box>
    </Draggable>
  );
}
