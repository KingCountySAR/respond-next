import Inventory2Icon from '@mui/icons-material/Inventory2';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { Badge, Box, Tab, Tabs } from '@mui/material';
import { useState } from 'react';

import { useTeamCommands } from '@respond/lib/client/services/teams';
import { Participant, ParticipantStatus } from '@respond/shared/types/activity';
import { EquipmentItem } from '@respond/shared/types/operations';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';
import { Droppable } from '@/client/components/DragAndDrop/DnDComponents';

import { DashboardEquipmentManager } from './DashboardEquipmentManager';
import { DashboardPanel } from './DashboardPanel';
import { DashboardResponderManager } from './DashboardResponderManager';

export function DashboardResourcesPanel() {
  const [tab, setTab] = useState<'responders' | 'equipment'>('responders');
  const [available, setAvailable] = useState(0);
  const activity = useActivityContext();
  const teamCommands = useTeamCommands();

  const handleDrop = (item: Participant | EquipmentItem, type: string) => {
    if (type === 'participant') {
      const participant = item as Participant;
      if (participant.timeline[0].status === ParticipantStatus.Assigned) {
        teamCommands.assignTeamMember(activity.id, participant.id);
      }
      return;
    }

    if (type === 'equipment') {
      teamCommands.assignEquipment(activity.id, item as EquipmentItem, undefined);
    }
  };

  return (
    <DashboardPanel title="Resources" grow>
      <Droppable accepts={['participant', 'equipment']} onDrop={handleDrop} grow>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth" sx={{ minHeight: 36, height: 36 }}>
            <Tab
              icon={
                <Badge badgeContent={available} color="info" sx={{ m: 0.5 }}>
                  <PeopleAltIcon fontSize="small" />
                </Badge>
              }
              iconPosition="start"
              label={<Box sx={{ ml: 1 }}>Responders</Box>}
              value="responders"
              sx={{ minHeight: 36, py: 0, fontSize: '0.8125rem' }}
            />
            <Tab icon={<Inventory2Icon fontSize="small" />} iconPosition="start" label={<Box sx={{ ml: 1 }}>Equipment</Box>} value="equipment" sx={{ minHeight: 36, py: 0, fontSize: '0.8125rem' }} />
          </Tabs>
        </Box>

        <Box sx={{ display: tab === 'responders' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
          <DashboardResponderManager availableCallback={setAvailable} />
        </Box>
        {tab === 'equipment' && <DashboardEquipmentManager />}
      </Droppable>
    </DashboardPanel>
  );
}
