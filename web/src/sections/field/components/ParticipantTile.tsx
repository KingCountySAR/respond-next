import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Stack, Typography } from '@mui/material';
import { format as formatDate } from 'date-fns';
import type { FieldParticipant } from '@sync/model';
import { observer } from '@sync/model/react';
import { statusText } from '../../../ui/status';
import { RosterRowCard } from './RosterPanel';

/** A roster row, the same on desktop and mobile; marked when someone else set the status. */
export const ParticipantTile = observer(function ParticipantTile({ participant, onClick }: { participant: FieldParticipant; onClick?: () => void }) {
  const eta = participant.record?.eta;
  const byName = participant.currentStatus?.byName;
  return (
    <RosterRowCard status={participant.status} onClick={onClick}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', flexGrow: 1, m: '5px', ml: '8px' }}>
        <Stack>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {participant.name}
          </Typography>
          <Typography variant="body2">
            {participant.unit?.name ?? ''} {participant.tags.join(', ')}
          </Typography>
        </Stack>
        <Stack sx={{ textAlign: 'right', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
            {byName && <InfoOutlinedIcon sx={{ fontSize: 16 }} color="action" titleAccess={`Status set by ${byName}`} />}
            <Typography variant="body2">{statusText(participant.status)}</Typography>
          </Stack>
          <Typography variant="body2">{participant.isEnrouteOrStandby && eta ? `ETA ${formatDate(eta, 'HHmm')}` : null}</Typography>
        </Stack>
      </Stack>
    </RosterRowCard>
  );
});
