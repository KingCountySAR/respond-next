import { Circle } from '@mui/icons-material';
import { Chip } from '@mui/material';

import { ParticipantStatus } from '@respond/types/activity';

const STATUS_COLORS: Record<ParticipantStatus, 'success' | 'error' | 'warning' | 'disabled'> = {
  [ParticipantStatus.NotResponding]: 'disabled',
  [ParticipantStatus.Standby]: 'warning',
  [ParticipantStatus.Remote]: 'success',
  [ParticipantStatus.SignedIn]: 'success',
  [ParticipantStatus.Available]: 'success',
  [ParticipantStatus.Assigned]: 'success',
  [ParticipantStatus.Demobilized]: 'warning',
  [ParticipantStatus.SignedOut]: 'error',
};

export const STATUS_TEXT: Record<ParticipantStatus, string> = {
  [ParticipantStatus.NotResponding]: 'Not Responding',
  [ParticipantStatus.Standby]: 'Standby',
  [ParticipantStatus.Remote]: 'In Town',
  [ParticipantStatus.SignedIn]: 'Responding',
  [ParticipantStatus.Available]: 'Available',
  [ParticipantStatus.Assigned]: 'Assigned',
  [ParticipantStatus.Demobilized]: 'Demobilized',
  [ParticipantStatus.SignedOut]: 'Signed Out',
};

export const StatusChip = ({ status }: { status: ParticipantStatus }) => {
  return <Chip icon={<Circle color={STATUS_COLORS[status]} />} label={STATUS_TEXT[status]} variant="outlined" size="small" />;
};
