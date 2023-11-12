import { Circle } from '@mui/icons-material';
import { Chip } from '@mui/material';

import { getStatusMuiColor, getStatusText, ParticipantStatus } from '@respond/types/activity';

export const StatusChip = ({ status }: { status: ParticipantStatus }) => {
  return <Chip icon={<Circle color={getStatusMuiColor(status)} />} label={getStatusText(status)} variant="outlined" size="small" />;
};
