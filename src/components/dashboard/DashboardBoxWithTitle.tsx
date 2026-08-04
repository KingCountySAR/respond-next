import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, IconButton, Stack, SxProps, Theme, Typography } from '@mui/material';
import React, { useState } from 'react';

interface DashboardBoxWithTitleProps {
  title: string;
  actions?: DashboardBoxWithTitleAction[];
  collapsible?: boolean;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

interface DashboardBoxWithTitleAction {
  icon: React.ReactNode;
  id: string;
  onClick: () => void;
}

export function DashboardBoxWithTitle({ title, actions = [], collapsible = false, children, sx }: DashboardBoxWithTitleProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Box
      sx={[
        {
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.paper',
          p: 1,
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
        <Stack direction="row">
          {actions.map((action) => (
            <IconButton
              key={action.id}
              size="small"
              sx={{ width: 24, height: 24 }}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
            >
              {action.icon}
            </IconButton>
          ))}
          {collapsible && (
            <IconButton size="small" sx={{ width: 24, height: 24 }}>
              {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
            </IconButton>
          )}
        </Stack>
      </Stack>
      {!collapsed && children}
    </Box>
  );
}
