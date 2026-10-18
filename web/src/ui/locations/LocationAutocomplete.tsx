import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import type { SavedLocation } from '@sync/domain';
import { useApi } from '../../shell/api';

type TextFieldVariant = 'filled' | 'outlined' | 'standard';

const SEARCH_DEBOUNCE_MS = 300;

/** What the picker shows as chosen: a saved location, or an activity's own (unsaved) one. */
export interface ChosenLocation {
  title: string;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
  savedId?: string | null;
}

// An unsaved location appears as an option with no id, so it stays selectable.
const asOption = (l: ChosenLocation): SavedLocation => ({ id: l.savedId ?? '', title: l.title, address: l.address ?? null, lat: l.lat ?? null, lon: l.lon ?? null, description: '' });
const keyOf = (l: SavedLocation) => l.id || `unsaved:${l.title}`;

/** The legacy LocationAutocomplete: searches the saved-location catalog as you type. */
export function LocationAutocomplete({
  required,
  value,
  variant = 'filled',
  onChange,
}: {
  required?: boolean;
  value?: ChosenLocation | null;
  variant?: TextFieldVariant;
  onChange: (location: SavedLocation | null) => void;
}) {
  const api = useApi();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<SavedLocation[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let live = true;
    setIsFetching(true);
    api
      .searchLocations(debounced)
      .then((found) => live && setResults(found))
      .catch(() => live && setResults([]))
      .finally(() => live && setIsFetching(false));
    return () => {
      live = false;
    };
  }, [api, debounced]);

  const selected = value?.title ? asOption(value) : null;
  // A preselected value stays selectable even if it's not in the current results.
  const options = [...results];
  if (selected && !results.some((l) => keyOf(l) === keyOf(selected))) options.push(selected);
  options.sort((a, b) => (a.title >= b.title ? 1 : -1));

  return (
    <Autocomplete
      open={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      disablePortal
      options={options}
      onInputChange={(_, v) => setSearch(v)}
      onChange={(_, v) => onChange(v)}
      isOptionEqualToValue={(option, v) => keyOf(option) === keyOf(v)}
      getOptionLabel={(option) => option.title}
      value={selected}
      renderOption={(props, option) => (
        <li {...props} key={keyOf(option)}>
          {option.title}
        </li>
      )}
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
