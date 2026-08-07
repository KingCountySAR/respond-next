import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

export function DashboardClock() {
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date());
    }, 1000);

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
