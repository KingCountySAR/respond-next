import { Stack, SxProps, Theme } from '@mui/material';
import { ReactNode } from 'react';
import { DragHandle } from '../DragAndDrop/DnDComponents';

type DashboardDraggableContainerProps = {
  children: ReactNode;
  sx?: SxProps<Theme>;
  showHandle?: boolean;
  variant?: 'standard' | 'compact';
  disabled?: boolean;
};

export function DashboardDraggableContainer({ children, sx, showHandle = true, variant = 'standard', disabled = false }: DashboardDraggableContainerProps) {
  const isCompact = variant === 'compact';

  const disabledStyles: SxProps<Theme> = {
    width: '100%',
    minWidth: 0,
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 2,
    p: isCompact ? 0.5 : 1,
    bgcolor: disabled ? '#ebebeb' : 'background.paper',
  };

  const draggableStyles: SxProps<Theme> = {
    width: '100%',
    minWidth: 0,
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 2,
    p: isCompact ? 0.5 : 1,
    cursor: 'grab',
    bgcolor: disabled ? '#ebebeb' : 'background.paper',
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
  };

  return (
    <Stack direction="row" alignItems="center" justifyContent="flex-start" spacing={isCompact ? 0.5 : 1} sx={[disabled ? disabledStyles : draggableStyles, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      {showHandle && <DragHandle />}
      {children}
    </Stack>
  );
}
