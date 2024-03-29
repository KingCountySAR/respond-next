import { Box, Dialog, DialogContent, DialogTitle } from '@mui/material';

import { useAppDispatch } from '@respond/lib/client/store';
import { LocationActions } from '@respond/lib/state';
import { createNewLocation, Location } from '@respond/types/location';

import { LocationEditForm } from './LocationEditForm';

export function LocationEditDialog({ location = createNewLocation(), open, onSubmit, onClose }: { location?: Location; open: boolean; onSubmit: (location: Location) => void; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const handleSubmit = (location: Location) => {
    if (location.toSaved) {
      dispatch(LocationActions.update(location));
    }
    onSubmit(location);
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle alignItems="center" justifyContent="space-between" display="flex">
        <Box>{location.title ? `Update ${location.title}` : 'Create New Location'}</Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <LocationEditForm enableTemporary variant="outlined" location={{ ...location }} onClose={onClose} onSubmit={handleSubmit} />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
