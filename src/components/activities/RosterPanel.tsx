import { Button, DialogActions, Divider } from '@mui/material';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import { PaperProps } from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import Switch from '@mui/material/Switch';
import { FunctionComponent, ReactNode, useEffect, useState } from 'react';

import { Box, Dialog, DialogContent, DialogTitle, Paper, Stack, Typography, useMediaQuery } from '@respond/components/Material';
import { MemberContext } from '@respond/hooks/useMemberContext';
import { ParticipantContext } from '@respond/hooks/useParticipantContext';
import { buildBaseOrganization, getStatusCssColor, getStatusText, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/types/activity';
import { buildMemberFromParticipant } from '@respond/types/member';

import { useActivityContext } from '../../hooks/useActivityContext';
import { MemberInfo } from '../member/MemberInfo';
import { MemberPhoto } from '../member/MemberPhoto';
import { ParticipantHours } from '../participant/ParticipantHours';
import { ParticipantMiles } from '../participant/ParticipantMiles';
import { ParticipantOrgName } from '../participant/ParticipantOrgName';
import { ParticipantTags } from '../participant/ParticipantTags';
import { StatusUpdater } from '../StatusUpdater';

import ParticipantTimeline from './ParticipantTimeline';

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
      <RosterRowCard status={ParticipantStatus.NotResponding}>
        <Typography sx={{ p: 2 }}>No responders with the selected filter</Typography>
      </RosterRowCard>
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

export function ParticipantDialog({ open, participant, onClose }: { open: boolean; onClose: () => void; participant?: Participant }) {
  const activity = useActivityContext();
  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  if (!participant) return <></>;

  const member = buildMemberFromParticipant(participant);
  const org = buildBaseOrganization(activity, member.orgId);

  return (
    <ParticipantContext.Provider value={participant}>
      <Dialog fullWidth open={open} onClose={onClose}>
        <DialogTitle style={{ borderBottom: 'solid 4px ' + getStatusCssColor(participant.timeline[0].status) }} alignItems="center" justifyContent="space-between" display="flex">
          <Box>{member.name}</Box>
          <Typography style={{ color: getStatusCssColor(participant.timeline[0].status) }}>{getStatusText(participant.timeline[0].status)}</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ pt: 2 }} divider={<Divider orientation={isMobile ? 'horizontal' : 'vertical'} flexItem />}>
            <Box>
              <MemberContext.Provider value={member}>
                <MemberPhoto />
                <Typography fontWeight={600}>
                  <ParticipantOrgName />
                </Typography>
                <ParticipantTags />
                <MemberInfo phone email />
              </MemberContext.Provider>
            </Box>
            <Stack spacing={2} flexGrow={1}>
              <ParticipantHours />
              <ParticipantMiles />
              <Box sx={{ my: 2 }} display="flex" justifyContent="end">
                <StatusUpdater member={member} org={org} />
              </Box>
              <ParticipantTimeline />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={onClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </ParticipantContext.Provider>
  );
}
