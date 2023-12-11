import { Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { Controller, Resolver, ResolverResult, SubmitHandler, useForm } from 'react-hook-form';

import { apiFetch } from '@respond/lib/api';
import { createNewLocation, Location } from '@respond/types/location';

import { FormControl, FormHelperText } from './Material';

const getLocations = async () => {
  return (await apiFetch<{ data: Location[] }>(`/api/v1/locations`)).data;
};

export function LocationAutocomplete({ value, onChange }: { value?: Location; onChange: (location: Location | null) => void }) {
  const [currentValue, setCurrentValue] = useState(value);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationOptions, setLocationOptions] = useState<Location[]>([]);
  const loadingLocations = locationOpen && locationOptions.length === 0;

  useEffect(() => {
    if (!loadingLocations) {
      return undefined;
    }
    getLocations().then((options) => {
      setLocationOptions(options);
    });
  }, [loadingLocations]);

  useEffect(() => {
    if (!currentValue) return;
    onChange(currentValue);
  }, [currentValue, onChange]);

  // TODO: Attempt to Parse Lat/Lon and/or Addresses
  const parseLocation = (value: string) => {
    return createNewLocation(value);
  };

  return (
    <Autocomplete
      open={locationOpen}
      onOpen={() => setLocationOpen(true)}
      onClose={() => setLocationOpen(false)}
      disablePortal
      freeSolo={true}
      options={locationOptions}
      onChange={(event, value) => {
        if (!value) return;
        setCurrentValue(typeof value === 'string' ? parseLocation(value) : value);
      }}
      onInputChange={(event, value) => onChange(parseLocation(value))}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.title)}
      value={currentValue}
      renderOption={(props, option) => {
        return (
          <li {...props} key={option.title}>
            {option.title}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          variant="filled"
          label="Location"
          required
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loadingLocations ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

/**
 * Validation resolver
 * @param values
 * @returns
 */
const editLocationResolver: Resolver<Location> = async (values) => {
  console.log('resolving');

  const result: ResolverResult<Location> = {
    values: values.id ? values : {},
    errors: {},
  };

  if (!values.title) {
    result.errors.title = { type: 'required', message: 'Name is required' };
  }

  if (values.lat) {
    if (/[-]?\d{1,2}\.\d+/.test(values.lat)) {
      result.errors.lat = {
        type: 'validate',
        message: 'Latitude must be decimal degrees',
      };
    }
  }

  if (values.lon) {
    if (/[-]?\d{1,3}\.\d+/.test(values.lon)) {
      result.errors.lon = {
        type: 'validate',
        message: 'Longitude must be decimal degrees',
      };
    }
  }

  return result;
};

export function EditLocationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Location>({
    resolver: editLocationResolver,
    defaultValues: createNewLocation(''),
  });

  const onSubmit: SubmitHandler<Location> = (data) => {
    console.log('huzzah!', data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Dialog open={open} onClose={onClose}>
        <DialogTitle style={{ borderBottom: 'solid 4px ' }} alignItems="center" justifyContent="space-between" display="flex">
          <Box>Create Location</Box>
        </DialogTitle>
        <DialogContent>
          <Box padding={2}>
            <Grid container spacing={2} justifyItems="center">
              <Grid item xs={12}>
                <Controller
                  name="title"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.title?.message}>
                      <TextField autoFocus {...field} fullWidth label="Location Name" required></TextField>
                      <FormHelperText>{errors.title?.message}</FormHelperText>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="address"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.address?.message}>
                      <TextField {...field} fullWidth label="Address"></TextField>
                      <FormHelperText>{errors.address?.message}</FormHelperText>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="lat"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.lat?.message}>
                      <TextField {...field} fullWidth label="Lat (Decimal Degrees)"></TextField>
                      <FormHelperText>{errors.lat?.message}</FormHelperText>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="lon"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.lon?.message}>
                      <TextField {...field} fullWidth label="Lon (Decimal Degrees)"></TextField>
                      <FormHelperText>{errors.lon?.message}</FormHelperText>
                    </FormControl>
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </form>
  );
}
