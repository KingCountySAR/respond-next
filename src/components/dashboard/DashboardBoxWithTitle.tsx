import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, IconButton, Stack, SxProps, Theme, Typography } from '@mui/material';
import React, { useState } from 'react';

interface DashboardCollapsibleBoxProps {
  title: string;
  collapsible?: boolean;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

export function DashboardBoxWithTitle({ title, collapsible = false, children, sx }: DashboardCollapsibleBoxProps): JSX.Element {
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
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        onClick={() => {
          if (!collapsible) return;
          setCollapsed((current) => !current);
        }}
        sx={{ cursor: 'pointer', pb: collapsed ? 0 : 1 }}
      >
        <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center' }}>{title}</Typography>
        {collapsible && (
          <IconButton size="small" sx={{ width: 24, height: 24 }}>
            {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        )}
      </Stack>
      {!collapsed && children}
    </Box>
  );
}
