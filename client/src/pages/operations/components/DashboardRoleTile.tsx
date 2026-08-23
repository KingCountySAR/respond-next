import ClearIcon from '@mui/icons-material/Clear';
import GroupsIcon from '@mui/icons-material/Groups';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import { useTeamCommands } from '@respond/lib/client/services/teams';
import { Participant } from '@respond/shared/types/activity';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';
import ConfirmDialog from '@/client/components/ConfirmDialog';
import { Droppable } from '@/client/components/DragAndDrop/DnDComponents';

export function DashboardRoleTile({ title, id }: { title: string; id?: string }) {
  const teams = useTeamCommands();
  const activity = useActivityContext();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const selectedId = activity.staff?.[title] ?? id;
  const participant = selectedId ? activity.participants[selectedId] : undefined;
  const name = participant ? `${participant.firstname} ${participant.lastname}` : 'Unassigned';

  // The team-comms reactor logs the "assuming"/"unassigned" comm server-side.
  const handleDrop = (p: Participant | null) => {
    if (!p || selectedId === p.id) return;
    if (p && activity && activity.id) {
      teams.updateStaff(activity.id, { [title]: p.id });
    }
  };

  const handleDelete = (): void => {
    setConfirmClearOpen(true);
  };

  const confirmDelete = (): void => {
    if (activity && activity.id) {
      teams.updateStaff(activity.id, { [title]: '' });
    }
  };

  return (
    <>
      <Droppable accepts="participant" onDrop={handleDrop}>
        <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
          <Box sx={{ '&:hover .action': { opacity: 1, visibility: 'visible' } }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <GroupsIcon fontSize="small" />
              <Typography component="div" variant="subtitle1" sx={{ fontWeight: 700 }}>
                {title}
              </Typography>
            </Stack>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', spacing: 1 }}>
              <Typography component="div" sx={{ color: 'text.secondary' }}>
                {name}
              </Typography>
              {participant && (
                <IconButton className="action" onClick={handleDelete} size="small" aria-label="delete communication" sx={{ opacity: 0, visibility: 'hidden', transition: 'opacity 180ms ease' }}>
                  <ClearIcon sx={{ fontSize: 16, color: 'darkred' }} />
                </IconButton>
              )}
            </Stack>
          </Box>
        </Paper>
      </Droppable>
      <ConfirmDialog open={confirmClearOpen} prompt={`Unassign ${name} from ${title}?`} destructive={true} label="Unassign" onConfirm={confirmDelete} onClose={() => setConfirmClearOpen(false)} />
    </>
  );
}
