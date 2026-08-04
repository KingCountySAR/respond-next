import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import { IconButton, Stack, Typography } from '@mui/material';

import { getOrganizationName, Participant, ParticipantStatus } from '@respond/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';

export function DashboardTeamMember({ participant, onPromote }: { participant: Participant; onPromote?: () => void }) {
  const activity = useActivityContext();
  const participantStatus: ParticipantStatus = participant.timeline?.[0]?.status;
  const organizationName = getOrganizationName(activity, participant.organizationId);
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        borderRadius: 1,
        px: 1,
        py: 0.75,
        bgcolor: participantStatus !== ParticipantStatus.Assigned ? '#ffd7d7' : undefined,
        ':hover': {
          bgcolor: participantStatus !== ParticipantStatus.Assigned ? '#f0bcbc' : 'grey.100',
          // Targets the child element with class 'promote-button' when Stack is hovered
          '& .promote-button': {
            opacity: 1,
            visibility: 'visible',
          },
        },
      }}
    >
      <Typography variant="body2" sx={{ flexGrow: 1 }}>
        {participant.firstname} {participant.lastname} ({organizationName})
      </Typography>

      {!!onPromote && (
        <IconButton
          className="promote-button"
          onClick={(event) => {
            event.stopPropagation();
            onPromote?.();
          }}
          size="small"
          disableRipple // Optional: prevents grey ripple effect on click
          sx={{
            width: 16,
            height: 16,
            opacity: 0,
            visibility: 'hidden',
            transition: 'opacity 0.2s ease-in-out',
            bgcolor: 'transparent',
            ':hover': {
              bgcolor: 'transparent', // Ensures button stays transparent even when directly hovered
            },
          }}
        >
          <KeyboardDoubleArrowUpIcon sx={{ fontSize: 14 }} />
        </IconButton>
      )}
    </Stack>
  );
}
