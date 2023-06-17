import { Chip } from '@mui/material';
import { Circle } from '@mui/icons-material';
import { ResponderStatus } from '@respond/types/activity';

const STATUS_COLORS: Record<ResponderStatus, 'success'|'error'|'warning'|'disabled'> = {
  [ResponderStatus.SignedIn]: 'success',
  [ResponderStatus.SignedOut]: 'error',
  [ResponderStatus.Standby]: 'warning',
  [ResponderStatus.Cancel]: 'disabled',
  [ResponderStatus.Unavailable]: 'disabled'
};

const STATUS_TEXT: Record<ResponderStatus, string> = {
  [ResponderStatus.SignedIn]: 'Signed In',
  [ResponderStatus.SignedOut]: 'Signed Out',
  [ResponderStatus.Standby]: 'Standby',
  [ResponderStatus.Cancel]: 'Cancel',
  [ResponderStatus.Unavailable]: 'Unavailable'
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