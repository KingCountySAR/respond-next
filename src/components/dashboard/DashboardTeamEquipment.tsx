import { Stack, Typography } from '@mui/material';

import { EquipmentItem } from '@respond/types/team';

import { Draggable } from '../DragAndDrop/DnDComponents';

export function DashboardTeamEquipment({ item }: { item: EquipmentItem }) {
  return (
    <Draggable type="equipment" item={item}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          borderRadius: 1,
          px: 1,
          py: 0.75,
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
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {item.name}
        </Typography>
      </Stack>
    </Draggable>
  );
}
