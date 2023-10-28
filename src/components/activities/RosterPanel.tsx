import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import { PaperProps } from '@mui/material/Paper';
import { FunctionComponent, ReactNode } from 'react';

import { Box, Paper, Stack, Typography } from '@respond/components/Material';
import { Activity, getStatusCssColor, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/types/activity';

interface RosterPanelProps {
  activity: Activity;
  filter?: string;
  participantContainerComponent: FunctionComponent<{ children: ReactNode }>;
  participantRowComponent: FunctionComponent<{ orgs: Record<string, ParticipatingOrg>; participant: Participant; onClick?: () => void }>;
  onClick?: (participant: Participant) => void;
}

export function RosterPanel({ activity, filter, participantContainerComponent: Participants, participantRowComponent: Participant, onClick }: RosterPanelProps) {
  let participants = Object.values(activity.participants);
  if (filter) participants = participants.filter((p) => p.organizationId === filter);

  let cards: ReactNode = participants.map((p) => <Participant key={p.id} orgs={activity.organizations} participant={p} onClick={() => onClick?.(p)} />);
  if (participants.length == 0) {
    cards = (
      <RosterRowCard status={ParticipantStatus.NotResponding}>
        <Typography sx={{ p: 2 }}>No responders with the selected filter</Typography>
      </RosterRowCard>
    );
  }

  return (
    <Box flex="1 1 auto">
      <Participants>{cards}</Participants>
    </Box>
  );
}

export function RosterRowCard({ status, children, onClick, ...props }: PaperProps & { status: ParticipantStatus; children: ReactNode; onClick?: () => void }) {
  let cardContent = (
    <Stack direction="row" minHeight="3rem">
      <Paper elevation={2} sx={{ width: 8, bgcolor: getStatusCssColor(status) ?? 'transparent', borderBottomRightRadius: 0, borderTopRightRadius: 0 }} />
      {children}
    </Stack>
  );
  if (onClick) {
    cardContent = <CardActionArea onClick={onClick}>{cardContent}</CardActionArea>;
  }

  return (
    <Card elevation={1} {...props}>
      {cardContent}
    </Card>
  );
}
