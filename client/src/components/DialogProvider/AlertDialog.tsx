import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Button, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';

import { AppDialog } from './AppDialog';

import { MuiDialogProps } from '.';

export type AlertType = 'none' | 'info' | 'warning' | 'error';

export interface AlertDialogProps extends MuiDialogProps<void> {
  title?: string;
  message: string;
  buttonLabel?: string;
  type?: AlertType;
}

export type AlertDialogOptions = Omit<AlertDialogProps, keyof MuiDialogProps<void>>;

const typeConfigs: Record<Exclude<AlertType, 'none'>, { color: 'info' | 'warning' | 'error'; icon: React.ReactNode }> = {
  info: { color: 'info', icon: <InfoIcon color="info" /> },
  warning: { color: 'warning', icon: <WarningAmberIcon color="warning" /> },
  error: { color: 'error', icon: <ErrorIcon color="error" /> },
};

export default function AlertDialog({ open, onClose, title, message, buttonLabel = 'OK', type = 'none' }: AlertDialogProps) {
  const config = type !== 'none' ? typeConfigs[type] : null;

  return (
    <AppDialog open={open} onClose={onClose}>
      {(title || config) && (
        <DialogTitle>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {config?.icon}
            {title && <Box component="span">{title}</Box>}
          </Stack>
        </DialogTitle>
      )}
      <DialogContent sx={{ pt: title || config ? undefined : 2 }}>{message}</DialogContent>
      <DialogActions>
        <Button variant="contained" color={config?.color ?? 'primary'} onClick={() => onClose()} focusRipple={false} autoFocus>
          {buttonLabel}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
