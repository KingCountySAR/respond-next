import AnnouncementIcon from '@mui/icons-material/Announcement';
import DescriptionIcon from '@mui/icons-material/Description';
import GroupsIcon from '@mui/icons-material/Groups';
import { BottomNavigation, BottomNavigationAction, Box, Paper, Stack, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';
import type { FieldActivity } from '@sync/model';
import { observer } from '@sync/model/react';
import { useDialogs } from '../../shell/dialogs';
import { MobilePageId, usePreferences } from '../../shell/preferences';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { ActivityActionsBar } from './ActivityActionsBar';
import { BriefingPanel } from './components/BriefingPanel';
import { ManagerPanel } from './components/ManagerPanel';
import { ParticipantEtaUpdater } from './components/ParticipantEtaUpdater';
import { ParticipantTile } from './components/ParticipantTile';
import { ParticipantDialog, RosterPanel, type RosterState } from './components/RosterPanel';
import { StatusUpdater } from './components/StatusUpdater';
import { UnitChips } from './components/UnitChips';

const MOBILE_BOTTOM_NAV_TAB_HEIGHT = 56;
const MOBILE_STATUS_UPDATER_HEIGHT = 68.5;
const MOBILE_ETA_INPUT_HEIGHT = 59.5;
const ROSTER_PANEL_PADDING = 16;

export const MobileActivityPage = observer(function MobileActivityPage({ activity, roster }: { activity: FieldActivity; roster: RosterState }) {
  const { defaultMobileView } = usePreferences();
  const [bottomNav, setBottomNav] = useState<MobilePageId>(defaultMobileView);
  const me = activity.me;
  const showParticipantOptions = !activity.record?.closed;
  const showEta = me?.isEnrouteOrStandby;
  const navFillerHeight = MOBILE_BOTTOM_NAV_TAB_HEIGHT + (showParticipantOptions ? MOBILE_STATUS_UPDATER_HEIGHT : 0) + (showEta ? MOBILE_ETA_INPUT_HEIGHT : 0) - ROSTER_PANEL_PADDING;

  return (
    <ToolbarPage>
      <Typography variant="h5">{activity.record?.title}</Typography>
      {bottomNav === MobilePageId.Roster && <MobileRosterScreen activity={activity} roster={roster} />}
      {bottomNav === MobilePageId.Briefing && <BriefingPanel activity={activity} />}
      {bottomNav === MobilePageId.Manage && <MobileManageScreen activity={activity} />}
      <Box sx={{ height: navFillerHeight }}>{/* filler for bottomnav */}</Box>
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderRadius: 0 }} elevation={3}>
        {showParticipantOptions && (
          <Stack spacing={2} sx={{ p: 2 }}>
            {showEta && me && <ParticipantEtaUpdater participant={me} />}
            <StatusUpdater activity={activity} fullWidth={true} />
          </Stack>
        )}
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
});

const MobileRosterScreen = observer(function MobileRosterScreen({ activity, roster }: { activity: FieldActivity; roster: RosterState }) {
  const { open } = useDialogs();
  return (
    <>
      <UnitChips activity={activity} filter={roster.filter} setFilter={roster.setFilter} />
      <Box style={{ overflowY: 'auto', height: 0, paddingBottom: 16 }} sx={{ flex: '1 1 auto' }}>
        <RosterPanel //
          participants={activity.participants}
          roster={roster}
          participantContainerComponent={RosterContainer}
          participantRowComponent={ParticipantTile}
          onClick={(p) => open(ParticipantDialog, { participant: p })}
        />
      </Box>
    </>
  );
});


function RosterContainer({ children }: { children: ReactNode }) {
  return <Stack spacing={1}>{children}</Stack>;
}

function MobileManageScreen({ activity }: { activity: FieldActivity }) {
  return (
    <>
      <ActivityActionsBar activity={activity} />
      <ManagerPanel activity={activity} />
    </>
  );
}
