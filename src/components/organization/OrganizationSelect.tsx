import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import * as React from 'react';

import useOrganizations from '@respond/hooks/useOrganizations';
import { Organization } from '@respond/types/organization';

export default function OrganizationSelect({ onChange }: { onChange: (id: Organization | undefined) => void }) {
  const { organizations } = useOrganizations();

  const [value, setValue] = React.useState('');

  const handleChange = (event: SelectChangeEvent<string>) => {
    setValue(event.target.value);
    onChange(event.target.value ? organizations?.find((f) => f.id === event.target.value) : undefined);
  };

  return (
    <FormControl fullWidth>
      <InputLabel>Organization</InputLabel>
      <Select value={value} label="Organization" onChange={handleChange}>
        {organizations === null ? (
          <MenuItem disabled>Loading organizations...</MenuItem>
        ) : (
          organizations.map((org) => (
            <MenuItem key={org.id} value={org.id}>
              {org.title}
            </MenuItem>
          ))
        )}
      </Select>
    </FormControl>
  );
}
