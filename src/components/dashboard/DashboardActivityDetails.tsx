import { Box, Typography } from '@mui/material';

import { useActivityContext } from '../activities/ActivityProvider';

export function DashboardActivityDetails() {
  const activity = useActivityContext();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
        {activity.title}
      </Typography>
      <Typography variant="subtitle1" sx={{ color: 'text.secondary', mt: 0.5 }}>
        {activity.idNumber || ''}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
        {activity.isMission ? 'Mission' : 'Event'} • {activity.location?.title || 'Location pending'}
      </Typography>
    </Box>
  );
}
