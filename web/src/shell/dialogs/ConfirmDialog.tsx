import { Button, DialogActions, DialogContent, DialogTitle } from '@mui/material';

import { AppDialog } from './AppDialog';

import { MuiDialogProps } from '.';

interface ConfirmDialogProps extends MuiDialogProps<boolean> {
  title?: string;
  prompt: string;
  destructive?: boolean;
  label?: string;
}

export type ConfirmDialogOptions = Omit<ConfirmDialogProps, keyof MuiDialogProps<boolean>>;

export default function ConfirmDialog({ open, title, prompt, onClose, destructive = false, label = 'OK' }: ConfirmDialogProps) {
  return (
    <AppDialog open={open} onClose={onClose}>
      {title && <DialogTitle>{title}</DialogTitle>}
      <DialogContent sx={{ pt: title ? undefined : 2 }}>{prompt}</DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>Cancel</Button>
        <Button variant="contained" color={destructive ? 'error' : 'primary'} onClick={() => onClose(true)}>
          {label}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
