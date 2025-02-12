import { Alert, Box, FormControl, InputLabel, MenuItem, Paper, Select } from '@mui/material';
import { Card, CardContent, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import ParticipantTimeline from '@respond/components/activities/ParticipantTimeline';
import AsyncSearch, { AsyncSearchResult } from '@respond/components/AsyncSearch';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { apiFetch } from '@respond/lib/api';
import { useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector } from '@respond/lib/client/store/activities';
import { Participant } from '@respond/types/activity';
import { OrganizationDoc } from '@respond/types/data/organizationDoc';
import { Member } from '@respond/types/member';

import { MemberInfo } from '../member/MemberInfo';
import { MemberPhoto } from '../member/MemberPhoto';
import { MemberProvider } from '../member/MemberProvider';
import { ParticipantProvider } from '../participant/ParticipantProvider';

import { ActivityProvider } from './ActivityProvider';

const findMembers = async (orgId: string, query: string) => {
  return (await apiFetch<{ data: Member[] }>(`/api/v1/organizations/${orgId}/members/find/${query}`)).data;
};

const findOrganizations = async () => {
  return (await apiFetch<{ data: OrganizationDoc[] }>(`/api/v1/organizations`)).data;
};

export default function ActivityKiosk({ activityId }: { activityId: string }) {
  const activity = useAppSelector(buildActivitySelector(activityId));

  const [organizations, setOrganizations] = useState<OrganizationDoc[]>();
  const [org, setOrg] = useState<OrganizationDoc>();
  const [orgId, setOrgId] = useState<string>('');
  const [member, setMember] = useState<Member>();
  const [participant, setParticipant] = useState<Participant>();

  useEffect(() => {
    findOrganizations().then((organizations) => {
      setOrganizations(organizations.filter((f) => !!f.memberProvider));
    });
  }, []);

  useEffect(() => {
    if (!activity || !member) {
      setParticipant(undefined);
      return;
    }
    setParticipant(activity.participants[member.id]);
    setOrg(organizations?.find((f) => f?.id === orgId));
  }, [activity, member, organizations, orgId, org]);

  const handleMemberQuery = async (value: string): Promise<AsyncSearchResult[]> => {
    if (!orgId) return Promise.reject(new Error('no organization selected'));
    return findMembers(orgId, value).then((list) =>
      list.map((member) => {
        const label = member.name;
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

  if (!activity) return <Alert severity="error">Activity not found</Alert>;

  return (
    <ActivityProvider activity={activity}>
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
            {member && (
              <MemberProvider member={member}>
                <MemberInfoCard />
              </MemberProvider>
            )}
            {member && org && (
              <Box sx={{ my: 2 }} display="flex" justifyContent="end">
                <StatusUpdater member={member} org={org} />
              </Box>
            )}
            {participant && (
              <ParticipantProvider participant={participant}>
                <ParticipantTimeline />
              </ParticipantProvider>
            )}
          </Stack>
        </Paper>
      </ToolbarPage>
    </ActivityProvider>
  );
}

function MemberInfoCard() {
  return (
    <Card>
      <CardContent>
        <Stack direction={{ sm: 'row' }} spacing={2}>
          <MemberPhoto />
          <MemberInfo name phone email />
        </Stack>
      </CardContent>
    </Card>
  );
}
