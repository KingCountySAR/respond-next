import { Button, ButtonBase, Chip, DialogActions, Divider } from '@mui/material';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import { PaperProps } from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import Switch from '@mui/material/Switch';
import { FunctionComponent, ReactNode, useEffect, useState } from 'react';

import { Box, Dialog, DialogContent, DialogTitle, Paper, Stack, Typography, useMediaQuery } from '@respond/components/Material';
import { apiFetch } from '@respond/lib/api';
import { getOrganizationName, getStatusCssColor, getStatusText, isActive, Participant, ParticipantStatus, ParticipantUpdate, ParticipatingOrg } from '@respond/types/activity';
import { ParticipantInfo } from '@respond/types/participant';

import { ParticipantMilesUpdater } from '../participant/ParticipantMilesUpdater';

import { useActivityContext } from './ActivityProvider';
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

const findMember = async (orgId: string, memberId: string) => {
  return (await apiFetch<{ data: ParticipantInfo }>(`/api/v1/organizations/${orgId}/members/${memberId}`)).data;
};

const formatPhoneNumber = (phoneNumberString: string, includeIntlCode: boolean = false) => {
  const cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    const intlCode = match[1] ? '+1 ' : '';
    return [includeIntlCode ? intlCode : '', '(', match[2], ') ', match[3], '-', match[4]].join('');
  }
  return null;
};

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
  const [memberInfo, setMemberInfo] = useState<ParticipantInfo | undefined>();

  useEffect(() => {
    if (participant) getMemberInfo(participant);
  }, [participant]);

  const getMemberInfo = async (participant: Participant) => {
    const member = await findMember(participant.organizationId, participant.id);
    setMemberInfo(member);
  };

  if (!participant) return <></>;

  const name = `${participant.firstname} ${participant.lastname}`;
  return (
    <Dialog fullWidth open={open} onClose={onClose}>
      <DialogTitle style={{ borderBottom: 'solid 4px ' + getStatusCssColor(participant.timeline[0].status) }} alignItems="center" justifyContent="space-between" display="flex">
        <Box>{name}</Box>
        <Typography style={{ color: getStatusCssColor(participant.timeline[0].status) }}>{getStatusText(participant.timeline[0].status)}</Typography>
      </DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ pt: 2 }} divider={<Divider orientation={isMobile ? 'horizontal' : 'vertical'} flexItem />}>
          <Box>
            <img //
              src={`/api/v1/organizations/${participant.organizationId}/members/${participant.id}/photo`}
              alt={`Photo of ${name}`}
              style={{ width: '8rem', minHeight: '10rem', border: 'solid 1px #777', borderRadius: '4px' }}
            />
            <Typography fontWeight={600}>{getOrganizationName(activity, participant.organizationId)}</Typography>
            <Box>{participant.tags?.map((t) => <Chip sx={{ mr: '3px' }} key={t} label={t} variant="outlined" size="small" />)}</Box>
            {memberInfo?.mobilephone && <Typography>{formatPhoneNumber(memberInfo.mobilephone)}</Typography>}
            {memberInfo?.email && (
              <Typography>
                <a href={`mailto:${memberInfo.email}`}>{memberInfo.email}</a>
              </Typography>
            )}
          </Box>
          <Stack spacing={2} flexGrow={1}>
            <ParticipantHoursText participant={participant} />
            <ParticipantMiles activityId={activity.id} participant={participant} />
            <Typography borderBottom={1} variant="h6">
              Timeline
            </Typography>
            <ParticipantTimeline participant={participant} />
          </Stack>
        </Stack>
        {/* <DialogContentText>Mark this activity as deleted? Any data it contains will stop contributing to report totals.</DialogContentText> */}
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function isOnClock(status: ParticipantStatus) {
  if (status === ParticipantStatus.Standby) return false;
  return isActive(status);
}

function getLastTimeout(lastUpdate: ParticipantUpdate) {
  if (!isOnClock(lastUpdate.status)) return lastUpdate.time;
  return new Date().getTime();
}

function ParticipantHoursText({ participant }: { participant: Participant }) {
  const lastTimeline = participant.timeline[0];
  const [latestTimeout, setLatestTimeout] = useState<number>(getLastTimeout(lastTimeline));

  // Keep the timeline up to date while the dialog is open
  useEffect(() => {
    const timer = setTimeout(() => {
      setLatestTimeout(getLastTimeout(lastTimeline));
    }, 10000);
    return () => clearTimeout(timer);
  }, [lastTimeline, latestTimeout, participant.firstname]);

  let timeOnClock = 0;
  let lastTime: number = latestTimeout;
  for (const t of participant.timeline) {
    if (isOnClock(t.status)) {
      timeOnClock += lastTime - t.time;
    }

    lastTime = t.time;
  }

  // Round to the nearest quarter hour.
  return (
    <Stack direction={'row'} spacing={2} justifyContent={'space-between'}>
      <Typography variant="h6">Total Hours:</Typography>
      <Typography variant="h6" flexGrow={1} align={'right'}>
        {Math.round(timeOnClock / 1000 / 60 / 15) / 4}
      </Typography>
    </Stack>
  );
}

function ParticipantMiles({ activityId, participant }: { activityId: string; participant: Participant }) {
  const [miles, setMiles] = useState(participant.miles ?? 0);
  const [edit, setEdit] = useState(false);
  return (
    <>
      {!edit && (
        <ButtonBase sx={{ width: '100%' }} onClick={() => setEdit(true)}>
          <Stack sx={{ width: '100%' }} direction={'row'} spacing={2} justifyContent={'space-between'}>
            <Typography variant="h6">Total Miles:</Typography>
            <Typography variant="h6" flexGrow={1} align={'right'}>
              {miles}
            </Typography>
          </Stack>
        </ButtonBase>
      )}
      {edit && (
        <>
          <Typography variant="h6">Updating Miles</Typography>
          <ParticipantMilesUpdater
            activityId={activityId}
            participant={{ ...participant, miles: miles }}
            onCancel={() => setEdit(false)}
            onSubmit={(newMiles) => {
              setMiles(newMiles);
              setEdit(false);
            }}
          />
        </>
      )}
    </>
  );
}
