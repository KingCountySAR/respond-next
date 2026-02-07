import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import * as React from 'react';

import { Activity } from '@respond/types/activity';

import MemberSearch from '../member/MemberSearch';
import OrganizationSelect from '../organization/OrganizationSelect';

export default function AddParticipantButton({ activity }: { activity: Activity }) {
  const [openDialog, setOpenDialog] = React.useState<boolean>(false);

  const label = `Add ${activity.isMission ? 'Responder' : 'Participant'}`;

  const handleResult = (data?: { memberId: string; organizationId: string }) => {
    setOpenDialog(false);
    if (data) console.log(`Add ${data.memberId}`);
  };

  return (
    <>
      <Button size="small" variant="outlined" onClick={() => setOpenDialog(true)}>
        {label}
      </Button>
      <AddParticipantDialog open={openDialog} title={label} onAdd={handleResult} onClose={handleResult} />
    </>
  );
}

function AddParticipantDialog({ open, title, onClose, onAdd }: { open: boolean; title: string; onAdd: (data: { memberId: string; organizationId: string }) => void; onClose: () => void }) {
  const [organizationId, setOrganizationId] = React.useState('');
  const [memberId, setMemberId] = React.useState('');

  const handleAdd = () => {
    onAdd({ memberId, organizationId });
    onClose();
  };

  return (
    <Dialog fullWidth={true} open={open} onClose={onClose}>
      <DialogTitle alignItems="center" justifyContent="space-between" display="flex">
        <Box>{title}</Box>
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ py: 1 }} spacing={2}>
          <OrganizationSelect onChange={(id: string) => setOrganizationId(id)}></OrganizationSelect>
          <MemberSearch organizationId={organizationId} onChange={(id: string) => setMemberId(id)}></MemberSearch>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button disabled={!memberId || !organizationId} onClick={handleAdd} variant="contained">
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
