import { useState } from 'react';

import { useParticipantCommands } from '@respond/lib/client/services/participants';
import { Participant } from '@respond/shared/types/activity';

import { Button, Stack } from '../Material';

import { ParticipantMilesInput } from './ParticipantMilesInput';

export function ParticipantMilesUpdater({ activityId, participant, onCancel, onSubmit }: { activityId: string; participant: Participant; onCancel: () => void; onSubmit: (miles: number) => void }) {
  const participants = useParticipantCommands();

  const [miles, setMiles] = useState(participant.miles ?? 0);

  const handleChange = (miles: number | string) => {
    setMiles(Number(miles));
  };

  const handleSubmit = () => {
    participants.updateMiles(activityId, participant.id, miles);
    onSubmit(miles);
  };

  return (
    <Stack spacing={1}>
      <ParticipantMilesInput currentMiles={participant.miles ?? 0} value={miles} onChange={handleChange} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'right' }}>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={participant.miles === miles}>
          Update
        </Button>
      </Stack>
    </Stack>
  );
}
