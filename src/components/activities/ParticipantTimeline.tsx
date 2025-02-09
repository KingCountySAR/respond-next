import { Close } from '@mui/icons-material';
import { Box, ButtonBase, IconButton, Stack, Typography } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { format as formatDate } from 'date-fns';
import { useState } from 'react';

import { ActivityContext, useActivityContext } from '@respond/hooks/useActivity';
import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { Activity, getOrganizationName, getStatusText, Participant, ParticipantUpdate } from '@respond/types/activity';

export default function ParticipantTimeline({ participant, activity }: { participant: Participant; activity: Activity }) {
  const dispatch = useAppDispatch();
  const updateTimeline = (update: ParticipantUpdate, index: number) => {
    dispatch(ActivityActions.participantTimelineUpdate(activity.id, participant.id, update, index));
  };
  return (
    <ActivityContext.Provider value={activity}>
      <Stack spacing={2}>
        {[...participant.timeline].reverse().map((update, i) => (
          <ParticipantUpdateTile key={i} record={update} onChange={(time) => updateTimeline({ ...update, time }, i)} />
        ))}
      </Stack>
    </ActivityContext.Provider>
  );
}

function ParticipantUpdateTile({ record, onChange }: { record: ParticipantUpdate; onChange: (time: number) => void }) {
  const activity = useActivityContext();
  const org = activity ? getOrganizationName(activity, record.organizationId) : '';
  const status = getStatusText(record.status);
  const initialTime = record.time ?? new Date().getTime(); // Backward Compatability; timelines might have null time values. This ensures a value is present so it can be edited.
  const [edit, setEdit] = useState(false);
  const [time, setTime] = useState(initialTime);
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
          <DateTimePicker value={initialTime} label={`${org} - ${status}`} format="MM/dd HH:mm" onChange={handleAccept} onAccept={handleAccept} onClose={handleClose} />
          <IconButton disableRipple onClick={handleClose}>
            <Close />
          </IconButton>
        </Stack>
      ) : (
        <ButtonBase sx={{ width: '100%' }} onClick={() => setEdit(true)}>
          <Stack flexGrow={1} direction="row" justifyContent="space-between">
            <Stack alignItems="flex-start">
              <Typography variant="h6">{status}</Typography>
              <Typography variant="caption">{org}</Typography>
            </Stack>
            <Stack alignItems="flex-end">
              <Typography sx={{ ml: 2 }} variant="h6">
                {formatDate(time, 'HHmm')}
              </Typography>
              <Typography variant="caption">{formatDate(time, 'MM/dd')}</Typography>
            </Stack>
          </Stack>
        </ButtonBase>
      )}
    </Box>
  );
}
