import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import * as React from 'react';

import { useDebounce } from '@respond/hooks/useDebounce';
import { apiFetch } from '@respond/lib/api';
import { MemberInfo } from '@respond/lib/server/memberProviders/memberProvider';

const findMembers = async (organizationId: string, query: string) => {
  return (await apiFetch<{ data: MemberInfo[] }>(`/api/v1/organizations/${organizationId}/members?query=${query}`)).data;
};

type TextFieldVariant = 'filled' | 'outlined' | 'standard';

export default function MemberSearch({ organizationId, label = 'Member', variant = 'outlined', onChange }: { organizationId: string | undefined; label?: string; variant?: TextFieldVariant; onChange: (member: MemberInfo | undefined) => void }) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<readonly MemberInfo[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 500);

  React.useEffect(() => {
    if (organizationId && debouncedSearch) {
      findMembers(organizationId, debouncedSearch).then((infos) => {
        setOptions(infos);
        setLoading(false);
      });
    }
  }, [organizationId, debouncedSearch]);

  return (
    <Autocomplete
      disabled={!organizationId}
      open={open}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        setOpen(false);
      }}
      onInputChange={(event, value) => {
        if ((value?.length ?? 0) >= 3) {
          setLoading(true);
          setSearch(value);
        }
      }}
      onChange={(event, value) => {
        if (value && typeof value !== 'string') {
          onChange(value ? options.find((f) => f.id === value.id) : undefined);
        }
      }}
      freeSolo={true}
      isOptionEqualToValue={(option, value) => option.label === value.label}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.label) ?? ''}
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
          variant={variant}
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
