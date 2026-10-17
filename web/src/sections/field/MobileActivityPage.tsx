import AnnouncementIcon from '@mui/icons-material/Announcement';
import DescriptionIcon from '@mui/icons-material/Description';
import GroupsIcon from '@mui/icons-material/Groups';
import { BottomNavigation, BottomNavigationAction, Box, Paper, Stack, Typography } from '@mui/material';
import { format as formatDate } from 'date-fns';
import { useState, type ReactNode } from 'react';
import type { FieldActivity, FieldParticipant } from '@sync/model';
import { observer } from '@sync/model/react';
import { useDialogs } from '../../shell/dialogs';
import { MobilePageId, usePreferences } from '../../shell/preferences';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { statusText } from '../../ui/status';
import { ActivityActionsBar } from './ActivityActionsBar';
import { BriefingPanel } from './components/BriefingPanel';
import { ManagerPanel } from './components/ManagerPanel';
import { ParticipantEtaUpdater } from './components/ParticipantEtaUpdater';
import { ParticipantDialog, RosterPanel, RosterRowCard, type RosterState } from './components/RosterPanel';
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
          participantRowComponent={RosterRow}
          onClick={(p) => open(ParticipantDialog, { participant: p })}
        />
      </Box>
    </>
  );
});

const RosterRow = observer(function RosterRow({ participant, onClick }: { participant: FieldParticipant; onClick?: () => void }) {
  const eta = participant.record?.eta;
  return (
    <RosterRowCard status={participant.status} onClick={onClick}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', flexGrow: 1, m: '5px', ml: '8px' }}>
        <Stack>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {participant.name}
          </Typography>
          <Typography variant="body2">
            {participant.unit?.name ?? ''} {participant.tags.join(', ')}
          </Typography>
        </Stack>
        <Stack sx={{ textAlign: 'right', justifyContent: 'space-between' }}>
          <Typography variant="body2">{statusText(participant.status)}</Typography>
          <Typography variant="body2">{participant.isEnrouteOrStandby && eta ? `ETA ${formatDate(eta, 'HHmm')}` : null}</Typography>
        </Stack>
      </Stack>
    </RosterRowCard>
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
