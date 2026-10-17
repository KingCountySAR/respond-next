import { Typography } from '@mui/material';
import { observer, useFieldActivity } from '@sync/model/react';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { Placeholder } from '../../ui/Placeholder';

export const ActivityPage = observer(function ActivityPage() {
  const activity = useFieldActivity();
  const rec = activity.record!;
  return (
    <ToolbarPage>
      <Placeholder title={rec.title} comesWith="the field pages">
        <Typography>
          {rec.location.title} · {activity.phase}
        </Typography>
        <Typography>{activity.me ? `You: ${activity.me.status}` : 'You are not signed in to this activity.'}</Typography>
      </Placeholder>
    </ToolbarPage>
  );
});
