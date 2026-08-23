import { Stack, Typography } from '@mui/material';

import { EquipmentItem } from '@respond/shared/types/operations';

import { DashboardDraggableContainer } from './DashboardDraggableContainer';

export function DashboardTeamEquipment({ item }: { item: EquipmentItem }) {
  return (
    <DashboardDraggableContainer variant="compact">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {item.name}
        </Typography>
      </Stack>
    </DashboardDraggableContainer>
  );
}
