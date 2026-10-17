import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import { format as formatDate } from 'date-fns';
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import type { FieldActivity, FieldParticipant } from '@sync/model';
import { observer } from '@sync/model/react';
import { useDialogs } from '../../shell/dialogs';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { statusText } from '../../ui/status';
import { ActivityActionsBar } from './ActivityActionsBar';
import { BriefingPanel } from './components/BriefingPanel';
import { ManagerPanel } from './components/ManagerPanel';
import { ParticipantEtaUpdater } from './components/ParticipantEtaUpdater';
import { ParticipantDialog, RosterPanel, RosterRowCard, type RosterState } from './components/RosterPanel';
import { StatusUpdater } from './components/StatusUpdater';
import { UnitChips } from './components/UnitChips';

export const DesktopActivityPage = observer(function DesktopActivityPage({ activity, roster }: { activity: FieldActivity; roster: RosterState }) {
  const { open } = useDialogs();
  const rec = activity.record!;
  const me = activity.me;
  return (
    <ToolbarPage maxWidth="lg">
      <Stack direction="row" sx={{ mb: 1, alignItems: 'start' }} spacing={2}>
        <Typography variant="h4" sx={{ flex: '1 1 auto' }}>
          {rec.idNumber} {rec.title}
        </Typography>
        <ActivityActionsBar activity={activity} />
      </Stack>
      <Stack direction="row" spacing={1} divider={<Divider orientation="vertical" flexItem />} sx={{ flex: '1 1 auto' }}>
        <Box sx={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column' }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <UnitChips activity={activity} filter={roster.filter} setFilter={roster.setFilter} sx={{ display: 'flex', flexDirection: 'row' }} />
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Button component={Link} href={`~/reports/roster/${activity.activityId}`} variant="outlined" size="small">
                View Roster
              </Button>
            </Stack>
          </Stack>
          <RosterPanel //
            participants={activity.participants}
            roster={roster}
            participantContainerComponent={RosterContainer}
            participantRowComponent={RosterRow}
            onClick={(p) => open(ParticipantDialog, { participant: p })}
          />
        </Box>
        <Stack sx={{ width: 400, alignItems: 'stretch' }}>
          <BriefingPanel sx={{ px: 3 }} activity={activity} />
          {me?.isEnrouteOrStandby && (
            <Paper sx={{ mt: 2, p: 2 }}>
              <ParticipantEtaUpdater participant={me} />
            </Paper>
          )}
          {!rec.closed && (
            <Box sx={{ my: 2, display: 'flex', justifyContent: 'end' }}>
              <StatusUpdater activity={activity} />
            </Box>
          )}
          <ManagerPanel activity={activity} sx={{ px: 3 }} />
        </Stack>
      </Stack>
    </ToolbarPage>
  );
});

const RosterRow = observer(function RosterRow({ participant, onClick }: { participant: FieldParticipant; onClick?: () => void }) {
  const eta = participant.record?.eta;
  return (
    <RosterRowCard status={participant.status} onClick={onClick}>
      <Stack direction="column" sx={{ m: '5px', ml: '8px', flexGrow: 1 }}>
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Stack>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {participant.name}
            </Typography>
            <Typography variant="body2">
              {participant.unit?.name ?? ''} {participant.tags.join(', ')}
            </Typography>
          </Stack>
          <Stack sx={{ textAlign: 'right', justifyContent: 'space-between' }}>
            <Typography variant="body2">{statusText(participant.status)}</Typography>
            <Typography variant="body2">{participant.isEnrouteOrStandby && eta ? <>ETA {formatDate(eta, 'HHmm')}</> : <></>}</Typography>
          </Stack>
        </Stack>
      </Stack>
    </RosterRowCard>
  );
});

function RosterContainer({ children }: { children: ReactNode }) {
  return <Stack spacing={1}>{children}</Stack>;
}
