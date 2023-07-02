import { Chip } from '@mui/material';
import { Circle } from '@mui/icons-material';
import { ResponderStatus } from '@respond/types/activity';

const STATUS_COLORS: Record<ResponderStatus, 'success'|'error'|'warning'|'disabled'> = {
  [ResponderStatus.NotResponding]: 'disabled',
  [ResponderStatus.Standby]: 'warning',
  [ResponderStatus.Remote]: 'success',
  [ResponderStatus.SignedIn]: 'success',
  [ResponderStatus.Available]: 'success',
  [ResponderStatus.Assigned]: 'success',
  [ResponderStatus.Demobilized]: 'warning',
  [ResponderStatus.SignedOut]: 'error',
};

export const STATUS_TEXT: Record<ResponderStatus, string> = {
  [ResponderStatus.NotResponding]: 'Not Responding',
  [ResponderStatus.Standby]: 'Standby',
  [ResponderStatus.Remote]: 'In Town',
  [ResponderStatus.SignedIn]: 'Responding',
  [ResponderStatus.Available]: 'Available',
  [ResponderStatus.Assigned]: 'Assigned',
  [ResponderStatus.Demobilized]: 'Demobilized',
  [ResponderStatus.SignedOut]: 'Signed Out'
};

export const StatusChip = ({ status }: { status: ResponderStatus }) => {

  return (
    <Chip
      icon={<Circle color={STATUS_COLORS[status]} />}
      label={STATUS_TEXT[status]}
      variant="outlined"
      size="small"
    />
  );

}