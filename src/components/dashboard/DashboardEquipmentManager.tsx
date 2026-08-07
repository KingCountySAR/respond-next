import { Box, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';

import { EquipmentItem } from '@respond/types/operations';

import { Draggable, Droppable } from '../DragAndDrop/DnDComponents';

import { DashboardBoxWithTitle } from './DashboardBoxWithTitle';
import { DashboardDraggableContainer } from './DashboardDraggableContainer';
import { DashboardEquipmentCreateDialog } from './DashboardEquipmentCreateDialog';
import { EquipmentGrouping, EquipmentGroupToggleButton } from './DashboardEquipmentGroupToggleButton';
import { DashboardSearchBox } from './DashboardSearchBox';

const inventory = [
  { id: 'inventory-0', type: 'Custom', name: 'Custom Item' },
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
  { id: 'inventory-30', type: 'Medical', name: 'Vacuum Splint: Full Body' },
  { id: 'inventory-31', type: 'Medical', name: 'Vacuum Splint: Extremity' },
  { id: 'inventory-32', type: 'Medical', name: 'SAM Splint' },
  { id: 'inventory-33', type: 'General', name: 'Webbing' },
  { id: 'inventory-34', type: 'Medical', name: 'A.E.D - Basic' },
  { id: 'inventory-35', type: 'Medical', name: 'A.E.D - EMT' },
  { id: 'inventory-36', type: 'Medical', name: 'Backboard' },
  { id: 'inventory-37', type: 'Rigging', name: 'Bolt Kit' },
].sort((a, b) => a.name.localeCompare(b.name));

const checkOutEquipmentItem = (item: EquipmentItem): EquipmentItem => {
  return { ...item, uuid: uuid() };
};

type GroupedInventory = Record<string, EquipmentItem[]>;

type EditingState = {
  item: EquipmentItem;
  onSave: (item: EquipmentItem) => void;
};

export function DashboardEquipmentManager() {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<EquipmentGrouping>('Type');
  const [editingState, setEditingState] = useState<EditingState | null>(null);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDrop = (item: any, type: string, callback?: () => void) => {
    callback?.();
  };

  const initializeCustomItem = (editingState: EditingState | undefined) => {
    if (!editingState) return;
    setEditingState(editingState);
  };

  const handleSaveEdit = (name: string) => {
    editingState?.onSave({ ...editingState.item, name });
    setEditingState(null);
  };

  const handleCancelEdit = () => {
    setEditingState(null);
  };

  function EquipmentAphabetical({ items }: { items: EquipmentItem[] }) {
    return (
      <>
        {items.map((item) => (
          <Draggable key={item.id} type="equipment" item={checkOutEquipmentItem(item)} callback={initializeCustomItem}>
            <EquipmentTile item={item} />
          </Draggable>
        ))}
      </>
    );
  }

  function EquipmentGroups({ groups }: { groups: GroupedInventory }) {
    return (
      <>
        {Object.entries(groups)
          .sort(([leftGroupName], [rightGroupName]) => leftGroupName.localeCompare(rightGroupName))
          .map(([groupName, list]) => (
            <DashboardBoxWithTitle key={groupName} title={groupName} collapsible>
              <Stack spacing={0.5}>
                {list.map((item) => (
                  <Draggable key={item.id} type="equipment" item={checkOutEquipmentItem(item)} callback={initializeCustomItem}>
                    <EquipmentTile item={item} />
                  </Draggable>
                ))}
              </Stack>
            </DashboardBoxWithTitle>
          ))}
      </>
    );
  }

  return (
    <>
      <Droppable accepts="equipment" onDrop={handleDrop} grow>
        <Stack spacing={2} sx={{ overflow: 'auto' }}>
          <Stack direction="row" spacing={1}>
            <DashboardSearchBox onChange={setSearchQuery} />
            <EquipmentGroupToggleButton onChange={(value) => setGroupBy(value)} />
          </Stack>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1, pr: 0.5 }}>{groupBy === 'All' ? <EquipmentAphabetical items={filteredEquipment} /> : <EquipmentGroups groups={groupedEquipment} />}</Box>
        </Stack>
      </Droppable>
      {!!editingState?.item && <DashboardEquipmentCreateDialog onSave={handleSaveEdit} onCancel={handleCancelEdit} />}
    </>
  );
}

function EquipmentTile({ item }: { item: EquipmentItem }) {
  return (
    <DashboardDraggableContainer variant="compact">
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="subtitle2">{item.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {item.type}
        </Typography>
      </Stack>
    </DashboardDraggableContainer>
  );
}
