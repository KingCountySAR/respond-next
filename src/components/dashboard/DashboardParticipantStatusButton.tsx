import { Chip } from '@mui/material';
import { type MouseEvent, type PointerEvent, useState } from 'react';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state/activityActions';
import { getStatusMuiColor, getStatusText, Participant, ParticipantStatus } from '@respond/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';
import ConfirmDialog from '../ConfirmDialog';

export function DashboardParticipantStatusButton({ participant, status }: { participant: Participant; status: ParticipantStatus }) {
  const dispatch = useAppDispatch();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const activity = useActivityContext();

  const statusLabel = getStatusText(status);
  const statusColor = getStatusMuiColor(status);
  const chipColor = statusColor === 'disabled' ? 'default' : statusColor;

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    setConfirmOpen(true);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const updateParticipantStatus = () => {
    setConfirmOpen(false);
    const update = { time: Date.now(), status, organizationId: participant.organizationId };
    dispatch(ActivityActions.participantTimelineAdd(activity.id, participant.id, update));
  };

  return (
    <>
      <Chip label={statusLabel} size="small" variant="filled" color={chipColor} clickable onClick={handleClick} onPointerDown={handlePointerDown} sx={{ color: 'common.white' }} />
      <ConfirmDialog open={confirmOpen} prompt={`Mark ${participant.firstname} ${participant.lastname} as ${statusLabel}?`} onConfirm={updateParticipantStatus} onClose={() => setConfirmOpen(false)} />
    </>
  );
}
