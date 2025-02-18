import { Button, Divider, Typography } from '@mui/material';
import { useState } from 'react';

import { Box, Paper, Stack } from '@respond/components/Material';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';
import { isActive } from '@respond/lib/client/store/activities';
import { isEnrouteOrStandby } from '@respond/types/activity';

import { ParticipantEtaUpdater } from '../participant/ParticipantEtaUpdater';

import { ActivityActionsBar } from './ActivityPage';
import { ActivityParticipantList } from './ActivityParticipantList';
import { useActivityContext } from './ActivityProvider';
import { BriefingPanel } from './BriefingPanel';
import { ManagerPanel } from './ManagerPanel';
import { ParticipatingOrgChips } from './ParticipatingOrgChips';

export function DesktopActivityPage() {
  const activity = useActivityContext();
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
        <ActivityActionsBar />
      </Stack>
      <Stack direction="row" flex="1 1 auto" spacing={1} divider={<Divider orientation="vertical" flexItem />}>
        <Box display="flex" flex="1 1 auto" flexDirection="column">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <ParticipatingOrgChips filter={orgFilter} setFilter={setOrgFilter} display="flex" flexDirection="row" />
            <Button href={`/roster/${activity.id}`} variant="outlined" size="small">
              View Roster
            </Button>
          </Stack>
          <ActivityParticipantList filter={orgFilter} />
        </Box>
        <Stack alignItems="stretch" sx={{ width: 400 }}>
          <BriefingPanel sx={{ px: 3 }} />
          {showEta && (
            <Paper sx={{ mt: 2, p: 2 }}>
              <ParticipantEtaUpdater activityId={activity.id} participantId={myParticipation.id} participantEta={myParticipation.eta} />
            </Paper>
          )}
          {isActivityActive && (
            <Box sx={{ my: 2 }} display="flex" justifyContent="end">
              <StatusUpdater />
            </Box>
          )}
          <ManagerPanel sx={{ px: 3 }} />
        </Stack>
      </Stack>
    </ToolbarPage>
  );
}
