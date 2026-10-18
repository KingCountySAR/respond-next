import DeleteIcon from '@mui/icons-material/Delete';
import { Button, FormControl, FormControlLabel, FormHelperText, Grid, IconButton, Stack, Switch, TextField } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { GoogleMapEmbed } from './GoogleMapEmbed';

type InputVariant = 'filled' | 'outlined' | 'standard';

/** What the form edits: a location's fields as typed, and whether to keep it in the catalog. */
export interface LocationFormValues {
  title: string;
  address: string;
  lat: string;
  lon: string;
  description: string;
  toSaved: boolean;
}

type Errors = Partial<Record<keyof LocationFormValues, string>>;

// The legacy rules: a name, and decimal-degree coordinates given in pairs.
function validate(v: LocationFormValues): Errors {
  const errors: Errors = {};
  if (!v.title.trim()) errors.title = 'Name is required';
  if (v.lat) {
    if (!/^[-]?\d{1,2}\.\d+$/.test(v.lat.trim())) errors.lat = 'Latitude must be decimal degrees';
    else if (!v.lon) errors.lon = 'Longitude is required';
  }
  if (v.lon) {
    if (!/^[-]?\d{1,3}\.\d+$/.test(v.lon.trim())) errors.lon = 'Longitude must be decimal degrees';
    else if (!v.lat) errors.lat = 'Latitude is required';
  }
  return errors;
}

/**
 * The legacy LocationEditForm. With `enableTemporary` (editing an activity's location) it offers
 * "Create/Update Saved Location" (and leaves the catalog's description alone); without (the admin
 * page) everything is saved, a saved location can be deleted, and it has its description. No map
 * preview: that needs the Google Maps embed.
 */
export function LocationEditForm({
  initial,
  isSaved,
  enableTemporary,
  variant = 'filled',
  onSubmit,
  onDelete,
  onClose,
}: {
  initial: Omit<LocationFormValues, 'toSaved'>;
  isSaved: boolean;
  enableTemporary?: boolean;
  variant?: InputVariant;
  onSubmit: (values: LocationFormValues) => Promise<void> | void;
  onDelete?: () => void;
  onClose?: () => void;
}) {
  const start: LocationFormValues = { ...initial, toSaved: !enableTemporary };
  const [values, setValues] = useState(start);
  const [errors, setErrors] = useState<Errors>({});
  const isDirty = (Object.keys(start) as (keyof LocationFormValues)[]).some((k) => values[k] !== start[k]);
  const enableDelete = isSaved && !enableTemporary && !!onDelete;

  const field = (name: Exclude<keyof LocationFormValues, 'toSaved'>) => ({
    value: values[name],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // it can sit inside the activity form
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length === 0) await onSubmit(values);
  };

  return (
    <form onSubmit={submit}>
      <Grid container spacing={2} sx={{ justifyItems: 'center' }}>
        <Grid size={12}>
          <FormControl fullWidth error={!!errors.title}>
            <TextField {...field('title')} variant={variant} disabled={enableTemporary && isSaved && values.toSaved} label="Location Name" required />
            <FormHelperText>{errors.title}</FormHelperText>
          </FormControl>
        </Grid>
        <Grid size={12}>
          <FormControl fullWidth error={!!errors.address}>
            <TextField multiline {...field('address')} variant={variant} label="Address" />
            <FormHelperText>{errors.address}</FormHelperText>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormControl fullWidth error={!!errors.lat}>
            <TextField {...field('lat')} variant={variant} label="Lat (Decimal Degrees)" />
            <FormHelperText>{errors.lat}</FormHelperText>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormControl fullWidth error={!!errors.lon}>
            <TextField {...field('lon')} variant={variant} label="Lon (Decimal Degrees)" />
            <FormHelperText>{errors.lon}</FormHelperText>
          </FormControl>
        </Grid>
        {/* The description is the catalog's: an activity keeps only the name, address and coordinates. */}
        {!enableTemporary && (
          <Grid size={12}>
            <FormControl fullWidth>
              <TextField multiline {...field('description')} rows={3} variant={variant} label="Description" />
              <FormHelperText></FormHelperText>
            </FormControl>
          </Grid>
        )}
        {enableTemporary && (
          <Grid size={12}>
            <FormControlLabel
              control={<Switch checked={values.toSaved} onChange={(e) => setValues((v) => ({ ...v, toSaved: e.target.checked }))} color="primary" />}
              label={isSaved ? 'Update Saved Location' : 'Create Saved Location'}
            />
            <FormHelperText>{`By default, the location will only be ${isSaved ? 'updated' : 'created'} for this activity.`}</FormHelperText>
          </Grid>
        )}
        <Grid size={12}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: enableDelete ? 'space-between' : 'flex-end' }}>
            {enableDelete && (
              <IconButton color="error" aria-label="Delete" onClick={onDelete}>
                <DeleteIcon />
              </IconButton>
            )}
            <Stack direction="row" spacing={1}>
              <Button onClick={onClose}>Cancel</Button>
              <Button disabled={!isDirty} type="submit" variant="contained">
                {initial.title ? 'Update' : 'Create'}
              </Button>
            </Stack>
          </Stack>
        </Grid>
        <Grid size={12}>
          <GoogleMapEmbed lat={values.lat} lon={values.lon} address={values.address} />
        </Grid>
      </Grid>
    </form>
  );
}

/** Form values to a catalog entry's fields. */
export const locationFields = (v: LocationFormValues) => ({
  title: v.title.trim(),
  address: v.address.trim() || null,
  lat: v.lat ? Number(v.lat) : null,
  lon: v.lon ? Number(v.lon) : null,
  description: v.description.trim(),
});

/** A location (activity or saved) to the form's starting values. */
export const formValues = (l: { title?: string; address?: string | null; lat?: number | null; lon?: number | null; description?: string } | null | undefined) => ({
  title: l?.title ?? '',
  address: l?.address ?? '',
  lat: l?.lat?.toString() ?? '',
  lon: l?.lon?.toString() ?? '',
  description: l?.description ?? '',
});
