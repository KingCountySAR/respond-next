import { Autocomplete, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, TextField } from '@mui/material';
import { useEffect, useState } from 'react';

import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { buildLocationsSelector, LocationActions } from '@respond/lib/client/store/locations';
import { createNewLocation, Location } from '@respond/types/location';

import { FormControl, FormHelperText } from './Material';

export function LocationAutocomplete({ value, onChange }: { value?: Location; onChange: (location: Location | null) => void }) {
  const locations = useAppSelector(buildLocationsSelector());

  useEffect(() => {
    setOptions([...locations].sort((a, b) => (a.title >= b.title ? 1 : -1)));
  }, [locations]);

  const [options, setOptions] = useState<Location[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const loadingLocations = isOpen && options.length === 0;

  return (
    <Autocomplete
      open={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      disablePortal
      options={options}
      onChange={(event, value) => {
        onChange(value);
      }}
      isOptionEqualToValue={(option, value) => option.id === value?.id}
      getOptionLabel={(option) => option.title}
      value={value}
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

export function NewLocationDialog({ open, onSubmit, onClose }: { open: boolean; onSubmit: (location: Location) => void; onClose: () => void }) {
  const dispatch = useAppDispatch();

  const buildErrorState = () => {
    return {
      title: '',
      address: '',
      lat: '',
      lon: '',
      active: '',
    };
  };

  const [formData, setFormData] = useState({
    title: '',
    address: '',
    lat: '',
    lon: '',
    active: true,
  });

  const [errors, setErrors] = useState(buildErrorState());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData({ ...formData, [name]: checked });
  };

  const handleSubmit = () => {
    if (validate()) {
      return;
    }
    const location = { ...createNewLocation(formData.title), ...formData };
    dispatch(LocationActions.update(location));
    onSubmit(location);
    onClose();
  };

  const validate = () => {
    const newErrors = buildErrorState();

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
          <Box paddingTop={2}>
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
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!errors.active}>
                  <FormControlLabel name="active" control={<Checkbox defaultChecked onChange={handleCheckboxChange} />} label="Save For Later" />
                  <FormHelperText>{errors.active}</FormHelperText>
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
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
