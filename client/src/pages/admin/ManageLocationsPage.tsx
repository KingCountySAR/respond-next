import { createNewLocation, Location } from '@app/shared/api';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { LocationAutocomplete } from '@respond/components/locations/LocationAutocomplete';
import { LocationEditForm } from '@respond/components/locations/LocationEditForm';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useLocationsContext } from '@respond/store/locationsStore';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

export const ManageLocationsPage = observer(() => {
  const locationsStore = useLocationsContext();
  const [selected, setSelected] = useState<Location>();

  const handleSelection = (location: Location | null) => {
    setSelected(location ?? undefined);
  };

  const handleFormClose = () => {
    setSelected(undefined);
  };

  const handleFormSubmit = async (location: Location) => {
    if (location.isSaved) {
      locationsStore.save(location);
    } else {
      locationsStore.remove(location);
    }
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
});
