import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { useDebounce } from '@respond/hooks/useDebounce';
import { apiFetch } from '@respond/lib/api';
import { MemberInfo } from '@respond/lib/server/memberProviders/memberProvider';

type TextFieldVariant = 'filled' | 'outlined' | 'standard';

export default function MemberSearch({ organizationId, label = 'Member', variant = 'outlined', onChange }: { organizationId: string | undefined; label?: string; variant?: TextFieldVariant; onChange: (member: MemberInfo | undefined) => void }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 500);

  const { data: options = [], isLoading } = useQuery({
    queryKey: ['members', organizationId, debouncedSearch],
    queryFn: async () => {
      if (!organizationId || debouncedSearch.length < 3) return [];
      const res = await apiFetch<{ data: MemberInfo[] }>(`/api/v1/organizations/${organizationId}/members?query=${debouncedSearch}`);
      return res.data;
    },
    enabled: !!organizationId && debouncedSearch.length >= 3,
  });

  const handleChange = React.useCallback(
    (event: React.SyntheticEvent, value: MemberInfo | null) => {
      onChange(value ?? undefined);
    },
    [onChange],
  );

  return (
    <Autocomplete
      disabled={!organizationId}
      open={open && !!debouncedSearch}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onInputChange={(event, value) => setSearch(value)}
      onChange={handleChange}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      getOptionLabel={(option) => option.label ?? ''}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          {option.label}
        </li>
      )}
      options={options}
      loading={isLoading}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          variant={variant}
          helperText="Search by member name or email (min 3 characters)"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
