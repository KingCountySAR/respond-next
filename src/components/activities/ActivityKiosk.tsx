import { Box, FormControl, InputLabel, MenuItem, Paper, Select } from '@mui/material';
import { Card, CardContent, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import ParticipantTimeline from '@respond/components/activities/ParticipantTimeline';
import AsyncSearch, { AsyncSearchResult } from '@respond/components/AsyncSearch';
import { AdminStatusUpdater } from '@respond/components/StatusUpdater';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { apiFetch } from '@respond/lib/api';
import { useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector } from '@respond/lib/client/store/activities';
import { D4HMemberResponse } from '@respond/lib/server/memberProviders/d4hMembersProvider';
import { Participant } from '@respond/types/activity';
import { OrganizationDoc } from '@respond/types/data/organizationDoc';
import { UserInfo } from '@respond/types/userInfo';

const findMembers = async (orgId: string, query: string) => {
  return (await apiFetch<{ data: D4HMemberResponse[] }>(`/api/v1/organizations/${orgId}/members/find/${query}`)).data;
};

const findOrganizations = async () => {
  return (await apiFetch<{ data: OrganizationDoc[] }>(`/api/v1/organizations`)).data;
};

export default function ActivityKiosk({ activityId }: { activityId: string }) {
  const activity = useAppSelector(buildActivitySelector(activityId));

  const [organizations, setOrganizations] = useState<OrganizationDoc[]>();
  const [org, setOrg] = useState<OrganizationDoc>();
  const [orgId, setOrgId] = useState<string>('');
  const [member, setMember] = useState<D4HMemberResponse>();
  const [participant, setParticipant] = useState<Participant>();
  const [userInfo, setUserInfo] = useState<UserInfo>();

  useEffect(() => {
    findOrganizations().then((organizations) => {
      organizations.forEach((o, i) => console.log(`org ${i}`, JSON.stringify(o)));
      setOrganizations(organizations.filter((f) => !!f.memberProvider));
    });
  }, []);

  useEffect(() => {
    if (!activity || !member) {
      setParticipant(undefined);
      setUserInfo(undefined);
      return;
    }
    setParticipant(activity.participants[member.id]);
    setUserInfo({
      email: member.email ?? '',
      userId: member.id.toString(),
      organizationId: orgId,
      participantId: member.id.toString(),
      domain: org?.domain ?? '',
      name: member.name,
      given_name: member.name.split(',')[1].trim(),
      family_name: member.name.split(',')[0].trim(),
      picture: member.urls.image,
    });
    setOrg(organizations?.find((f) => f?.id === orgId));
  }, [activity, member, organizations, orgId, org]);

  const handleMemberQuery = async (value: string): Promise<AsyncSearchResult[]> => {
    if (!orgId) return Promise.reject(new Error('no organization selected'));
    return findMembers(orgId, value).then((list) =>
      list.map((member) => {
        const label = `${member.name} (${member.ref})`;
        return { label: label, value: { ...member, label: label } };
      }),
    );
  };

  const handleMemberSelect = (member: AsyncSearchResult) => {
    setMember(member.value);
  };

  const handleClear = () => {
    setMember(undefined);
  };

  return (
    <ToolbarPage maxWidth="lg">
      <Typography variant="h4" paddingBottom={2}>
        {activity?.idNumber} {activity?.title}
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          {organizations && (
            <FormControl fullWidth>
              <InputLabel id="org-select">Organization</InputLabel>
              <Select labelId="org-select" label="Organization" disabled={!organizations} value={orgId} onChange={(event) => setOrgId(event.target.value)}>
                {organizations.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {orgId && <AsyncSearch label="Search Members" onInputChange={handleMemberQuery} onChange={handleMemberSelect} onClear={handleClear} variant="outlined"></AsyncSearch>}
          {member && <MemberInfo orgId={orgId} member={member} />}
          {activity && userInfo && org && (
            <Box sx={{ my: 2 }} display="flex" justifyContent="end">
              <AdminStatusUpdater activity={activity} current={participant?.timeline[0].status} user={userInfo} org={org} />
            </Box>
          )}
          {participant && activity && <ParticipantTimeline participant={participant} activity={activity} />}
        </Stack>
      </Paper>
    </ToolbarPage>
  );
}

function MemberInfo({ orgId, member }: { orgId: string; member: D4HMemberResponse }) {
  return (
    <Card>
      <CardContent>
        <Stack direction={{ sm: 'row' }} spacing={2}>
          <img //
            src={`/api/v1/organizations/${orgId}/members/${member.id}/photo`}
            alt={`Photo of ${member.name}`}
            style={{ width: '8rem', minHeight: '10rem', border: 'solid 1px #777', borderRadius: '4px' }}
          />
          <Stack>
            <Typography>
              Name: {member.name} ({member.ref})
            </Typography>
            <Typography>Phone: {member.mobilephone}</Typography>
            <Typography>Email: {member.email}</Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
