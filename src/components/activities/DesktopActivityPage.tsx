import { Divider, Typography } from '@mui/material';

import { Box, Stack } from '@respond/components/Material';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { Activity } from '@respond/types/activity';

import { ActivityInfoPanel } from './ActivityInfoPanel';
import { ActivityActionsBar, ActivityContentProps, ActivityGuardPanel } from './ActivityPage';

export function DesktopActivityPage({ activity }: { activity?: Activity }) {
  return <ActivityGuardPanel activity={activity} component={DesktopActivityContents} />;
}

function DesktopActivityContents({ activity, startChangeState, startRemove }: ActivityContentProps) {
  return (
    <ToolbarPage maxWidth="lg">
      <Stack direction="row" sx={{ mb: 1 }} alignItems="start" spacing={2}>
        <Typography variant="h4" flex="1 1 auto">
          {activity.idNumber} {activity.title}
        </Typography>
        <ActivityActionsBar activity={activity} startRemove={startRemove} startChangeState={startChangeState} />
      </Stack>
      <Stack direction="row" flex="1 1 auto" spacing={1} divider={<Divider orientation="vertical" flexItem />}>
        <Box style={{ backgroundColor: 'blue' }} display="flex" flex="1 1 auto">
          Roster part {activity.id}
        </Box>
        <Stack>
          <ActivityInfoPanel activity={activity} />
        </Stack>
      </Stack>
    </ToolbarPage>
  );
}
