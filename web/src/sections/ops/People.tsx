/** The people and equipment cards that teams, places, groups and the resource pool show. */
import { Chip, Stack, Typography } from '@mui/material';
import type { MouseEvent, PointerEvent } from 'react';
import type { ParticipantStatus } from '@sync/domain';
import type { CommandEquipment, CommandParticipant } from '@sync/model';
import { observer } from '@sync/model/react';
import { useDialogs } from '../../shell/dialogs';
import { statusMuiColor, statusText } from '../../ui/status';
import { useChange } from '../../ui/useChange';
import { format24HourTime } from './opsRules';
import { DashboardDraggableContainer } from './parts';

/** A chip that, once confirmed, sets the person's status. */
export function DashboardParticipantStatusButton({ participant, status }: { participant: CommandParticipant; status: Exclude<ParticipantStatus, 'unknown'> }) {
  const { confirm } = useDialogs();
  const change = useChange();
  const label = statusText(status);
  const color = statusMuiColor(status);

  const handleClick = async (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const confirmed = await confirm({ prompt: `Mark ${participant.name} as ${label}?` });
    if (confirmed) change(() => participant.setStatus(status));
  };

  // Keeps a click on the chip from starting a drag.
  const stopDrag = (event: PointerEvent<HTMLDivElement>) => event.stopPropagation();

  return <Chip label={label} size="small" variant="filled" color={color === 'disabled' ? 'default' : color} clickable onClick={handleClick} onPointerDown={stopDrag} sx={{ color: 'common.white' }} />;
}

/** In the resource pool: the person, their ETA while still on the way, unit and tags. */
export const DashboardParticipantCard = observer(function DashboardParticipantCard({ participant }: { participant: CommandParticipant }) {
  const isAvailable = participant.status === 'staging';
  const eta = participant.record?.eta;
  return (
    <DashboardDraggableContainer variant="compact" disabled={!isAvailable}>
      <Stack direction="column" spacing={0.25} sx={{ width: '100%' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">{participant.name}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {!isAvailable && eta ? `ETA: ${format24HourTime(eta)}` : ''}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {participant.unit?.name} {participant.tags.join(', ')}
          </Typography>
          {!isAvailable && <DashboardParticipantStatusButton participant={participant} status="staging" />}
        </Stack>
      </Stack>
    </DashboardDraggableContainer>
  );
});

/** On a team, place or group: red, with an "Assigned" button, until their status says assigned. */
export const DashboardTeamMember = observer(function DashboardTeamMember({ participant }: { participant: CommandParticipant }) {
  const isAssigned = participant.status === 'assigned';
  return (
    <DashboardDraggableContainer variant="compact" sx={{ bgcolor: !isAssigned ? '#f0bcbc' : 'background.paper' }}>
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', flex: 1, minWidth: 0, width: '100%' }}>
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {participant.name} ({participant.unit?.name})
        </Typography>
        {!isAssigned && <DashboardParticipantStatusButton participant={participant} status="assigned" />}
      </Stack>
    </DashboardDraggableContainer>
  );
});

export function DashboardTeamEquipment({ item }: { item: CommandEquipment }) {
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
export const hasUnassignedPersonnel = (people: CommandParticipant[]): boolean => people.some((p) => p.status !== 'assigned');
