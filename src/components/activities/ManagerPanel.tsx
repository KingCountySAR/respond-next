import { SxProps } from '@mui/material/styles';

import { Paper } from '@respond/components/Material';
import { OutputForm, OutputText, OutputTime } from '@respond/components/OutputForm';
import { getActivityStatus } from '@respond/lib/client/store/activities';
import { Activity, isActive as isParticpantActive, isCheckedIn as isParticpantCheckedIn, Participant, ParticipantStatus } from '@respond/types/activity';

import { RelativeStyle } from '../RelativeTimeText';

export function ManagerPanel({ activity, sx }: { activity: Activity; sx?: SxProps }) {
  const reduceActive = (count: number, participant: Participant) => {
    return count + (isParticpantActive(participant?.timeline[0].status) ? 1 : 0);
  };

  const reduceStandby = (count: number, participant: Participant) => {
    return count + (participant?.timeline[0].status === ParticipantStatus.Standby ? 1 : 0);
  };

  const reduceSignedIn = (count: number, participant: Participant) => {
    return count + (participant?.timeline[0].status === ParticipantStatus.SignedIn ? 1 : 0);
  };

  const reduceCheckedIn = (count: number, participant: Participant) => {
    return count + (isParticpantCheckedIn(participant?.timeline[0].status) ? 1 : 0);
  };

  return (
    <Paper elevation={1} sx={{ p: 1, ...sx }}>
      <OutputForm>
        <OutputText label="State #" value={activity.idNumber} />
        <OutputText label="Agency" value={activity.organizations[activity.ownerOrgId]?.title} />
        <OutputText label="Mission Status" value={getActivityStatus(activity)} />
        <OutputText label="Active Responders" value={Object.values(activity.participants).reduce(reduceActive, 0).toString()}></OutputText>
        <OutputText label="Standby" value={Object.values(activity.participants).reduce(reduceStandby, 0).toString()}></OutputText>
        <OutputText label="Responding" value={Object.values(activity.participants).reduce(reduceSignedIn, 0).toString()}></OutputText>
        <OutputText label="Checked-In" value={Object.values(activity.participants).reduce(reduceCheckedIn, 0).toString()}></OutputText>
        <OutputTime label="Start Time" time={activity.startTime} relative={RelativeStyle.Auto}></OutputTime>
        <OutputTime label="End Time" time={activity.endTime}></OutputTime>
      </OutputForm>
    </Paper>
  );
}
