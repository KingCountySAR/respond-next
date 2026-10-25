import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import type { FieldActivity } from '@sync/model';
import { observer } from '@sync/model/react';
import { useDialogs } from '../../shell/dialogs';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { ActivityActionsBar } from './ActivityActionsBar';
import { AddParticipantButton } from './components/AddParticipantButton';
import { BriefingPanel } from './components/BriefingPanel';
import { ManagerPanel } from './components/ManagerPanel';
import { ParticipantEtaUpdater } from './components/ParticipantEtaUpdater';
import { ParticipantTile } from './components/ParticipantTile';
import { ParticipantDialog, RosterPanel, type RosterState } from './components/RosterPanel';
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
      <Stack direction="row" spacing={1} divider={<Divider orientation="vertical" flexItem />} sx={{ flex: '1 1 auto', paddingBottom: 2 }}>
        <Box sx={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column' }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <UnitChips activity={activity} filter={roster.filter} setFilter={roster.setFilter} sx={{ display: 'flex', flexDirection: 'row' }} />
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <AddParticipantButton activity={activity} />
              <Button component={Link} href={`~/reports/roster/${activity.activityId}`} variant="outlined" size="small">
                View Roster
              </Button>
            </Stack>
          </Stack>
          <RosterPanel //
            participants={activity.participants}
            roster={roster}
            participantContainerComponent={RosterContainer}
            participantRowComponent={ParticipantTile}
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


function RosterContainer({ children }: { children: ReactNode }) {
  return <Stack spacing={1}>{children}</Stack>;
}
