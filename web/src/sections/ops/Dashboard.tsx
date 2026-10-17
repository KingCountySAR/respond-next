import { Alert, Typography } from '@mui/material';
import { isCommandActivity } from '@sync/model';
import { observer, useFieldActivity } from '@sync/model/react';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { Placeholder } from '../../ui/Placeholder';

export const Dashboard = observer(function Dashboard() {
  const activity = useFieldActivity();
  if (!isCommandActivity(activity)) {
    return (
      <ToolbarPage maxWidth={false}>
        <Alert severity="warning">The operations dashboard is for command and support.</Alert>
      </ToolbarPage>
    );
  }
  const counts = activity.statusCounts;
  return (
    <ToolbarPage maxWidth={false}>
      <Placeholder title={`${activity.record!.title}: operations`} comesWith="the ops dashboard">
        <Typography>
          {activity.participants.length} people · {counts.assigned} assigned · {counts.staging} staging · {activity.teams.length} teams
        </Typography>
      </Placeholder>
    </ToolbarPage>
  );
});
