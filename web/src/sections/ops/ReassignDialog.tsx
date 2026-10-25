import { Button, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, MenuItem, Radio, RadioGroup, Select } from '@mui/material';
import { useState } from 'react';
import type { Target } from '@sync/domain';
import type { ManageActivity } from '@sync/model';
import type { MuiDialogProps, useDialogs } from '../../shell/dialogs';
import { AppDialog } from '../../shell/dialogs/AppDialog';

type Mode = 'available' | 'place' | 'team' | 'group';

/**
 * The legacy DashboardResourceReassignmentDialog: where the people and equipment of a team, place or
 * group being removed go. Closes with the target, `{ target: null }` for back to the pool.
 */
export function ReassignDialog({ activity, origin, title, action, onClose }: MuiDialogProps<{ target: Target | null }> & { activity: ManageActivity; origin: Target; title: string; action: string }) {
  const teams = activity.teams.filter((t) => t.id !== origin.id && t.status !== 'disbanded');
  const places = activity.places.filter((p) => p.id !== origin.id);
  const groups = activity.groups.filter((g) => g.id !== origin.id);

  const [mode, setMode] = useState<Mode>('available');
  const [placeId, setPlaceId] = useState(places[0]?.id ?? '');
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');

  const confirm = () => {
    if (mode === 'place' && placeId) onClose({ target: { kind: 'place', id: placeId } });
    else if (mode === 'team' && teamId) onClose({ target: { kind: 'team', id: teamId } });
    else if (mode === 'group' && groupId) onClose({ target: { kind: 'group', id: groupId } });
    else onClose({ target: null });
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
            {groups.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            ))}
          </Select>
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(null)}>Cancel</Button>
        <Button variant="contained" color="primary" onClick={confirm} disabled={confirmDisabled}>
          {action}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}

/**
 * Removing a team, place or group: a plain confirm when it holds nothing (or, for a team, is in
 * base), else the reassignment dialog. Resolves with where its resources go, or undefined to cancel.
 */
export async function chooseReassignment(
  dialogs: ReturnType<typeof useDialogs>,
  activity: ManageActivity,
  origin: Target,
  options: { holdsResources: boolean; title: string; action: string; confirmPrompt?: string },
): Promise<Target | null | undefined> {
  if (!options.holdsResources) {
    if (options.confirmPrompt === undefined) return null;
    const confirmed = await dialogs.confirm({ prompt: options.confirmPrompt, destructive: true, label: options.action });
    return confirmed ? null : undefined;
  }
  const result = await dialogs.open(ReassignDialog, { activity, origin, title: options.title, action: options.action });
  return result ? result.target : undefined;
}
