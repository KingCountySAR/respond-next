import { Chip } from '@mui/material';
import { type MouseEvent, type PointerEvent } from 'react';

import { useDialogs } from '@respond/components/DialogProvider';
import { useParticipantCommands } from '@respond/lib/client/services/participants';
import { getStatusMuiColor, getStatusText, Participant, ParticipantStatus } from '@respond/shared/types/activity';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';

export function DashboardParticipantStatusButton({ participant, status }: { participant: Participant; status: ParticipantStatus }) {
  const participants = useParticipantCommands();
  const activity = useActivityContext();
  const { confirm } = useDialogs();

  const statusLabel = getStatusText(status);
  const statusColor = getStatusMuiColor(status);
  const chipColor = statusColor === 'disabled' ? 'default' : statusColor;

  const handleClick = async (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const confirmed = await confirm({
      prompt: `Mark ${participant.firstname} ${participant.lastname} as ${statusLabel}?`,
    });
    if (!confirmed) return;
    const update = { time: Date.now(), status, organizationId: participant.organizationId };
    participants.addTimeline(activity.id, participant.id, update);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return <Chip label={statusLabel} size="small" variant="filled" color={chipColor} clickable onClick={handleClick} onPointerDown={handlePointerDown} sx={{ color: 'common.white' }} />;
}
