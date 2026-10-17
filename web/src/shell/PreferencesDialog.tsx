import { Button, DialogContent, DialogTitle, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { AppDialog } from './dialogs/AppDialog';
import { MobilePageId, NavigationApp, usePreferences, useSetPreferences, type Preferences } from './preferences';

export function PreferencesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setPreferences = useSetPreferences();
  const handleSubmit = (preferences: Preferences) => {
    setPreferences(preferences);
    onClose();
  };
  return (
    <AppDialog fullWidth={true} onClose={onClose} open={open}>
      <DialogTitle>Preferences</DialogTitle>
      <DialogContent>{open && <PreferencesForm onSubmit={handleSubmit} onCancel={onClose} />}</DialogContent>
    </AppDialog>
  );
}

type MinuteField = 'etaIncrement' | 'etaPreset1' | 'etaPreset2' | 'etaPreset3';
const MINUTE_FIELDS: [MinuteField, string][] = [
  ['etaIncrement', 'ETA Increment'],
  ['etaPreset1', 'ETA Preset 1'],
  ['etaPreset2', 'ETA Preset 2'],
  ['etaPreset3', 'ETA Preset 3'],
];
const validMinutes = (v: number | string) => v !== '' && Number(v) >= 1 && Number(v) <= 999;

function PreferencesForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (preferences: Preferences) => void }) {
  const saved = usePreferences();
  const [form, setForm] = useState<Record<keyof Preferences, string | number>>(saved);
  const isDirty = (Object.keys(saved) as (keyof Preferences)[]).some((k) => String(form[k]) !== String(saved[k]));
  const invalid = MINUTE_FIELDS.filter(([k]) => !validMinutes(form[k])).map(([k]) => k);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (invalid.length) return;
    onSubmit({
      defaultMobileView: form.defaultMobileView as MobilePageId,
      navigationApp: form.navigationApp as NavigationApp,
      etaIncrement: Number(form.etaIncrement),
      etaPreset1: Number(form.etaPreset1),
      etaPreset2: Number(form.etaPreset2),
      etaPreset3: Number(form.etaPreset3),
    });
  };

  return (
    <form onSubmit={submit}>
      <Stack spacing={2} sx={{ marginTop: 1 }}>
        <FormControl fullWidth>
          <InputLabel variant="outlined">Default Mobile View</InputLabel>
          <Select value={form.defaultMobileView} onChange={(e) => setForm({ ...form, defaultMobileView: e.target.value })} variant="outlined" label="Default Mobile View">
            <MenuItem value={MobilePageId.Manage}>{MobilePageId.Manage}</MenuItem>
            <MenuItem value={MobilePageId.Roster}>{MobilePageId.Roster}</MenuItem>
            <MenuItem value={MobilePageId.Briefing}>{MobilePageId.Briefing}</MenuItem>
          </Select>
          <FormHelperText />
        </FormControl>
        <FormControl fullWidth>
          <InputLabel variant="outlined">Navigation App</InputLabel>
          <Select value={form.navigationApp} onChange={(e) => setForm({ ...form, navigationApp: e.target.value })} variant="outlined" label="Navigation App">
            <MenuItem value={NavigationApp.Apple}>{NavigationApp.Apple}</MenuItem>
            <MenuItem value={NavigationApp.Google}>{NavigationApp.Google}</MenuItem>
            <MenuItem value={NavigationApp.Waze}>{NavigationApp.Waze}</MenuItem>
          </Select>
          <FormHelperText />
        </FormControl>
        <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }}>
          {MINUTE_FIELDS.map(([field, label]) => (
            <TextField
              key={field}
              label={label}
              type="number"
              fullWidth
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              error={invalid.includes(field)}
              helperText={invalid.includes(field) ? 'Must be between 1 and 999 minutes' : ''}
            />
          ))}
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
