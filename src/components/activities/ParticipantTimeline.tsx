import { Close } from '@mui/icons-material';
import { Box, ButtonBase, IconButton, Stack, Typography } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { format as formatDate } from 'date-fns';
import { useState } from 'react';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { Activity, getOrganizationName, getStatusText, Participant, ParticipantUpdate } from '@respond/types/activity';

interface EnrichedParticipantUpdate extends ParticipantUpdate {
  statusText: string;
  organizationName: string;
}

export default function ParticipantTimeline({ participant, activity }: { participant: Participant; activity: Activity }) {
  const dispatch = useAppDispatch();
  const updateTimeline = (update: ParticipantUpdate, index: number) => {
    dispatch(ActivityActions.participantTimelineUpdate(activity.id, participant.id, update, index));
  };
  const getEnrichedUpdate = (update: ParticipantUpdate): EnrichedParticipantUpdate => {
    return {
      ...update,
      statusText: getStatusText(update.status),
      organizationName: getOrganizationName(activity, update.organizationId),
    };
  };
  return <Stack spacing={2}>{[...participant.timeline].map((update, i) => <ParticipantUpdateTile key={i} record={getEnrichedUpdate(update)} onChange={(time) => updateTimeline({ ...update, time }, i)} />).reverse()}</Stack>;
}

function ParticipantUpdateTile({ record, onChange }: { record: EnrichedParticipantUpdate; onChange: (time: number) => void }) {
  const [edit, setEdit] = useState(false);
  const [time, setTime] = useState(record.time);
  const handleAccept = (newTime: number | null) => {
    if (newTime) {
      setTime(newTime);
      onChange(new Date(newTime).getTime());
    }
  };
  const handleClose = () => {
    setEdit(false);
  };
  return (
    <Box>
      {edit ? (
        <Stack flexGrow={1} direction="row" justifyContent="space-between">
          <DateTimePicker value={record.time} label={`${record.organizationName} - ${record.statusText}`} format="MM/dd HH:mm" onAccept={handleAccept} onClose={handleClose} />
          <IconButton disableRipple onClick={handleClose}>
            <Close />
          </IconButton>
        </Stack>
      ) : (
        <>
          <ButtonBase sx={{ width: '100%' }} onClick={() => setEdit(true)}>
            <Stack flexGrow={1} direction="row" justifyContent="space-between">
              <Stack alignItems="flex-start">
                <Typography variant="h6">{record.statusText}</Typography>
                <Typography variant="caption">{record.organizationName}</Typography>
              </Stack>
              <Stack alignItems="flex-end">
                <Typography sx={{ ml: 2 }} variant="h6">
                  {formatDate(time, 'HHmm')}
                </Typography>
                <Typography variant="caption">{formatDate(time, 'MM/dd')}</Typography>
              </Stack>
            </Stack>
          </ButtonBase>
        </>
      )}
    </Box>
  );
}
