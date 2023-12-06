import { Button, ButtonBase, Chip, DialogActions, Divider, Table, TableBody, TableCell, TableFooter, TableRow } from '@mui/material';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import { PaperProps } from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import { DateTimePicker } from '@mui/x-date-pickers';
import { format as formatDate } from 'date-fns';
import { FunctionComponent, ReactNode, useEffect, useState } from 'react';

import { Box, Dialog, DialogContent, DialogTitle, Paper, Stack, Typography, useMediaQuery } from '@respond/components/Material';
import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { Activity, getStatusCssColor, getStatusText, isActive, Participant, ParticipantStatus, ParticipantUpdate, ParticipatingOrg } from '@respond/types/activity';

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

function EditTime({ datetime, onChange }: { datetime: number; onChange: (time: number) => void }) {
  const [edit, setEdit] = useState<boolean>(false);
  const [time, setTime] = useState(datetime);
  const handleAccept = (newTime: number | null) => {
    if (newTime) {
      setTime(newTime);
      onChange(new Date(newTime).getTime());
    }
  };

  return (
    <>
      {edit ? (
        <DateTimePicker value={time} format="MM/dd HH:mm" onAccept={handleAccept} onClose={() => setEdit(false)} />
      ) : (
        <ButtonBase sx={{ width: '100%' }} onClick={() => setEdit(true)}>
          <Typography variant="caption">{formatDate(time, 'MM/dd')}</Typography>
          <Typography sx={{ ml: 2 }} variant="h6">
            {formatDate(time, 'HHmm')}
          </Typography>
        </ButtonBase>
      )}
    </>
  );
}

export function ParticipantDialog({ open, participant, activity, onClose }: { open: boolean; onClose: () => void; participant?: Participant; activity: Activity }) {
  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  const dispatch = useAppDispatch();

  if (!participant) return <></>;

  const updateTimeline = (update: ParticipantUpdate, index: number) => {
    dispatch(ActivityActions.participantTimelineUpdate(activity.id, participant.id, update, index));
  };

  const name = `${participant.firstname} ${participant.lastname}`;
  return (
    <Dialog open={open} onClose={onClose}>
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
            <Typography fontWeight={600}>{activity.organizations[participant.organizationId].rosterName ?? activity.organizations[participant.organizationId].title}</Typography>
            <Box>{participant.tags?.map((t) => <Chip sx={{ mr: '3px' }} key={t} label={t} variant="outlined" size="small" />)}</Box>
          </Box>
          <Box>
            <Typography>Timeline:</Typography>
            <Table size="small">
              <TableBody>
                {[...participant.timeline]
                  .map((t, i) => (
                    <TableRow key={t.time}>
                      <TableCell>{activity.organizations[t.organizationId].rosterName ?? activity.organizations[t.organizationId].title}</TableCell>
                      <TableCell>{getStatusText(t.status)}</TableCell>
                      <TableCell>
                        <EditTime datetime={t.time} onChange={(time) => updateTimeline({ ...t, time }, i)} />
                      </TableCell>
                    </TableRow>
                  ))
                  .reverse()}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} align="right" style={{ borderBottomWidth: 0 }}>
                    <Typography>
                      Total Hours: <ParticipantHoursText participant={participant} />
                    </Typography>
                    {participant.miles !== undefined && <Typography>Total Miles: {participant.miles}</Typography>}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Box>
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
  return <>{Math.round(timeOnClock / 1000 / 60 / 15) / 4}</>;
}
