import { Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import { isActive, ParticipantStatus, ParticipantUpdate } from '@respond/types/activity';

import { useParticipantContext } from '../../hooks/useParticipantContext';

function isOnClock(status: ParticipantStatus) {
  if (status === ParticipantStatus.Standby) return false;
  return isActive(status);
}

function getLastTimeout(lastUpdate: ParticipantUpdate) {
  if (!isOnClock(lastUpdate.status)) return lastUpdate.time;
  return new Date().getTime();
}

export function ParticipantHours() {
  const participant = useParticipantContext();
  const lastTimeline = participant.timeline[0];
  const [latestTimeout, setLatestTimeout] = useState<number>(getLastTimeout(lastTimeline));

  // Keep the timeline up to date while the dialog is open
  useEffect(() => {
    const timer = setTimeout(() => {
      setLatestTimeout(getLastTimeout(lastTimeline));
    }, 10000);
    return () => clearTimeout(timer);
  }, [lastTimeline, latestTimeout, participant.firstname]);

  let timeOnClock = 0;
  let lastTime: number = latestTimeout;
  for (const t of participant.timeline) {
    if (isOnClock(t.status)) {
      timeOnClock += lastTime - t.time;
    }

    lastTime = t.time;
  }

  // Round to the nearest quarter hour.
  return (
    <Stack direction={'row'} spacing={2} justifyContent={'space-between'}>
      <Typography variant="h6">Total Hours:</Typography>
      <Typography variant="h6" flexGrow={1} align={'right'}>
        {Math.round(timeOnClock / 1000 / 60 / 15) / 4}
      </Typography>
    </Stack>
  );
}
