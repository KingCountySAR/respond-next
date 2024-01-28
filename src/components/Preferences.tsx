import { Button, Dialog, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack } from '@mui/material';
import { useState } from 'react';

import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { NavigationApp, PreferenceActions } from '@respond/lib/client/store/preferences';

import { MobilePageId } from './activities/MobileActivityPage';

interface PreferenceDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PreferencesDialog(props: PreferenceDialogProps) {
  const { onClose, open } = props;
  const dispatch = useAppDispatch();
  const initialState = useAppSelector((state) => state.preferences);
  const [preferences, setPreferences] = useState(initialState);

  const handleClose = (): void => {
    setPreferences(initialState);
    onClose();
  };

  const handleSave = (): void => {
    dispatch(PreferenceActions.update(preferences));
    onClose();
  };

  const handleDefaultMobileViewChange = (event: SelectChangeEvent): void => {
    setPreferences({ ...preferences, defaultMobileView: event.target.value as MobilePageId });
  };

  const handleNavigationAppChange = (event: SelectChangeEvent): void => {
    setPreferences({ ...preferences, navigationApp: event.target.value as NavigationApp });
  };

  return (
    <Dialog fullWidth={true} onClose={handleClose} open={open}>
      <DialogTitle>Preferences</DialogTitle>
      <DialogContent>
        <Stack spacing={2} marginTop={2}>
          <FormControl fullWidth>
            <InputLabel id="default-mobile-view-select-label">Default Mobile View</InputLabel>
            <Select labelId="default-mobile-view-select-label" id="default-mobile-view-select" value={preferences.defaultMobileView} label="Default Mobile View" onChange={handleDefaultMobileViewChange}>
              <MenuItem value={MobilePageId.Manage}>{MobilePageId.Manage}</MenuItem>
              <MenuItem value={MobilePageId.Roster}>{MobilePageId.Roster}</MenuItem>
              <MenuItem value={MobilePageId.Briefing}>{MobilePageId.Briefing}</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id="nav-app-select-label">Navigation App</InputLabel>
            <Select labelId="nav-app-select-label" id="nav-app-select" value={preferences.navigationApp} label="Navigation App" onChange={handleNavigationAppChange}>
              <MenuItem value={NavigationApp.Apple}>{NavigationApp.Apple}</MenuItem>
              <MenuItem value={NavigationApp.Google}>{NavigationApp.Google}</MenuItem>
              <MenuItem value={NavigationApp.Waze}>{NavigationApp.Waze}</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
          <Button variant="outlined" onClick={handleClose}>
            Cancel
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
