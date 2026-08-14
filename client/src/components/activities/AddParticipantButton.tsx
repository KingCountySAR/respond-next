import { Box, Button, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import * as React from 'react';

import { DialogWithHistory } from '@respond/components/Material';
import { MemberInfo } from '@respond/shared/types/member';
import { Organization } from '@respond/shared/types/organization';

import { ActivityDomainModel } from '@/client/models/activityDomainModel';
import { ParticipantDomainModel } from '@/client/models/participantDomainModel';

import MemberSearch from '../member/MemberSearch';
import OrganizationSelect from '../organization/OrganizationSelect';
import { StatusUpdater } from '../StatusUpdater';

import ParticipantTimeline from './ParticipantTimeline';

const getTitle = (activity: ActivityDomainModel) => `Add ${activity.isMission ? 'Responder' : 'Participant'}`;

export default function AddParticipantButton({ activity }: { activity: ActivityDomainModel }) {
  const [openDialog, setOpenDialog] = React.useState<boolean>(false);

  return (
    <>
      <Button size="small" variant="outlined" onClick={() => setOpenDialog(true)}>
        {getTitle(activity)}
      </Button>
      <AddParticipantDialog open={openDialog} activity={activity} onClose={() => setOpenDialog(false)} />
    </>
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
    <DialogWithHistory fullWidth={true} open={open} onClose={onClose}>
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
    </DialogWithHistory>
  );
}
