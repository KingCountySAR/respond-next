import React from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import ErrorIcon from '@mui/icons-material/Error';

interface DashboardErrorIndicatorProps {
  /** Optional error message displayed in a hover tooltip */
  message?: string;
  /** Size of the icon in pixels or CSS units (default: 20) */
  size?: number | string;
}

export const DashboardErrorIndicator: React.FC<DashboardErrorIndicatorProps> = ({
  message,
  size = 20,
}) => {
  if (message) {
    return (
      <Tooltip title={message} arrow placement="top">
        <Box
          aria-label={message || 'Error'}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'error.main',
            fontSize: size,
            cursor: message ? 'help' : 'default',
            lineHeight: 1,
          }}
        >
          <ErrorIcon fontSize="inherit" />
        </Box>
      </Tooltip>
    );
  }
};
