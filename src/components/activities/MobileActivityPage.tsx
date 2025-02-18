import AnnouncementIcon from '@mui/icons-material/Announcement';
import DescriptionIcon from '@mui/icons-material/Description';
import GroupsIcon from '@mui/icons-material/Groups';
import { BottomNavigation, BottomNavigationAction, Box, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import { StatusUpdater } from '@respond/components/StatusUpdater';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';
import { isActive } from '@respond/lib/client/store/activities';
import { ParticipantStatus } from '@respond/types/activity';

import { ParticipantEtaUpdater } from '../participant/ParticipantEtaUpdater';

import { ActivityActionsBar } from './ActivityPage';
import { ActivityParticipantList } from './ActivityParticipantList';
import { useActivityContext } from './ActivityProvider';
import { BriefingPanel } from './BriefingPanel';
import { ManagerPanel } from './ManagerPanel';
import { ParticipatingOrgChips } from './ParticipatingOrgChips';

const MOBILE_BOTTOM_NAV_TAB_HEIGHT = 56;
const MOBILE_STATUS_UPDATER_HEIGHT = 68.5;
const MOBILE_ETA_INPUT_HEIGHT = 59.5;
const ROSTER_PANEL_PADDING = 16;

export enum MobilePageId {
  Briefing = 'Briefing',
  Roster = 'Roster',
  Manage = 'Manage',
}

export function MobileActivityPage() {
  const defaultMobileView: MobilePageId = useAppSelector((state) => state.preferences.defaultMobileView);
  const [bottomNav, setBottomNav] = useState<MobilePageId>(defaultMobileView);
  const activity = useActivityContext();
  const user = useAppSelector((state) => state.auth.userInfo);
  const myParticipation = activity?.participants[user?.participantId ?? ''];
  const showStatusUpdater = isActive(activity);
  const showEta = myParticipation?.timeline[0] && [ParticipantStatus.Standby, ParticipantStatus.SignedIn].includes(myParticipation.timeline[0].status);
  const navFillerHeight = MOBILE_BOTTOM_NAV_TAB_HEIGHT + (showStatusUpdater ? MOBILE_STATUS_UPDATER_HEIGHT : 0) + (showEta ? MOBILE_ETA_INPUT_HEIGHT : 0) - ROSTER_PANEL_PADDING;

  return (
    <ToolbarPage>
      <Typography variant="h5">{activity.title}</Typography>
      {bottomNav === MobilePageId.Roster && <MobileRosterScreen />}
      {bottomNav === MobilePageId.Briefing && <MobileBriefingScreen />}
      {bottomNav === MobilePageId.Manage && <MobileManageScreen />}
      <Box sx={{ height: navFillerHeight }}>{/* filler for bottomnav */}</Box>
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderRadius: 0 }} elevation={3}>
        <Stack spacing={2} p={2}>
          {showEta && <ParticipantEtaUpdater activityId={activity.id} participantId={myParticipation.id} participantEta={myParticipation.eta} />}
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
    </ToolbarPage>
  );
}

function MobileBriefingScreen() {
  return <BriefingPanel />;
}

function MobileRosterScreen() {
  const [orgFilter, setOrgFilter] = useState<string>('');

  return (
    <>
      <ParticipatingOrgChips filter={orgFilter} setFilter={setOrgFilter} />
      <Box style={{ overflowY: 'auto', height: 0, paddingBottom: 16 }} flex="1 1 auto">
        <ActivityParticipantList filter={orgFilter} />
      </Box>
    </>
  );
}

function MobileManageScreen() {
  return (
    <>
      <ActivityActionsBar />
      <ManagerPanel />
    </>
  );
}
