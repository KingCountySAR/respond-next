import { Box, Chip } from '@mui/material';
import type { BoxProps } from '@mui/material/Box';
import type { RespondActivity } from '@sync/model';
import { observer } from '@sync/model/react';
import { unitChipColor } from '../../../ui/status';

/** The legacy ParticipatingOrgChips: one chip per unit with its active count; clicking filters the roster. */
export const UnitChips = observer(function UnitChips({
  activity,
  filter,
  setFilter,
  ...boxProps
}: BoxProps & { activity: RespondActivity; filter?: string; setFilter?: (value: string) => void }) {
  const onClick = (id: string) => (setFilter ? () => setFilter(filter === id ? '' : id) : undefined);

  return (
    <Box {...boxProps}>
      {activity.units.map((unit) => (
        <Chip
          key={unit.id}
          size="small"
          sx={{ mr: 1 }}
          label={`${unit.name} ${unit.activeParticipantCount || ''}`}
          color={unitChipColor(unit.status)}
          variant={filter === unit.id ? 'filled' : 'outlined'}
          onClick={onClick(unit.id)}
        />
      ))}
    </Box>
  );
});
