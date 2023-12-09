import { Typography } from '@mui/material';
import { useState } from 'react';

import { apiFetch } from '@respond/lib/api';
import { LocationDoc } from '@respond/types/data/locationDoc';

import AsyncAutocomplete, { AsyncAutocompleteOption } from './AsyncAutocomplete';

const search = async (query: string) => {
  return (await apiFetch<{ data: LocationDoc[] }>(`/api/v1/locations/find/${query}`)).data;
};

export default function LocationInput() {
  const [location, setLocation] = useState<LocationDoc>();
  const handleInputChange = async (value: string): Promise<AsyncAutocompleteOption[]> => {
    return search(value).then((list) =>
      list.map((location) => {
        return { label: location.name, value: location };
      }),
    );
  };
  return (
    <>
      <AsyncAutocomplete label="Location" onInputChange={handleInputChange} onChange={(location) => setLocation(location.value)} />
      <Typography>{location?.name}</Typography>
    </>
  );
}
