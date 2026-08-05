'use client';

import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import GroupsIcon from '@mui/icons-material/Groups';
import HubIcon from '@mui/icons-material/Hub';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import MapIcon from '@mui/icons-material/Map';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { Box, Stack } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import { useActivityContext } from '../activities/ActivityProvider';
import { DnDProvider } from '../DragAndDrop/DnDProvider';
import { ToolbarPage } from '../ToolbarPage';

import { DashboardCommsManager } from './DashboardCommsManager';
import { DashboardEquipmentManager } from './DashboardEquipmentManager';
import { DashboardEquipmentSummary } from './DashboardEquipmentSummary';
import { DashboardHeader } from './DashboardHeader';
import { DashboardPanel } from './DashboardPanel';
import { DashboardPlaceManager } from './DashboardPlaceManager';
import { DashboardResponderManager } from './DashboardResponderManager';
import { DashboardResponderSummary } from './DashboardResponderSummary';
import { DashboardRoleTile } from './DashboardRoleTile';
import { DashboardTeamManager } from './DashboardTeamManager';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function OperationsDashboardContent() {
  const activity = useActivityContext();

  const [isResizing, setIsResizing] = useState(false);
  const centerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: MouseEvent) => {
      const rect = centerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nextRatio = clamp((event.clientY - rect.top) / rect.height, 0.3, 0.75);
      void nextRatio;
    };

    const stopResizing = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', stopResizing);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);

  if (!activity) {
    return (
      <ToolbarPage maxWidth={false}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>Loading activity…</Box>
      </ToolbarPage>
    );
  }

  return (
    <ToolbarPage maxWidth={false}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
        <DashboardHeader />
        <Box sx={{ display: 'flex', flex: 1, gap: 2, minHeight: 0 }} ref={centerRef}>
          {/* Left Side Panels */}
          <Box sx={{ display: 'flex', gap: 2, minHeight: 0, mr: 'auto' }}>
            <DashboardPanel title="Responders" collapse="left" icon={<PeopleAltIcon />}>
              <DashboardResponderManager />
            </DashboardPanel>
            <DashboardPanel title="Equipment" collapse="left" icon={<Inventory2Icon />}>
              <DashboardEquipmentManager />
            </DashboardPanel>
            <DashboardPanel title="Places" collapse="left" icon={<MapIcon />}>
              <DashboardPlaceManager />
            </DashboardPanel>
          </Box>
          {/* Right Side Panels */}
          <DashboardPanel title="Team Manager" collapse="right" icon={<GroupsIcon />} grow>
            <DashboardTeamManager />
          </DashboardPanel>
          <DashboardPanel title="Communcations Log" collapse="right" icon={<ChatBubbleOutlineIcon />} grow>
            <DashboardCommsManager />
          </DashboardPanel>
          <DashboardPanel title="Operations" collapse="right" icon={<HubIcon />}>
            <Stack direction="column" spacing={1} overflow="auto" sx={{ flex: 1, minHeight: 0 }}>
              <DashboardRoleTile title="Rescue Group" id={activity.staff?.['Rescue Group']} />
              <DashboardRoleTile title="Medical Group" id={activity.staff?.['Medical Group']} />
              <DashboardRoleTile title="Rigging Group" id={activity.staff?.['Rigging Group']} />
              <DashboardResponderSummary />
              <DashboardEquipmentSummary />
            </Stack>
          </DashboardPanel>
        </Box>
      </Box>
    </ToolbarPage>
  );
}

export function OperationsDashboard() {
  return (
    <DnDProvider>
      <OperationsDashboardContent />
    </DnDProvider>
  );
}
