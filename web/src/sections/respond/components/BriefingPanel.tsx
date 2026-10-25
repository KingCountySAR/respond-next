import { Paper } from '@mui/material';
import type { SxProps } from '@mui/material/styles';
import type { RespondActivity } from '@sync/model';
import { observer } from '@sync/model/react';
import { OutputForm, OutputLink, OutputLinkified, OutputText, OutputTime } from '../../../ui/OutputForm';
import { RelativeStyle } from '../../../ui/RelativeTimeText';
import { phaseText } from '../../../ui/status';

export const BriefingPanel = observer(function BriefingPanel({ activity, sx }: { activity: RespondActivity; sx?: SxProps }) {
  const rec = activity.record;
  if (!rec) return null;

  return (
    <Paper elevation={1} sx={{ p: 1, ...sx }}>
      <OutputForm>
        <OutputText label="Location" value={rec.location.title} />
        <OutputLink label="Map" value={rec.mapId} href={`https://caltopo.com/m/${rec.mapId}`} />
        <OutputTime label="Start Time" time={rec.startTime} relative={RelativeStyle.Auto}></OutputTime>
        <OutputText label="Mission Status" value={phaseText(activity.phase)} />
        <OutputText label="On Their Way" value={activity.statusCounts.responding}></OutputText>
      </OutputForm>
      <OutputLinkified label="Description" value={rec.description} rows={3}></OutputLinkified>
    </Paper>
  );
});
