import AccessTime from '@mui/icons-material/AccessTime';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { Button, ButtonBase, IconButton, Stack, Typography } from '@mui/material';
import { MobileDateTimePicker, renderMultiSectionDigitalClockTimeView } from '@mui/x-date-pickers';
import { format as formatDate } from 'date-fns';
import { useState } from 'react';

import { useDebouncedCallback } from '@respond/hooks/useDebouncedCallback';

import { ParticipantDomainModel } from '@/client/models/participantDomainModel';

import { usePreferences } from '../PreferencesProvider';

const toMilliseconds = (minutes: number) => minutes * 60 * 1000;

export function ParticipantEtaUpdater({ participant }: { participant: Pick<ParticipantDomainModel, 'eta' | 'updateEta'> }) {
  const { etaIncrement, etaPreset1, etaPreset2, etaPreset3 } = usePreferences();

  const [eta, setEta] = useState<number | null>(participant.eta ?? null);
  const [open, setOpen] = useState(false);

  const commitEta = useDebouncedCallback((value: number | null) => participant.updateEta(value), 1000);
  const changeEta = (value: number | null) => {
    setEta(value);
    commitEta(value);
  };

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <MobileDateTimePicker
        open={open}
        value={new Date(eta ?? Date.now())}
        label="ETA"
        format="MM/dd HH:mm"
        openTo="hours"
        minutesStep={1}
        timeSteps={{ minutes: 1 }}
        viewRenderers={{
          hours: renderMultiSectionDigitalClockTimeView,
          minutes: renderMultiSectionDigitalClockTimeView,
        }}
        onAccept={(date) => {
          if (date) changeEta(date.getTime());
        }}
        onClose={() => setOpen(false)}
        slots={{ field: () => null }}
      />
      {eta && (
        <>
          <Typography variant="h6">ETA</Typography>
          <ButtonBase onClick={() => setOpen(true)}>
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
            <IconButton onClick={() => changeEta(new Date().getTime() + toMilliseconds(etaPreset1))}>{etaPreset1}</IconButton>
            <IconButton onClick={() => changeEta(new Date().getTime() + toMilliseconds(etaPreset2))}>{etaPreset2}</IconButton>
            <IconButton onClick={() => changeEta(new Date().getTime() + toMilliseconds(etaPreset3))}>{etaPreset3}</IconButton>
            <IconButton onClick={() => setOpen(true)}>
              <AccessTime />
            </IconButton>
          </Stack>
        </>
      )}
    </Stack>
  );
}
