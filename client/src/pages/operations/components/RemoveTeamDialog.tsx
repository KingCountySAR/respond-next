import { Button, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, MenuItem, Radio, RadioGroup, Select } from '@mui/material';
import { useState } from 'react';

import { MuiDialogProps } from '@respond/components/DialogProvider';
import { AppDialog } from '@respond/components/DialogProvider/AppDialog';
import { Activity } from '@respond/shared/types/activity';
import { AssignmentTarget, Team } from '@respond/shared/types/operations';

export interface RemoveTeamDialogResult {
  target: AssignmentTarget;
}

interface RemoveTeamDialogProps extends MuiDialogProps<RemoveTeamDialogResult> {
  activity: Activity;
  team: Team;
  /** Which action is prompting this dialog — only changes copy, not behavior. */
  action: 'Disband' | 'Delete';
}

type Mode = 'available' | 'place' | 'team';

export function RemoveTeamDialog({ activity, team, action, onClose }: RemoveTeamDialogProps) {
  const otherTeams = (activity.teams ?? []).filter((t) => t.id !== team.id && t.status !== 'Disbanded');
  const places = activity.places ?? [];

  const [mode, setMode] = useState<Mode>('available');
  const [placeId, setPlaceId] = useState(places[0]?.id ?? '');
  const [teamId, setTeamId] = useState(otherTeams[0]?.id ?? '');

  const handleConfirm = () => {
    if (mode === 'place' && placeId) {
      onClose({ target: { type: 'place', id: placeId } });
    } else if (mode === 'team' && teamId) {
      onClose({ target: { type: 'team', id: teamId } });
    } else {
      onClose({ target: undefined });
    }
  };

  const confirmDisabled = (mode === 'place' && !placeId) || (mode === 'team' && !teamId);

  return (
    <AppDialog fullWidth open onClose={onClose}>
      <DialogTitle>
        {action} {team.name}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{team.name} isn&apos;t in base. Choose what happens to its remaining members and equipment.</DialogContentText>
        <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          <FormControlLabel value="available" control={<Radio />} label="Everyone is in base and assignable" />

          <FormControlLabel value="place" control={<Radio />} label="Move to a place" disabled={places.length === 0} />
          <Select size="small" disabled={mode !== 'place'} value={placeId} onChange={(e) => setPlaceId(e.target.value)} sx={{ ml: 4, mb: 1 }}>
            {places.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>

          <FormControlLabel value="team" control={<Radio />} label="Merge into another team" disabled={otherTeams.length === 0} />
          <Select size="small" disabled={mode !== 'team'} value={teamId} onChange={(e) => setTeamId(e.target.value)} sx={{ ml: 4 }}>
            {otherTeams.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(null)}>Cancel</Button>
        <Button variant="contained" color="primary" onClick={handleConfirm} disabled={confirmDisabled}>
          {action}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
