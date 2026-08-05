import { Box, Paper, Stack } from '@mui/material';

import { useActivityContext } from '../activities/ActivityProvider';
import DashboardActivityDetails from '../dashboard/DashboardActivityDetails';
import DashboardClock from '../dashboard/DashboardClock';
import { DashboardWeather } from '../dashboard/DashboardWeather';

export function DashboardHeader() {
  const activity = useActivityContext();
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
        <Stack direction="row" alignItems="stretch" spacing={2}>
          <DashboardClock />
          <DashboardActivityDetails />
        </Stack>
        <Box sx={{ justifySelf: 'right', display: 'flex', alignItems: 'stretch' }}>
          <DashboardWeather lat={activity.location?.lat ?? 0} lon={activity.location?.lon ?? 0} />
        </Box>
      </Box>
    </Paper>
  );
}
