import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { IconButton, Stack, SxProps, Theme, Typography } from '@mui/material';
import React, { useState } from 'react';

interface DashboardBoxWithTitleProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: DashboardBoxWithTitleAction[];
  collapse?: boolean;
  collapsible?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
  adornment?: React.ReactNode;
  sx?: SxProps<Theme>;
}

interface DashboardBoxWithTitleAction {
  icon: React.ReactNode;
  id: string;
  onClick: () => void;
}

export function DashboardBoxWithTitle({ title, subtitle, actions = [], collapse = false, collapsible = false, children, icon, adornment, sx }: DashboardBoxWithTitleProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(collapse);
  const [hovered, setHovered] = useState(false);

  return (
    <Stack
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
      spacing={0.5}
    >
      <Stack
        direction="row"
        onClick={() => {
          if (!collapsible) return;
          setCollapsed((current) => !current);
        }}
        sx={{ alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {icon}
          <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center' }}>{title}</Typography>
          {adornment}
        </Stack>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Stack direction="row" sx={{ visibility: hovered ? 'visible' : 'hidden' }}>
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
          </Stack>
          {collapsible && (
            <IconButton size="small" sx={{ width: 24, height: 24 }}>
              {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
            </IconButton>
          )}
        </Stack>
      </Stack>
      {!!subtitle &&
        (React.isValidElement(subtitle) ? (
          subtitle
        ) : (
          <Typography component="div" sx={{ color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        ))}
      {!collapsed && children}
    </Stack>
  );
}
