import AccessTime from '@mui/icons-material/AccessTime';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { format as formatDate } from 'date-fns';
import { useEffect, useState } from 'react';

import { useDebounce } from '@respond/hooks/useDebounce';
import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';

import { InlineTimeEdit } from '../InlineTimeEdit';
import { Button, IconButton, Stack, Typography } from '../Material';

const ONE_MINUTE_MILLISECONDS = 60 * 1000;
const FIFTEEN_MINUTES_MILLISECONDS = 15 * 60 * 1000;
const THIRTY_MINUTES_MILLISECONDS = 30 * 60 * 1000;
const SIXTY_MINUTES_MILLISECONDS = 60 * 60 * 1000;

export function ParticipantEtaUpdater({ activityId, participantId, participantEta }: { activityId: string; participantId: string; participantEta?: number }) {
  const dispatch = useAppDispatch();

  const [eta, setEta] = useState<number | undefined | null>(participantEta);
  const [editing, setEditing] = useState(false);
  const debouncedEta = useDebounce(eta, 1000);

  useEffect(() => {
    dispatch(ActivityActions.participantEtaUpdate(activityId, participantId, debouncedEta));
  }, [debouncedEta, activityId, participantId, dispatch]);

  return (
    <Stack direction={'row'} spacing={2} alignItems={'center'} justifyContent={'space-between'}>
      {editing && (
        <InlineTimeEdit
          label="ETA"
          format="MM/dd HH:mm"
          openTo="hours"
          onChange={(time) => {
            if (time) setEta(new Date(time).getTime());
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}
      {!editing && eta && (
        <>
          <Typography variant="h6">ETA</Typography>
          <Typography variant="h6">{formatDate(eta, 'HHmm')}</Typography>
          <IconButton onClick={() => setEta(eta - ONE_MINUTE_MILLISECONDS)}>
            <RemoveIcon />
          </IconButton>
          <IconButton onClick={() => setEta(eta + ONE_MINUTE_MILLISECONDS)}>
            <AddIcon />
          </IconButton>
          <Button onClick={() => setEta(null)}>clear</Button>
        </>
      )}
      {!editing && !eta && (
        <>
          <Typography variant="h6">ETA</Typography>
          <Stack direction={'row'} spacing={2} alignItems={'center'} justifyContent={'space-between'}>
            <IconButton onClick={() => setEta(new Date().getTime() + FIFTEEN_MINUTES_MILLISECONDS)}>15</IconButton>
            <IconButton onClick={() => setEta(new Date().getTime() + THIRTY_MINUTES_MILLISECONDS)}>30</IconButton>
            <IconButton onClick={() => setEta(new Date().getTime() + SIXTY_MINUTES_MILLISECONDS)}>60</IconButton>
            <IconButton onClick={() => setEditing(true)}>
              <AccessTime />
            </IconButton>
          </Stack>
        </>
      )}
    </Stack>
  );
}
