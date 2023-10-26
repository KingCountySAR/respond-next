import { Box } from '@respond/components/Material';
import { OutputForm, OutputLink, OutputText, OutputTextArea, OutputTime } from '@respond/components/OutputForm';
import { getActivityStatus } from '@respond/lib/client/store/activities';
import { Activity, isActive as isParticpantActive, isCheckedIn as isParticpantCheckedIn, Participant, ParticipantStatus } from '@respond/types/activity';

export function ActivityInfoPanel({ activity, responsive }: { activity: Activity; responsive?: boolean }) {
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

  const WrapperComponent = responsive ? OutputForm : Box;
  return (
    <>
      <WrapperComponent>
        <Box>
          <OutputText label="Location" value={activity.location.title} />
          <OutputText label="State #" value={activity.idNumber} />
          <OutputText label="Agency" value={activity.organizations[activity.ownerOrgId]?.title} />
          <OutputLink label="Map" value={activity.mapId} href={`https://caltopo.com/m/${activity.mapId}`} />
        </Box>
        <Box>
          <OutputText label="Mission Status" value={getActivityStatus(activity)} />
          <OutputText label="Active Responders" value={Object.values(activity.participants).reduce(reduceActive, 0).toString()}></OutputText>
          <OutputText label="Standby" value={Object.values(activity.participants).reduce(reduceStandby, 0).toString()}></OutputText>
          <OutputText label="Responding" value={Object.values(activity.participants).reduce(reduceSignedIn, 0).toString()}></OutputText>
          <OutputText label="Checked-In" value={Object.values(activity.participants).reduce(reduceCheckedIn, 0).toString()}></OutputText>
          <OutputTime label="Start Time" time={activity.startTime}></OutputTime>
          <OutputTime label="End Time" time={activity.endTime}></OutputTime>
        </Box>
      </WrapperComponent>
      <OutputTextArea label="Description" value={activity.description} rows={3}></OutputTextArea>
    </>
  );
}
