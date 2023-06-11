'use client';
import Link from 'next/link';
//import { Inter } from 'next/font/google';
import { Box, Button, Stack, Typography, Chip } from "@mui/material";

//import styles from './page.module.css';
import { useAppSelector } from '@respond/lib/client/store';
import { canCreateEvents, canCreateMissions } from '@respond/lib/client/store/organization';
import { buildActivityTypeSelector, buildMyActivitySelector, getActiveParticipants, isActive, isComplete } from '@respond/lib/client/store/activities';
import { useEffect } from 'react';
import { Activity } from '@respond/types/activity';
import addDays from 'date-fns/addDays'
import { EventTile } from './EventTile';
import { OrganizationChip } from './OrganizationChip';

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
      <Box sx={{mb:3}}>
        <Box sx={{mb:1}}>
          <Typography variant="h5">My Activity</Typography>
        </Box>
        <Stack spacing={1}>
          {myActivities.map(up => (
            <EventTile key={up.activity.id} activity={up.activity} status={up.status.status} />
          ))}
        </Stack>
      </Box>
      <Box sx={{mb:3}}>
        <Box sx={{mb:1}}>
          <Typography variant="h5">Missions</Typography>
        </Box>
        <Stack spacing={1}>
          {missions.map(a => (
            <EventTile key={a.id} activity={a} status={getMyStatus(a)}>
              <Box>State #: {a.idNumber}</Box>
              <Box>Active Responders: {getActiveParticipants(a).length}</Box>
              <Box sx={{ pt: 1 }}>
                  {Object.entries(a.organizations ?? {}).map(([id, org]) => <OrganizationChip key={id} org={org} />)}
              </Box>
            </EventTile>
          ))}
          {missions.length === 0 && <Typography>No recent missions</Typography>}
        </Stack>
        {canCreateM ? ( 
          <Box sx={{mt: 2, display:'flex', flexDirection:'row-reverse'}}> 
            <Button variant="outlined" component={Link} href="/mission/new">New Mission</Button> 
          </Box>
        ) : null} 
      </Box>
      <Box>
        <Box sx={{mb:1}}>
          <Typography variant="h5">Trainings and Other Events</Typography>
        </Box>
        <Stack spacing={1}>
          {events.map(a => (
            <EventTile key={a.id} activity={a}>
              <Box>State #: {a.idNumber}</Box>
              <Box>Participants: {getActiveParticipants(a).length}</Box>
            </EventTile>
          ))}
          {events.length === 0 && <Typography>No recent events</Typography>}
        </Stack>
        {canCreateE ? ( 
          <Box sx={{mt: 2, display:'flex', flexDirection:'row-reverse'}}> 
            <Button variant="outlined" component={Link} href="/event/new">New Event</Button> 
          </Box> 
        ) : null} 
      </Box>
    </main>
  );
}