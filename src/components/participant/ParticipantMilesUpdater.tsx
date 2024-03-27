import { useState } from 'react';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { Participant } from '@respond/types/activity';

import { Button, Stack } from '../Material';

import { ParticipantMilesInput } from './ParticipantMilesInput';

export function ParticipantMilesUpdater({ activityId, participant, onCancel, onSubmit }: { activityId: string; participant: Participant; onCancel: () => void; onSubmit: (miles: number) => void }) {
  const dispatch = useAppDispatch();

  const [miles, setMiles] = useState(participant.miles ?? 0);

  const handleChange = (miles: number) => {
    setMiles(miles);
  };

  const handleSubmit = () => {
    dispatch(ActivityActions.participantMilesUpdate(activityId, participant.id, miles));
    onSubmit(miles);
  };

  return (
    <Stack spacing={1}>
      <ParticipantMilesInput currentMiles={participant.miles ?? 0} onChange={handleChange} />
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent={'right'} spacing={2}>
        <Button variant={'outlined'} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={'contained'} onClick={handleSubmit} disabled={participant.miles === miles}>
          Update
        </Button>
      </Stack>
    </Stack>
  );
}
