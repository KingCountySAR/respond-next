import { Button, DialogActions, DialogContent } from '@mui/material';

import { DialogWithHistory } from '@respond/components/Material';

export default function ConfirmDialog({ open, prompt, onConfirm, onClose }: { open: boolean; prompt: string; onConfirm: () => void; onClose: () => void }) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };
  return (
    <DialogWithHistory open={open} onClose={onClose}>
      <DialogContent>{prompt}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm}>
          OK
        </Button>
      </DialogActions>
    </DialogWithHistory>
  );
}
