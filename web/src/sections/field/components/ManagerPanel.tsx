import { Paper } from '@mui/material';
import type { SxProps } from '@mui/material/styles';
import { isActiveStatus } from '@sync/domain';
import type { FieldActivity } from '@sync/model';
import { observer } from '@sync/model/react';
import { OutputForm, OutputText, OutputTime } from '../../../ui/OutputForm';
import { RelativeStyle } from '../../../ui/RelativeTimeText';
import { phaseText } from '../../../ui/status';

export const ManagerPanel = observer(function ManagerPanel({ activity, sx }: { activity: FieldActivity; sx?: SxProps }) {
  const rec = activity.record;
  if (!rec) return null;
  const counts = activity.statusCounts;
  const active = activity.participants.filter((p) => isActiveStatus(p.status)).length;

  return (
    <Paper elevation={1} sx={{ p: 1, ...sx }}>
      <OutputForm>
        <OutputText label="State #" value={rec.idNumber} />
        <OutputText label="Agency" value={activity.unit(rec.ownerOrgId)?.title ?? ''} />
        <OutputText label="Mission Status" value={phaseText(activity.phase)} />
        <OutputText label="Active Responders" value={active}></OutputText>
        <OutputText label="Standby" value={counts.standby} />
        <OutputText label="Responding" value={counts.responding} />
        <OutputText label="Checked-In" value={counts.staging + counts.assigned}></OutputText>
        <OutputTime label="Start Time" time={rec.startTime} relative={RelativeStyle.Auto}></OutputTime>
        <OutputTime label="End Time" time={rec.endTime ?? undefined}></OutputTime>
      </OutputForm>
    </Paper>
  );
});
