import { Circle } from '@mui/icons-material';
import { Chip } from '@mui/material';
import type { ParticipantStatus } from '@sync/domain';
import { statusMuiColor, statusText } from './status';

export const StatusChip = ({ status }: { status: ParticipantStatus }) => {
  return <Chip icon={<Circle color={statusMuiColor(status)} />} label={statusText(status)} variant="outlined" size="small" />;
};
