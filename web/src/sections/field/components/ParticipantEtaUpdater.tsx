import AccessTime from '@mui/icons-material/AccessTime';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { Button, ButtonBase, IconButton, Stack, Typography } from '@mui/material';
import { format as formatDate } from 'date-fns';
import { useState } from 'react';
import type { FieldParticipant } from '@sync/model';
import { usePreferences } from '../../../shell/preferences';
import { TimePickerDialog } from '../../../ui/TimePickerDialog';
import { useDebouncedCallback } from '../../../ui/useDebouncedCallback';

const toMilliseconds = (minutes: number) => minutes * 60 * 1000;

export function ParticipantEtaUpdater({ participant }: { participant: FieldParticipant }) {
  const { etaIncrement, etaPreset1, etaPreset2, etaPreset3 } = usePreferences();
  const now = () => participant.activity.clock.now();

  const [eta, setEta] = useState<number | null>(participant.record?.eta ?? null);
  const [picking, setPicking] = useState(false);

  const commitEta = useDebouncedCallback((value: number | null) => participant.setEta(value), 1000);
  const changeEta = (value: number | null) => {
    setEta(value);
    commitEta(value);
  };

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <TimePickerDialog open={picking} value={eta ?? now()} label="ETA" onAccept={changeEta} onClose={() => setPicking(false)} />
      {eta && (
        <>
          <Typography variant="h6">ETA</Typography>
          {/* The time itself opens the picker, as in respond-next. */}
          <ButtonBase onClick={() => setPicking(true)} aria-label="Change ETA">
            <Typography variant="h6">{formatDate(eta, 'HHmm')}</Typography>
          </ButtonBase>
          <IconButton onClick={() => changeEta(eta - toMilliseconds(etaIncrement))}>
            <RemoveIcon />
          </IconButton>
          <IconButton onClick={() => changeEta(eta + toMilliseconds(etaIncrement))}>
            <AddIcon />
          </IconButton>
          <Button onClick={() => changeEta(null)}>clear</Button>
        </>
      )}
      {!eta && (
        <>
          <Typography variant="h6">ETA</Typography>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <IconButton onClick={() => changeEta(now() + toMilliseconds(etaPreset1))}>{etaPreset1}</IconButton>
            <IconButton onClick={() => changeEta(now() + toMilliseconds(etaPreset2))}>{etaPreset2}</IconButton>
            <IconButton onClick={() => changeEta(now() + toMilliseconds(etaPreset3))}>{etaPreset3}</IconButton>
            <IconButton onClick={() => setPicking(true)} aria-label="Pick ETA">
              <AccessTime />
            </IconButton>
          </Stack>
        </>
      )}
    </Stack>
  );
}
