import { Box, Stack, Typography } from '@mui/material';

import { ActivityTile } from '@respond/components/activities/ActivityTile';
import { OutputForm, OutputText, OutputTime } from '@respond/components/OutputForm';
import { getActiveParticipants, getActivityStatus, isFuture } from '@respond/lib/client/store/activities';
import { Activity, ActivityType, ParticipantStatus } from '@respond/types/activity';

import { RelativeStyle } from '../RelativeTimeText';

import { ParticipatingOrgChips } from './ParticipatingOrgChips';

interface ActivityStackProps {
  type: ActivityType;
  activities: Activity[];
  statusMap?: Record<string, ParticipantStatus>;
  showOrgs?: boolean;
}

export function ActivityStack({ type, activities, showOrgs, statusMap }: ActivityStackProps) {
  return (
    <Stack spacing={1}>
      {activities.map((a) => (
        <ActivityTile key={a.id} activity={a} status={statusMap?.[a.id]}>
          <OutputForm>
            <Box>
              <OutputText label="Location" value={a.location.title} />
              <OutputText label="State #" value={a.idNumber} />
            </Box>
            <Box>
              <OutputText label={a.isMission ? 'Mission Status' : 'Status'} value={getActivityStatus(a)} />
              {isFuture(a.startTime) && <OutputTime label="Start Time" time={a.startTime} relative={RelativeStyle.Auto}></OutputTime>}
              <OutputText label="Active Responders" value={getActiveParticipants(a).length.toString()} />
            </Box>
          </OutputForm>
          {showOrgs && <ParticipatingOrgChips sx={{ mt: 2 }} />}
        </ActivityTile>
      ))}
      {activities.length === 0 && <Typography>No recent {type == 'missions' ? 'missions' : 'events'}</Typography>}
    </Stack>
  );
}
