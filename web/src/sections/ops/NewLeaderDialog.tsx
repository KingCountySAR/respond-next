import { Button, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useState } from 'react';
import type { Target } from '@sync/domain';
import type { ManageParticipant, ManageTeam } from '@sync/model';
import { useDialogs, type MuiDialogProps } from '../../shell/dialogs';
import { AppDialog } from '../../shell/dialogs/AppDialog';
import { useChange } from '../../ui/useChange';

/** Who leads a team its leader is leaving: one of those staying, none picked at first. Closes with their id. */
export function NewLeaderDialog({ team, leaving, successors, onClose }: MuiDialogProps<{ participantId: string }> & { team: ManageTeam; leaving: ManageParticipant; successors: ManageParticipant[] }) {
  const [picked, setPicked] = useState('');
  return (
    <AppDialog fullWidth open onClose={onClose}>
      <DialogTitle>New leader for {team.name}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1 }}>
          {leaving.name} is leaving {team.name}. Who leads it now?
        </DialogContentText>
        <RadioGroup value={picked} onChange={(e) => setPicked(e.target.value)} aria-label="New leader">
          {successors.map((p) => (
            <FormControlLabel key={p.id} value={p.id} control={<Radio />} label={p.name} />
          ))}
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(null)}>Cancel</Button>
        <Button variant="contained" color="primary" disabled={!picked} onClick={() => onClose({ participantId: picked })}>
          Make leader
        </Button>
      </DialogActions>
    </AppDialog>
  );
}

/**
 * Moves a person on the dashboard. When they lead a team they're leaving and two or more stay, asks
 * who leads it now first; cancelling that leaves them where they are. Resolves with whether it moved.
 */
export function useAssignResponder(): (p: ManageParticipant, target: Target | null, options?: { asLeader?: boolean }) => Promise<boolean> {
  const dialogs = useDialogs();
  const change = useChange();
  return async (p, target, options = {}) => {
    const successors = p.successorsLeaving(target);
    let newLeaderId: string | undefined;
    if (successors.length) {
      const picked = await dialogs.open(NewLeaderDialog, { team: p.team!, leaving: p, successors });
      if (!picked) return false;
      newLeaderId = picked.participantId;
    }
    return change(() => p.assign(target, { ...options, newLeaderId }));
  };
}
