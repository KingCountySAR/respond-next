import { Divider, Typography } from '@mui/material';
import { ReactNode, useState } from 'react';

import { Box, Stack } from '@respond/components/Material';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { Activity, Participant, ParticipatingOrg } from '@respond/types/activity';

import { ActivityInfoPanel } from './ActivityInfoPanel';
import { ActivityActionsBar, ActivityContentProps, ActivityGuardPanel } from './ActivityPage';
import { ParticipatingOrgChips } from './ParticipatingOrgChips';
import { ParticipantDialog, RosterPanel, RosterRowCard } from './RosterPanel';

export function DesktopActivityPage({ activity }: { activity?: Activity }) {
  return <ActivityGuardPanel activity={activity} component={DesktopActivityContents} />;
}

function DesktopActivityContents({ activity, startChangeState, startRemove }: ActivityContentProps) {
  const [orgFilter, setOrgFilter] = useState<string>('');
  const [participantOpen, setParticipantOpen] = useState<boolean>(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant>();

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
          <ParticipatingOrgChips activity={activity} orgFilter={orgFilter} setOrgFilter={setOrgFilter} display="flex" flexDirection="row" />
          <RosterPanel //
            activity={activity}
            filter={orgFilter}
            participantContainerComponent={RosterContainer}
            participantRowComponent={RosterRow}
            onClick={(p) => {
              setSelectedParticipant(p);
              setParticipantOpen(true);
            }}
          />
        </Box>
        <Stack>
          <ActivityInfoPanel activity={activity} />
        </Stack>
      </Stack>
      <ParticipantDialog open={participantOpen} activity={activity} participant={selectedParticipant} onClose={() => setParticipantOpen(false)} />
    </ToolbarPage>
  );
}

function RosterRow({ participant, orgs, onClick }: { participant: Participant; orgs: Record<string, ParticipatingOrg>; onClick?: () => void }) {
  return (
    <RosterRowCard status={participant.timeline[0].status} onClick={onClick}>
      <Stack direction="column" sx={{ m: '5px', ml: '8px' }} flexGrow={1}>
        <Stack>
          <Typography variant="body1" fontWeight={600}>
            {participant.firstname} {participant.lastname}
          </Typography>
          <Typography variant="body2">
            {orgs[participant.organizationId]?.rosterName ?? orgs[participant.organizationId]?.title} {participant.tags?.join(', ')}
          </Typography>
        </Stack>
      </Stack>
    </RosterRowCard>
  );
}

function RosterContainer({ children }: { children: ReactNode }) {
  return <Stack spacing={1}>{children}</Stack>;
}
