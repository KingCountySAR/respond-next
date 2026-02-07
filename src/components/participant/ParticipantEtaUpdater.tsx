import AccessTime from '@mui/icons-material/AccessTime';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { format as formatDate } from 'date-fns';
import { useEffect, useState } from 'react';

import { useDebounce } from '@respond/hooks/useDebounce';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';

import { InlineTimeEdit } from '../InlineTimeEdit';
import { Button, IconButton, Stack, Typography } from '../Material';

const toMilliseconds = (minutes: number) => minutes * 60 * 1000;

export function ParticipantEtaUpdater({ activityId, participantId, participantEta }: { activityId: string; participantId: string; participantEta?: number }) {
  const dispatch = useAppDispatch();

  const { etaIncrement, etaPreset1, etaPreset2, etaPreset3 } = useAppSelector((state) => state.preferences);

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
          <IconButton onClick={() => setEta(eta - toMilliseconds(etaIncrement))}>
            <RemoveIcon />
          </IconButton>
          <IconButton onClick={() => setEta(eta + toMilliseconds(etaIncrement))}>
            <AddIcon />
          </IconButton>
          <Button onClick={() => setEta(null)}>clear</Button>
        </>
      )}
      {!editing && !eta && (
        <>
          <Typography variant="h6">ETA</Typography>
          <Stack direction={'row'} spacing={2} alignItems={'center'} justifyContent={'space-between'}>
            <IconButton onClick={() => setEta(new Date().getTime() + toMilliseconds(etaPreset1))}>{etaPreset1}</IconButton>
            <IconButton onClick={() => setEta(new Date().getTime() + toMilliseconds(etaPreset2))}>{etaPreset2}</IconButton>
            <IconButton onClick={() => setEta(new Date().getTime() + toMilliseconds(etaPreset3))}>{etaPreset3}</IconButton>
            <IconButton onClick={() => setEditing(true)}>
              <AccessTime />
            </IconButton>
          </Stack>
        </>
      )}
    </Stack>
  );
}
