import AnnouncementIcon from '@mui/icons-material/Announcement';
import DescriptionIcon from '@mui/icons-material/Description';
import GroupsIcon from '@mui/icons-material/Groups';
import { BottomNavigation, BottomNavigationAction, Box, Paper, Stack, Typography } from '@mui/material';
import { format as formatDate } from 'date-fns';
import { ReactNode, useState } from 'react';

import { StatusUpdater } from '@respond/components/StatusUpdater';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';
import { isActive } from '@respond/lib/client/store/activities';
import { Activity, getStatusText, isEnrouteOrStandby, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/types/activity';

import { ParticipantEtaUpdater } from '../participant/ParticipantEtaUpdater';
import { ParticipantTile } from '../participant/ParticipantTile';

import { ActivityActionsBar, ActivityContentProps, ActivityGuardPanel } from './ActivityPage';
import { BriefingPanel } from './BriefingPanel';
import { ManagerPanel } from './ManagerPanel';
import { ParticipatingOrgChips } from './ParticipatingOrgChips';
import { RosterPanel } from './RosterPanel';

const MOBILE_BOTTOM_NAV_TAB_HEIGHT = 56;
const MOBILE_STATUS_UPDATER_HEIGHT = 68.5;
const MOBILE_ETA_INPUT_HEIGHT = 59.5;
const ROSTER_PANEL_PADDING = 16;

export enum MobilePageId {
  Briefing = 'Briefing',
  Roster = 'Roster',
  Manage = 'Manage',
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
  return <BriefingPanel activity={activity} />;
}

function MobileRosterScreen({ activity }: { activity: Activity }) {
  const [orgFilter, setOrgFilter] = useState<string>('');

  return (
    <>
      <ParticipatingOrgChips activity={activity} orgFilter={orgFilter} setOrgFilter={setOrgFilter} />
      <Box style={{ overflowY: 'auto', height: 0, paddingBottom: 16 }} flex="1 1 auto">
        <RosterPanel //
          filter={orgFilter}
          participantContainerComponent={RosterContainer}
          participantRowComponent={RosterRow}
        />
      </Box>
    </>
  );
}

function RosterRow({ participant, orgs }: { participant: Participant; orgs: Record<string, ParticipatingOrg> }) {
  return (
    <ParticipantTile participant={participant}>
      <Stack direction="row" sx={{ m: '5px', ml: '8px' }} justifyContent="space-between" flexGrow={1}>
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
    </ParticipantTile>
  );
}

function RosterContainer({ children }: { children: ReactNode }) {
  return <Stack spacing={1}>{children}</Stack>;
}

function MobileManageScreen({ activity, startRemove, startChangeState }: { activity: Activity; startRemove: () => void; startChangeState: () => void }) {
  return (
    <>
      <ActivityActionsBar activity={activity} startRemove={startRemove} startChangeState={startChangeState} />
      <ManagerPanel activity={activity} />
    </>
  );
}

function MobileActivityContents({ activity, startRemove, startChangeState }: ActivityContentProps) {
  const defaultMobileView: MobilePageId = useAppSelector((state) => state.preferences.defaultMobileView);
  const [bottomNav, setBottomNav] = useState<MobilePageId>(defaultMobileView);
  const user = useAppSelector((state) => state.auth.userInfo);
  const myParticipation = activity?.participants[user?.participantId ?? ''];
  const showStatusUpdater = isActive(activity);
  const showEta = myParticipation?.timeline[0] && [ParticipantStatus.Standby, ParticipantStatus.SignedIn].includes(myParticipation.timeline[0].status);
  const navFillerHeight = MOBILE_BOTTOM_NAV_TAB_HEIGHT + (showStatusUpdater ? MOBILE_STATUS_UPDATER_HEIGHT : 0) + (showEta ? MOBILE_ETA_INPUT_HEIGHT : 0) - ROSTER_PANEL_PADDING;
  return (
    <>
      <Typography variant="h5">{activity.title}</Typography>
      {bottomNav === MobilePageId.Roster && <MobileRosterScreen activity={activity} />}
      {bottomNav === MobilePageId.Briefing && <MobileBriefingScreen activity={activity} />}
      {bottomNav === MobilePageId.Manage && <MobileManageScreen activity={activity} startRemove={startRemove} startChangeState={startChangeState} />}
      <Box sx={{ height: navFillerHeight }}>{/* filler for bottomnav */}</Box>
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderRadius: 0 }} elevation={3}>
        <Stack spacing={2} p={2}>
          {showEta && <ParticipantEtaUpdater />}
          {showStatusUpdater && (
            <Box>
              <StatusUpdater fullWidth={true} />
            </Box>
          )}
        </Stack>
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
