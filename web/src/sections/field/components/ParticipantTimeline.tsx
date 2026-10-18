import { Close } from '@mui/icons-material';
import { Box, ButtonBase, IconButton, Stack, Typography } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { format as formatDate } from 'date-fns';
import { useState } from 'react';
import type { ParticipantStatusRec } from '@sync/domain';
import { isCommandActivity, type FieldParticipant } from '@sync/model';
import { observer } from '@sync/model/react';
import { statusText } from '../../../ui/status';
import { useChange } from '../../../ui/useChange';

/** Status entries, oldest first. Command can correct an entry's time. */
export const ParticipantTimeline = observer(function ParticipantTimeline({ participant }: { participant: FieldParticipant }) {
  const change = useChange();
  const command = isCommandActivity(participant.activity) ? participant.activity : undefined;
  return (
    <Stack spacing={2}>
      {[...participant.timeline].reverse().map((entry) => {
        const unit = participant.activity.unit(entry.unitId);
        const onChange = command ? (time: number) => change(() => command.participant(participant.id)?.correctStatus(entry.id, { at: time })) : undefined;
        return <ParticipantUpdateTile key={entry.id} entry={entry} unitName={unit?.name ?? ''} onChange={onChange} />;
      })}
    </Stack>
  );
});

function ParticipantUpdateTile({ entry, unitName, onChange }: { entry: ParticipantStatusRec; unitName: string; onChange?: (time: number) => void }) {
  const [edit, setEdit] = useState(false);
  const handleAccept = (newTime: number | null) => {
    if (newTime) onChange?.(newTime);
  };
  const handleClose = () => {
    setEdit(false);
  };

  const summary = (
    <Stack direction="row" sx={{ flexGrow: 1, justifyContent: 'space-between' }}>
      <Stack sx={{ alignItems: 'flex-start' }}>
        <Typography variant="h6">{statusText(entry.status)}</Typography>
        <Typography variant="caption">{unitName}</Typography>
      </Stack>
      <Stack sx={{ alignItems: 'flex-end' }}>
        <Typography sx={{ ml: 2 }} variant="h6">
          {formatDate(entry.at, 'HHmm')}
        </Typography>
        <Typography variant="caption">{formatDate(entry.at, 'MM/dd')}</Typography>
      </Stack>
    </Stack>
  );

  return (
    <Box>
      {edit ? (
        <Stack direction="row" sx={{ flexGrow: 1, justifyContent: 'space-between' }}>
          <DateTimePicker
            value={new Date(entry.at)}
            label={`${unitName} - ${statusText(entry.status)}`}
            format="MM/dd HH:mm"
            onAccept={(d) => handleAccept(d ? d.getTime() : null)}
            onClose={handleClose}
          />
          <IconButton disableRipple onClick={handleClose}>
            <Close />
          </IconButton>
        </Stack>
      ) : onChange ? (
        <ButtonBase sx={{ width: '100%' }} onClick={() => setEdit(true)}>
          {summary}
        </ButtonBase>
      ) : (
        summary
      )}
    </Box>
  );
}
