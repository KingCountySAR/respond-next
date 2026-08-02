import { Box, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { EquipmentItem } from '@respond/types/team';

import { useActivityContext } from '../activities/ActivityProvider';
import { Draggable, Droppable } from '../DragAndDrop/DnDComponents';

import { DashboardSearchBox } from './DashboardSearchBox';

const inventory = [
  { id: 'inventory-1', name: 'Anchor Rope (150)' },
  { id: 'inventory-2', name: 'Body Bag' },
  { id: 'inventory-3', name: 'Climbing Rack' },
  { id: 'inventory-4', name: 'Climbing Rope' },
  { id: 'inventory-5', name: 'Dog Rescue Kit' },
  { id: 'inventory-6', name: 'Drone' },
  { id: 'inventory-7', name: 'EMT Kit' },
  { id: 'inventory-8', name: 'First Aid Kit' },
  { id: 'inventory-9', name: 'Helmet' },
  { id: 'inventory-10', name: 'Ice Pack' },
  { id: 'inventory-11', name: 'Litter' },
  { id: 'inventory-12', name: 'Oxygen' },
  { id: 'inventory-13', name: 'Packaging' },
  { id: 'inventory-14', name: 'Patient Harness' },
  { id: 'inventory-15', name: 'Rigging Kit' },
  { id: 'inventory-16', name: 'Rope (300)' },
  { id: 'inventory-17', name: 'Rope (600)' },
  { id: 'inventory-18', name: 'Warming Blanket' },
  { id: 'inventory-19', name: 'Wheel' },
  { id: 'inventory-20', name: 'Water' },
  { id: 'inventory-21', name: 'Snacks' },
  { id: 'inventory-22', name: 'Stove' },
  { id: 'inventory-23', name: 'Tarp' },
  { id: 'inventory-24', name: 'Saw' },
  { id: 'inventory-25', name: 'Traction' },
  { id: 'inventory-26', name: 'Snowshoes' },
  { id: 'inventory-27', name: 'Mega Mover' },
].sort((a, b) => a.name.localeCompare(b.name));

const checkOutEquipmentItem = (item: EquipmentItem): EquipmentItem => {
  return { ...item, uuid: uuid() };
};

export function DashboardEquipmentManager() {
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState('');

  const activity = useActivityContext();

  const filteredEquipment = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((entry) => {
      const name = (entry.name || '').toLowerCase();
      return name.includes(q);
    });
  }, [searchQuery]);

  const returnEquipment = (equipment: EquipmentItem) => {
    // Remove from the previous team, if any
    // TODO: need actions to club these updates into a single activity transaction
    activity.teams.forEach((team) => {
      if (team.assignedEquipment.some((item) => item.uuid === equipment.uuid)) {
        // Remove the participant from the team
        const updatedTeam = { ...team, assignedEquipment: team.assignedEquipment.filter((item) => item.uuid !== equipment.uuid) };
        dispatch(ActivityActions.updateTeam(activity.id, updatedTeam));
      }
    });
  };

  return (
    <Droppable accepts="equipment" onDrop={returnEquipment} grow>
      <DashboardSearchBox onChange={setSearchQuery} sx={{ mb: 2 }} />
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {filteredEquipment.map((item) => (
          <Draggable key={item.id} type="equipment" item={checkOutEquipmentItem(item)}>
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1, cursor: 'grab', bgcolor: 'background.paper' }}>
              <Typography variant="subtitle2">{item.name}</Typography>
            </Box>
          </Draggable>
        ))}
      </Box>
    </Droppable>
  );
}
