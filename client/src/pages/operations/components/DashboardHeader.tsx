import { Box, Paper, Stack } from '@mui/material';

import { DashboardActivityDetails } from './DashboardActivityDetails';
import { DashboardClock } from './DashboardClock';
import { DashboardResponderSummary } from './DashboardResponderSummary';

export function DashboardHeader() {
  return (
    <Paper elevation={2} sx={{ p: 2, display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 2, borderRadius: 3, minHeight: 120 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          alignItems: 'stretch',
          gap: 2,
          width: '100%',
        }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: 'stretch' }}>
          <DashboardClock />
          <DashboardActivityDetails />
        </Stack>
        <Stack direction={'row'} spacing={1} sx={{ justifySelf: 'right' }}>
          <DashboardResponderSummary />
        </Stack>
      </Box>
    </Paper>
  );
}
