import { Chip } from '@mui/material';

import { useParticipantContext } from '../../hooks/useParticipantContext';

export function ParticipantTags() {
  const participant = useParticipantContext();
  return <>{participant.tags?.map((t) => <Chip sx={{ mr: '3px' }} key={t} label={t} variant="outlined" size="small" />)}</>;
}
