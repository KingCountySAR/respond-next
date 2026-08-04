import { Box, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { EquipmentItem } from '@respond/types/team';

import { useActivityContext } from '../activities/ActivityProvider';
import { Draggable, Droppable } from '../DragAndDrop/DnDComponents';

import { DashboardBoxWithTitle } from './DashboardBoxWithTitle';
import { EquipmentGrouping, EquipmentGroupToggleButton } from './DashboardEquipmentGroupToggleButton';
import { DashboardSearchBox } from './DashboardSearchBox';

const inventory = [
  { id: 'inventory-1', type: 'Rigging', name: 'Anchor Rope (150)' },
  { id: 'inventory-2', type: 'Medical', name: 'Body Bag' },
  { id: 'inventory-3', type: 'Rigging', name: 'Climbing Rack' },
  { id: 'inventory-4', type: 'Rigging', name: 'Climbing Rope' },
  { id: 'inventory-5', type: 'General', name: 'Dog Rescue Kit' },
  { id: 'inventory-6', type: 'General', name: 'Drone' },
  { id: 'inventory-7', type: 'Medical', name: 'EMT Kit' },
  { id: 'inventory-8', type: 'Medical', name: 'First Aid Kit' },
  { id: 'inventory-9', type: 'Rigging', name: 'Helmet' },
  { id: 'inventory-10', type: 'Medical', name: 'Ice Pack' },
  { id: 'inventory-11', type: 'Packaging', name: 'Litter' },
  { id: 'inventory-12', type: 'Medical', name: 'Oxygen' },
  { id: 'inventory-13', type: 'Packaging', name: 'Sleeping Bag' },
  { id: 'inventory-14', type: 'Rigging', name: 'Patient Harness' },
  { id: 'inventory-15', type: 'Rigging', name: 'Rigging Kit' },
  { id: 'inventory-16', type: 'Rigging', name: 'Rope (300)' },
  { id: 'inventory-17', type: 'Rigging', name: 'Rope (600)' },
  { id: 'inventory-18', type: 'Medical', name: 'Warming Blanket' },
  { id: 'inventory-19', type: 'Packaging', name: 'Wheel' },
  { id: 'inventory-20', type: 'General', name: 'Water' },
  { id: 'inventory-21', type: 'General', name: 'Snacks' },
  { id: 'inventory-22', type: 'General', name: 'Stove' },
  { id: 'inventory-23', type: 'Packaging', name: 'Tarp' },
  { id: 'inventory-24', type: 'General', name: 'Saw' },
  { id: 'inventory-25', type: 'General', name: 'Traction' },
  { id: 'inventory-26', type: 'General', name: 'Snowshoes' },
  { id: 'inventory-27', type: 'Packaging', name: 'Mega Mover' },
  { id: 'inventory-28', type: 'Packaging', name: 'Foam Pad' },
  { id: 'inventory-29', type: 'Packaging', name: 'Padding' },
].sort((a, b) => a.name.localeCompare(b.name));

const checkOutEquipmentItem = (item: EquipmentItem): EquipmentItem => {
  return { ...item, uuid: uuid() };
};

type GroupedInventory = Record<string, EquipmentItem[]>;

export function DashboardEquipmentManager() {
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<EquipmentGrouping>('All');

  const activity = useActivityContext();

  const filteredEquipment = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((entry) => {
      const name = (entry.name || '').toLowerCase();
      return name.includes(q);
    });
  }, [searchQuery]);

  const groupedEquipment = useMemo<GroupedInventory>(() => {
    return filteredEquipment.reduce<GroupedInventory>((acc, item) => {
      const typeKey = item.type;
      if (!acc[typeKey]) {
        acc[typeKey] = [];
      }
      acc[typeKey].push(item);
      return acc;
    }, {});
  }, [filteredEquipment]);

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
      <Stack spacing={2} sx={{ overflow: 'auto' }}>
        <Stack direction="row" spacing={1}>
          <DashboardSearchBox onChange={setSearchQuery} />
          <EquipmentGroupToggleButton onChange={(value) => setGroupBy(value)} />
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1, pr: 0.5 }}>{groupBy === 'All' ? <EquipmentAphabetical items={filteredEquipment} /> : <EquipmentGroups groups={groupedEquipment} />}</Box>
      </Stack>
    </Droppable>
  );
}

function EquipmentTile({ item }: { item: EquipmentItem }) {
  return (
    <Draggable type="equipment" item={checkOutEquipmentItem(item)}>
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 1,
          cursor: 'grab',
          bgcolor: 'background.paper',
          ':hover': {
            bgcolor: 'grey.100',
            // Targets the child element with class 'promote-button' when Stack is hovered
            '& .promote-button': {
              opacity: 1,
              visibility: 'visible',
            },
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="subtitle2">{item.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {item.type}
          </Typography>
        </Stack>
      </Box>
    </Draggable>
  );
}

function EquipmentAphabetical({ items }: { items: EquipmentItem[] }) {
  return (
    <>
      {items.map((item) => (
        <EquipmentTile key={item.id} item={item} />
      ))}
    </>
  );
}

function EquipmentGroups({ groups }: { groups: GroupedInventory }) {
  return (
    <>
      {Object.entries(groups).map(([groupName, list]) => (
        <DashboardBoxWithTitle key={groupName} title={groupName} sx={{ p: 1 }} collapsible>
          <Stack spacing={0.5}>
            {list.map((item) => (
              <EquipmentTile key={item.id} item={item} />
            ))}
          </Stack>
        </DashboardBoxWithTitle>
      ))}
    </>
  );
}
