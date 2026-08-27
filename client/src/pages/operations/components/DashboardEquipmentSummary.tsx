import Inventory2Icon from '@mui/icons-material/Inventory2';
import { Typography } from '@mui/material';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';
import { Box, Stack } from '@/client/components/Material';

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

  const assignedTeams = teams.filter((team) => team.status !== 'On Scene');

  // Map item names to count and unique team names holding that item
  const assignedEquipmentDetails = assignedTeams.reduce<Record<string, { count: number; teams: Set<string> }>>((acc, team) => {
    (team.assignedEquipment ?? []).forEach((item) => {
      if (!acc[item.name]) {
        acc[item.name] = { count: 0, teams: new Set() };
      }
      acc[item.name].count += 1;
      acc[item.name].teams.add(team.name);
    });
    return acc;
  }, {});

  const assignedEntries = Object.entries(assignedEquipmentDetails).sort(([leftName], [rightName]) => leftName.localeCompare(rightName));

  const onSceneEquipmentCounts = countTeamEquipment(teams.filter((team) => team.status === 'On Scene'));
  const onSceneEntries = Object.entries(onSceneEquipmentCounts).sort(([leftName], [rightName]) => leftName.localeCompare(rightName));

  const placesWithEquipment = places.filter((place) => place.assignedEquipment?.length > 0);

  return (
    <Stack spacing={1}>
      <DashboardBoxWithTitle title="On Scene" icon={<Inventory2Icon fontSize="small" />} collapsible={!!onSceneEntries.length}>
        {!!onSceneEntries.length &&
          onSceneEntries.map(([name, count]) => (
            <Typography key={name} variant="subtitle1" sx={{ whiteSpace: 'pre-line' }}>
              {`${count} - ${name}`}
            </Typography>
          ))}
      </DashboardBoxWithTitle>
      <DashboardBoxWithTitle title="Assigned" icon={<Inventory2Icon fontSize="small" />} collapsible={!!assignedEntries.length}>
        {!!assignedEntries.length &&
          assignedEntries.map(([name, details]) => (
            <Box key={name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ whiteSpace: 'pre-line', mr: 1 }}>
                {`${details.count} - ${name}`}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                {Array.from(details.teams).join(', ')}
              </Typography>
            </Box>
          ))}
      </DashboardBoxWithTitle>
      <DashboardBoxWithTitle title="Staged" icon={<Inventory2Icon fontSize="small" />} collapsible={!!placesWithEquipment.length}>
        {!!placesWithEquipment.length &&
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
                    {`${count} - ${name}`}
                  </Typography>
                ))}
              </div>
            );
          })}
      </DashboardBoxWithTitle>
    </Stack>
  );
}
