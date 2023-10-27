import { Box, Breadcrumbs, Paper, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';

import { StatusUpdater } from '@respond/components/StatusUpdater';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';
import { isActive } from '@respond/lib/client/store/activities';
import { Activity } from '@respond/types/activity';

import { ActivityInfoPanel } from './ActivityInfoPanel';
import { ActivityActionsBar, ActivityContentProps, ActivityGuardPanel } from './ActivityPage';
import { ParticipatingOrgChips } from './ParticipatingOrgChips';
import { Roster } from './Roster';

export function MobileActivityPage({ activity }: { activity?: Activity }) {
  const breadcrumbText = `${activity?.isMission ? 'Mission' : 'Event'} Details`;

  return (
    <ToolbarPage>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <Link href="/">Home</Link>
        <Typography color="text.primary">{breadcrumbText}</Typography>
      </Breadcrumbs>
      <ActivityGuardPanel activity={activity} component={MobileActivityContents} />
    </ToolbarPage>
  );
}

function MobileActivityContents({ activity, startRemove, startChangeState }: ActivityContentProps) {
  const [rosterOrgFilter, setRosterOrgFilter] = useState<string>('');

  const user = useAppSelector((state) => state.auth.userInfo);
  const myParticipation = activity?.participants[user?.userId ?? ''];
  const isActivityActive = isActive(activity);

  return (
    <Paper sx={{ p: 2, mb: 4 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="start" sx={{ mb: 2 }}>
        <Typography variant="h4" flexGrow={1}>
          {activity.title}
        </Typography>

        <ActivityActionsBar activity={activity} startRemove={startRemove} startChangeState={startChangeState} />
      </Stack>

      <ActivityInfoPanel activity={activity} responsive />
      <Box sx={{ my: 2 }}>{isActivityActive && <StatusUpdater activity={activity} current={myParticipation?.timeline[0].status} />}</Box>

      <Box>
        <Typography>Participating Organizations:</Typography>
      </Box>
      <ParticipatingOrgChips activity={activity} orgFilter={rosterOrgFilter} setOrgFilter={setRosterOrgFilter} />

      <Box>
        <Typography>Roster:</Typography>
        <Roster participants={activity.participants} orgs={activity.organizations} orgFilter={rosterOrgFilter} startTime={activity.startTime} />
      </Box>
    </Paper>
  );
}
