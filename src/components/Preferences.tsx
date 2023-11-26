import { Button, Dialog, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack } from '@mui/material';
import { useState } from 'react';

import { MobilePageId } from './activities/MobileActivityPage';

export interface IPreferences {
  defaultMobileView: MobilePageId;
}

class Preferences implements IPreferences {
  defaultMobileView;
  constructor() {
    this.defaultMobileView = MobilePageId.Briefing;
  }
}

const PREFERENCES_KEY = 'preferences';

export const getPreferences = (): IPreferences => {
  return Object.assign(new Preferences(), JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}'));
};

const savePreferences = (preferences: IPreferences) => {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
};

interface PreferenceDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PreferencesDialog(props: PreferenceDialogProps) {
  const [preferences, setPreferences] = useState(getPreferences());
  const { onClose, open } = props;

  const handleClose = (): void => {
    onClose();
  };

  const handleSave = (): void => {
    savePreferences(preferences);
    onClose();
  };

  const handleDefaultMobileViewChange = (event: SelectChangeEvent): void => {
    setPreferences({ ...preferences, defaultMobileView: event.target.value as MobilePageId });
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
