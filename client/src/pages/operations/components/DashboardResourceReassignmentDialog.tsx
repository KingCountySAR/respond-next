import { Button, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, MenuItem, Radio, RadioGroup, Select } from '@mui/material';
import { useState } from 'react';

import { MuiDialogProps } from '@respond/components/DialogProvider';
import { AppDialog } from '@respond/components/DialogProvider/AppDialog';
import { Activity } from '@respond/shared/types/activity';
import { AssignmentTarget, Group, Place, Team } from '@respond/shared/types/operations';

export interface DashboardResourceReassignmentResult {
  target: AssignmentTarget;
}

interface DashboardResourceReassignmentDialogProps extends MuiDialogProps<DashboardResourceReassignmentResult> {
  activity: Activity;
  origin: Team | Place | Group;
  action: string;
  title: string;
}

type Mode = 'available' | 'place' | 'team' | 'group';

export function DashboardResourceReassignmentDialog({ activity, origin, title, action, onClose }: DashboardResourceReassignmentDialogProps) {
  const teams = (activity.teams ?? []).filter((t) => t.id !== origin.id && t.status !== 'Disbanded');
  const places = (activity.places ?? []).filter((p) => p.id !== origin.id);
  const groups = (activity.groups ?? []).filter((g) => g.id !== origin.id);

  const [mode, setMode] = useState<Mode>('available');
  const [placeId, setPlaceId] = useState(places[0]?.id ?? '');
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');

  const handleConfirm = () => {
    if (mode === 'place' && placeId) {
      onClose({ target: { type: 'place', id: placeId } });
    } else if (mode === 'team' && teamId) {
      onClose({ target: { type: 'team', id: teamId } });
    } else if (mode === 'group' && groupId) {
      onClose({ target: { type: 'group', id: groupId } });
    } else {
      onClose({ target: undefined });
    }
  };

  const confirmDisabled = (mode === 'place' && !placeId) || (mode === 'team' && !teamId) || (mode === 'group' && !groupId);

  return (
    <AppDialog fullWidth open onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>Choose what happens to remaining resources.</DialogContentText>
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

          <FormControlLabel value="team" control={<Radio />} label="Move to a team" disabled={teams.length === 0} />
          <Select size="small" disabled={mode !== 'team'} value={teamId} onChange={(e) => setTeamId(e.target.value)} sx={{ ml: 4 }}>
            {teams.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </Select>

          <FormControlLabel value="group" control={<Radio />} label="Move to a group" disabled={groups.length === 0} />
          <Select size="small" disabled={mode !== 'group'} value={groupId} onChange={(e) => setGroupId(e.target.value)} sx={{ ml: 4 }}>
            {groups.map((t) => (
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
