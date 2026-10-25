import { Box, Stack, Typography } from '@mui/material';
import type { ParticipantStatus } from '@sync/domain';
import type { ActivityListItem } from '@sync/model';
import { observer } from '@sync/model/react';
import { OutputForm, OutputText, OutputTime } from '../../../ui/OutputForm';
import { RelativeStyle } from '../../../ui/RelativeTimeText';
import { phaseText } from '../../../ui/status';
import { ListedUnitChips } from '../../../ui/ListedUnitChips';
import { ActivityTile } from './ActivityTile';

interface ActivityStackProps {
  type: 'missions' | 'events';
  activities: ActivityListItem[];
  statusMap?: Record<string, ParticipantStatus>;
  showOrgs?: boolean;
}

export const ActivityStack = observer(function ActivityStack({ type, activities, showOrgs, statusMap }: ActivityStackProps) {
  return (
    <Stack spacing={1}>
      {activities.map((item) => {
        const a = item.activity;
        if (!a) return null;
        return (
          <ActivityTile key={item.id} item={item} status={statusMap?.[item.id]}>
            <OutputForm>
              <Box>
                <OutputText label="Location" value={a.location.title} />
                <OutputText label="State #" value={a.idNumber} />
              </Box>
              <Box>
                <OutputText label={item.isMission ? 'Mission Status' : 'Status'} value={phaseText(item.phase)} />
                {item.startsInFuture && <OutputTime label="Start Time" time={a.startTime} relative={RelativeStyle.Auto}></OutputTime>}
                <OutputText label="Active Responders" value={item.activeParticipantCount} />
              </Box>
            </OutputForm>
            {showOrgs && <ListedUnitChips item={item} sx={{ mt: 2 }} />}
          </ActivityTile>
        );
      })}
      {activities.length === 0 && <Typography>No recent {type == 'missions' ? 'missions' : 'events'}</Typography>}
    </Stack>
  );
});
