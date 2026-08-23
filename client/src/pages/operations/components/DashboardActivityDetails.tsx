import { Box, Typography } from '@mui/material';
import { Link } from 'wouter';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';

export function DashboardActivityDetails() {
  const activity = useActivityContext();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
      <Typography
        variant="h5"
        component={Link}
        href={`/${activity.isMission ? 'mission' : 'event'}/${activity.id}`}
        sx={{ fontWeight: 700, lineHeight: 1.2, color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
      >
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
