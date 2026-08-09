import { Button, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { Activity } from '@respond/shared/types/activity';
import { isDefaultPlace, Place } from '@respond/shared/types/operations';
import { useEffect, useMemo } from 'react';
import { FieldErrors, Resolver, useForm } from 'react-hook-form';

import { useActivityContext } from '../activities/ActivityProvider';
import DialogWithHistory from '../DialogWithHistory';
import { Stack } from '../Material';

type DashboardPlaceEditDialogProps = {
  place: Place | null;
  onSave: (place: Place) => void;
  onClose: () => void;
};

type FormValues = Pick<Place, 'name' | 'lat' | 'lon' | 'notes'>;

/**
 * Builds a resolver scoped to the current activity and place.
 */
const createResolver = (activity: Activity, placeId: string): Resolver<FormValues> => {
  return async (values) => {
    const normalizedValues: FormValues = {
      name: values.name?.trim() ?? '',
      lat: values.lat?.trim() ?? '',
      lon: values.lon?.trim() ?? '',
      notes: values.notes?.trim() ?? '',
    };

    const errors: FieldErrors<FormValues> = {};

    if (!normalizedValues.name) {
      errors.name = { type: 'required', message: 'Name is required' };
    }

    const hasDuplicate = (activity.places ?? []).some((place) => place.id !== placeId && place.name.trim().toLowerCase() === normalizedValues.name.toLowerCase());
    if (hasDuplicate) {
      errors.name = { type: 'duplicate', message: 'Place name already exists' };
    }

    const hasLat = !!normalizedValues.lat;
    const hasLon = !!normalizedValues.lon;

    if (hasLat && !hasLon) {
      errors.lon = { type: 'required', message: 'Longitude is required when latitude is provided' };
    }

    if (hasLon && !hasLat) {
      errors.lat = { type: 'required', message: 'Latitude is required when longitude is provided' };
    }

    if (hasLat) {
      const parsedLat = Number(normalizedValues.lat);
      if (!Number.isFinite(parsedLat)) {
        errors.lat = { type: 'format', message: 'Latitude must be a valid decimal number' };
      } else if (parsedLat < -90 || parsedLat > 90) {
        errors.lat = { type: 'range', message: 'Latitude must be between -90 and 90' };
      }
    }

    if (hasLon) {
      const parsedLon = Number(normalizedValues.lon);
      if (!Number.isFinite(parsedLon)) {
        errors.lon = { type: 'format', message: 'Longitude must be a valid decimal number' };
      } else if (parsedLon < -180 || parsedLon > 180) {
        errors.lon = { type: 'range', message: 'Longitude must be between -180 and 180' };
      }
    }

    if (Object.keys(errors).length > 0) {
      return { values: {}, errors } as unknown as ReturnType<Resolver<FormValues>>;
    }

    return { values: normalizedValues, errors: {} } as unknown as ReturnType<Resolver<FormValues>>;
  };
};

export function DashboardPlaceEditDialog({ place, onSave, onClose }: DashboardPlaceEditDialogProps) {
  const activity = useActivityContext();

  const isDefault = !!place && isDefaultPlace(place);
  const resolver = useMemo(() => createResolver(activity, place?.id ?? ''), [activity, place?.id]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver,
    // Use `values` instead of `defaultValues` to keep the form synced when `place` changes or finishes loading
    values: {
      name: place?.name ?? '',
      lat: place?.lat ?? '',
      lon: place?.lon ?? '',
      notes: place?.notes ?? '',
    },
  });

  useEffect(() => {
    reset({
      name: place?.name ?? '',
      lat: place?.lat ?? '',
      lon: place?.lon ?? '',
      notes: place?.notes ?? '',
    });
  }, [place, reset]);

  const handleSave = (data: FormValues) => {
    // Safety check in case the form is somehow submitted while place is undefined
    if (!place) return;

    onSave({
      ...place,
      name: data.name,
      lat: data.lat,
      lon: data.lon,
      notes: data.notes,
    });
  };

  // Prevent rendering dialog contents if place is null/undefined
  if (!place) return null;

  return (
    <DialogWithHistory fullWidth={true} open={Boolean(place)} onClose={onClose}>
      <DialogTitle>Edit Place</DialogTitle>
      <form onSubmit={handleSubmit(handleSave)}>
        <DialogContent>
          <Stack spacing={1}>
            <TextField autoFocus label="Place Name" disabled={isDefault} fullWidth {...register('name')} error={Boolean(errors.name)} helperText={errors.name?.message ?? 'Choose a unique name for this place.'} />
            <TextField label="Latitude" fullWidth {...register('lat')} error={Boolean(errors.lat)} helperText={errors.lat?.message ?? 'Optional, decimal degrees (-90 to 90).'} />
            <TextField label="Longitude" fullWidth {...register('lon')} error={Boolean(errors.lon)} helperText={errors.lon?.message ?? 'Optional, decimal degrees (-180 to 180).'} />
            <TextField label="Notes" fullWidth multiline minRows={3} {...register('notes')} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </form>
    </DialogWithHistory>
  );
}
