import { useParticipantCommands } from '@respond/lib/client/services/participants';
import { getStatusMuiColor, getStatusText, Participant, ParticipantStatus } from '@respond/shared/types/activity';
import { useActivityContext } from '../activities/ActivityProvider';
import { type MouseEvent, useState } from 'react';
import { Chip } from '@mui/material';
import ConfirmDialog from '../ConfirmDialog';

export function DashboardParticipantStatusButton({ participant, status }: { participant: Participant; status: ParticipantStatus }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const participants = useParticipantCommands();
  const activity = useActivityContext();

  const statusLabel = getStatusText(status);
  const statusColor = getStatusMuiColor(status);
  const chipColor = statusColor === 'disabled' ? 'default' : statusColor;

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    setConfirmOpen(true);
  };

  const updateParticipantStatus = () => {
    setConfirmOpen(false);
    const update = { time: Date.now(), status, organizationId: participant.organizationId };
    participants.addTimeline(activity.id, participant.id, update);
  };
  
  return (
    <>
      <Chip label={statusLabel} size="small" variant="filled" color={chipColor} clickable onClick={handleClick} sx={{ color: 'common.white' }} />
      <ConfirmDialog
        open={confirmOpen}
        prompt={`Mark ${participant.firstname} ${participant.lastname} as ${statusLabel}?`}
        onConfirm={updateParticipantStatus}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
