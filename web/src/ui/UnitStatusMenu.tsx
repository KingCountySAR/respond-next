import { Box, Button, Checkbox, Chip, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, FormGroup, ListSubheader, Menu, MenuItem } from '@mui/material';
import { useState, type MouseEvent } from 'react';
import { UNIT_STATUS_TEXT, invitableUnits, isUnitOut, unitStatusSteps, type OperationalUnit, type SettableUnitStatus } from '@sync/domain';
import { isManageActivity, type ManageActivity, type UnitRef } from '@sync/model';
import { ActivityModelProvider, observer, useRespondActivity } from '@sync/model/react';
import { useHomeUnit, useSite } from '../shell/App';
import { useAuth } from '../shell/auth';
import { useDialogs, type MuiDialogProps } from '../shell/dialogs';
import { AppDialog } from '../shell/dialogs/AppDialog';
import { useSyncClient } from '../shell/sync';
import { unitStepLabel } from './status';
import { useChange } from './useChange';

/** The last chip in a unit list: opens the units menu. */
function MenuChip({ onClick }: { onClick: (anchor: HTMLElement) => void }) {
  // Lists inside a card link keep the click (and its ripple) to themselves.
  const stop = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  return (
    <Chip
      size="small"
      label="…"
      aria-label="Unit status"
      variant="outlined"
      sx={{ minWidth: 40 }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        stop(e);
        onClick(e.currentTarget);
      }}
    />
  );
}

/** For managers of an open activity: the units menu chip. */
export function UnitMenuChip({ activity }: { activity: ManageActivity }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <MenuChip onClick={setAnchor} />
      {anchor && <UnitMenu anchor={anchor} activity={activity} onClose={() => setAnchor(null)} />}
    </>
  );
}

/**
 * For managers, on an activity in a list: the units menu chip. Changing a unit needs the activity
 * itself, so, like a tile's status button, it reads it once and appears once it's loaded and managed.
 */
export function ListedUnitMenuChip({ activityId }: { activityId: string }) {
  const { session } = useAuth();
  const client = useSyncClient();
  if (session?.tier !== 'manage') return null;
  return (
    <ActivityModelProvider client={client} activityId={activityId} live={false}>
      <LoadedUnitMenuChip />
    </ActivityModelProvider>
  );
}

const LoadedUnitMenuChip = observer(function LoadedUnitMenuChip() {
  const activity = useRespondActivity();
  return activity.record && isManageActivity(activity) ? <UnitMenuChip activity={activity} /> : null;
});

/** The site's organization's status steps, then inviting the units it operates with that can't see the activity. */
const UnitMenu = observer(function UnitMenu({ anchor, activity, onClose }: { anchor: HTMLElement; activity: ManageActivity; onClose: () => void }) {
  const { confirm, open } = useDialogs();
  const change = useChange();
  const home = useHomeUnit();
  const invitable = invitableUnits(useSite().operational, { ownerOrgId: activity.record?.ownerOrgId, has: (id) => !!activity.unit(id) });
  const homeName = home.rosterName ?? home.title;
  const status = activity.unit(home.id)?.status ?? 'unknown';

  const setStatus = async (unit: UnitRef, next: SettableUnitStatus) => {
    onClose();
    const active = activity.unit(unit.id)?.activeParticipantCount ?? 0;
    const name = unit.rosterName ?? unit.title;
    if (isUnitOut(next) && active > 0) {
      const confirmed = await confirm({
        title: `${unitStepLabel(next)} ${name}?`,
        prompt: `This signs out the ${active === 1 ? 'person' : `${active} people`} active under ${name}, and they won't be able to sign themselves back in.`,
        destructive: true,
        label: unitStepLabel(next),
      });
      if (!confirmed) return;
    }
    change(() => activity.setUnitStatus(unit, next));
  };

  const invite = async () => {
    onClose();
    const picked = await open(InviteDialog, { units: invitable });
    if (picked?.length) change(() => picked.forEach((u) => activity.setUnitStatus({ id: u.id, title: u.title, rosterName: u.shortTitle }, 'invited')));
  };

  return (
    // The menu renders in a portal, but its events still bubble through here: keep them from a card link.
    <Box component="span" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <Menu anchorEl={anchor} open onClose={onClose}>
        <ListSubheader>
          {homeName}: {UNIT_STATUS_TEXT[status]}
        </ListSubheader>
        {unitStatusSteps(status)
          .filter((s) => s !== 'invited')
          .map((next) => (
            <MenuItem key={next} onClick={() => void setStatus(home, next)}>
              {unitStepLabel(next)}
            </MenuItem>
          ))}
        <Divider />
        <MenuItem disabled={!invitable.length} onClick={() => void invite()}>
          Invite unit…
        </MenuItem>
      </Menu>
    </Box>
  );
});

/** Pick the units to invite; closes with them. */
function InviteDialog({ open, onClose, units }: MuiDialogProps<OperationalUnit[]> & { units: OperationalUnit[] }) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setPicked((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  return (
    <AppDialog open={open} onClose={() => onClose(null)}>
      <DialogTitle>Invite Units</DialogTitle>
      <DialogContent>
        <FormGroup>
          {units.map((u) => (
            <FormControlLabel key={u.id} control={<Checkbox checked={picked.has(u.id)} onChange={() => toggle(u.id)} />} label={u.shortTitle === u.title ? u.title : `${u.shortTitle} (${u.title})`} />
          ))}
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(null)}>Cancel</Button>
        <Button disabled={!picked.size} onClick={() => onClose(units.filter((u) => picked.has(u.id)))}>
          Invite
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
