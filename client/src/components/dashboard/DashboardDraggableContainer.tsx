import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Box, Stack, SxProps, Theme } from '@mui/material';
import { ReactNode } from 'react';

type DashboardDraggableContainerProps = {
  children: ReactNode;
  sx?: SxProps<Theme>;
  showHandle?: boolean;
  variant?: 'standard' | 'compact';
};

export function DashboardDraggableContainer({ children, sx, showHandle = true, variant = 'standard' }: DashboardDraggableContainerProps) {
  const isCompact = variant === 'compact';

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="flex-start"
      spacing={isCompact ? 0.5 : 1}
      sx={[
        {
          width: '100%',
          minWidth: 0,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: isCompact ? 0.5 : 1,
          cursor: 'grab',
          bgcolor: 'background.paper',
          boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
          transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background-color 120ms ease',
          ':hover': {
            bgcolor: 'grey.50',
            borderColor: 'primary.light',
            boxShadow: '0 6px 14px rgba(16,24,40,0.12)',
            '& .drag-handle': {
              opacity: 0.9,
            },
          },
          ':active': {
            cursor: 'grabbing',
            transform: 'scale(0.9)',
          },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {showHandle && <DragIndicatorIcon className="drag-handle" sx={{ fontSize: isCompact ? 14 : 16, color: 'text.secondary', opacity: 0.55 }} />}
      {children}
    </Stack>
  );
}
