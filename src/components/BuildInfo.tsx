import { useAppSelector } from '@respond/lib/client/store';

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from './Material';

export const BuildInfo = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const build = getBuild();

  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="build-info-title" aria-describedby="build-info-description">
      <DialogTitle id="build-info-title">Build information</DialogTitle>
      <DialogContent>
        <DialogContentText id="build-info-description">
          {build.commit === 'development' ? (
            'Development Build'
          ) : (
            <>
              Build:{' '}
              <a target="_blank" href={build.url}>
                {build.id}
              </a>
            </>
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

type Build = {
  id: string,
  commit: string,
  url: string
}

export function getBuild(): Build {
  const buildId = useAppSelector((s) => s.config.dev.buildId);
  const commit = buildId.split('-')[0];
  return {
    id: buildId,
    commit: buildId.split('-')[0],
    url: commit === 'development' ? '#' : `https://github.com/KingCountySAR/respond-next/commits/${commit}`
  };
}
