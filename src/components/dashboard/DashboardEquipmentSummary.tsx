import { Typography } from '@mui/material';

import { useActivityContext } from '../activities/ActivityProvider';

import { DashboardCollapsibleBox } from './DashboardCollapsibleBox';

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
    <DashboardCollapsibleBox title="Equipment" sx={{ p: 1 }}>
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
    </DashboardCollapsibleBox>
  );
}
