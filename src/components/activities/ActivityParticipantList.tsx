import Card from '@mui/material/Card';
import Switch from '@mui/material/Switch';
import { format as formatDate } from 'date-fns';
import { ReactNode, useEffect, useState } from 'react';

import { Box, Stack, Typography } from '@respond/components/Material';
import { getStatusText, isEnrouteOrStandby, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/types/activity';

import { ParticipantTile } from '../participant/ParticipantTile';

import { useActivityContext } from './ActivityProvider';

const etaStatus = (status: ParticipantStatus) => ([ParticipantStatus.Standby, ParticipantStatus.SignedIn].includes(status) ? 1 : 0);
const sortArrivingNext = (a: Participant, b: Participant) => etaStatus(b.timeline[0].status) - etaStatus(a.timeline[0].status) || (a.eta ?? Infinity) - (b.eta ?? Infinity);
const sortAlphabetical = (a: Participant, b: Participant) => a.firstname.localeCompare(b.firstname);

export function ActivityParticipantList({ filter }: { filter?: string }) {
  const activity = useActivityContext();
  const [sortEta, setSortEta] = useState(false);
  const [participants, setParticipants] = useState<Array<Participant>>(Object.values(activity.participants));

  useEffect(() => {
    let list = Object.values(activity.participants);
    if (filter) list = list.filter((p) => p.organizationId === filter);
    list.sort(sortEta ? sortArrivingNext : sortAlphabetical);
    setParticipants(list);
  }, [activity, filter, sortEta]);

  let cards: ReactNode = participants.map((p) => <ParticipantContent key={p.id} orgs={activity.organizations} participant={p} />);
  if (participants.length == 0) {
    cards = (
      <Card elevation={1}>
        <Typography sx={{ p: 2 }}>No responders with the selected filter</Typography>
      </Card>
    );
  }

  return (
    <Box flex="1 1 auto">
      <Stack direction="row" spacing={1} alignItems="center" justifyContent={'right'}>
        <Typography>Sort By: Name</Typography>
        <Switch value={sortEta} onChange={(e) => setSortEta(e.target.checked)} color="primary" />
        <Typography>ETA</Typography>
      </Stack>
      <Stack spacing={1}>{cards}</Stack>
    </Box>
  );
}

function ParticipantContent({ participant, orgs }: { participant: Participant; orgs: Record<string, ParticipatingOrg>; onClick?: () => void }) {
  return (
    <ParticipantTile participant={participant}>
      <Stack direction="row" sx={{ m: '5px', ml: '8px' }} justifyContent="space-between" flexGrow={1}>
        <Stack>
          <Typography variant="body1" fontWeight={600}>
            {participant.firstname} {participant.lastname}
          </Typography>
          <Typography variant="body2">
            {orgs[participant.organizationId]?.rosterName ?? orgs[participant.organizationId]?.title} {participant.tags?.join(', ')}
          </Typography>
        </Stack>
        <Stack textAlign={'right'} justifyContent={'space-between'}>
          <Typography variant="body2">{getStatusText(participant.timeline[0].status)}</Typography>
          <Typography variant="body2">{isEnrouteOrStandby(participant.timeline[0].status) && participant.eta ? <>ETA {formatDate(participant.eta, 'HHmm')}</> : <></>}</Typography>
        </Stack>
      </Stack>
    </ParticipantTile>
  );
}
