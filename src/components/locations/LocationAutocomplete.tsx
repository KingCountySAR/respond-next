import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { useEffect, useState } from 'react';

import { useAppSelector } from '@respond/lib/client/store';
import { buildLocationsSelector } from '@respond/lib/client/store/locations';
import { Location } from '@respond/types/location';

type TextFieldVariant = 'filled' | 'outlined' | 'standard';

export function LocationAutocomplete({ required, value, variant = 'filled', onChange }: { required?: boolean; value?: Location; variant?: TextFieldVariant; onChange: (location: Location | null) => void }) {
  const locations = useAppSelector(buildLocationsSelector());

  useEffect(() => {
    const locationOptions = [...locations];
    if (value && !locations.some((l) => l.id === value.id)) {
      locationOptions.push(value);
    }
    setOptions(locationOptions.sort((a, b) => (a.title >= b.title ? 1 : -1)));
  }, [locations, value]);

  const [options, setOptions] = useState<Location[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const loadingLocations = isOpen && options.length === 0;

  return (
    <Autocomplete
      open={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      disablePortal
      options={options}
      onChange={(event, value) => {
        onChange(value);
      }}
      isOptionEqualToValue={(option, value) => option.id === value?.id}
      getOptionLabel={(option) => option.title}
      value={value}
      renderOption={(props, option) => {
        return (
          <li {...props} key={option.title}>
            {option.title}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          variant={variant}
          label="Location"
          required={required}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loadingLocations ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
