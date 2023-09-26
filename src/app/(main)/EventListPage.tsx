import * as React from 'react';
import { Box, Button, Stack, Typography, Chip } from "@mui/material";

import { Activity, ActivityType } from '@respond/types/activity';
import { buildActivityTypeSelector, buildMyActivitySelector, getActiveParticipants, getActivityStatus, isActive, isComplete, isFuture } from '@respond/lib/client/store/activities';
import { EventTile } from './EventTile';
import { OutputForm, OutputText, OutputTime } from '@respond/components/OutputForm';
import { apiFetch } from '@respond/lib/api';

export const EventListPage = ({activityType }: { activityType: ActivityType }) => {
  const [ loading, setLoading ] = React.useState<boolean>(true);
  const [ activities, setActivities ] = React.useState<Activity[]>([]);

  React.useEffect(() => {
    apiFetch<{ data: Activity[] }>(`/api/v1/${activityType}`).then(api => {
      setLoading(false);
      setActivities(api.data);
    });
  }, [activityType]);

  return (
    <main>
      <Box sx={{ pb: 4 }}>
        <Box sx={{mb:1, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <Typography variant="h5">{ activityType === 'missions' ? 'Mission List' : 'Event List'}</Typography>
        </Box>
        {loading
        ? (<main><Typography>Loading ...</Typography></main>)
        : (
          <Stack spacing={1}>
            {activities.map(a => (
              <EventTile key={a.id} activity={a}>
                <OutputForm>
                  <Box>
                    <OutputText label="Location" value={a.location.title} />
                    <OutputText label="State #" value={a.idNumber} />
                  </Box>
                  <Box>
                    <OutputText label="Mission Status" value={getActivityStatus(a)} />
                    {isFuture(a.startTime) && <OutputTime label="Start Time" time={a.startTime}></OutputTime>}
                    <OutputText label="Active Participants" value={getActiveParticipants(a).length.toString()} />
                  </Box>
                </OutputForm>
              </EventTile>
            ))}
          </Stack>
        )}
      </Box>
    </main>
  )
}