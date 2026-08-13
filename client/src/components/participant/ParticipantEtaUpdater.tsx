import AccessTime from '@mui/icons-material/AccessTime';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { Button, IconButton, Stack, Typography } from '@mui/material';
import { format as formatDate } from 'date-fns';
import { useState } from 'react';

import { useDebouncedCallback } from '@respond/hooks/useDebouncedCallback';

import { ParticipantDomainModel } from 'src/models/participantDomainModel';

import { InlineTimeEdit } from '../InlineTimeEdit';
import { usePreferences } from '../PreferencesProvider';

const toMilliseconds = (minutes: number) => minutes * 60 * 1000;

export function ParticipantEtaUpdater({ participant }: { participant: Pick<ParticipantDomainModel, 'eta' | 'updateEta'> }) {
  const { etaIncrement, etaPreset1, etaPreset2, etaPreset3 } = usePreferences();

  const [eta, setEta] = useState<number | null>(participant.eta ?? null);
  const [editing, setEditing] = useState(false);

  const commitEta = useDebouncedCallback((value: number | null) => participant.updateEta(value), 1000);
  const changeEta = (value: number | null) => {
    setEta(value);
    commitEta(value);
  };

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      {editing && (
        <InlineTimeEdit
          label="ETA"
          format="MM/dd HH:mm"
          openTo="hours"
          onChange={(time) => {
            if (time) changeEta(new Date(time).getTime());
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}
      {!editing && eta && (
        <>
          <Typography variant="h6">ETA</Typography>
          <Typography variant="h6">{formatDate(eta, 'HHmm')}</Typography>
          <IconButton onClick={() => changeEta(eta - toMilliseconds(etaIncrement))}>
            <RemoveIcon />
          </IconButton>
          <IconButton onClick={() => changeEta(eta + toMilliseconds(etaIncrement))}>
            <AddIcon />
          </IconButton>
          <Button onClick={() => changeEta(null)}>clear</Button>
        </>
      )}
      {!editing && !eta && (
        <>
          <Typography variant="h6">ETA</Typography>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <IconButton onClick={() => changeEta(new Date().getTime() + toMilliseconds(etaPreset1))}>{etaPreset1}</IconButton>
            <IconButton onClick={() => changeEta(new Date().getTime() + toMilliseconds(etaPreset2))}>{etaPreset2}</IconButton>
            <IconButton onClick={() => changeEta(new Date().getTime() + toMilliseconds(etaPreset3))}>{etaPreset3}</IconButton>
            <IconButton onClick={() => setEditing(true)}>
              <AccessTime />
            </IconButton>
          </Stack>
        </>
      )}
    </Stack>
  );
}
