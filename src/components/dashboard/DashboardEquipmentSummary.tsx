import { Typography } from '@mui/material';

import { useActivityContext } from '../activities/ActivityProvider';

import { DashboardBoxWithTitle } from './DashboardBoxWithTitle';

export function DashboardEquipmentSummary() {
  const activity = useActivityContext();
  const teams = activity?.teams ?? [];
  const places = activity?.places ?? [];

  const equipmentCounts = teams
    .flatMap((team) => team.assignedEquipment ?? [])
    .reduce<Record<string, number>>((counts, item) => {
      counts[item.name] = (counts[item.name] ?? 0) + 1;
      return counts;
    }, {});

  const placeEquipmentCounts = places
    .flatMap((place) => place.assignedEquipment ?? [])
    .reduce<Record<string, number>>((counts, item) => {
      counts[item.name] = (counts[item.name] ?? 0) + 1;
      return counts;
    }, {});

  const teamEntries = Object.entries(equipmentCounts).sort(([leftName], [rightName]) => leftName.localeCompare(rightName));
  const placeEntries = Object.entries(placeEquipmentCounts).sort(([leftName], [rightName]) => leftName.localeCompare(rightName));

  return (
    <DashboardBoxWithTitle title="Equipment" collapsible>
      <Typography variant="subtitle1">Assigned</Typography>
      {teamEntries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No equipment assigned.
        </Typography>
      ) : (
        teamEntries.map(([name, count]) => (
          <Typography key={name} variant="subtitle1" sx={{ whiteSpace: 'pre-line' }}>
            {`(${count}) ${name}`}
          </Typography>
        ))
      )}
      <Typography variant="subtitle1">Staged</Typography>
      {placeEntries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No equipment assigned.
        </Typography>
      ) : (
        placeEntries.map(([name, count]) => (
          <Typography key={name} variant="subtitle1" sx={{ whiteSpace: 'pre-line' }}>
            {`(${count}) ${name}`}
          </Typography>
        ))
      )}
    </DashboardBoxWithTitle>
  );
}
