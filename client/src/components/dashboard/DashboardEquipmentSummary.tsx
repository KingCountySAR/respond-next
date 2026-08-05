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

  const teamEntries = Object.entries(equipmentCounts).sort(([leftName], [rightName]) => leftName.localeCompare(rightName));
  const placesWithEquipment = places.filter((place) => place.assignedEquipment?.length > 0);

  return (
    <DashboardBoxWithTitle title="Equipment" collapsible>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Assigned
      </Typography>
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
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Staged
      </Typography>
      {placesWithEquipment.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No equipment staged.
        </Typography>
      ) : (
        placesWithEquipment.map((place) => {
          const counts = place.assignedEquipment.reduce<Record<string, number>>((acc, item) => {
            acc[item.name] = (acc[item.name] ?? 0) + 1;
            return acc;
          }, {});
          const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
          return (
            <div key={place.id}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 0.5 }}>
                {place.name}
              </Typography>
              {entries.map(([name, count]) => (
                <Typography key={name} variant="subtitle1" sx={{ whiteSpace: 'pre-line' }}>
                  {`(${count}) ${name}`}
                </Typography>
              ))}
            </div>
          );
        })
      )}
    </DashboardBoxWithTitle>
  );
}
