import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';

const COLLAPSE_WIDTH = 56;

export function DashboardPanel({ title, icon, collapse = 'left', grow = false, children }: { title: string; icon?: React.ReactNode; collapse: 'left' | 'right'; grow?: boolean; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = () => {
    setCollapsed((current) => !current);
  };
  return (
    <Paper
      elevation={2}
      sx={{
        width: collapsed ? COLLAPSE_WIDTH : grow ? '100%' : 280,
        minWidth: collapsed ? COLLAPSE_WIDTH : 280,
        flex: collapsed ? 'none' : grow ? 1 : 'none',
        transition: 'width 180ms ease',
        display: 'flex',
        flexDirection: 'column',
        p: 1,
        borderRadius: 3,
      }}
    >
      {collapse === 'left' ? <LeftPanelHeader title={title} icon={icon} collapsed={collapsed} onToggle={toggle} /> : <RightPanelHeader title={title} icon={icon} collapsed={collapsed} onToggle={toggle} />}
      {!collapsed && children}
    </Paper>
  );
}

function LeftPanelHeader({ title, icon, collapsed, onToggle }: { title: string; icon?: React.ReactNode; collapsed: boolean; onToggle: () => void }) {
  const open = (
    <Stack direction="row" alignItems="center" sx={{ mb: 1, gap: 1, width: '100%' }} justifyContent="space-between">
      <Box sx={{ width: 32, height: 32 }} /> {/* Placeholder to balance the layout when the button is on the right */}
      <DashboardPanelTitle title={title} icon={icon} />
      <IconButton onClick={onToggle} size="small" sx={{ width: 32, height: 32 }}>
        {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      </IconButton>
    </Stack>
  );

  const closed = (
    <Stack direction="column" alignItems="center" sx={{ gap: 2, width: '100%' }} justifyContent="flex-start">
      <IconButton onClick={onToggle} size="small" sx={{ width: 32, height: 32 }}>
        {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      </IconButton>
      <DashboardPanelTitle title={title} icon={icon} rotate />
    </Stack>
  );

  return collapsed ? closed : open;
}

function RightPanelHeader({ title, icon, collapsed, onToggle }: { title: string; icon?: React.ReactNode; collapsed: boolean; onToggle: () => void }) {
  const open = (
    <Stack direction="row" alignItems="center" sx={{ mb: 1, gap: 1, width: '100%' }} justifyContent="space-between">
      <IconButton onClick={onToggle} size="small" sx={{ width: 32, height: 32 }}>
        {collapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </IconButton>
      <DashboardPanelTitle title={title} icon={icon} />
      <Box sx={{ width: 32, height: 32 }} /> {/* Placeholder to balance the layout when the button is on the left */}
    </Stack>
  );

  const closed = (
    <Stack direction="column" alignItems="center" sx={{ gap: 2, width: '100%' }} justifyContent="flex-start">
      <IconButton onClick={onToggle} size="small" sx={{ width: 32, height: 32 }}>
        {collapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </IconButton>
      <DashboardPanelTitle title={title} icon={icon} rotate />
    </Stack>
  );

  return collapsed ? closed : open;
}

function DashboardPanelTitle({ title, rotate = false, icon }: { title: string; rotate?: boolean; icon?: React.ReactNode }) {
  return (
    <Stack direction={rotate ? 'column' : 'row'} spacing={1} alignItems="center">
      {icon}
      <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center', writingMode: rotate ? 'vertical-rl' : 'unset' }}>{title}</Typography>
    </Stack>
  );
}
