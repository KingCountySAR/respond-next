import { Button, Dialog, DialogContent, DialogTitle, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';

import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { NavigationApp, PerferencesState, PreferenceActions } from '@respond/lib/client/store/preferences';

import { MobilePageId } from './activities/MobileActivityPage';

export function PreferencesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch();

  const handleSubmit = (preferences: PerferencesState) => {
    dispatch(PreferenceActions.update(preferences));
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog fullWidth={true} onClose={onClose} open={open}>
      <DialogTitle>Preferences</DialogTitle>
      <DialogContent>{open && <PreferencesForm onSubmit={handleSubmit} onCancel={handleCancel} />}</DialogContent>
    </Dialog>
  );
}

function PreferencesForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (preferences: PerferencesState) => void }) {
  const defaultValues = useAppSelector((state) => state.preferences);

  const {
    control,
    handleSubmit,
    formState: { isDirty, errors },
  } = useForm<PerferencesState>({
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2} marginTop={1}>
        <Controller
          name="defaultMobileView"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth error={!!errors.defaultMobileView?.message}>
              <InputLabel variant="outlined">Default Mobile View</InputLabel>
              <Select {...field} variant="outlined" label="Default Mobile View">
                <MenuItem value={MobilePageId.Manage}>{MobilePageId.Manage}</MenuItem>
                <MenuItem value={MobilePageId.Roster}>{MobilePageId.Roster}</MenuItem>
                <MenuItem value={MobilePageId.Briefing}>{MobilePageId.Briefing}</MenuItem>
              </Select>
              <FormHelperText>{errors.defaultMobileView?.message}</FormHelperText>
            </FormControl>
          )}
        />
        <Controller
          name="navigationApp"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth error={!!errors.navigationApp?.message}>
              <InputLabel variant="outlined">Navigation App</InputLabel>
              <Select {...field} variant="outlined" label="Navigation App">
                <MenuItem value={NavigationApp.Apple}>{NavigationApp.Apple}</MenuItem>
                <MenuItem value={NavigationApp.Google}>{NavigationApp.Google}</MenuItem>
                <MenuItem value={NavigationApp.Waze}>{NavigationApp.Waze}</MenuItem>
              </Select>
              <FormHelperText>{errors.navigationApp?.message}</FormHelperText>
            </FormControl>
          )}
        />
        <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }}>
          <Controller
            name="etaIncrement"
            control={control}
            rules={{ required: true, min: 1, max: 999 }} // Add validation rules
            render={({ field }) => (
              <TextField
                {...field}
                label="ETA Increment"
                type="number" // Ensure numeric input on mobile devices
                fullWidth
                error={!!errors.etaIncrement}
                helperText={errors.etaIncrement ? 'Must be between 1 and 999 minutes' : ''}
              />
            )}
          />
          <Controller
            name="etaPreset1"
            control={control}
            rules={{ required: true, min: 1, max: 999 }} // Add validation rules
            render={({ field }) => (
              <TextField
                {...field}
                label="ETA Preset 1"
                type="number" // Ensure numeric input on mobile devices
                fullWidth
                error={!!errors.etaIncrement}
                helperText={errors.etaIncrement ? 'Must be between 1 and 999 minutes' : ''}
              />
            )}
          />
          <Controller
            name="etaPreset2"
            control={control}
            rules={{ required: true, min: 1, max: 999 }} // Add validation rules
            render={({ field }) => (
              <TextField
                {...field}
                label="ETA Preset 2"
                type="number" // Ensure numeric input on mobile devices
                fullWidth
                error={!!errors.etaIncrement}
                helperText={errors.etaIncrement ? 'Must be between 1 and 999 minutes' : ''}
              />
            )}
          />
          <Controller
            name="etaPreset3"
            control={control}
            rules={{ required: true, min: 1, max: 999 }} // Add validation rules
            render={({ field }) => (
              <TextField
                {...field}
                label="ETA Preset 3"
                type="number" // Ensure numeric input on mobile devices
                fullWidth
                error={!!errors.etaIncrement}
                helperText={errors.etaIncrement ? 'must be between 1 and 999 minutes' : ''}
              />
            )}
          />
        </Stack>
        <Button disabled={!isDirty} type="submit" variant="contained">
          Save
        </Button>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
      </Stack>
    </form>
  );
}
