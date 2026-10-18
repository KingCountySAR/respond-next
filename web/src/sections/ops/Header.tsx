import { Box, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { observer, useCommandActivity } from '@sync/model/react';
import { activityPath } from '../../ui/paths';
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
  const activity = useCommandActivity();
  const record = activity.record!;
  const isMission = record.kind === 'mission';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
      <Typography
        variant="h5"
        component={Link}
        href={`~${activityPath(activity)}`}
        sx={{ fontWeight: 700, lineHeight: 1.2, color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
      >
        {record.title}
      </Typography>
      <Typography variant="subtitle1" sx={{ color: 'text.secondary', mt: 0.5 }}>
        {record.idNumber || ''}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
        {isMission ? 'Mission' : 'Event'} • {record.location.title || 'Location pending'}
      </Typography>
    </Box>
  );
});

/** Responding, Available and Field counts. */
export const DashboardResponderSummary = observer(function DashboardResponderSummary({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const summary = responderSummary(useCommandActivity());
  const lines = [
    ['Responding', summary.responding],
    ['Available', summary.available],
    ['Field', summary.field],
  ] as const;
  return (
    <>
      {lines.map(([label, count]) => (
        <DashboardMetricTile key={label} label={label} value={count.toString()} variant={variant} />
      ))}
    </>
  );
});
