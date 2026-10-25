import { Box, Chip } from '@mui/material';
import type { BoxProps } from '@mui/material/Box';
import type { ActivityListItem } from '@sync/model';
import { observer } from '@sync/model/react';
import { unitChipColor } from './status';

/** The legacy ParticipatingOrgChips, from a summary: each unit with its active count. */
export const ListedUnitChips = observer(function ListedUnitChips({ item, ...boxProps }: BoxProps & { item: ActivityListItem }) {
  return (
    <Box {...boxProps}>
      {item.units.map((unit) => (
        <Chip key={unit.id} size="small" sx={{ mr: 1 }} label={`${unit.rosterName ?? unit.title} ${unit.activeCount || ''}`} color={unitChipColor(unit.status)} variant="outlined" />
      ))}
    </Box>
  );
});
