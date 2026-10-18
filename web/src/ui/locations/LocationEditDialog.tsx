import { Box, DialogContent, DialogTitle } from '@mui/material';
import { randomId } from '@sync/core';
import { fromSaved, type Location, type SavedLocation } from '@sync/domain';
import { useApi } from '../../shell/api';
import { useDialogs, type MuiDialogProps } from '../../shell/dialogs';
import { AppDialog } from '../../shell/dialogs/AppDialog';
import { LocationEditForm, formValues, locationFields, type LocationFormValues } from './LocationEditForm';

/**
 * The legacy LocationEditDialog, for an activity's location: it closes with the location to use,
 * having first saved it to the catalog when "Create/Update Saved Location" is on.
 */
export function LocationEditDialog({ location, open, onClose }: MuiDialogProps<Location> & { location?: Location | null }) {
  const api = useApi();
  const { alert } = useDialogs();
  const isSaved = !!location?.savedId;

  const submit = async (values: LocationFormValues) => {
    const fields = locationFields(values);
    if (!values.toSaved) {
      onClose({ title: fields.title, address: fields.address, lat: fields.lat, lon: fields.lon, savedId: null });
      return;
    }
    let entry: SavedLocation | undefined;
    try {
      // Updating keeps the saved entry's description, which this form doesn't show.
      const savedId = location?.savedId;
      const existing = savedId ? (await api.searchLocations('')).find((l) => l.id === savedId) : undefined;
      entry = { ...fields, id: savedId ?? randomId(), description: existing?.description ?? '' };
      await api.saveLocation(entry);
    } catch (err) {
      await alert({ title: 'Not saved', message: err instanceof Error ? err.message : String(err), type: 'error' });
      return;
    }
    onClose(fromSaved(entry));
  };

  return (
    <AppDialog open={open} onClose={onClose}>
      <DialogTitle sx={{ alignItems: 'center', justifyContent: 'space-between', display: 'flex' }}>
        <Box>{location?.title ? `Update ${location.title}` : 'Create New Location'}</Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <LocationEditForm enableTemporary variant="outlined" isSaved={isSaved} initial={formValues(location)} onClose={() => onClose(null)} onSubmit={submit} />
        </Box>
      </DialogContent>
    </AppDialog>
  );
}
