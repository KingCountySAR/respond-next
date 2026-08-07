import { Stack, Typography } from '@mui/material';

import { EquipmentItem } from '@respond/shared/types/operations';

import { DashboardDraggableContainer } from './DashboardDraggableContainer';

export function DashboardTeamEquipment({ item }: { item: EquipmentItem }) {
  return (
    <DashboardDraggableContainer variant="compact">
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {item.name}
        </Typography>
      </Stack>
    </DashboardDraggableContainer>
  );
}
