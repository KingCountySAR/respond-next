import AnnouncementIcon from '@mui/icons-material/Announcement';
import DescriptionIcon from '@mui/icons-material/Description';
import GroupsIcon from '@mui/icons-material/Groups';
import { BottomNavigation, BottomNavigationAction, Box, Paper, Stack, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { ReactNode, useState } from 'react';

import { BriefingPanel } from '@respond/components/activities/BriefingPanel';
import { ManagerPanel } from '@respond/components/activities/ManagerPanel';
import { ParticipatingOrgChips } from '@respond/components/activities/ParticipatingOrgChips';
import { ParticipantDialog, RosterPanel, RosterRowCard } from '@respond/components/activities/RosterPanel';
import { ParticipantEtaUpdater } from '@respond/components/participant/ParticipantEtaUpdater';
import { usePreferences } from '@respond/components/PreferencesProvider';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { ToolbarPage } from '@respond/components/ToolbarPage';

import { ParticipantDomainModel } from '@/client/models/participantDomainModel';
import { ActivityViewModel } from '@/client/pages/respond/activityViewModel';
import { MobilePageId } from '@/client/types';

import { ActivityActionsBar } from './ActivityPage';

const MOBILE_BOTTOM_NAV_TAB_HEIGHT = 56;
const MOBILE_STATUS_UPDATER_HEIGHT = 68.5;
const MOBILE_ETA_INPUT_HEIGHT = 59.5;
const ROSTER_PANEL_PADDING = 16;

export const MobileActivityPage = observer(function MobileActivityPage({ activity }: { activity: ActivityViewModel }) {
  const { defaultMobileView } = usePreferences();
  const [bottomNav, setBottomNav] = useState<MobilePageId>(defaultMobileView);
  const myParticipation = activity.myParticipation;
  const showParticipantOptions = activity.isActive;
  const showEta = myParticipation?.isEnrouteOrStandby;
  const navFillerHeight = MOBILE_BOTTOM_NAV_TAB_HEIGHT + (showParticipantOptions ? MOBILE_STATUS_UPDATER_HEIGHT : 0) + (showEta ? MOBILE_ETA_INPUT_HEIGHT : 0) - ROSTER_PANEL_PADDING;

  return (
    <ToolbarPage>
      <Typography variant="h5">{activity.title}</Typography>
      {bottomNav === MobilePageId.Roster && <MobileRosterScreen activity={activity} />}
      {bottomNav === MobilePageId.Briefing && <MobileBriefingScreen activity={activity} />}
      {bottomNav === MobilePageId.Manage && <MobileManageScreen vm={activity} />}
      <Box sx={{ height: navFillerHeight }}>{/* filler for bottomnav */}</Box>
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderRadius: 0 }} elevation={3}>
        {showParticipantOptions && (
          <Stack spacing={2} sx={{ p: 2 }}>
            {showEta && myParticipation?.id && <ParticipantEtaUpdater participant={myParticipation} />}
            <StatusUpdater activity={activity.domain} fullWidth={true} />
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

function MobileBriefingScreen({ activity }: { activity: ActivityViewModel }) {
  return <BriefingPanel activity={activity.domain} />;
}

const MobileRosterScreen = observer(function MobileRosterScreen({ activity }: { activity: ActivityViewModel }) {
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantDomainModel>();
  const [participantOpen, setParticipantOpen] = useState(false);
  return (
    <>
      <ParticipatingOrgChips activity={activity.domain} filter={activity.roster.filter} setFilter={(f) => activity.roster.setFilter(f)} />
      <Box style={{ overflowY: 'auto', height: 0, paddingBottom: 16 }} sx={{ flex: '1 1 auto' }}>
        <RosterPanel //
          roster={activity.roster}
          participantContainerComponent={RosterContainer}
          participantRowComponent={RosterRow}
          onClick={(p) => {
            if (!p.participant) return;
            setSelectedParticipant(p);
            setParticipantOpen(true);
          }}
        />
      </Box>
      <ParticipantDialog open={participantOpen} participant={selectedParticipant} onClose={() => setParticipantOpen(false)} />
    </>
  );
});

const RosterRow = observer(function RosterRow({ participant, onClick }: { participant: ParticipantDomainModel; onClick?: () => void }) {
  return (
    <RosterRowCard status={participant.status} onClick={onClick}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', flexGrow: 1, m: '5px', ml: '8px' }}>
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
          <Typography variant="body2">{participant.etaText ? `ETA ${participant.etaText}` : null}</Typography>
        </Stack>
      </Stack>
    </RosterRowCard>
  );
});

function RosterContainer({ children }: { children: ReactNode }) {
  return <Stack spacing={1}>{children}</Stack>;
}

function MobileManageScreen({ vm }: { vm: ActivityViewModel }) {
  return (
    <>
      <ActivityActionsBar vm={vm} />
      <ManagerPanel activity={vm.domain} />
    </>
  );
}
