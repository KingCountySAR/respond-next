import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from './Material';
import { useAppSelector } from '@respond/lib/client/store';

export const BuildInfo = ({ open, onClose }: { open: boolean, onClose: () => void }) => {
  const buildId = useAppSelector(s => s.config.dev.buildId);
  const commit = buildId.split('-')[0];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="build-info-title"
      aria-describedby="build-info-description"
    >
      <DialogTitle id="build-info-title">Build information</DialogTitle>
      <DialogContent>
        <DialogContentText id="build-info-description">
          { commit === 'development' ? (
            'Development Build'
          ) : (
            <>Build: <a target="_blank" href={`https://github.com/KingCountySAR/respond-next/commits/${commit}`}>{buildId}</a></>
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>Close</Button>
      </DialogActions>
    </Dialog>
  );
}