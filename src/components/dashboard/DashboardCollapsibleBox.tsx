import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, IconButton, Stack, SxProps, Theme, Typography } from '@mui/material';
import React, { useState } from 'react';

interface DashboardCollapsibleBoxProps {
  title: string;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

export function DashboardCollapsibleBox({ title, children, sx }: DashboardCollapsibleBoxProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Box
      sx={[
        {
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.paper',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      onClick={() => setCollapsed((current) => !current)}
    >
      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
        <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center' }}>{title}</Typography>
        <IconButton size="small" sx={{ width: 32, height: 32 }}>
          {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </IconButton>
      </Stack>
      {!collapsed && children}
    </Box>
  );
}
