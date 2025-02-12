import Card from '@mui/material/Card';
import Switch from '@mui/material/Switch';
import { FunctionComponent, ReactNode, useEffect, useState } from 'react';

import { Box, Stack, Typography } from '@respond/components/Material';
import { Participant, ParticipantStatus, ParticipatingOrg } from '@respond/types/activity';

import { useActivityContext } from './ActivityProvider';

interface RosterPanelProps {
  filter?: string;
  participantContainerComponent: FunctionComponent<{ children: ReactNode }>;
  participantRowComponent: FunctionComponent<{ orgs: Record<string, ParticipatingOrg>; participant: Participant; onClick?: () => void }>;
  onClick?: (participant: Participant) => void;
}

const etaStatus = (status: ParticipantStatus) => {
  return [ParticipantStatus.Standby, ParticipantStatus.SignedIn].includes(status) ? 1 : 0;
};
const sortArrivingNext = (a: Participant, b: Participant) => etaStatus(b.timeline[0].status) - etaStatus(a.timeline[0].status) || (a.eta ?? Infinity) - (b.eta ?? Infinity);
const sortAlphabetical = (a: Participant, b: Participant) => a.firstname.localeCompare(b.firstname);

export function RosterPanel({ filter, participantContainerComponent: Participants, participantRowComponent: Participant, onClick }: RosterPanelProps) {
  const activity = useActivityContext();
  const [sortEta, setSortEta] = useState(false);
  const [participants, setParticipants] = useState<Array<Participant>>(Object.values(activity.participants));

  useEffect(() => {
    let list = Object.values(activity.participants);
    if (filter) list = list.filter((p) => p.organizationId === filter);
    list.sort(sortEta ? sortArrivingNext : sortAlphabetical);
    setParticipants(list);
  }, [activity, filter, sortEta]);

  let cards: ReactNode = participants.map((p) => <Participant key={p.id} orgs={activity.organizations} participant={p} onClick={() => onClick?.(activity.participants[p.id])} />);
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
        <Switch value={sortEta} onChange={(event) => setSortEta(event.target.checked)} color="primary" />
        <Typography>ETA</Typography>
      </Stack>
      <Participants>{cards}</Participants>
    </Box>
  );
}
