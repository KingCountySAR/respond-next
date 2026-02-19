import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import * as React from 'react';

import useOrganizations from '@respond/hooks/useOrganizations';
import { Organization } from '@respond/types/organization';

export default function OrganizationSelect({ onChange }: { onChange: (organization: Organization | undefined) => void }) {
  const { organizations, isLoading, isError } = useOrganizations();

  const [value, setValue] = React.useState('');

  const handleChange = React.useCallback(
    (event: SelectChangeEvent<string>) => {
      setValue(event.target.value);
      onChange(event.target.value ? organizations?.find((f) => f.id === event.target.value) : undefined);
    },
    [organizations, onChange],
  );

  return (
    <FormControl fullWidth>
      <InputLabel>Organization</InputLabel>
      <Select value={value} label="Organization" onChange={handleChange}>
        {isLoading ? (
          <MenuItem disabled>Loading organizations...</MenuItem>
        ) : isError ? (
          <MenuItem disabled>Error loading organizations</MenuItem>
        ) : organizations?.length === 0 ? (
          <MenuItem disabled>No organizations available</MenuItem>
        ) : (
          organizations?.map((org) => (
            <MenuItem key={org.id} value={org.id}>
              {org.title}
            </MenuItem>
          ))
        )}
      </Select>
    </FormControl>
  );
}
