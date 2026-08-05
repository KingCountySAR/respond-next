import { Box, Typography } from '@mui/material';

import { getOrganizationName, Participant } from '@respond/shared/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';

export default function DashboardParticipantCard({ participant }: { participant: Participant }) {
  const activity = useActivityContext();
  const organizationName = getOrganizationName(activity, participant.organizationId);
  return (
    <Box
      key={participant.id}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 1,
        cursor: 'grab',
        bgcolor: 'background.paper',
        ':hover': {
          bgcolor: 'grey.100',
          // Targets the child element with class 'promote-button' when Stack is hovered
          '& .promote-button': {
            opacity: 1,
            visibility: 'visible',
          },
        },
      }}
    >
      <Typography variant="subtitle2">
        {participant.firstname} {participant.lastname}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {organizationName} {participant.tags?.join(', ')}
      </Typography>
    </Box>
  );
}
