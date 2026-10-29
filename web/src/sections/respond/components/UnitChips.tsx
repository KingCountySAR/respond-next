import { Box, Chip } from '@mui/material';
import type { BoxProps } from '@mui/material/Box';
import { isManageActivity, type RespondActivity } from '@sync/model';
import { observer } from '@sync/model/react';
import { unitChipProps } from '../../../ui/status';
import { UnitMenuChip } from '../../../ui/UnitStatusMenu';

/**
 * The legacy ParticipatingOrgChips: one chip per unit with its active count; clicking filters the
 * roster. Managers get a last chip whose menu changes their organization's status or invites a unit it operates with.
 */
export const UnitChips = observer(function UnitChips({
  activity,
  filter,
  setFilter,
  ...boxProps
}: BoxProps & { activity: RespondActivity; filter?: string; setFilter?: (value: string) => void }) {
  const onClick = (id: string) => (setFilter ? () => setFilter(filter === id ? '' : id) : undefined);

  return (
    <Box {...boxProps}>
      {activity.units.map((unit) => {
        const { sx, ...look } = unitChipProps(unit.status);
        return (
          <Chip
            key={unit.id}
            size="small"
            sx={{ mr: 1, ...sx }}
            label={`${unit.name} ${unit.activeParticipantCount || ''}`}
            {...look}
            variant={filter === unit.id ? 'filled' : 'outlined'}
            onClick={onClick(unit.id)}
          />
        );
      })}
      {isManageActivity(activity) && !activity.record?.closed && <UnitMenuChip activity={activity} />}
    </Box>
  );
});
