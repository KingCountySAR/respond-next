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
import { getStatusText, isEnrouteOrStandby, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/types/activity';

import { ParticipantEtaUpdater } from '../participant/ParticipantEtaUpdater';

import { ActivityActionsBar } from './ActivityPage';
import { useActivityContext } from './ActivityProvider';
import { BriefingPanel } from './BriefingPanel';
import { ManagerPanel } from './ManagerPanel';
import { ParticipatingOrgChips } from './ParticipatingOrgChips';
import { ParticipantDialog, RosterPanel, RosterRowCard } from './RosterPanel';

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
  const [participantOpen, setParticipantOpen] = useState<boolean>(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant>();

  return (
    <>
      <ParticipatingOrgChips filter={orgFilter} setFilter={setOrgFilter} />
      <Box style={{ overflowY: 'auto', height: 0, paddingBottom: 16 }} flex="1 1 auto">
        <RosterPanel //
          filter={orgFilter}
          participantContainerComponent={RosterContainer}
          participantRowComponent={RosterRow}
          onClick={(p) => {
            setSelectedParticipant(p);
            setParticipantOpen(true);
          }}
        />
      </Box>
      <ParticipantDialog open={participantOpen} participant={selectedParticipant} onClose={() => setParticipantOpen(false)} />
    </>
  );
}

function RosterRow({ participant, orgs, onClick }: { participant: Participant; orgs: Record<string, ParticipatingOrg>; onClick?: () => void }) {
  return (
    <RosterRowCard status={participant.timeline[0].status} onClick={onClick}>
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
    </RosterRowCard>
  );
}

function RosterContainer({ children }: { children: ReactNode }) {
  return <Stack spacing={1}>{children}</Stack>;
}

function MobileManageScreen() {
  return (
    <>
      <ActivityActionsBar />
      <ManagerPanel />
    </>
  );
}
