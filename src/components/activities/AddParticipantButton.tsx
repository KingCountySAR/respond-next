import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import * as React from 'react';

import { MemberInfo } from '@respond/lib/server/memberProviders/memberProvider';
import { Activity, Participant } from '@respond/types/activity';
import { Organization } from '@respond/types/organization';

import MemberSearch from '../member/MemberSearch';
import OrganizationSelect from '../organization/OrganizationSelect';
import { StatusUpdater } from '../StatusUpdater';

import ParticipantTimeline from './ParticipantTimeline';

const getTitle = (activity: Activity) => `Add ${activity.isMission ? 'Responder' : 'Participant'}`;

export default function AddParticipantButton({ activity }: { activity: Activity }) {
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

function AddParticipantDialog({ open, activity, onClose }: { open: boolean; activity: Activity; onClose: () => void }) {
  const [organization, setOrganization] = React.useState<Organization | undefined>(undefined);
  const [member, setMember] = React.useState<MemberInfo | undefined>(undefined);
  const [participant, setParticipant] = React.useState<Participant | undefined>(undefined);

  React.useEffect(() => {
    if (member && activity.participants[member.id]) {
      setParticipant(activity.participants[member.id]);
    } else {
      setParticipant(undefined);
    }
  }, [activity, member]);

  const handleClose = () => {
    setOrganization(undefined);
    setMember(undefined);
    setParticipant(undefined);
    onClose();
  };

  return (
    <Dialog fullWidth={true} open={open} onClose={onClose}>
      <DialogTitle alignItems="center" justifyContent="space-between" display="flex">
        <Box>{getTitle(activity)}</Box>
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ py: 1 }} spacing={2}>
          <OrganizationSelect onChange={(organization) => setOrganization(organization)}></OrganizationSelect>
          <MemberSearch organizationId={organization?.id} onChange={(member) => setMember(member)}></MemberSearch>
          {participant && <ParticipantTimeline participant={participant} />}
          {organization && member && <StatusUpdater member={member} organization={organization} fullWidth />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
