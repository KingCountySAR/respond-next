import { Box, Chip, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import React from 'react';

import { useTeamCommands } from '@respond/lib/client/services/teams';
import { Team, TeamStatus } from '@respond/shared/types/operations';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';
import { useDialogs } from '@/client/components/DialogProvider';

import { DisbandTeamDialog } from './DisbandTeamDialog';

const TEAM_STATUSES: TeamStatus[] = ['In Base', 'In Transit', 'On Assignment', 'On Scene', 'Returning To Base', 'Disbanded'];

// Color mapping for status visual indicators
const STATUS_COLORS: Record<TeamStatus, 'default' | 'info' | 'warning' | 'success' | 'secondary'> = {
  'In Base': 'default',
  'In Transit': 'info',
  'On Assignment': 'warning',
  'On Scene': 'success',
  'Returning To Base': 'secondary',
  Disbanded: 'default',
};

interface TeamStatusSelectProps {
  team: Team;
  label?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

export const TeamStatusSelect: React.FC<TeamStatusSelectProps> = ({ team }) => {
  const teams = useTeamCommands();
  const activity = useActivityContext();
  const { open } = useDialogs();

  const handleChange = async (event: SelectChangeEvent<string>) => {
    const newStatus = event.target.value as TeamStatus;
    if (newStatus !== 'Disbanded') {
      teams.updateTeam(activity.id, { ...team, status: newStatus });
      return;
    }

    if (team.status === 'Disbanded') {
      return;
    }

    const isInBase = team.status === 'In Base';
    const hasResources = team.assignedParticipants.length + team.assignedEquipment.length > 0;
    if (isInBase || !hasResources) {
      teams.disbandTeam(activity.id, team.id, undefined);
    } else {
      const result = await open(DisbandTeamDialog, { activity, team });
      if (!result) return;
      teams.disbandTeam(activity.id, team.id, result.target);
    }
  };

  return (
    <Select
      value={team.status}
      onChange={handleChange}
      variant="outlined"
      size="small"
      sx={{
        borderRadius: '16px', // Pill shape
        height: 28,
        fontSize: '0.75rem',
        fontWeight: 600,
        '& .MuiOutlinedInput-notchedOutline': {
          border: 'none', // Removes the standard input border box
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          border: 'none',
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          border: 'none',
        },
        '& .MuiSelect-select': {
          paddingLeft: '12px',
          paddingRight: '28px !important', // Leaves space for the arrow
          paddingTop: '2px',
          paddingBottom: '2px',
          display: 'flex',
          alignItems: 'center',
        },
        '& .MuiSelect-icon': {
          right: '6px',
          color: 'inherit', // Arrow inherits text color
          fontSize: '1.1rem',
        },
      }}
    >
      {TEAM_STATUSES.map((status) => (
        <MenuItem key={status} value={status}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Chip
              label={status}
              size="small"
              color={STATUS_COLORS[status]}
              sx={{
                height: 20,
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            />
          </Box>
        </MenuItem>
      ))}
    </Select>
  );
};
