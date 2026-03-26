import { createNewLocation, Location } from '@app/shared/api';
import DeleteIcon from '@mui/icons-material/Delete';
import { Button, FormControl, FormControlLabel, FormHelperText, Grid, IconButton, Stack, Switch, TextField } from '@mui/material';
import { useState } from 'react';
import { Controller, Resolver, useForm, useWatch } from 'react-hook-form';


import ConfirmDialog from '../ConfirmDialog';
import { GoogleMapEmbed } from '../GoogleMapEmbed';

type InputVariant = 'filled' | 'outlined' | 'standard';

/**
 * Validation resolver
 * @param values
 * @returns
 */
const resolver: Resolver<Location> = async (values) => {
  const errors: Record<string, { type: string, message: string }> = {};

  if (!values.title) {
    errors.title = { type: 'required', message: 'Name is required' };
  }

  if (values.lat) {
    if (!/[-]?\d{1,2}\.\d+/.test(values.lat)) {
      errors.lat = { type: 'format', message: 'Latitude must be decimal degrees' };
    } else if (!values.lon) {
      errors.lon = { type: 'required', message: 'Longitude is required' };
    }
  }

  if (values.lon) {
    if (!/[-]?\d{1,3}\.\d+/.test(values.lon)) {
      errors.lon = { type: 'format', message: 'Longitude must be decimal degrees' };
    } else if (!values.lat) {
      errors.lat = { type: 'required', message: 'Longitude is required' };
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      values: {},
      errors
    };
  }
  return {
    values: values.id ? values : {} as Location,
    errors: {}
  };
};

export function LocationEditForm({ location, enableTemporary, variant = 'filled', onSubmit, onClose }: { location: Location; enableTemporary?: boolean; variant?: InputVariant; onSubmit: (location: Location) => void; onClose?: () => void }) {
  // Legacy activity.location records will only have title. We need to initialize
  // them onto the new Location object to ensures backward compatibility.
  const defaultValues = { ...createNewLocation(), ...location };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [ persist, setPersist ] = useState(!enableTemporary);

  const {
    control,
    handleSubmit,
    formState: { isDirty, errors },
  } = useForm<Location>({
    resolver,
    defaultValues,
  });

  // Delete should only be available in contexts where temporary is not an option; i.e. we are not editing an activity location.
  const enableDelete = location.isSaved && !enableTemporary;

  const handleFormSubmit = (location: Location, isDelete?: boolean) => {
    location.isSaved = persist && !isDelete;
    onSubmit(location);
    onClose?.();
  };

  const handleFormDelete = () => {
    setConfirmDelete(true);
  };

  const handleFormClose = () => {
    onClose?.();
  };

  const lat = useWatch({ control, name: 'lat' });
  const lon = useWatch({ control, name: 'lon' });
  const address = useWatch({ control, name: 'address' });

  return (
    <>
      <form onSubmit={handleSubmit(loc => handleFormSubmit(loc))}>
        <Grid container spacing={2} justifyItems="center">
          <Grid size={12}>
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.title?.message}>
                  <TextField {...field} variant={variant} disabled={enableTemporary && location.isSaved} label="Location Name" required />
                  <FormHelperText>{errors.title?.message}</FormHelperText>
                </FormControl>
              )}
            />
          </Grid>
          <Grid size={12}>
            <Controller
              name="address"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.address?.message}>
                  <TextField multiline {...field} variant={variant} label="Address" />
                  <FormHelperText>{errors.address?.message}</FormHelperText>
                </FormControl>
              )}
            />
          </Grid>
          <Grid size={{ xs:12, sm: 6 }}>
            <Controller
              name="lat"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.lat?.message}>
                  <TextField {...field} variant={variant} label="Lat (Decimal Degrees)" />
                  <FormHelperText>{errors.lat?.message}</FormHelperText>
                </FormControl>
              )}
            />
          </Grid>
          <Grid size={{ xs:12, sm: 6 }}>
            <Controller
              name="lon"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.lon?.message}>
                  <TextField {...field} variant={variant} label="Lon (Decimal Degrees)" />
                  <FormHelperText>{errors.lon?.message}</FormHelperText>
                </FormControl>
              )}
            />
          </Grid>
          <Grid size={12}>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.description?.message}>
                  <TextField multiline {...field} rows={3} variant={variant} label="Description" />
                  <FormHelperText>{errors.description?.message}</FormHelperText>
                </FormControl>
              )}
            />
          </Grid>
          {enableTemporary && (
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={persist} color="primary" onChange={evt => setPersist(evt.target.checked)} />} label={location.isSaved ? 'Update Saved Location' : 'Create Saved Location'} />
              <FormHelperText>{`By default, the location will only be ${location.isSaved ? 'updated' : 'created'} for this activity.`}</FormHelperText>
            </Grid>
          )}
          <Grid size={12}>
            <Stack direction="row" alignItems={'center'} justifyContent={enableDelete ? 'space-between' : 'flex-end'}>
              {enableDelete && (
                <IconButton color="error" onClick={handleFormDelete}>
                  <DeleteIcon />
                </IconButton>
              )}
              <Stack direction="row" spacing={1}>
                <Button onClick={handleFormClose}>Cancel</Button>
                <Button disabled={!isDirty} type="submit" variant="contained">
                  {location.title ? 'Update' : 'Create'}
                </Button>
              </Stack>
            </Stack>
          </Grid>
          <Grid size={12}>
            <GoogleMapEmbed lat={lat} lon={lon} address={address} />
          </Grid>
        </Grid>
      </form>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => handleFormSubmit(location, true)} prompt={`Delete ${location.title}?`} />
    </>
  );
}
