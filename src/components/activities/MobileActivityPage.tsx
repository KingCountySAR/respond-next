import AnnouncementIcon from '@mui/icons-material/Announcement';
import DescriptionIcon from '@mui/icons-material/Description';
import GroupsIcon from '@mui/icons-material/Groups';
import { BottomNavigation, BottomNavigationAction, Box, Paper, Stack, Typography } from '@mui/material';
import { ReactNode, useState } from 'react';

import { StatusUpdater } from '@respond/components/StatusUpdater';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';
import { isActive } from '@respond/lib/client/store/activities';
import { Activity, Participant, ParticipatingOrg } from '@respond/types/activity';

import { ActivityInfoPanel } from './ActivityInfoPanel';
import { ActivityActionsBar, ActivityContentProps, ActivityGuardPanel } from './ActivityPage';
import { ParticipatingOrgChips } from './ParticipatingOrgChips';
import { ParticipantDialog, RosterPanel, RosterRowCard } from './RosterPanel';

enum MobilePageId {
  Briefing,
  Roster,
  Manage,
}

export function MobileActivityPage({ activity }: { activity?: Activity }) {
  //const breadcrumbText = `${activity?.isMission ? 'Mission' : 'Event'} Details`;

  return (
    <ToolbarPage>
      {/* <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <Link href="/">Home</Link>
        <Typography color="text.primary">{breadcrumbText}</Typography>
      </Breadcrumbs> */}
      <ActivityGuardPanel activity={activity} component={MobileActivityContents} />
    </ToolbarPage>
  );
}

function MobileBriefingScreen({ activity }: { activity: Activity }) {
  const user = useAppSelector((state) => state.auth.userInfo);
  const myParticipation = activity?.participants[user?.userId ?? ''];
  const isActivityActive = isActive(activity);

  return (
    <>
      <Box sx={{ my: 2 }}>{isActivityActive && <StatusUpdater activity={activity} current={myParticipation?.timeline[0].status} />}</Box>
      <Box>
        <strong>Make this the info interesting to responders (driving directions, location, description)</strong>
      </Box>
      <ActivityInfoPanel activity={activity} responsive />
    </>
  );
}

function MobileRosterScreen({ activity }: { activity: Activity }) {
  const [orgFilter, setOrgFilter] = useState<string>('');
  const [participantOpen, setParticipantOpen] = useState<boolean>(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant>();

  return (
    <>
      <ParticipatingOrgChips activity={activity} orgFilter={orgFilter} setOrgFilter={setOrgFilter} />
      <Box style={{ overflowY: 'auto', height: 0, paddingBottom: '16px' }} flex="1 1 auto">
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
      <ParticipantDialog open={participantOpen} activity={activity} participant={selectedParticipant} onClose={() => setParticipantOpen(false)} />
    </>
  );
}

function RosterRow({ participant, orgs, onClick }: { participant: Participant; orgs: Record<string, ParticipatingOrg>; onClick?: () => void }) {
  return (
    <RosterRowCard status={participant.timeline[0].status} onClick={onClick}>
      <Box sx={{ m: '5px', ml: '8px' }} display="flex" flexDirection="column" flex="1 1 auto">
        <Stack direction="row" flexGrow={1} justifyContent="space-between" flex="1 1 auto">
          <Typography variant="body1" fontWeight={600}>
            {participant.firstname} {participant.lastname}
          </Typography>
        </Stack>
        <Stack direction="row" flexGrow={1} justifyContent="space-between" flex="1 1 auto">
          <Typography variant="body2">
            {orgs[participant.organizationId]?.rosterName ?? orgs[participant.organizationId]?.title} {participant.tags?.join(', ')}
          </Typography>
        </Stack>
      </Box>
    </RosterRowCard>
  );
}

function RosterContainer({ children }: { children: ReactNode }) {
  return <Stack spacing={1}>{children}</Stack>;
}

function MobileManageScreen({ activity, startRemove, startChangeState }: { activity: Activity; startRemove: () => void; startChangeState: () => void }) {
  return (
    <>
      <ActivityActionsBar activity={activity} startRemove={startRemove} startChangeState={startChangeState} />
      <Box>
        <strong>Make this the info interesting to managers</strong>
      </Box>
      <ActivityInfoPanel activity={activity} responsive />
    </>
  );
}

function MobileActivityContents({ activity, startRemove, startChangeState }: ActivityContentProps) {
  const [bottomNav, setBottomNav] = useState<MobilePageId>(MobilePageId.Briefing);

  return (
    <>
      <Typography variant="h5">{activity.title}</Typography>
      {bottomNav === MobilePageId.Roster && <MobileRosterScreen activity={activity} />}
      {bottomNav === MobilePageId.Briefing && <MobileBriefingScreen activity={activity} />}
      {bottomNav === MobilePageId.Manage && <MobileManageScreen activity={activity} startRemove={startRemove} startChangeState={startChangeState} />}
      <Box sx={{ height: 40 }}>{/* filler for bottomnav */}</Box>
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
        <BottomNavigation
          showLabels
          value={bottomNav}
          onChange={(_evt, value) => {
            setBottomNav(value);
          }}
        >
          <BottomNavigationAction value={MobilePageId.Manage} label="Manage" icon={<DescriptionIcon />} />
          <BottomNavigationAction value={MobilePageId.Roster} label="Roster" icon={<GroupsIcon />} />
          <BottomNavigationAction value={MobilePageId.Briefing} label="Briefing" icon={<AnnouncementIcon />} />
        </BottomNavigation>
      </Paper>
    </>
  );
}
