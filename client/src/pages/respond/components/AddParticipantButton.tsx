import { Box, Button, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import * as React from 'react';

import { useDialogs } from '@respond/components/DialogProvider';
import { AppDialog } from '@respond/components/DialogProvider/AppDialog';
import { MemberInfo } from '@respond/shared/types/member';
import { Organization } from '@respond/shared/types/organization';

import MemberSearch from '@/client/components/member/MemberSearch';
import OrganizationSelect from '@/client/components/organization/OrganizationSelect';
import { StatusUpdater } from '@/client/components/StatusUpdater';
import { ActivityDomainModel } from '@/client/models/activityDomainModel';
import { ParticipantDomainModel } from '@/client/models/participantDomainModel';

import ParticipantTimeline from './ParticipantTimeline';

const getTitle = (activity: ActivityDomainModel) => `Add ${activity.isMission ? 'Responder' : 'Participant'}`;

export default function AddParticipantButton({ activity }: { activity: ActivityDomainModel }) {
  const { open } = useDialogs();
  return (
    <Button size="small" variant="outlined" onClick={() => open(AddParticipantDialog, { activity })}>
      {getTitle(activity)}
    </Button>
  );
}

function AddParticipantDialog({ open, activity, onClose }: { open: boolean; activity: ActivityDomainModel; onClose: () => void }) {
  const [organization, setOrganization] = React.useState<Organization | undefined>(undefined);
  const [member, setMember] = React.useState<MemberInfo | undefined>(undefined);
  const [participant, setParticipant] = React.useState<ParticipantDomainModel | undefined>(undefined);

  const updateMember = (m?: MemberInfo) => {
    setMember(m);
    setParticipant(m ? activity.participants.find((p) => p.id === m.id) : undefined);
  };

  const handleClose = () => {
    setOrganization(undefined);
    setMember(undefined);
    setParticipant(undefined);
    onClose();
  };

  return (
    <AppDialog fullWidth={true} open={open} onClose={onClose}>
      <DialogTitle sx={{ alignItems: 'center', justifyContent: 'space-between', display: 'flex' }}>
        <Box>{getTitle(activity)}</Box>
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ py: 1 }} spacing={2}>
          <OrganizationSelect onChange={(organization) => setOrganization(organization)}></OrganizationSelect>
          <MemberSearch organizationId={organization?.id} onChange={(member) => updateMember(member)}></MemberSearch>
          {participant && <ParticipantTimeline participant={participant} />}
          {organization && member && <StatusUpdater activity={activity} member={member} organization={organization} fullWidth />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </AppDialog>
  );
}
