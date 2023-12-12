import { Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import { useEffect, useState } from 'react';

import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { buildLocationsSelector, LocationActions } from '@respond/lib/client/store/locations';
import { createNewLocation, Location } from '@respond/types/location';

import { FormControl, FormHelperText } from './Material';

export function LocationAutocomplete({ value, onChange }: { value?: Location; onChange: (location: Location | null) => void }) {
  const locations = useAppSelector(buildLocationsSelector());

  useEffect(() => {
    console.log('!!!', locations);
  }, [locations]);

  const [currentValue, setCurrentValue] = useState(value);
  const [locationOpen, setLocationOpen] = useState(false);
  const loadingLocations = locationOpen && locations.length === 0;

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
      options={locations}
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

export function EditLocationDialog({ open, onSubmit, onClose }: { open: boolean; onSubmit: (location: Location) => void; onClose: () => void }) {
  const dispatch = useAppDispatch();

  const [formData, setFormData] = useState({
    title: '',
    address: '',
    lat: '',
    lon: '',
  });

  const [errors, setErrors] = useState({
    title: '',
    address: '',
    lat: '',
    lon: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = () => {
    if (validate()) {
      return;
    }
    const location = { ...createNewLocation(formData.title), ...formData };
    console.log('send it', location);
    dispatch(LocationActions.update(location));
    onSubmit(location);
    onClose();
  };

  const validate = () => {
    const newErrors = {
      title: '',
      address: '',
      lat: '',
      lon: '',
    };

    if (!formData.title) {
      newErrors.title = 'Name is required';
    }

    if (formData.lat) {
      if (!/[-]?\d{1,2}\.\d+/.test(formData.lat)) {
        newErrors.lat = 'Latitude must be decimal degrees';
      } else if (!formData.lon) {
        newErrors.lon = 'Longitude is required';
      }
    }

    if (formData.lon) {
      if (!/[-]?\d{1,3}\.\d+/.test(formData.lon)) {
        newErrors.lon = 'Longitude must be decimal degrees';
      } else if (!formData.lat) {
        newErrors.lat = 'Longitude is required';
      }
    }

    const hasError = Object.values(newErrors).some((error) => !!error);
    setErrors(newErrors);
    return hasError;
  };

  return (
    <>
      <Dialog open={open} onClose={onClose}>
        <DialogTitle style={{ borderBottom: 'solid 4px ' }} alignItems="center" justifyContent="space-between" display="flex">
          <Box>Create Location</Box>
        </DialogTitle>
        <DialogContent>
          <Box padding={2}>
            <Grid container spacing={2} justifyItems="center">
              <Grid item xs={12}>
                <FormControl fullWidth error={!!errors.title}>
                  <TextField name="title" autoFocus fullWidth label="Location Name" required onChange={handleChange}></TextField>
                  <FormHelperText>{errors.title}</FormHelperText>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth error={!!errors.address}>
                  <TextField name="address" fullWidth label="Address" onChange={handleChange}></TextField>
                  <FormHelperText>{errors.address}</FormHelperText>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!errors.lat}>
                  <TextField name="lat" fullWidth label="Lat (Decimal Degrees)" onChange={handleChange}></TextField>
                  <FormHelperText>{errors.lat}</FormHelperText>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!errors.lon}>
                  <TextField name="lon" fullWidth label="Lon (Decimal Degrees)" onChange={handleChange}></TextField>
                  <FormHelperText>{errors.lon}</FormHelperText>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
