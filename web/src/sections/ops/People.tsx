/** The people and equipment cards that teams, places, groups and the resource pool show. */
import { Link, Stack, Typography, type TypographyProps } from '@mui/material';
import { useRef, type MouseEvent, type PointerEvent } from 'react';
import type { ManageEquipment, ManageParticipant } from '@sync/model';
import { observer } from '@sync/model/react';
import { useDialogs } from '../../shell/dialogs';
import { statusText } from '../../ui/status';
import { ParticipantDialog } from '../../ui/participant/ParticipantDialog';
import { format24HourTime, isDeployable } from './opsRules';
import { DashboardDraggableContainer } from './parts';

/** Past this, a press on the name was a drag of the card, not a click. As the drag's own threshold. */
const CLICK_SLOP_PX = 6;

/**
 * The person's name, as a link opening their dialog as the Respond roster's does: contact, hours,
 * timeline and status. A press that moves drags the card instead.
 */
export function DashboardParticipantName({ participant, variant }: { participant: ManageParticipant; variant: TypographyProps['variant'] }) {
  const { open } = useDialogs();
  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <Link
      component="button"
      variant={variant}
      underline="hover"
      color="inherit"
      onPointerDown={(e: PointerEvent) => (down.current = { x: e.clientX, y: e.clientY })}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        const from = down.current;
        if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) >= CLICK_SLOP_PX) return;
        open(ParticipantDialog, { participant });
      }}
      sx={{ textAlign: 'left', verticalAlign: 'baseline' }}
    >
      {participant.name}
    </Link>
  );
}

/**
 * On the roster: the person, unit and tags, and where they are (or their ETA while on the way).
 * Anyone not available is on a faded card; those who can't be put anywhere have no handle. `showStatus` names their status, for when the roster isn't grouped by it.
 */
export const DashboardParticipantCard = observer(function DashboardParticipantCard({ participant, showStatus = false }: { participant: ManageParticipant; showStatus?: boolean }) {
  const isResponding = participant.status === 'responding';
  const eta = participant.record?.eta;
  const where = isResponding && eta ? `ETA: ${format24HourTime(eta)}` : participant.target ? participant.locationName : '';
  const deployable = isDeployable(participant);
  return (
    <DashboardDraggableContainer variant="compact" disabled={!deployable} showHandle={deployable} tone={participant.status === 'staging' ? 'normal' : 'faded'}>
      <Stack direction="column" spacing={0.25} sx={{ width: '100%', minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <DashboardParticipantName participant={participant} variant="subtitle2" />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {[showStatus ? statusText(participant.status) : '', where].filter(Boolean).join(' · ')}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {participant.unit?.name} {participant.tags.join(', ')}
          </Typography>
        </Stack>
      </Stack>
    </DashboardDraggableContainer>
  );
});

/** On a team, place or group: red until their status says assigned (set it from their dialog, by their name). */
export const DashboardTeamMember = observer(function DashboardTeamMember({ participant }: { participant: ManageParticipant }) {
  const isAssigned = participant.status === 'assigned';
  return (
    <DashboardDraggableContainer variant="compact" tone={isAssigned ? 'normal' : 'attention'}>
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', flex: 1, minWidth: 0, width: '100%' }}>
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          <DashboardParticipantName participant={participant} variant="body2" /> ({participant.unit?.name})
        </Typography>
      </Stack>
    </DashboardDraggableContainer>
  );
});

export function DashboardTeamEquipment({ item }: { item: ManageEquipment }) {
  return (
    <DashboardDraggableContainer variant="compact">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {item.name}
        </Typography>
      </Stack>
    </DashboardDraggableContainer>
  );
}

/** Anyone on the target whose status isn't assigned (they're there, but not on the clock as assigned). */
export const hasUnassignedPersonnel = (people: ManageParticipant[]): boolean => people.some((p) => p.status !== 'assigned');
