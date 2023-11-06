'use client';
import { Box, Button, Stack, Typography } from '@mui/material';
import addDays from 'date-fns/addDays';
import Link from 'next/link';
import { useEffect } from 'react';

import { ActivityStack } from '@respond/components/activities/ActivityStack';
import { ActivityTile } from '@respond/components/activities/ActivityTile';
import { OutputForm, OutputText, OutputTime } from '@respond/components/OutputForm';
import { useAppSelector } from '@respond/lib/client/store';
import { buildActivityTypeSelector, buildMyActivitySelector, getActivityStatus, isActive, isComplete, isFuture } from '@respond/lib/client/store/activities';
import { canCreateEvents, canCreateMissions } from '@respond/lib/client/store/organization';
import { Activity, isActive as isParticipantStatusActive } from '@respond/types/activity';

function filterActivitiesForDisplay(activities: Activity[], maxCompletedVisible: number, oldestVisible: number) {
  // Most recent first
  const sort = (a: Activity, b: Activity) => (a.startTime > b.startTime ? -1 : 1);

  const active = activities.filter(isActive).sort(sort);
  const complete = activities
    .filter((a) => isComplete(a) && a.startTime > oldestVisible)
    .sort(sort)
    .slice(0, maxCompletedVisible);

  return active.concat(complete);
}

export default function Home() {
  const myActivities = useAppSelector(buildMyActivitySelector());
  const myCurrentActivities = myActivities.filter((activity) => isParticipantStatusActive(activity.status.status) === true);

  const statusMap = myActivities.reduce((accum, cur) => ({ [cur.activity.id]: cur.status.status, ...accum }), {});

  const maxCompletedActivitiesVisible = 3;
  const oldestCompletedActivityVisible = addDays(new Date(), -3).getTime();

  const canCreateM = useAppSelector((state) => canCreateMissions(state));
  const canCreateE = useAppSelector((state) => canCreateEvents(state));

  let missions = useAppSelector(buildActivityTypeSelector(true));
  missions = filterActivitiesForDisplay(missions, maxCompletedActivitiesVisible, oldestCompletedActivityVisible);

  let events = useAppSelector(buildActivityTypeSelector(false));
  events = filterActivitiesForDisplay(events, maxCompletedActivitiesVisible, oldestCompletedActivityVisible);

  useEffect(() => {
    document.title = 'Event list';
  }, []);

  return (
    <main>
      {myCurrentActivities.length < 1 ? null : (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ mb: 1 }}>
            <Typography variant="h5">My Activity</Typography>
          </Box>
          <Stack spacing={1}>
            {myCurrentActivities.map((up) => (
              <ActivityTile key={up.activity.id} activity={up.activity} status={up.status.status}>
                <OutputForm>
                  <Box>
                    <OutputText label="Location" value={up.activity.location.title} />
                  </Box>
                  <Box>
                    <OutputText label="Mission Status" value={getActivityStatus(up.activity)} />
                    {isFuture(up.activity.startTime) && <OutputTime label="Start Time" time={up.activity.startTime}></OutputTime>}
                  </Box>
                </OutputForm>
              </ActivityTile>
            ))}
          </Stack>
        </Box>
      )}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            mb: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="h5">Missions</Typography>
          {canCreateM && (
            <Button variant="outlined" component={Link} href="/mission/new">
              New Mission
            </Button>
          )}
        </Box>
        <ActivityStack type="missions" activities={missions} statusMap={statusMap} showOrgs />
      </Box>
      <Box sx={{ pb: 4 }}>
        <Box
          sx={{
            mb: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="h5">Events</Typography>
          {canCreateE && (
            <Button variant="outlined" component={Link} href="/event/new">
              New Event
            </Button>
          )}
        </Box>
        <ActivityStack type="events" activities={events} statusMap={statusMap} />
      </Box>
    </main>
  );
}
