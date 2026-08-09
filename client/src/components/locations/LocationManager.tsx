import { Box } from '@mui/material';
import { createNewLocation, Location } from '@respond/shared/types/location';
import { useState } from 'react';

import { useLocationCommands } from '@respond/lib/client/services/locations';

import { Button, Paper, Stack, Typography } from '../Material';
import { ToolbarPage } from '../ToolbarPage';

import { LocationAutocomplete } from './LocationAutocomplete';
import { LocationEditForm } from './LocationEditForm';

export const LocationManager = () => {
  const locations = useLocationCommands();
  const [selected, setSelected] = useState<Location>();

  const handleSelection = (location: Location | null) => {
    setSelected(location ?? undefined);
  };

  const handleFormSubmit = (location: Location) => {
    if (location.isSaved) {
      locations.updateLocation(location);
    } else {
      locations.removeLocation(location.id);
    }
  };

  const handleFormClose = () => {
    setSelected(undefined);
  };

  return (
    <ToolbarPage>
      <Paper sx={{ p: 2 }}>
        <Stack sx={{ mb: 2 }} direction="row" spacing={2} alignItems={'center'} justifyContent={'space-between'}>
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
