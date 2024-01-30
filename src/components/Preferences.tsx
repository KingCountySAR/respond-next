import { Button, Dialog, DialogContent, DialogTitle, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack } from '@mui/material';
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
      <Stack spacing={2} marginTop={2}>
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
