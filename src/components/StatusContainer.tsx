import { Box, Paper, Stack, SxProps, Theme } from '@mui/material';
import { ReactNode } from 'react';

export function StatusContainer({ color, children, sx }: { color: string; children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Stack direction="row" sx={sx}>
      <Paper
        elevation={0}
        sx={{
          width: 8,
          flexShrink: 0, // Prevents the color bar from shrinking if content expands
          bgcolor: color ?? 'transparent',
          borderBottomRightRadius: 0,
          borderTopRightRadius: 0,
        }}
      />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>{children}</Box>
    </Stack>
  );
}
