'use client';
import Link from 'next/link';
//import { Inter } from 'next/font/google';
import { Box, Button, Card, CardActionArea, CardContent, Stack, Typography } from "@mui/material";

//import styles from './page.module.css';
import { useAppSelector } from '@respond/lib/client/store';
import { canCreateEvents, canCreateMissions } from '@respond/lib/client/store/organization';
import { buildActivityTypeSelector, getActiveParticipants } from '@respond/lib/client/store/activities';
import { useEffect } from 'react';

//const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  const canCreateM = useAppSelector(state => canCreateMissions(state));
  const canCreateE = useAppSelector(state => canCreateEvents(state));
  const missions = useAppSelector(buildActivityTypeSelector(true));
  const events = useAppSelector(buildActivityTypeSelector(false));
  
  useEffect(() => {
    document.title = "Event list";
  }, []);

  return (
    <main>
      <Box sx={{mb:3}}>
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
            </Card>
          ))}
          {missions.length === 0 && <Typography>No recent missions</Typography>}
        </Stack>
        {canCreateM ? ( 
          <Box sx={{mt: 2}}> 
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
            </Card>
          ))}
          {events.length === 0 && <Typography>No recent events</Typography>}
        </Stack>
        {canCreateE ? ( 
          <Box sx={{mt: 2}}> 
            <Button variant="outlined" component={Link} href="/event/new">New Event</Button> 
          </Box> 
        ) : null} 
      </Box>
    </main>
  );
  // return (
  //   <main>
  //     <div>Auth: {JSON.stringify(auth)}</div>
  //     <AppBar />
  //     <div>{process.env.GOOGLE_ID}</div>
  //     <LoginPanel />
  //     <SocketPart />
  //   </main>
  // )
}