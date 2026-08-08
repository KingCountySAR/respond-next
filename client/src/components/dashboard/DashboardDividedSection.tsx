import { Stack, SxProps, Theme, Typography } from '@mui/material';
import { ReactNode } from 'react';

type DashboardDividedSectionProps = {
  title: string;
  children: ReactNode;
  sx?: SxProps<Theme>;
};

export function DashboardDividedSection({ title, children, sx }: DashboardDividedSectionProps) {
  return (
    <Stack spacing={0.5} sx={[{ pt: 1, borderTop: '1px solid', borderColor: 'divider' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}
