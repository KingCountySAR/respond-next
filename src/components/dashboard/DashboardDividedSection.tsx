import { Stack, Typography } from '@mui/material';

export function DashboardDividedSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack spacing={0.75} sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}
