import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import * as React from 'react';

import useDebounce from '../hooks/useDebounce';

export interface AsyncAutocompleteOption {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}

type TextFieldVariant = 'filled' | 'outlined' | 'standard';

export default function AsyncAutocomplete({ label, variant, onInputChange, onChange }: { label: string; variant: TextFieldVariant; onInputChange: (value: string) => Promise<AsyncAutocompleteOption[]>; onChange: (value: AsyncAutocompleteOption) => void }) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<readonly AsyncAutocompleteOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 500);

  React.useEffect(() => {
    if (debouncedSearch) {
      onInputChange(debouncedSearch).then((options) => {
        setOptions(options);
        setLoading(false);
      });
    }
  }, [debouncedSearch, onInputChange]);

  return (
    <Autocomplete
      open={open}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        setOpen(false);
      }}
      onInputChange={(event, value) => {
        setLoading(true);
        setSearch(value);
      }}
      onChange={(event, value) => {
        if (value) {
          onChange(value);
        }
      }}
      freeSolo={true}
      isOptionEqualToValue={(option, value) => option.label === value.label}
      getOptionLabel={(option) => option.label}
      renderOption={(props, option) => {
        return (
          <li {...props} key={option.label}>
            {option.label}
          </li>
        );
      }}
      options={options}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          variant={variant ?? 'outlined'}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <React.Fragment>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </React.Fragment>
            ),
          }}
        />
      )}
    />
  );
}
