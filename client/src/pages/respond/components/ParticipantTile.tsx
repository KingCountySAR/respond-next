import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Stack, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';

import { ParticipantStatus } from '@respond/shared/types/activity';

import { ParticipantDomainModel } from '@/client/models/participantDomainModel';
import { RosterRowCard } from '@/client/pages/respond/components/RosterPanel';

export const ParticipantTile = observer(function ParticipantTile({ participant, onClick }: { participant: ParticipantDomainModel; onClick?: () => void }) {
  return (
    <RosterRowCard status={participant.status ?? ParticipantStatus.NotResponding} onClick={onClick}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', flexGrow: 1, m: '5px', ml: '8px' }}>
        <Stack>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {participant.fullName}
          </Typography>
          <Typography variant="body2">
            {participant.organizationName} {participant.tags.join(', ')}
          </Typography>
        </Stack>
        <Stack sx={{ textAlign: 'right', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
            {participant.lastEditedByOther && <InfoOutlinedIcon sx={{ fontSize: 16 }} color="disabled" titleAccess="Latest status was updated by someone else" />}
            <Typography variant="body2">{participant.statusText}</Typography>
          </Stack>
          <Typography variant="body2">{participant.etaText ? `ETA ${participant.etaText}` : null}</Typography>
        </Stack>
      </Stack>
    </RosterRowCard>
  );
});
