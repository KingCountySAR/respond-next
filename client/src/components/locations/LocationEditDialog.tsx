import { Box, DialogContent, DialogTitle } from '@mui/material';

import { useLocationCommands } from '@respond/lib/client/services/locations';
import { createNewLocation, Location } from '@respond/shared/types/location';

import { AppDialog } from '../DialogProvider/AppDialog';

import { LocationEditForm } from './LocationEditForm';

export function LocationEditDialog({ location = createNewLocation(), open, onSubmit, onClose }: { location?: Location; open: boolean; onSubmit: (location: Location) => void; onClose: () => void }) {
  const locations = useLocationCommands();
  const handleSubmit = (location: Location) => {
    if (location.toSaved) {
      locations.updateLocation(location);
    }
    onSubmit(location);
    onClose();
  };
  return (
    <AppDialog open={open} onClose={onClose}>
      <DialogTitle sx={{ alignItems: 'center', justifyContent: 'space-between', display: 'flex' }}>
        <Box>{location.title ? `Update ${location.title}` : 'Create New Location'}</Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <LocationEditForm enableTemporary variant="outlined" location={{ ...location }} onClose={onClose} onSubmit={handleSubmit} />
        </Box>
      </DialogContent>
    </AppDialog>
  );
}
