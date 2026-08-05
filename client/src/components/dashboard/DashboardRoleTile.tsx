import { Paper, Typography } from '@mui/material';
import { useState } from 'react';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/shared';
import { Participant } from '@respond/shared/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';
import { Droppable } from '../DragAndDrop/DnDComponents';

export function DashboardRoleTile({ title, id }: { title: string; id?: string }) {
  const [selected, setSelected] = useState<string | undefined>(id);
  const dispatch = useAppDispatch();
  const activity = useActivityContext();

  const participant = selected ? activity.participants[selected] : undefined;
  const name = participant ? `${participant.firstname} ${participant.lastname}` : 'Unassigned';

  const handleDrop = (p: Participant | null) => {
    setSelected(p?.id);
    if (p && activity && activity.id) {
      dispatch(ActivityActions.updateStaff(activity.id, { [title]: p.id }));
    }
  };

  return (
    <Droppable accepts="participant" onDrop={handleDrop}>
      <Paper variant="outlined" sx={{ p: 1 }}>
        <Typography component="div" variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography component="div" sx={{ color: 'text.secondary' }}>
          {name}
        </Typography>
      </Paper>
    </Droppable>
  );
}
