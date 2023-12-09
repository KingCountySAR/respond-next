'use client';

import { Card, CardContent, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import AsyncSearch, { AsyncSearchResult } from '@respond/components/AsyncSearch';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { apiFetch } from '@respond/lib/api';
import { D4HMemberResponse } from '@respond/lib/server/memberProviders/d4hMembersProvider';

const findMembers = async (query: string) => {
  return (await apiFetch<{ data: D4HMemberResponse[] }>(`/api/v1/members/find/${query}`)).data;
};

export default function ViewRoster() {
  const [member, setMember] = useState();

  const handleInputChange = async (value: string): Promise<AsyncSearchResult[]> => {
    return findMembers(value).then((list) =>
      list.map((member) => {
        const label = `${member.name} (${member.ref})`;
        return { label: label, value: { ...member, label: label } };
      }),
    );
  };

  return (
    <ToolbarPage>
      <Stack spacing={2}>
        <AsyncSearch label="Find Member" onInputChange={handleInputChange} onChange={(member) => setMember(member.value)}></AsyncSearch>
        {member && <MemberInfo member={member} />}
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
        <Typography>Phone: {member.mobilephone}</Typography>
        <Typography>Email: {member.email}</Typography>
      </CardContent>
    </Card>
  );
}
