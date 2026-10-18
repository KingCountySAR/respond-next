import { Autocomplete, TextField } from '@mui/material';
import { useState } from 'react';
import type { Location } from '@sync/domain';
import { observer, useActivityList } from '@sync/model/react';
import { useSyncClient } from '../../../shell/sync';

type TextFieldVariant = 'filled' | 'outlined' | 'standard';

const keyOf = (l: Location) => `${l.title}|${l.lat ?? ''}|${l.lon ?? ''}`;

/**
 * The legacy LocationAutocomplete. Until there's a saved-location catalog, the choices are the
 * locations of the activities on the list, so a place used before can be picked again.
 */
export const LocationAutocomplete = observer(function LocationAutocomplete({
  required,
  value,
  variant = 'filled',
  onChange,
}: {
  required?: boolean;
  value?: Location | null;
  variant?: TextFieldVariant;
  onChange: (location: Location | null) => void;
}) {
  const list = useActivityList(useSyncClient());
  const [isOpen, setIsOpen] = useState(false);

  const byKey = new Map<string, Location>();
  for (const item of list?.activities ?? []) {
    const l = item.activity?.location;
    if (l?.title) byKey.set(keyOf(l), l);
  }
  // A preselected value stays selectable even if no listed activity uses it.
  if (value?.title) byKey.set(keyOf(value), value);
  const options = [...byKey.values()].sort((a, b) => (a.title >= b.title ? 1 : -1));

  return (
    <Autocomplete
      open={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      disablePortal
      options={options}
      onChange={(_, v) => onChange(v)}
      isOptionEqualToValue={(option, v) => keyOf(option) === keyOf(v)}
      getOptionLabel={(option) => option.title}
      value={value?.title ? value : null}
      renderOption={(props, option) => (
        <li {...props} key={keyOf(option)}>
          {option.title}
        </li>
      )}
      renderInput={(params) => <TextField {...params} variant={variant} label="Location" required={required} />}
    />
  );
});
