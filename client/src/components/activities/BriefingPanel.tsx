import { SxProps } from '@mui/material/styles';
import { observer } from 'mobx-react-lite';

import { Paper } from '@respond/components/Material';
import { OutputForm, OutputLink, OutputLinkified, OutputText, OutputTime } from '@respond/components/OutputForm';
import { ParticipantStatus } from '@respond/shared/types/activity';

import { ActivityDomainModel } from '@/client/models/activityDomainModel';

import { RelativeStyle } from '../RelativeTimeText';

export const BriefingPanel = observer(function BriefingPanel({ activity, sx }: { activity: ActivityDomainModel; sx?: SxProps }) {
  if (!activity.activityLoaded) return null;

  return (
    <Paper elevation={1} sx={{ p: 1, ...sx }}>
      <OutputForm>
        <OutputText label="Location" value={activity.location.title} />
        <OutputLink label="Map" value={activity.mapId} href={`https://caltopo.com/m/${activity.mapId}`} />
        <OutputTime label="Start Time" time={activity.startTime} relative={RelativeStyle.Auto}></OutputTime>
        <OutputText label="Mission Status" value={activity.statusText} />
        <OutputText label="On Their Way" value={activity.participantCountByStatus[ParticipantStatus.SignedIn]}></OutputText>
      </OutputForm>
      <OutputLinkified label="Description" value={activity.description} rows={3}></OutputLinkified>
    </Paper>
  );
});
