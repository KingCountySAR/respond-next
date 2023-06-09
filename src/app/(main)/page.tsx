'use client';
import Link from 'next/link';
//import { Inter } from 'next/font/google';
import { Box, Button, Stack, Typography, Chip } from "@mui/material";

//import styles from './page.module.css';
import { useAppSelector } from '@respond/lib/client/store';
import { canCreateEvents, canCreateMissions } from '@respond/lib/client/store/organization';
import { buildActivityTypeSelector, buildMyActivitySelector, getActiveParticipants, getActivityStatus, isActive, isComplete } from '@respond/lib/client/store/activities';
import { useEffect } from 'react';
import { Activity, isActive as isResponderStatusActive, ParticipatingOrg } from '@respond/types/activity';
import addDays from 'date-fns/addDays'
import { EventTile } from './EventTile';
import { OrganizationChip } from './OrganizationChip';
import { OutputForm, OutputText } from '@respond/components/OutputForm';

//const inter = Inter({ subsets: ['latin'] })

function filterActivitiesForDisplay(activities: Activity[], maxCompletedVisible: number, oldestVisible: number) {
  // Most recent first
  const sort = (a: Activity, b: Activity) => a.startTime > b.startTime ? -1 : 1;

  const active = activities.filter(isActive).sort(sort);
  const complete = activities
    .filter(a => isComplete(a) && a.startTime > oldestVisible)
    .sort(sort)
    .slice(0, maxCompletedVisible);

  return active.concat(complete)
}

export default function Home() {
  let myActivities = useAppSelector(buildMyActivitySelector());
  let myCurrentActivities = myActivities.filter(activity => isResponderStatusActive(activity.status.status) === true);

  function getMyStatus(activity: Activity) {
    return myActivities.find(f => f.activity.id === activity.id)?.status.status;
  }

  const maxCompletedActivitiesVisible = 3;
  const oldestCompletedActivityVisible = addDays(new Date(), -3).getTime();

  const canCreateM = useAppSelector(state => canCreateMissions(state));
  const canCreateE = useAppSelector(state => canCreateEvents(state));

  let missions = useAppSelector(buildActivityTypeSelector(true));
  missions = filterActivitiesForDisplay(missions, maxCompletedActivitiesVisible, oldestCompletedActivityVisible);

  let events = useAppSelector(buildActivityTypeSelector(false));
  events = filterActivitiesForDisplay(events, maxCompletedActivitiesVisible, oldestCompletedActivityVisible);

  useEffect(() => {
    document.title = "Event list";
  }, []);

  return (
    <main>
      { myCurrentActivities.length < 1 ? null : (
        <Box sx={{mb:3}}>
          <Box sx={{mb:1}}>
            <Typography variant="h5">My Activity</Typography>
          </Box>
          <Stack spacing={1}>
            {myCurrentActivities.map(up => (
              <EventTile key={up.activity.id} activity={up.activity} status={up.status.status}>
                <OutputForm>
                  <OutputText label="Location" value={up.activity.location.title} />
                  <OutputText label="Mission Status" value={getActivityStatus(up.activity)} />
                </OutputForm>
              </EventTile>
            ))}
          </Stack>
        </Box>
      )}
      <Box sx={{mb:3}}>
        <Box sx={{mb:1, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <Typography variant="h5">Missions</Typography>
          {canCreateM  && <Button variant="outlined" component={Link} href="/mission/new">New Mission</Button>}
        </Box>
        <Stack spacing={1}>
          {missions.map(a => (
            <EventTile key={a.id} activity={a} status={getMyStatus(a)}>
              <OutputForm>
                <Box>
                  <OutputText label="Location" value={a.location.title} />
                  <OutputText label="State #" value={a.idNumber} />
                </Box>
                <Box>
                  <OutputText label="Mission Status" value={getActivityStatus(a)} />
                  <OutputText label="Active Responders" value={getActiveParticipants(a).length.toString()} />
                </Box>
              </OutputForm>
              <Box sx={{ pt: 2 }}>
                  {Object.entries(a.organizations ?? {}).map(([id, org]) => <OrganizationChip key={id} org={org} activity={a} />)}
              </Box>
            </EventTile>
          ))}
          {missions.length === 0 && <Typography>No recent missions</Typography>}
        </Stack>
      </Box>
      <Box sx={{ pb: 4 }}>
        <Box sx={{mb:1, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <Typography variant="h5">Events</Typography>
          {canCreateE && <Button variant="outlined" component={Link} href="/event/new">New Event</Button>}
        </Box>
        <Stack spacing={1}>
          {events.map(a => (
            <EventTile key={a.id} activity={a}>
              <OutputForm>
                <Box>
                  <OutputText label="Location" value={a.location.title} />
                  <OutputText label="State #" value={a.idNumber} />
                </Box>
                <Box>
                  <OutputText label="Mission Status" value={getActivityStatus(a)} />
                  <OutputText label="Active Participants" value={getActiveParticipants(a).length.toString()} />
                </Box>
              </OutputForm>
            </EventTile>
          ))}
          {events.length === 0 && <Typography>No recent events</Typography>}
        </Stack>
      </Box>
    </main>
  );
}