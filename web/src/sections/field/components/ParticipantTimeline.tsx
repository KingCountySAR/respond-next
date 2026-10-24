import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { format as formatDate } from 'date-fns';
import { useState } from 'react';
import type { ParticipantStatusRec } from '@sync/domain';
import { isCommandActivity, type FieldParticipant } from '@sync/model';
import { observer } from '@sync/model/react';
import { statusText } from '../../../ui/status';
import { TimePickerDialog } from '../../../ui/TimePickerDialog';
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
  const [open, setOpen] = useState(false);

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

  const audit = auditText(entry);
  const auditLine = audit && (
    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
      {audit}
    </Typography>
  );

  if (!onChange) {
    return (
      <Box>
        {summary}
        {auditLine}
      </Box>
    );
  }
  return (
    <Box>
      <ButtonBase sx={{ width: '100%' }} onClick={() => setOpen(true)}>
        {summary}
      </ButtonBase>
      <TimePickerDialog open={open} value={entry.at} label={`${unitName} - ${statusText(entry.status)}`} onAccept={onChange} onClose={() => setOpen(false)} />
      {auditLine}
    </Box>
  );
}

/** Why an entry was added and by whom, when it wasn't simply the participant's own: "Activity closed · by Alice Adams". */
export function auditText(entry: ParticipantStatusRec): string {
  return [entry.cause, entry.byName && `by ${entry.byName}`, entry.correctedBy && `corrected by ${entry.correctedBy}`].filter(Boolean).join(' · ');
}
