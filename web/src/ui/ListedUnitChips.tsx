import { Box, Chip } from '@mui/material';
import type { BoxProps } from '@mui/material/Box';
import type { ActivityListItem } from '@sync/model';
import { observer } from '@sync/model/react';
import { unitChipProps } from './status';
import { ListedUnitMenuChip } from './UnitStatusMenu';

/** The legacy ParticipatingOrgChips, from a summary: each unit with its active count, and the units menu for managers. */
export const ListedUnitChips = observer(function ListedUnitChips({ item, ...boxProps }: BoxProps & { item: ActivityListItem }) {
  return (
    <Box {...boxProps}>
      {item.units.map((unit) => {
        const { sx, ...look } = unitChipProps(unit.status);
        return <Chip key={unit.id} size="small" sx={{ mr: 1, ...sx }} label={`${unit.rosterName ?? unit.title} ${unit.activeCount || ''}`} {...look} variant="outlined" />;
      })}
      {item.isActive && <ListedUnitMenuChip activityId={item.id} />}
    </Box>
  );
});
