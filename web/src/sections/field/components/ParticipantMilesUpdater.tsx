import { Button, Stack } from '@mui/material';
import { useState } from 'react';
import type { FieldParticipant } from '@sync/model';
import { observer } from '@sync/model/react';
import { ParticipantMilesInput } from '../../../ui/ParticipantMilesInput';
import { useChange } from '../useChange';

export const ParticipantMilesUpdater = observer(function ParticipantMilesUpdater({
  participant,
  currentMiles,
  onCancel,
  onSubmit,
}: {
  participant: FieldParticipant;
  currentMiles: number;
  onCancel: () => void;
  onSubmit: (miles: number) => void;
}) {
  const change = useChange();
  const [miles, setMiles] = useState(currentMiles);

  const handleChange = (miles: number | string) => {
    setMiles(Number(miles));
  };

  const handleSubmit = () => {
    if (change(() => participant.setMiles(miles))) onSubmit(miles);
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
