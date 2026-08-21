'use client';

import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { Badge, Box, Stack, Tab, Tabs, useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';

import { useActivityContext } from '../activities/ActivityProvider';
import { DnDProvider } from '../DragAndDrop/DnDProvider';
import { ToolbarPage } from '../ToolbarPage';

import { DashboardActivityDescription } from './DashboardActivityDescription';
import { DashboardCommsManager } from './DashboardCommsManager';
import { DashboardEquipmentManager } from './DashboardEquipmentManager';
import { DashboardEquipmentSummary } from './DashboardEquipmentSummary';
import { DashboardHeader } from './DashboardHeader';
import { DashboardPanel } from './DashboardPanel';
import { DashboardAddPlaceButton, DashboardPlaceManager } from './DashboardPlaceManager';
import { DashboardReadOnlyTeams } from './DashboardReadOnlyTeams';
import { DashboardResponderManager } from './DashboardResponderManager';
import { DashboardRoleTile } from './DashboardRoleTile';
import { DashboardTeamManager } from './DashboardTeamManager';
import { DashboardWeatherTile } from './DashboardWeather';

/**
 * Combined Responders + Equipment Component
 */
function CombinedResourcesPanel() {
  const [tab, setTab] = useState<'responders' | 'equipment'>('responders');
  const [available, setAvailable] = useState(0);

  return (
    <DashboardPanel title="Resources" grow>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs
          value={tab}
          onChange={(_, val) => setTab(val)}
          variant="fullWidth"
          sx={{ minHeight: 36, height: 36 }} // Compact height replacing invalid size prop
        >
          <Tab
            icon={<PeopleAltIcon fontSize="small" />}
            iconPosition="start"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span>Responders</span>
                <Badge badgeContent={available} color="info" sx={{ m: 0.5 }} />
              </Box>
            }
            value="responders"
            sx={{ minHeight: 36, py: 0, fontSize: '0.8125rem' }}
          />
          <Tab icon={<Inventory2Icon fontSize="small" />} iconPosition="start" label="Equipment" value="equipment" sx={{ minHeight: 36, py: 0, fontSize: '0.8125rem' }} />
        </Tabs>
      </Box>

      {tab === 'responders' && <DashboardResponderManager availableCallback={setAvailable} />}
      {tab === 'equipment' && <DashboardEquipmentManager />}
    </DashboardPanel>
  );
}

/**
 * Combined Team Manager + Communications Component (tablet view)
 */
function CombinedTeamCommsPanel() {
  const [tab, setTab] = useState<'teams' | 'comms'>('teams');

  return (
    <DashboardPanel title="Teams & Communications" grow>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs value={tab} onChange={(_, val) => setTab(val)} variant="fullWidth" sx={{ minHeight: 36, height: 36 }}>
          <Tab icon={<GroupsIcon fontSize="small" />} iconPosition="start" label="Teams" value="teams" sx={{ minHeight: 36, py: 0, fontSize: '0.8125rem' }} />
          <Tab icon={<ChatBubbleOutlineOutlinedIcon fontSize="small" />} iconPosition="start" label="Comms" value="comms" sx={{ minHeight: 36, py: 0, fontSize: '0.8125rem' }} />
        </Tabs>
      </Box>

      {tab === 'teams' && <DashboardTeamManager />}
      {tab === 'comms' && <DashboardCommsManager />}
    </DashboardPanel>
  );
}

function DashboardContent() {
  const activity = useActivityContext();
  const hasLocation = activity.location?.lat && activity.location?.lon;

  useEffect(() => {
    document.title = `${activity.idNumber} ${activity.title} - Dashboard`;
  }, [activity.idNumber, activity.title]);

  // Mobile View: narrower than 1280px
  const isSmallScreen = useMediaQuery('(max-width:1279.95px)');
  // Tablet View: 1280px up to (but narrower than) 1920px; Team Manager and Communications are tabbed
  const isTablet = useMediaQuery('(min-width:1280px) and (max-width:1919.95px)');

  if (!activity) {
    return (
      <ToolbarPage maxWidth={false}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>Loading activity…</Box>
      </ToolbarPage>
    );
  }

  // ==========================================
  // MOBILE / TABLET PORTRAIT VIEW (< md)
  // ==========================================
  if (isSmallScreen) {
    return (
      <ToolbarPage>
        <Stack spacing={2}>
          <DashboardReadOnlyTeams />
        </Stack>
      </ToolbarPage>
    );
  }

  // ==========================================
  // DESKTOP / TABLET LANDSCAPE VIEW (>= md)
  // ==========================================
  return (
    <ToolbarPage maxWidth={false}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0, height: '100%' }}>
        <DashboardHeader />

        {/* Dashboard Main Grid Layout */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: isTablet ? '1fr 2fr 1fr' : '1fr 4fr 1fr',
            gap: 1,
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* LEFT COLUMN: Resource Pool & Places */}
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, minHeight: 0 }}>
            <CombinedResourcesPanel />
          </Box>

          {/* CENTER COLUMN: Team Manager (PRIMARY FOCUS) */}
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

          {/* RIGHT COLUMN: Operations & Communications */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
            {/* Operations Staffing */}
            <DashboardPanel title="Operations" actions={<DashboardAddPlaceButton />}>
              <Stack direction="column" spacing={1} sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                {hasLocation && <DashboardWeatherTile lat={activity.location.lat} lon={activity.location.lon} />}
                <DashboardActivityDescription activity={activity} />
                <DashboardRoleTile title="Rescue Group" id={activity.staff?.['Rescue Group']} />
                <DashboardRoleTile title="Medical Group" id={activity.staff?.['Medical Group']} />
                <DashboardRoleTile title="Rigging Group" id={activity.staff?.['Rigging Group']} />
                <DashboardPlaceManager />
                <DashboardEquipmentSummary />
              </Stack>
            </DashboardPanel>
          </Box>
        </Box>
      </Box>
    </ToolbarPage>
  );
}

export function Dashboard() {
  return (
    <DnDProvider>
      <DashboardContent />
    </DnDProvider>
  );
}
