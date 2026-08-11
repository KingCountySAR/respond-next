import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Typography } from '@mui/material';
import { useState } from 'react';

import { useTeamCommands } from '@respond/lib/client/services/teams';
import { createNewTeam, Team } from '@respond/shared/types/operations';

import { useActivityContext } from '../activities/ActivityProvider';
import { Stack } from '../Material';

import DashboardTeamCard from './DashboardTeamCard';

function getNextTeamNumber(teams: Team[]): number {
  const usedNumbers = new Set<number>();

  (teams ?? []).forEach((team) => {
    const match = team.name.trim().match(/^team\s+(\d+)$/i);
    if (match) {
      usedNumbers.add(Number(match[1]));
    }
  });

  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1;
  }

  return nextNumber;
}

const sortTeams = (left: Team, right: Team) => {
  // Sort order for dashboard team listing:
  // 1. All non-disbanded teams should appear before any 'Disbanded' teams.
  // 2. Teams with status 'Disbanded' should still be alphabetized by name.
  // 3. For active teams, sort by GAR priority (red first, then amber, then green).
  // 4. If GAR is the same, sort active teams alphabetically by name.
  if (left.status === 'Disbanded' && right.status !== 'Disbanded') {
    return 1;
  }

  if (right.status === 'Disbanded' && left.status !== 'Disbanded') {
    return -1;
  }

  if (left.status === 'Disbanded' && right.status === 'Disbanded') {
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  }

  const garPriority: Team['gar'][] = ['red', 'amber', 'green'];

  const leftPriority = garPriority.indexOf(left.gar as Team['gar']);
  const rightPriority = garPriority.indexOf(right.gar as Team['gar']);

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
};

export function DashboardTeamManager() {
  const teamCommands = useTeamCommands();

  const activity = useActivityContext();
  const [expandedAll, setExpandedAll] = useState(false);
  const teams = activity.teams ?? [];

  const addTeam = () => {
    const nextTeamNumber = getNextTeamNumber(teams);
    teamCommands.createTeam(activity.id, createNewTeam(`Team ${nextTeamNumber}`));
  };

  const toggleAll = () => {
    setExpandedAll((current) => !current);
  };

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Button size="small" variant="outlined" onClick={toggleAll}>
          {expandedAll ? 'Collapse all' : 'Expand all'}
        </Button>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={addTeam}>
          Add
        </Button>
      </Stack>
      <Box sx={{ flex: 1, width: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="column" spacing={1} sx={{ minHeight: 0, flex: 1 }}>
          {teams.length ? (
            [...teams].sort(sortTeams).map((team) => {
              return <DashboardTeamCard key={team.id} team={team} defaultExpanded={expandedAll} />;
            })
          ) : (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                There are no active teams.
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>
    </>
  );
}
