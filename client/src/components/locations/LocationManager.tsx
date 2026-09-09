import { Box } from '@mui/material';
import { useState } from 'react';

import { createNewLocation, Location } from '@respond/shared/types/location';

import { Button, Paper, Stack, Typography } from '../Material';
import { ToolbarPage } from '../ToolbarPage';

import { LocationAutocomplete } from './LocationAutocomplete';
import { LocationEditForm } from './LocationEditForm';
import { useLocationsStore } from './LocationsProvider';

export const LocationManager = () => {
  const locationsStore = useLocationsStore();
  const [selected, setSelected] = useState<Location>();

  const handleSelection = (location: Location | null) => {
    setSelected(location ?? undefined);
  };

  const handleFormSubmit = async (location: Location) => {
    if (location.isSaved) {
      await locationsStore.update(location);
    } else {
      await locationsStore.remove(location.id);
    }
  };

  const handleFormClose = () => {
    setSelected(undefined);
  };

  return (
    <ToolbarPage>
      <Paper sx={{ p: 2 }}>
        <Stack sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }} direction="row" spacing={2}>
          <Typography variant="h4">Locations</Typography>
          <Box>
            <Button disabled={!!selected} variant="outlined" onClick={() => setSelected(createNewLocation(true))}>
              New
            </Button>
          </Box>
        </Stack>
        {!selected && <LocationAutocomplete variant="outlined" onChange={handleSelection} />}
        {selected && <LocationEditForm location={selected} variant="outlined" onSubmit={handleFormSubmit} onClose={handleFormClose} />}
      </Paper>
    </ToolbarPage>
  );
};
