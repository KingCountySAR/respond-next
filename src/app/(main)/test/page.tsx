'use client';

import { Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';

import { ToolbarPage } from '@respond/components/ToolbarPage';
import { apiFetch } from '@respond/lib/api';
import { D4HMemberResponse } from '@respond/lib/server/memberProviders/d4hMembersProvider';

export default function ViewRoster() {
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<D4HMemberResponse[]>([]);
  const handleFindMembers = async () => {
    apiFetch<{ data: D4HMemberResponse[] }>(`/api/v1/members/find/${query}`)
      .then((api) => setMembers(api.data))
      .catch((err) => console.error(err));
  };
  return (
    <ToolbarPage>
      <Stack spacing={2}>
        <TextField label="Member Name" onChange={(event) => setQuery(event.currentTarget.value)}></TextField>
        <Button onClick={handleFindMembers} variant="outlined" size="small">
          Find Members
        </Button>
        {members.map((member) => (
          <MemberInfo key={member.id} member={member} />
        ))}
      </Stack>
    </ToolbarPage>
  );
}

function MemberInfo({ member }: { member: D4HMemberResponse }) {
  return (
    <Card>
      <CardContent>
        <Typography>
          {member.name} ({member.ref})
        </Typography>
      </CardContent>
    </Card>
  );
}
