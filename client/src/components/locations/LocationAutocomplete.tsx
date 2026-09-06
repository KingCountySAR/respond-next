import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { useEffect, useState } from 'react';

import { useDebounce } from '@respond/hooks/useDebounce';
import { useLocationSearch } from '@respond/hooks/useLocationSearch';
import { Location } from '@respond/shared/types/location';

type TextFieldVariant = 'filled' | 'outlined' | 'standard';

export function LocationAutocomplete({ required, value, variant = 'filled', onChange }: { required?: boolean; value?: Location; variant?: TextFieldVariant; onChange: (location: Location | null) => void }) {
  const [selected, setSelected] = useState<Location | null>(value?.title ? value : null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Search the catalog over HTTP.
  const { data: results = [], isFetching } = useLocationSearch(debouncedSearch);

  useEffect(() => {
    setSelected(value?.title ? value : null);
  }, [value]);

  // Make sure a preselected value stays selectable even if it's not in the
  // current search results.
  const options = [...results];
  if (value && !results.some((l) => l.id === value.id)) {
    options.push(value);
  }
  options.sort((a, b) => (a.title >= b.title ? 1 : -1));

  const [isOpen, setIsOpen] = useState(false);

  return (
    <Autocomplete
      open={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      disablePortal
      options={options}
      onInputChange={(_, value) => setSearch(value)}
      onChange={(_, value) => {
        onChange(value);
      }}
      isOptionEqualToValue={(option, value) => option.id === value?.id}
      getOptionLabel={(option) => option.title}
      value={selected}
      renderOption={(props, option) => {
        return (
          <li {...props} key={option.id}>
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
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {isFetching ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
