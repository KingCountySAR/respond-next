import { Typography } from '@mui/material';

import { useActivityContext } from '../activities/ActivityProvider';
import { Stack } from '../Material';

import { DashboardBoxWithTitle } from './DashboardBoxWithTitle';

export function DashboardEquipmentSummary() {
  const activity = useActivityContext();
  const teams = activity?.teams ?? [];
  const places = activity?.places ?? [];

  const countTeamEquipment = (filteredTeams: typeof teams) =>
    filteredTeams
      .flatMap((team) => team.assignedEquipment ?? [])
      .reduce<Record<string, number>>((counts, item) => {
        counts[item.name] = (counts[item.name] ?? 0) + 1;
        return counts;
      }, {});

  const onSceneEquipmentCounts = countTeamEquipment(teams.filter((team) => team.status === 'On Scene'));
  const assignedEquipmentCounts = countTeamEquipment(teams.filter((team) => team.status !== 'On Scene'));

  const onSceneEntries = Object.entries(onSceneEquipmentCounts).sort(([leftName], [rightName]) => leftName.localeCompare(rightName));
  const assignedEntries = Object.entries(assignedEquipmentCounts).sort(([leftName], [rightName]) => leftName.localeCompare(rightName));

  const placesWithEquipment = places.filter((place) => place.assignedEquipment?.length > 0);

  return (
    <DashboardBoxWithTitle title="Equipment" collapsible>
      <Stack spacing={1}>
        <DashboardBoxWithTitle title="On Scene" collapsible>
          {onSceneEntries.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No equipment on scene.
            </Typography>
          ) : (
            onSceneEntries.map(([name, count]) => (
              <Typography key={name} variant="subtitle1" sx={{ whiteSpace: 'pre-line' }}>
                {`${count} - ${name}`}
              </Typography>
            ))
          )}
        </DashboardBoxWithTitle>
        <DashboardBoxWithTitle title="Assigned" collapsible>
          {assignedEntries.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No equipment assigned.
            </Typography>
          ) : (
            assignedEntries.map(([name, count]) => (
              <Typography key={name} variant="subtitle1" sx={{ whiteSpace: 'pre-line' }}>
                {`${count} - ${name}`}
              </Typography>
            ))
          )}
        </DashboardBoxWithTitle>
        <DashboardBoxWithTitle title="Staged" collapsible>
          {placesWithEquipment.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
                  <Typography variant="subtitle2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {place.name}
                  </Typography>
                  {entries.map(([name, count]) => (
                    <Typography key={name} variant="subtitle1" sx={{ whiteSpace: 'pre-line' }}>
                      {`${count} - ${name}`}
                    </Typography>
                  ))}
                </div>
              );
            })
          )}
        </DashboardBoxWithTitle>
      </Stack>
    </DashboardBoxWithTitle>
  );
}
