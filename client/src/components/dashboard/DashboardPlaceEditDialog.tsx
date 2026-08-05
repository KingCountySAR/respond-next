import { Button, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Activity } from '@respond/shared/types/activity';

import { isDefaultPlace, Place } from '@respond/shared/types/operations';
import { useActivityContext } from '../activities/ActivityProvider';
import DialogWithHistory from '../DialogWithHistory';
import { Stack } from '../Material';

type DashboardPlaceEditDialogProps = {
  place: Place | null;
  onSave: (place: Place) => void;
  onClose: () => void;
};

type FormValues = {
  name: string;
  lat: string;
  lon: string;
  notes: string;
};

export function validatePlaceName(activity: Activity, placeId: string, name: string): { isValid: boolean; error?: string } {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { isValid: false, error: 'Place name is required.' };
  }

  const hasDuplicate = activity.places.some((place) => place.id !== placeId && place.name.trim().toLowerCase() === trimmedName.toLowerCase());

  if (hasDuplicate) {
    return { isValid: false, error: 'Place name already exists.' };
  }

  return { isValid: true };
}

export function DashboardPlaceEditDialog({ place, onSave, onClose }: DashboardPlaceEditDialogProps) {
  const activity = useActivityContext();

  const isDefault = !!place && isDefaultPlace(place);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
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

    const validation = validatePlaceName(activity, place.id, data.name);
    // TODO: Validate Coordinates Inputs (see LocationEditForm form)

    if (!validation.isValid) {
      setError('name', {
        type: 'manual',
        message: validation.error ?? 'Please enter a place name.',
      });
      return;
    }

    onSave({
      ...place,
      name: data.name.trim(),
      lat: data.lat?.trim(),
      lon: data.lon?.trim(),
      notes: data.notes?.trim(),
    });
  };

  // Prevent rendering dialog contents if place is null/undefined
  if (!place) return null;

  return (
    <DialogWithHistory fullWidth={true} open={Boolean(place)} onClose={onClose}>
      <DialogTitle>Edit Place</DialogTitle>

      <form onSubmit={handleSubmit(handleSave)}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField autoFocus label="Place Name" disabled={isDefault} fullWidth {...register('name')} error={Boolean(errors.name)} helperText={errors.name?.message ?? 'Choose a unique name for this place.'} />
            <TextField label="Latitude" fullWidth multiline {...register('lat')} />
            <TextField label="Longitude" fullWidth multiline {...register('lon')} />
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
