import DeleteIcon from '@mui/icons-material/Delete';
import { Button, FormControl, FormHelperText, Grid, IconButton, Stack, Switch, TextField } from '@mui/material';
import { useState } from 'react';
import { Controller, Resolver, ResolverResult, useForm } from 'react-hook-form';

import { Location } from '@respond/types/location';

import ConfirmDialog from '../ConfirmDialog';
import { FormControlLabel } from '../Material';

type InputVariant = 'filled' | 'outlined' | 'standard';

/**
 * Validation resolver
 * @param values
 * @returns
 */
const resolver: Resolver<Location> = async (values) => {
  const result: ResolverResult<Location> = {
    values: values.id ? values : {},
    errors: {},
  };

  if (!values.title) {
    result.errors.title = { type: 'required', message: 'Name is required' };
  }

  if (values.lat) {
    if (!/[-]?\d{1,2}\.\d+/.test(values.lat)) {
      result.errors.lat = { type: 'format', message: 'Latitude must be decimal degrees' };
    } else if (!values.lon) {
      result.errors.lon = { type: 'required', message: 'Longitude is required' };
    }
  }

  if (values.lon) {
    if (!/[-]?\d{1,3}\.\d+/.test(values.lon)) {
      result.errors.lon = { type: 'format', message: 'Longitude must be decimal degrees' };
    } else if (!values.lat) {
      result.errors.lat = { type: 'required', message: 'Longitude is required' };
    }
  }

  return result;
};

export function LocationEditForm({ location, enableTemporary, variant = 'filled', onSubmit, onClose }: { location: Location; enableTemporary?: boolean; variant?: InputVariant; onSubmit: (location: Location) => void; onClose?: () => void }) {
  const defaultValues = { ...location };
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { isDirty, errors },
  } = useForm<Location>({
    resolver,
    defaultValues,
  });

  const isSavedLocation = !!location._id;
  // Delete should only be available in contexts where temporary is not an option; i.e. we are not editing an activity location.
  const enableDelete = isSavedLocation && !enableTemporary;
  const submissionType = location.title ? 'Update' : 'Create';

  const handleFormSubmit = (location: Location) => {
    onSubmit(location);
    onClose?.();
  };

  const handleFormDelete = () => {
    setConfirmDelete(true);
  };

  const handleFormClose = () => {
    onClose?.();
  };

  return (
    <>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <Grid container spacing={2} justifyItems="center">
          <Grid item xs={12}>
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.title?.message}>
                  <TextField {...field} variant={variant} disabled={enableTemporary && isSavedLocation} label="Location Name" required />
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
                  <TextField multiline {...field} variant={variant} label="Address" />
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
                  <TextField {...field} variant={variant} label="Lat (Decimal Degrees)" />
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
                  <TextField {...field} variant={variant} label="Lon (Decimal Degrees)" />
                  <FormHelperText>{errors.lon?.message}</FormHelperText>
                </FormControl>
              )}
            />
          </Grid>
          <Grid item xs={12}>
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
          <Grid item xs={12}>
            <Controller
              name="directions"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.directions?.message}>
                  <TextField multiline {...field} rows={3} variant={variant} label="Driving Directions" />
                  <FormHelperText>{errors.directions?.message}</FormHelperText>
                </FormControl>
              )}
            />
          </Grid>
          {enableTemporary && (
            <Grid item xs={12}>
              <Controller
                name="active"
                control={control}
                render={({ field }) => (
                  <>
                    <FormControlLabel control={<Switch {...field} checked={field.value} color="primary" />} label={isSavedLocation ? 'Update Saved Location' : 'Create Saved Location'} />
                    <FormHelperText>{`By default, the location will only be ${submissionType.toLocaleLowerCase()}d for this activity.`}</FormHelperText>
                  </>
                )}
              />
            </Grid>
          )}
          <Grid item xs={12}>
            <Stack direction="row" alignItems={'center'} justifyContent={enableDelete ? 'space-between' : 'flex-end'}>
              {enableDelete && (
                <IconButton color="danger" onClick={handleFormDelete}>
                  <DeleteIcon />
                </IconButton>
              )}
              <Stack direction="row" spacing={1}>
                <Button onClick={handleFormClose}>Cancel</Button>
                <Button disabled={!isDirty} type="submit" variant="contained">
                  {submissionType}
                </Button>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </form>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => handleFormSubmit({ ...location, active: false })} prompt={`Delete ${location.title}?`} />
    </>
  );
}
