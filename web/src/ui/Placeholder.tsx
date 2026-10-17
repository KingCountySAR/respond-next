import { Alert, Typography } from '@mui/material';
import type { ReactNode } from 'react';

/** Marks a page whose legacy screen hasn't been ported yet, and says which step brings it. */
export function Placeholder({ title, comesWith, children }: { title: string; comesWith: string; children?: ReactNode }) {
  return (
    <>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {children}
      <Alert severity="info" sx={{ mt: 2 }}>
        This page comes over with {comesWith}.
      </Alert>
    </>
  );
}
