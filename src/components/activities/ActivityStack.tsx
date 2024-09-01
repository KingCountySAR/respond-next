import { Stack, Typography } from '@mui/material';

import { ActivityTile } from '@respond/components/activities/ActivityTile';
import { Activity, ActivityType, ParticipantStatus } from '@respond/types/activity';

interface ActivityStackProps {
  type: ActivityType;
  activities: Activity[];
  statusMap?: Record<string, ParticipantStatus>;
}

export function ActivityStack({ type, activities, statusMap }: ActivityStackProps) {
  return (
    <Stack spacing={1}>
      {activities.map((a) => (
        <ActivityTile key={a.id} activity={a} status={statusMap?.[a.id]}>
          <ActivityTile.Status />
          <ActivityTile.StartTime />
          <ActivityTile.Location />
          <ActivityTile.Responders />
        </ActivityTile>
      ))}
      {activities.length === 0 && <Typography>No recent {type == 'missions' ? 'missions' : 'events'}</Typography>}
    </Stack>
  );
}
