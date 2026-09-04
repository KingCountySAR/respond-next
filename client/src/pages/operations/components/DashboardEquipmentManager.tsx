import { Box, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';

import { useDialogs } from '@respond/components/DialogProvider';
import { EquipmentItem } from '@respond/shared/types/operations';

import { Draggable } from '@/client/components/DragAndDrop/DnDComponents';

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
  { id: 'inventory-38', type: 'Packaging', name: 'Packaging' },
].sort((a, b) => a.name.localeCompare(b.name));

type GroupedInventory = Record<string, EquipmentItem[]>;

export function DashboardEquipmentManager() {
  const { open } = useDialogs();
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<EquipmentGrouping>('Type');

  const filteredEquipment = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((entry) => {
      const name = (entry.name || '').toLowerCase();
      const type = (entry.type || '').toLowerCase();
      return name.includes(q) || type.includes(q);
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

  // A "Custom Item" needs to be named before it can be assigned; prompt for the name
  // on drop and hydrate it. Returning null (dialog dismissed) cancels the drop.
  const hydrateEquipment = async (item: EquipmentItem): Promise<EquipmentItem | null> => {
    if (item.type !== 'Custom' || item.name !== 'Custom Item') return { ...item, uuid: uuid() };
    const name = await open(DashboardEquipmentCreateDialog, {});
    return name == null ? null : { ...item, name, uuid: uuid() };
  };

  function EquipmentAphabetical({ items }: { items: EquipmentItem[] }) {
    return (
      <>
        {items.map((item) => (
          <Draggable key={item.id} type="equipment" item={item} transform={hydrateEquipment}>
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
                  <Draggable key={item.id} type="equipment" item={item} transform={hydrateEquipment}>
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
    <Stack spacing={2} sx={{ overflow: 'auto' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <DashboardSearchBox onChange={setSearchQuery} sx={{ flex: 1 }} />
        <EquipmentGroupToggleButton onChange={(value) => setGroupBy(value)} />
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {groupBy === 'All' ? <EquipmentAphabetical items={filteredEquipment} /> : <EquipmentGroups groups={groupedEquipment} />}
      </Box>
    </Stack>
  );
}

function EquipmentTile({ item }: { item: EquipmentItem }) {
  return (
    <DashboardDraggableContainer variant="compact">
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flex: 1, minWidth: 0, width: '100%' }}>
        <Typography variant="subtitle2">{item.name}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {item.type}
        </Typography>
      </Stack>
    </DashboardDraggableContainer>
  );
}
