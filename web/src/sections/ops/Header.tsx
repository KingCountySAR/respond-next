import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, ButtonBase, Divider, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { observer, useManageActivity } from '@sync/model/react';
import { useDialogs } from '../../shell/dialogs';
import { activityPath } from '../../ui/paths';
import { UnitChips } from '../../ui/UnitChips';
import { useChange } from '../../ui/useChange';
import { responderSummary } from './opsRules';
import { DashboardMetricTile } from './parts';

export function DashboardHeader() {
  return (
    <Paper elevation={2} sx={{ p: 2, display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 2, borderRadius: 3, minHeight: 120 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'stretch', gap: 2, width: '100%' }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'stretch' }}>
          <DashboardClock />
          <DashboardActivityDetails />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ justifySelf: 'right' }}>
          <DashboardResponderSummary />
        </Stack>
      </Box>
    </Paper>
  );
}

function DashboardClock() {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <Box sx={{ minWidth: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 3, px: 3, py: 2 }}>
      <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1, letterSpacing: 1.5 }}>
        {new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(clock)}
      </Typography>
    </Box>
  );
}

const DashboardActivityDetails = observer(function DashboardActivityDetails() {
  const activity = useManageActivity();
  const record = activity.record!;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', minWidth: 0 }}>
      <DashboardActivityMenu />
      <Typography variant="subtitle1" sx={{ color: 'text.secondary', mt: 0.5 }}>
        {record.idNumber || ''} • {record.location.title || 'Location pending'}
      </Typography>
      <UnitChips activity={activity} sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 0.5, mt: 1 }} />
    </Box>
  );
});

/** The dashboard's views. Only the full one exists so far. */
const VIEWS = [
  { value: 'full', label: 'Full dashboard', ready: true },
  { value: 'staging', label: 'Staging', ready: false },
  { value: 'scribe', label: 'Scribe', ready: false },
] as const;

/** The title opens the activity's menu: the responder view, the dashboard's views, and closing or reopening it. */
const DashboardActivityMenu = observer(function DashboardActivityMenu() {
  const activity = useManageActivity();
  const record = activity.record!;
  const { confirm } = useDialogs();
  const change = useChange();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const kind = record.kind === 'mission' ? 'mission' : 'event';

  const handleCloseOrReopen = async () => {
    setAnchor(null);
    const label = record.closed ? 'Reopen' : 'Close';
    const confirmed = await confirm({
      title: `${label} ${kind}?`,
      prompt: `${record.closed ? '' : `Everyone still on the ${kind} will be signed out. `}`,
      label,
    });
    if (confirmed) change(() => (record.closed ? activity.reopen() : activity.close()));
  };

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        sx={{ borderRadius: 1, px: 0.5, mx: -0.5, textAlign: 'left', '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Typography variant="h5" component="span" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {record.title}
        </Typography>
        <ArrowDropDownIcon sx={{ color: 'text.secondary' }} />
      </ButtonBase>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem component="a" href={activityPath(activity)} target="_blank" rel="noopener" onClick={() => setAnchor(null)}>
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open responder view</ListItemText>
        </MenuItem>
        <Divider />
        <ListSubheader sx={{ lineHeight: '32px' }}>Views</ListSubheader>
        {VIEWS.map((v) => (
          <MenuItem key={v.value} disabled={!v.ready} selected={v.value === 'full'} onClick={() => setAnchor(null)}>
            <ListItemIcon>{v.value === 'full' && <CheckIcon fontSize="small" />}</ListItemIcon>
            <ListItemText secondary={v.ready ? undefined : 'Coming soon'}>{v.label}</ListItemText>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={handleCloseOrReopen}>
          <ListItemIcon>{record.closed ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}</ListItemIcon>
          <ListItemText>
            {record.closed ? 'Reopen' : 'Close'} {kind}…
          </ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
});

/** On the way, Field and Total counts. */
export const DashboardResponderSummary = observer(function DashboardResponderSummary({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const summary = responderSummary(useManageActivity());
  const lines = [
    ['On the way', summary.onTheWay],
    ['Field', summary.field],
    ['Total', summary.total],
  ] as const;
  return (
    <>
      {lines.map(([label, count]) => (
        <DashboardMetricTile key={label} label={label} value={count.toString()} variant={variant} />
      ))}
    </>
  );
});
