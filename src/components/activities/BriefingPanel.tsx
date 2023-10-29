import { Paper } from '@respond/components/Material';
import { OutputForm, OutputLink, OutputText, OutputTextArea, OutputTime } from '@respond/components/OutputForm';
import { getActivityStatus } from '@respond/lib/client/store/activities';
import { Activity, Participant, ParticipantStatus } from '@respond/types/activity';

export function BriefingPanel({ activity }: { activity: Activity }) {
  const reduceSignedIn = (count: number, participant: Participant) => {
    return count + (participant?.timeline[0].status === ParticipantStatus.SignedIn ? 1 : 0);
  };

  return (
    <Paper elevation={1} sx={{ p: 1 }}>
      <OutputForm>
        <OutputText label="Location" value={activity.location.title} />
        <OutputLink label="Map" value={activity.mapId} href={`https://caltopo.com/m/${activity.mapId}`} />
        <OutputTime label="Start Time" time={activity.startTime}></OutputTime>
        <OutputText label="Mission Status" value={getActivityStatus(activity)} />
        <OutputText label="Responding" value={Object.values(activity.participants).reduce(reduceSignedIn, 0).toString()}></OutputText>
      </OutputForm>
      <OutputTextArea label="Description" value={activity.description} rows={3}></OutputTextArea>
    </Paper>
  );
}
