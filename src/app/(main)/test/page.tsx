'use client';

import { Box, Button, Stack, TextField } from '@mui/material';
import { useState } from 'react';

import { ToolbarPage } from '@respond/components/ToolbarPage';

export default function ViewRoster() {
  const [query, setQuery] = useState('');
  const [list, setList] = useState<any[]>([]);

  const handleFindMembers = async () => {
    const response = await fetch(`/api/v1/members/find/${query}`);
    const json: { list: any[] } = await response.json();
    setList(json.list);
    // .then((res) => console.log('!!!', res))
    // .catch((err) => console.error('!!!', err));
  };
  return (
    <ToolbarPage>
      <Stack spacing={2}>
        <TextField label="Member Name" onChange={(event) => setQuery(event.currentTarget.value)}></TextField>
        <Button onClick={handleFindMembers} variant="outlined" size="small">
          Find Members
        </Button>
      </Stack>
      {list.map((l) => (
        <Box key={l.id}>{l.name}</Box>
      ))}
    </ToolbarPage>
  );
}
