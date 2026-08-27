import { Paper, Stack, Typography } from '@mui/material';

export function DashboardMetricTile({ label, value, variant }: { label: string; value: string; variant?: 'desktop' | 'mobile' }) {
  return (
    <Paper variant="outlined" sx={{ p: 1, borderRadius: 2, flex: 1, minWidth: variant === 'mobile' ? undefined : 180 }}>
      <Stack spacing={0} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="div" sx={{ fontWeight: 700, fontSize: variant === 'mobile' ? '1rem' : '2rem' }}>
          {value}
        </Typography>
        <Typography component="div" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
      </Stack>
    </Paper>
  );
}
