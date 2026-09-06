import { Box, DialogContent, DialogTitle } from '@mui/material';
import { v4 as uuid } from 'uuid';

import { createNewLocation, Location } from '@respond/shared/types/location';

import { AppDialog } from '../DialogProvider/AppDialog';

import { LocationEditForm } from './LocationEditForm';
import { useLocationsStore } from './LocationsProvider';

export function LocationEditDialog({ location = createNewLocation(), open, onSubmit, onClose }: { location?: Location; open: boolean; onSubmit: (location: Location) => void; onClose: () => void }) {
  const locationsStore = useLocationsStore();
  // LocationEditForm already calls `onClose` itself right after `onSubmit`
  // resolves (LocationManager relies on that to dismiss its inline form) — do
  // not also call it here. Doing so fired the dialog's close/history-pop twice
  // in a row, and the second `history.back()` got queued before the first
  // one's popstate had resolved, over-popping past this page's own navigation
  // entry and closing whatever page opened the dialog (e.g. New Mission).
  const handleSubmit = async (location: Location) => {
    if (location.toSaved) {
      if (!location.isSaved) {
        location.id = uuid();
      }
      await locationsStore.update(location);
    }
    onSubmit(location);
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
