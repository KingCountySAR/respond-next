import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';

import { getOrganizationName, Participant, ParticipantStatus } from '@respond/shared/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';

import { DashboardDraggableContainer } from './DashboardDraggableContainer';

export function DashboardTeamMember({ participant, onPromote }: { participant: Participant; onPromote?: () => void }) {
  const activity = useActivityContext();
  const participantStatus: ParticipantStatus = participant.timeline?.[0]?.status;
  const organizationName = getOrganizationName(activity, participant.organizationId);
  return (
    <DashboardDraggableContainer variant="compact" sx={{ bgcolor: participantStatus !== ParticipantStatus.Assigned ? '#f0bcbc' : 'background.paper' }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          ':hover': {
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
          <Tooltip title={'Promote to Team Leader'}>
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
          </Tooltip>
        )}
      </Stack>
    </DashboardDraggableContainer>
  );
}
