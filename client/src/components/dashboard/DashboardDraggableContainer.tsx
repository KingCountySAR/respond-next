import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Box, SxProps, Theme } from '@mui/material';
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
    <Box
      sx={[
        {
          position: 'relative',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          py: isCompact ? 0.75 : 1,
          pr: 1,
          pl: showHandle ? (isCompact ? 3 : 3.25) : 1,
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
            transform: 'scale(0.995)',
          },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {showHandle && <DragIndicatorIcon className="drag-handle" sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: isCompact ? 14 : 16, color: 'text.secondary', opacity: 0.55 }} />}
      {children}
    </Box>
  );
}
