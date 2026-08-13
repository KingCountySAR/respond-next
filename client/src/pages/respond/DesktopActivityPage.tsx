import { Button, Divider, Typography } from '@mui/material';
import { format as formatDate } from 'date-fns';
import { observer } from 'mobx-react-lite';
import { ReactNode, useState } from 'react';
import { Link } from 'wouter';

import AddParticipantButton from '@respond/components/activities/AddParticipantButton';
import { BriefingPanel } from '@respond/components/activities/BriefingPanel';
import { ManagerPanel } from '@respond/components/activities/ManagerPanel';
import { ParticipatingOrgChips } from '@respond/components/activities/ParticipatingOrgChips';
import { ParticipantDialog, RosterPanel, RosterRowCard } from '@respond/components/activities/RosterPanel';
import { Box, Paper, Stack } from '@respond/components/Material';
import { ParticipantEtaUpdater } from '@respond/components/participant/ParticipantEtaUpdater';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { ParticipantStatus } from '@respond/shared/types/activity';

import { ParticipantDomainModel } from 'src/models/participantDomainModel';
import { ActivityViewModel } from 'src/pages/respond/activityViewModel';

import { ActivityActionsBar } from './ActivityPage';

export const DesktopActivityPage = observer(function DesktopActivityPage({ vm }: { vm: ActivityViewModel }) {
  const activity = vm.activity!;
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantDomainModel>();
  const [participantOpen, setParticipantOpen] = useState(false);
  return (
    <ToolbarPage maxWidth="lg">
      <Stack direction="row" sx={{ mb: 1, alignItems: 'start' }} spacing={2}>
        <Typography variant="h4" sx={{ flex: '1 1 auto' }}>
          {activity.idNumber} {activity.title}
        </Typography>
        <ActivityActionsBar vm={vm} />
      </Stack>
      <Stack direction="row" spacing={1} divider={<Divider orientation="vertical" flexItem />} sx={{ flex: '1 1 auto' }}>
        <Box sx={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column' }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <ParticipatingOrgChips filter={vm.roster.filter} setFilter={(f) => vm.roster.setFilter(f)} sx={{ display: 'flex', flexDirection: 'row' }} />
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <AddParticipantButton activity={activity} />
              <Button component={Link} href={`/roster/${activity.id}`} variant="outlined" size="small">
                View Roster
              </Button>
            </Stack>
          </Stack>
          <RosterPanel //
            roster={vm.roster}
            participantContainerComponent={RosterContainer}
            participantRowComponent={RosterRow}
            onClick={(p) => {
              if (!p.participant) return;
              setSelectedParticipant(p);
              setParticipantOpen(true);
            }}
          />
        </Box>
        <Stack sx={{ width: 400, alignItems: 'stretch' }}>
          <BriefingPanel sx={{ px: 3 }} />
          {vm.myParticipation?.isEnrouteOrStandby && vm.myParticipation.id && (
            <Paper sx={{ mt: 2, p: 2 }}>
              <ParticipantEtaUpdater participant={vm.myParticipation} />
            </Paper>
          )}
          {vm.isActive && (
            <Box sx={{ my: 2, display: 'flex', justifyContent: 'end' }}>
              <StatusUpdater />
            </Box>
          )}
          <ManagerPanel sx={{ px: 3 }} />
        </Stack>
      </Stack>
      <ParticipantDialog open={participantOpen} participant={selectedParticipant} onClose={() => setParticipantOpen(false)} />
    </ToolbarPage>
  );
});

const RosterRow = observer(function RosterRow({ participant, onClick }: { participant: ParticipantDomainModel; onClick?: () => void }) {
  return (
    <RosterRowCard status={participant.status ?? ParticipantStatus.NotResponding} onClick={onClick}>
      <Stack direction="column" sx={{ m: '5px', ml: '8px', flexGrow: 1 }}>
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Stack>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {participant.fullName}
            </Typography>
            <Typography variant="body2">
              {participant.organizationName} {participant.tags.join(', ')}
            </Typography>
          </Stack>
          <Stack sx={{ textAlign: 'right', justifyContent: 'space-between' }}>
            <Typography variant="body2">{participant.statusText}</Typography>
            <Typography variant="body2">{participant.isEnrouteOrStandby && participant.eta ? <>ETA {formatDate(participant.eta, 'HHmm')}</> : <></>}</Typography>
          </Stack>
        </Stack>
      </Stack>
    </RosterRowCard>
  );
});

function RosterContainer({ children }: { children: ReactNode }) {
  return <Stack spacing={1}>{children}</Stack>;
}
