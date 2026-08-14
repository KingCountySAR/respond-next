import { Box, Stack, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';

import { ActivityTile } from '@respond/components/activities/ActivityTile';
import { OutputForm, OutputText, OutputTime } from '@respond/components/OutputForm';
import { ActivityType, ParticipantStatus } from '@respond/shared/types/activity';

import { ActivityDomainModel } from '@/client/models/activityDomainModel';

import { RelativeStyle } from '../RelativeTimeText';

import { ParticipatingOrgChips } from './ParticipatingOrgChips';

interface ActivityStackProps {
  type: ActivityType;
  activities: ActivityDomainModel[];
  statusMap?: Record<string, ParticipantStatus>;
  showOrgs?: boolean;
}

export const ActivityStack = observer(function ActivityStack({ type, activities, showOrgs, statusMap }: ActivityStackProps) {
  return (
    <Stack spacing={1}>
      {activities.map((vm) => {
        if (!vm.activityLoaded) return null;
        return (
          <ActivityTile key={vm.id} activity={vm} status={statusMap?.[vm.id]}>
            <OutputForm>
              <Box>
                <OutputText label="Location" value={vm.location.title} />
                <OutputText label="State #" value={vm.idNumber} />
              </Box>
              <Box>
                <OutputText label={vm.isMission ? 'Mission Status' : 'Status'} value={vm.statusText} />
                {vm.startsInFuture && <OutputTime label="Start Time" time={vm.startTime} relative={RelativeStyle.Auto}></OutputTime>}
                <OutputText label="Active Responders" value={vm.activeParticipantCount} />
              </Box>
            </OutputForm>
            {showOrgs && <ParticipatingOrgChips activity={vm} sx={{ mt: 2 }} />}
          </ActivityTile>
        );
      })}
      {activities.length === 0 && <Typography>No recent {type == 'missions' ? 'missions' : 'events'}</Typography>}
    </Stack>
  );
});
