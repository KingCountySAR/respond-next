import { Button, Dialog, DialogActions, DialogContent } from '@mui/material';

export default function ConfirmDialog({ open, prompt, onConfirm, onClose }: { open: boolean; prompt: string; onConfirm: () => void; onClose: () => void }) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent>{prompt}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm}>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
