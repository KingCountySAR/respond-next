import { Box, Chip, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import React from 'react';

import { TeamStatus } from '../../types/team';

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
  value: TeamStatus;
  onChange: (status: TeamStatus) => void;
  label?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

export const TeamStatusSelect: React.FC<TeamStatusSelectProps> = ({ value, onChange }) => {
  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value as TeamStatus);
  };

  return (
    <Select
      value={value}
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
