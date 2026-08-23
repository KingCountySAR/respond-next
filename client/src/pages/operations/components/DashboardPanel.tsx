import { Box, Paper, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ReactNode } from 'react';

export interface DashboardPanelProps {
  /** Title text shown in the header */
  title: string;
  /** Primary icon for the header */
  icon?: ReactNode;
  /** Main panel content */
  children: ReactNode;
  /** If true, the panel expands to take available flex space */
  grow?: boolean;
  /** Additional header action buttons (e.g., '+ ADD' or settings) */
  actions?: ReactNode;
}

export function DashboardPanel({ title, icon, children, grow = false, actions }: DashboardPanelProps) {
  const theme = useTheme();

  return (
    <Paper
      elevation={2}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: grow ? 1 : 'initial',
        minHeight: 0,
        height: '100%',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
        transition: theme.transitions.create(['all'], {
          duration: theme.transitions.duration.shorter,
        }),
      }}
    >
      {/* Panel Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          bgcolor: 'action.hover',
          borderBottom: `1px solid ${theme.palette.divider}`,
          minHeight: 48,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
          {icon && <Box sx={{ display: 'flex', color: 'action.active' }}>{icon}</Box>}
          <Typography variant="subtitle1" noWrap sx={{ userSelect: 'none', fontWeight: 600 }}>
            {title}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          {actions}
        </Stack>
      </Box>

      {/* Panel Body */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          p: 1.5,
        }}
      >
        {children}
      </Box>
    </Paper>
  );
}
