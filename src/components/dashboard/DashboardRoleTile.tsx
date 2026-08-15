import ClearIcon from '@mui/icons-material/Clear';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { Participant } from '@respond/types/activity';
import { CommunicationsLogEntry, createNewCommsEntry } from '@respond/types/operations';

import { useActivityContext } from '../activities/ActivityProvider';
import { Droppable } from '../DragAndDrop/DnDComponents';

export function DashboardRoleTile({ title, id }: { title: string; id?: string }) {
  const dispatch = useAppDispatch();
  const activity = useActivityContext();

  const selectedId = activity.staff?.[title] ?? id;
  const participant = selectedId ? activity.participants[selectedId] : undefined;
  const name = participant ? `${participant.firstname} ${participant.lastname}` : 'Unassigned';

  const handleDrop = (p: Participant | null) => {
    if (!p || selectedId === p.id) return;
    if (p && activity && activity.id) {
      dispatch(ActivityActions.updateStaff(activity.id, { [title]: p.id }));
      autoLog(`${p.firstname} ${p.lastname} assuming ${title}`);
    }
  };

  const handleDelete = (): void => {
    if (activity && activity.id) {
      dispatch(ActivityActions.updateStaff(activity.id, { [title]: '' }));
      autoLog(`${title} unassigned`);
    }
  };

  const autoLog = (message: string) => {
    const comm: CommunicationsLogEntry = createNewCommsEntry({
      from: 'CP',
      message: message,
      isAutomated: true,
    });
    dispatch(ActivityActions.addComm(activity.id, comm));
  };

  return (
    <Droppable accepts="participant" onDrop={handleDrop}>
      <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
        <Box sx={{ '&:hover .action': { opacity: 1, visibility: 'visible' } }}>
          <Typography component="div" variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography component="div" sx={{ color: 'text.secondary' }}>
              {name}
            </Typography>
            <IconButton className="action" onClick={handleDelete} size="small" aria-label="delete communication" sx={{ opacity: 0, visibility: 'hidden', transition: 'opacity 180ms ease' }}>
              <ClearIcon sx={{ fontSize: 16, color: 'darkred' }} />
            </IconButton>
          </Stack>
        </Box>
      </Paper>
    </Droppable>
  );
}
