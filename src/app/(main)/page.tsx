'use client';
import Link from 'next/link';
//import { Inter } from 'next/font/google';
import { Box, Button, Card, CardActionArea, CardActions, CardContent, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, Typography } from "@mui/material";

//import styles from './page.module.css';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { canCreateEvents, canCreateMissions } from '@respond/lib/client/store/organization';
import { buildActivityTypeSelector, getActiveParticipants, isActive, isComplete } from '@respond/lib/client/store/activities';
import { useEffect, useState } from 'react';
import { Activity, ResponderStatus } from '@respond/types/activity';
import { ActivityActions } from '@respond/lib/state';
import { MyActivity } from './MyActivity';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import addDays from 'date-fns/addDays'

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
        <MyActivity />
        <Typography variant="h5">Missions</Typography>
        <Stack spacing={1}>
          {missions.map(a => (
            <Card key={a.id}>
              <CardActionArea component={Link} href={`/mission/${a.id}`}> 
              <CardContent>
                <Typography gutterBottom variant="h5" component="div">
                  {a.idNumber} {a.title}
                </Typography>
                <Typography>
                  Active Responders: {getActiveParticipants(a).length}
                </Typography>
              </CardContent>
              </CardActionArea>
              {(isActive(a)) && (
                <CardActions>
                  <StatusUpdater activity={a} />
                  {/* <Button size="small" color="primary" variant="contained" onClick={() => confirmPrompt('Respond to Mission', 'Respond', a)}>Respond</Button> */}
                </CardActions>
                )}
            </Card>
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
        <Typography variant="h5">Trainings and Other Events</Typography>
        <Stack spacing={1}>
          {events.map(a => (
            <Card key={a.id}>
              <CardActionArea component={Link} href={`/event/${a.id}`}> 
              <CardContent>
                <Typography gutterBottom variant="h5" component="div">
                  {a.idNumber} {a.title}
                </Typography>
                <Typography>
                  Active Responders: {getActiveParticipants(a).length}
                </Typography>
              </CardContent>
              </CardActionArea>
              {(isActive(a)) && (
                <CardActions>
                  <StatusUpdater activity={a} />
                  {/* <Button size="small" color="primary" onClick={() => confirmPrompt('Attend Event', 'Attend', a)}>Attend</Button> */}
                </CardActions>
              )}
            </Card>
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