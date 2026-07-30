import { Box, Typography } from '@mui/material';

import { useActivityContext } from '../activities/ActivityProvider';

export function DashboardEquipmentSummary() {
  const activity = useActivityContext();
  const teams = activity?.teams ?? [];

  const equipmentCounts = teams
    .flatMap((team) => team.assignedEquipment ?? [])
    .reduce<Record<string, number>>((counts, item) => {
      counts[item.name] = (counts[item.name] ?? 0) + 1;
      return counts;
    }, {});

  const equipmentEntries = Object.entries(equipmentCounts).sort(([leftName], [rightName]) => leftName.localeCompare(rightName));

  return (
    <Box sx={{ px: 1 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Equipment
      </Typography>
      {equipmentEntries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No equipment assigned.
        </Typography>
      ) : (
        equipmentEntries.map(([name, count]) => (
          <Typography key={name} variant="subtitle1" sx={{ whiteSpace: 'pre-line' }}>
            {`(${count}) ${name}`}
          </Typography>
        ))
      )}
    </Box>
  );
}
