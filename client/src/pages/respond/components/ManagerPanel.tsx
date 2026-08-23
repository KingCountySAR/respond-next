import { SxProps } from '@mui/material/styles';
import { observer } from 'mobx-react-lite';

import { Paper } from '@respond/components/Material';
import { OutputForm, OutputText, OutputTime } from '@respond/components/OutputForm';
import { isActive as isParticpantActive, isCheckedIn as isParticpantCheckedIn, ParticipantStatus } from '@respond/shared/types/activity';

import { RelativeStyle } from '@/client/components/RelativeTimeText';
import { ActivityDomainModel } from '@/client/models/activityDomainModel';
import { ParticipantDomainModel } from '@/client/models/participantDomainModel';

export const ManagerPanel = observer(function ManagerPanel({ activity, sx }: { activity: ActivityDomainModel; sx?: SxProps }) {
  const reduceActive = (count: number, participant: ParticipantDomainModel) => {
    return count + (isParticpantActive(participant.timeline[0].status) ? 1 : 0);
  };

  const reduceCheckedIn = (count: number, participant: ParticipantDomainModel) => {
    return count + (isParticpantCheckedIn(participant.timeline[0].status) ? 1 : 0);
  };

  return (
    <Paper elevation={1} sx={{ p: 1, ...sx }}>
      <OutputForm>
        <OutputText label="State #" value={activity.idNumber} />
        <OutputText label="Agency" value={activity.organizationName} />
        <OutputText label="Mission Status" value={activity.statusText} />
        <OutputText label="Active Responders" value={activity.participants.reduce(reduceActive, 0)}></OutputText>
        <OutputText label="Standby" value={activity.participantCountByStatus[ParticipantStatus.Standby]} />
        <OutputText label="Responding" value={activity.participantCountByStatus[ParticipantStatus.SignedIn]} />
        <OutputText label="Checked-In" value={activity.participants.reduce(reduceCheckedIn, 0)}></OutputText>
        <OutputTime label="Start Time" time={activity.startTime} relative={RelativeStyle.Auto}></OutputTime>
        <OutputTime label="End Time" time={activity.endTime}></OutputTime>
      </OutputForm>
    </Paper>
  );
});
