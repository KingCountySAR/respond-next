import { Button, Divider, Typography } from '@mui/material';
import { format as formatDate } from 'date-fns';
import { ReactNode, useState } from 'react';

import { Box, Paper, Stack } from '@respond/components/Material';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';
import { isActive } from '@respond/lib/client/store/activities';
import { Activity, getStatusText, isEnrouteOrStandby, Participant, ParticipatingOrg } from '@respond/types/activity';

import { ParticipantEtaUpdater } from '../participant/ParticipantEtaUpdater';
import { ParticipantTile } from '../participant/ParticipantTile';

import { ActivityActionsBar, ActivityContentProps, ActivityGuardPanel } from './ActivityPage';
import { BriefingPanel } from './BriefingPanel';
import { ManagerPanel } from './ManagerPanel';
import { ParticipatingOrgChips } from './ParticipatingOrgChips';
import { RosterPanel } from './RosterPanel';

export function DesktopActivityPage({ activity }: { activity?: Activity }) {
  return <ActivityGuardPanel activity={activity} component={DesktopActivityContents} />;
}

function DesktopActivityContents({ activity, startChangeState, startRemove }: ActivityContentProps) {
  const user = useAppSelector((state) => state.auth.userInfo);
  const myParticipation = activity?.participants[user?.participantId ?? ''];
  const isActivityActive = isActive(activity);

  const [orgFilter, setOrgFilter] = useState<string>('');

  const showEta = isEnrouteOrStandby(myParticipation?.timeline[0]?.status);

  return (
    <ToolbarPage maxWidth="lg">
      <Stack direction="row" sx={{ mb: 1 }} alignItems="start" spacing={2}>
        <Typography variant="h4" flex="1 1 auto">
          {activity.idNumber} {activity.title}
        </Typography>
        <ActivityActionsBar activity={activity} startRemove={startRemove} startChangeState={startChangeState} />
      </Stack>
      <Stack direction="row" flex="1 1 auto" spacing={1} divider={<Divider orientation="vertical" flexItem />}>
        <Box display="flex" flex="1 1 auto" flexDirection="column">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <ParticipatingOrgChips activity={activity} orgFilter={orgFilter} setOrgFilter={setOrgFilter} display="flex" flexDirection="row" />
            <Stack direction={'row'} spacing={1}>
              <Button href={`/${activity.isMission ? 'mission' : 'event'}/${activity.id}/kiosk`} variant="outlined" size="small">
                Base Mode
              </Button>
              <Button href={`/roster/${activity.id}`} variant="outlined" size="small">
                View Roster
              </Button>
            </Stack>
          </Stack>
          <RosterPanel //
            filter={orgFilter}
            participantContainerComponent={RosterContainer}
            participantRowComponent={RosterRow}
          />
        </Box>
        <Stack alignItems="stretch" sx={{ width: 400 }}>
          <BriefingPanel activity={activity} sx={{ px: 3 }} />
          {showEta && (
            <Paper sx={{ mt: 2, p: 2 }}>
              <ParticipantEtaUpdater />
            </Paper>
          )}
          {isActivityActive && (
            <Box sx={{ my: 2 }} display="flex" justifyContent="end">
              <StatusUpdater />
            </Box>
          )}
          <ManagerPanel activity={activity} sx={{ px: 3 }} />
        </Stack>
      </Stack>
    </ToolbarPage>
  );
}

function RosterRow({ participant, orgs }: { participant: Participant; orgs: Record<string, ParticipatingOrg> }) {
  return (
    <ParticipantTile participant={participant}>
      <Stack direction="column" sx={{ m: '5px', ml: '8px' }} flexGrow={1}>
        <Stack direction="row" spacing={2} justifyContent={'space-between'}>
          <Stack>
            <Typography variant="body1" fontWeight={600}>
              {participant.firstname} {participant.lastname}
            </Typography>
            <Typography variant="body2">
              {orgs[participant.organizationId]?.rosterName ?? orgs[participant.organizationId]?.title} {participant.tags?.join(', ')}
            </Typography>
          </Stack>
          <Stack textAlign={'right'} justifyContent={'space-between'}>
            <Typography variant="body2">{getStatusText(participant.timeline[0].status)}</Typography>
            <Typography variant="body2">{isEnrouteOrStandby(participant.timeline[0].status) && participant.eta ? <>ETA {formatDate(participant.eta, 'HHmm')}</> : <></>}</Typography>
          </Stack>
        </Stack>
      </Stack>
    </ParticipantTile>
  );
}

function RosterContainer({ children }: { children: ReactNode }) {
  return <Stack spacing={1}>{children}</Stack>;
}
