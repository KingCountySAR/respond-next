import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import { Alert, Box, Stack, Tab, Tabs, useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';
import { isManageActivity } from '@sync/model';
import { observer, useManageActivity, useRespondActivity } from '@sync/model/react';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { DashboardCommsManager } from './Comms';
import { DnDProvider } from './dnd';
import { DashboardHeader, DashboardResponderSummary } from './Header';
import { DashboardActivityDescription, DashboardAddGroupButton, DashboardAddPlaceButton, DashboardEquipmentSummary, DashboardGroupManager, DashboardPlaceManager } from './Operations';
import { DashboardPanel } from './parts';
import { DashboardResourcesPanel } from './Resources';
import { DashboardReadOnlyTeams, DashboardTeamManager } from './Teams';
import { DashboardWeatherTile } from './Weather';

/** The ops dashboard: managers only, and only for activities with operations. */
export const Dashboard = observer(function Dashboard() {
  const activity = useRespondActivity();
  if (!isManageActivity(activity)) {
    return (
      <ToolbarPage maxWidth={false}>
        <Alert severity="warning">The operations dashboard is for managers.</Alert>
      </ToolbarPage>
    );
  }
  if (!activity.hasOperations) {
    return (
      <ToolbarPage maxWidth={false}>
        <Alert severity="info">This event has no operations: it tracks sign-in only.</Alert>
      </ToolbarPage>
    );
  }
  return (
    <DnDProvider>
      <DashboardContent />
    </DnDProvider>
  );
});

/** Teams and comms as tabs, for the tablet layout. */
function CombinedTeamCommsPanel() {
  const [tab, setTab] = useState<'teams' | 'comms'>('teams');
  return (
    <DashboardPanel title="Teams & Communications" grow>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth" sx={{ minHeight: 36, height: 36 }}>
          <Tab icon={<GroupsIcon fontSize="small" />} iconPosition="start" label="Teams" value="teams" sx={{ minHeight: 36, py: 0, fontSize: '0.8125rem' }} />
          <Tab icon={<ChatBubbleOutlineOutlinedIcon fontSize="small" />} iconPosition="start" label="Comms" value="comms" sx={{ minHeight: 36, py: 0, fontSize: '0.8125rem' }} />
        </Tabs>
      </Box>
      {tab === 'teams' && <DashboardTeamManager />}
      {tab === 'comms' && <DashboardCommsManager />}
    </DashboardPanel>
  );
}

const DashboardContent = observer(function DashboardContent() {
  const activity = useManageActivity();
  const record = activity.record!;
  const { lat, lon } = record.location;

  useEffect(() => {
    document.title = `${record.idNumber} ${record.title} - Dashboard`;
  }, [record.idNumber, record.title]);

  // Phones: narrower than 1024px (an iPad mini in landscape is a tablet). Tablets: 1024px up to 1920px, with teams and comms tabbed.
  const isSmallScreen = useMediaQuery('(max-width:1023.95px)');
  const isTablet = useMediaQuery('(min-width:1024px) and (max-width:1919.95px)');

  if (isSmallScreen) {
    return (
      <ToolbarPage>
        <Stack spacing={1} direction="column" sx={{ pb: 2 }}>
          <Stack spacing={1} direction="row" sx={{ width: '100%' }}>
            <DashboardResponderSummary variant="mobile" />
          </Stack>
          <DashboardReadOnlyTeams />
          <DashboardEquipmentSummary />
        </Stack>
      </ToolbarPage>
    );
  }

  return (
    <ToolbarPage maxWidth={false}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0, height: '100%' }}>
        <DashboardHeader />
        <Box sx={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr 2fr 1fr' : '1fr 4fr 1fr', gap: 1, flex: 1, minHeight: 0 }}>
          {/* Left: the resource pool. */}
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, minHeight: 0 }}>
            <DashboardResourcesPanel />
          </Box>

          {/* Centre: teams, the main focus, and comms. */}
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, minHeight: 0 }}>
            {isTablet ? (
              <CombinedTeamCommsPanel />
            ) : (
              <>
                <DashboardPanel title="Teams" grow>
                  <DashboardTeamManager />
                </DashboardPanel>
                <DashboardPanel title="Communications" grow>
                  <DashboardCommsManager />
                </DashboardPanel>
              </>
            )}
          </Box>

          {/* Right: operations. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
            <DashboardPanel
              title="Operations"
              actions={
                <>
                  <DashboardAddGroupButton />
                  <DashboardAddPlaceButton />
                </>
              }
            >
              <Stack direction="column" spacing={1} sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                {lat != null && lon != null && <DashboardWeatherTile lat={lat} lon={lon} />}
                <DashboardActivityDescription />
                {activity.groups.length > 0 && <DashboardGroupManager />}
                <DashboardPlaceManager />
                <DashboardEquipmentSummary />
              </Stack>
            </DashboardPanel>
          </Box>
        </Box>
      </Box>
    </ToolbarPage>
  );
});
