import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { randomId } from '@sync/core';
import type { SavedLocation } from '@sync/domain';
import { useApi } from '../../shell/api';
import { useDialogs } from '../../shell/dialogs';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { LocationAutocomplete } from '../../ui/locations/LocationAutocomplete';
import { LocationEditForm, formValues, locationFields, type LocationFormValues } from '../../ui/locations/LocationEditForm';

/** The legacy LocationManager (`/admin/locations`): find, create, edit and delete saved locations. */
export function LocationManager() {
  const api = useApi();
  const { alert, confirm } = useDialogs();
  // A saved location, or a new one (no id yet).
  const [selected, setSelected] = useState<SavedLocation | 'new' | undefined>();

  useEffect(() => {
    document.title = 'Locations';
  }, []);

  const report = (what: string) => (err: unknown) => alert({ title: what, message: err instanceof Error ? err.message : String(err), type: 'error' });

  const handleSubmit = async (values: LocationFormValues) => {
    const id = selected === 'new' || !selected ? randomId() : selected.id;
    try {
      await api.saveLocation({ id, ...locationFields(values) });
      setSelected(undefined);
    } catch (err) {
      await report('Not saved')(err);
    }
  };

  const handleDelete = async () => {
    if (!selected || selected === 'new') return;
    const confirmed = await confirm({ prompt: `Delete ${selected.title}?`, destructive: true, label: 'Delete' });
    if (!confirmed) return;
    try {
      await api.removeLocation(selected.id);
      setSelected(undefined);
    } catch (err) {
      await report('Not deleted')(err);
    }
  };

  return (
    <ToolbarPage>
      <Paper sx={{ p: 2 }}>
        <Stack sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }} direction="row" spacing={2}>
          <Typography variant="h4">Locations</Typography>
          <Box>
            <Button disabled={!!selected} variant="outlined" onClick={() => setSelected('new')}>
              New
            </Button>
          </Box>
        </Stack>
        {!selected && <LocationAutocomplete variant="outlined" onChange={(l) => setSelected(l ?? undefined)} />}
        {selected && (
          <LocationEditForm
            key={selected === 'new' ? 'new' : selected.id}
            initial={formValues(selected === 'new' ? null : selected)}
            isSaved={selected !== 'new'}
            variant="outlined"
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            onClose={() => setSelected(undefined)}
          />
        )}
      </Paper>
    </ToolbarPage>
  );
}
