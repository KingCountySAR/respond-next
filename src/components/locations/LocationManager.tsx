import { Box } from '@mui/material';
import { useState } from 'react';

import { useAppDispatch } from '@respond/lib/client/store';
import { LocationActions } from '@respond/lib/client/store/locations';
import { createNewLocation, Location } from '@respond/types/location';

import { Button, Paper, Stack, Typography } from '../Material';
import { ToolbarPage } from '../ToolbarPage';

import { LocationAutocomplete } from './LocationAutocomplete';
import { LocationEditForm } from './LocationEditForm';

export const LocationManager = () => {
  const dispatch = useAppDispatch();
  const [selected, setSelected] = useState<Location>();

  const handleSelection = (location: Location | null) => {
    setSelected(location ?? undefined);
  };

  const handleFormSubmit = (location: Location) => {
    if (location.active) {
      dispatch(LocationActions.update(location));
    } else {
      dispatch(LocationActions.remove(location));
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
            <Button disabled={!!selected} variant="outlined" onClick={() => setSelected(createNewLocation())}>
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
