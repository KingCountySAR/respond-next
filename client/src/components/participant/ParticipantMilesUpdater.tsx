import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { ParticipantDomainModel } from '@/client/models/participantDomainModel';

import { Button, Stack } from '../Material';

import { ParticipantMilesInput } from './ParticipantMilesInput';

export const ParticipantMilesUpdater = observer(function ParticipantMilesUpdater({
  participant,
  onCancel,
  onSubmit,
}: {
  participant: Pick<ParticipantDomainModel, 'miles' | 'updateMiles'>;
  onCancel: () => void;
  onSubmit: (miles: number) => void;
}) {
  const currentMiles = participant.miles ?? 0;
  const [miles, setMiles] = useState(currentMiles);

  const handleChange = (miles: number | string) => {
    setMiles(Number(miles));
  };

  const handleSubmit = () => {
    participant.updateMiles(miles);
    onSubmit(miles);
  };

  return (
    <Stack spacing={1}>
      <ParticipantMilesInput currentMiles={currentMiles} value={miles} onChange={handleChange} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'right' }}>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={currentMiles === miles}>
          Update
        </Button>
      </Stack>
    </Stack>
  );
});
