import { ButtonBase, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import { useActivityContext } from '../activities/ActivityProvider';

import { ParticipantMilesUpdater } from './ParticipantMilesUpdater';
import { useParticipantContext } from './ParticipantProvider';

export function ParticipantMiles() {
  const activity = useActivityContext();
  const participant = useParticipantContext();
  const [miles, setMiles] = useState(participant.miles ?? 0);
  const [edit, setEdit] = useState(false);
  return (
    <>
      {!edit && (
        <ButtonBase sx={{ width: '100%' }} onClick={() => setEdit(true)}>
          <Stack sx={{ width: '100%' }} direction={'row'} spacing={2} justifyContent={'space-between'}>
            <Typography variant="h6">Total Miles:</Typography>
            <Typography variant="h6" flexGrow={1} align={'right'}>
              {miles}
            </Typography>
          </Stack>
        </ButtonBase>
      )}
      {edit && (
        <>
          <Typography variant="h6">Updating Miles</Typography>
          <ParticipantMilesUpdater
            activityId={activity.id}
            participant={{ ...participant, miles: miles }}
            onCancel={() => setEdit(false)}
            onSubmit={(newMiles) => {
              setMiles(newMiles);
              setEdit(false);
            }}
          />
        </>
      )}
    </>
  );
}
