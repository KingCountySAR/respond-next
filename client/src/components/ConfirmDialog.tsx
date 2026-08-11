import { Button, DialogActions, DialogContent } from '@mui/material';

import { DialogWithHistory } from '@respond/components/Material';

export default function ConfirmDialog({ open, prompt, onConfirm, onClose, destructive = false, label = 'OK' }: { open: boolean; prompt: string; onConfirm: () => void; onClose: () => void; destructive?: boolean; label?: string }) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };
  return (
    <DialogWithHistory open={open} onClose={onClose}>
      <DialogContent>{prompt}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color={destructive ? 'error' : 'primary'} onClick={handleConfirm}>
          {label}
        </Button>
      </DialogActions>
    </DialogWithHistory>
  );
}
