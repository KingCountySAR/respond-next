import { Box, Button, DialogContent, DialogTitle, FormControl, FormHelperText, Grid, Stack, TextField } from '@mui/material';
import { useState, type FormEvent } from 'react';
import type { Location } from '@sync/domain';
import type { MuiDialogProps } from '../../../shell/dialogs';
import { AppDialog } from '../../../shell/dialogs/AppDialog';

interface Draft {
  title: string;
  address: string;
  lat: string;
  lon: string;
}

type Errors = Partial<Record<keyof Draft, string>>;

// The legacy form's rules: a name, and decimal-degree coordinates given in pairs.
function validate(d: Draft): Errors {
  const errors: Errors = {};
  if (!d.title.trim()) errors.title = 'Name is required';
  if (d.lat) {
    if (!/^[-]?\d{1,2}\.\d+$/.test(d.lat.trim())) errors.lat = 'Latitude must be decimal degrees';
    else if (!d.lon) errors.lon = 'Longitude is required';
  }
  if (d.lon) {
    if (!/^[-]?\d{1,3}\.\d+$/.test(d.lon.trim())) errors.lon = 'Longitude must be decimal degrees';
    else if (!d.lat) errors.lat = 'Latitude is required';
  }
  return errors;
}

const toDraft = (l: Location | null | undefined): Draft => ({ title: l?.title ?? '', address: l?.address ?? '', lat: l?.lat?.toString() ?? '', lon: l?.lon?.toString() ?? '' });

const toLocation = (d: Draft): Location => ({
  title: d.title.trim(),
  address: d.address.trim() || null,
  lat: d.lat ? Number(d.lat) : null,
  lon: d.lon ? Number(d.lon) : null,
});

/**
 * The legacy LocationEditDialog, for this activity's location only: there's no saved-location
 * catalog yet, so no "Create Saved Location" switch, and no map preview.
 */
export function LocationEditDialog({ location, open, onClose }: MuiDialogProps<Location> & { location?: Location | null }) {
  const [draft, setDraft] = useState(() => toDraft(location));
  const [errors, setErrors] = useState<Errors>({});
  const initial = toDraft(location);
  const isDirty = (Object.keys(draft) as (keyof Draft)[]).some((k) => draft[k] !== initial[k]);

  const field = (name: keyof Draft) => ({
    value: draft[name],
    onChange: (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [name]: e.target.value })),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // the dialog sits inside the activity form
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) onClose(toLocation(draft));
  };

  return (
    <AppDialog open={open} onClose={onClose}>
      <DialogTitle sx={{ alignItems: 'center', justifyContent: 'space-between', display: 'flex' }}>
        <Box>{location?.title ? `Update ${location.title}` : 'Create New Location'}</Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <form onSubmit={submit}>
            <Grid container spacing={2} sx={{ justifyItems: 'center' }}>
              <Grid size={12}>
                <FormControl fullWidth error={!!errors.title}>
                  <TextField {...field('title')} variant="outlined" label="Location Name" required />
                  <FormHelperText>{errors.title}</FormHelperText>
                </FormControl>
              </Grid>
              <Grid size={12}>
                <FormControl fullWidth error={!!errors.address}>
                  <TextField multiline {...field('address')} variant="outlined" label="Address" />
                  <FormHelperText>{errors.address}</FormHelperText>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth error={!!errors.lat}>
                  <TextField {...field('lat')} variant="outlined" label="Lat (Decimal Degrees)" />
                  <FormHelperText>{errors.lat}</FormHelperText>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth error={!!errors.lon}>
                  <TextField {...field('lon')} variant="outlined" label="Lon (Decimal Degrees)" />
                  <FormHelperText>{errors.lon}</FormHelperText>
                </FormControl>
              </Grid>
              <Grid size={12}>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                  <Stack direction="row" spacing={1}>
                    <Button onClick={() => onClose(null)}>Cancel</Button>
                    <Button disabled={!isDirty} type="submit" variant="contained">
                      {location?.title ? 'Update' : 'Create'}
                    </Button>
                  </Stack>
                </Stack>
              </Grid>
            </Grid>
          </form>
        </Box>
      </DialogContent>
    </AppDialog>
  );
}
