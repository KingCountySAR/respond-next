import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Table, TableBody, TableCell, TableFooter, TableRow, Typography } from '@mui/material';
import { format as formatDate } from 'date-fns';
import { ReactNode, useEffect, useState } from 'react';

import { Box, Stack } from '@respond/components/Material';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { Activity, getStatusCssColor, getStatusText, isActive, Participant, ParticipantStatus, ParticipantUpdate, ParticipatingOrg } from '@respond/types/activity';

import { ActivityInfoPanel } from './ActivityInfoPanel';
import { ActivityActionsBar, ActivityContentProps, ActivityGuardPanel } from './ActivityPage';
import { ParticipatingOrgChips } from './ParticipatingOrgChips';
import { RosterPanel, RosterRowCard } from './RosterPanel';

export function DesktopActivityPage({ activity }: { activity?: Activity }) {
  return <ActivityGuardPanel activity={activity} component={DesktopActivityContents} />;
}

function DesktopActivityContents({ activity, startChangeState, startRemove }: ActivityContentProps) {
  const [orgFilter, setOrgFilter] = useState<string>('');
  const [participantOpen, setParticipantOpen] = useState<boolean>(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant>();

  return (
    <ToolbarPage maxWidth="lg">
      <Stack direction="row" sx={{ mb: 1 }} alignItems="start" spacing={2}>
        <Typography variant="h4" flex="1 1 auto">
          {activity.idNumber} {activity.title}
        </Typography>
        <ActivityActionsBar activity={activity} startRemove={startRemove} startChangeState={startChangeState} />
      </Stack>
      <Stack direction="row" flex="1 1 auto" spacing={1} divider={<Divider orientation="vertical" flexItem />}>
        <Box display="flex" flex="1 1 auto" flexDirection="column">
          <ParticipatingOrgChips activity={activity} orgFilter={orgFilter} setOrgFilter={setOrgFilter} display="flex" flexDirection="row" />
          <RosterPanel //
            activity={activity}
            filter={orgFilter}
            participantContainerComponent={RosterContainer}
            participantRowComponent={RosterRow}
            onClick={(p) => {
              setSelectedParticipant(p);
              setParticipantOpen(true);
            }}
          />
        </Box>
        <Stack>
          <ActivityInfoPanel activity={activity} />
        </Stack>
      </Stack>
      <ParticipantDialog open={participantOpen} activity={activity} participant={selectedParticipant} onClose={() => setParticipantOpen(false)} />
    </ToolbarPage>
  );
}

function ParticipantHoursText({ participant }: { participant: Participant }) {
  const lastTimeline = participant.timeline[0];
  const [latestTimeout, setLatestTimeout] = useState<number>(getLastTimeout(lastTimeline));

  useEffect(() => {
    const timer = setTimeout(() => {
      setLatestTimeout(getLastTimeout(lastTimeline));
    }, 10000);
    return () => clearTimeout(timer);
  }, [lastTimeline, latestTimeout, participant.firstname]);

  let timeOnClock = 0;
  let timeout = latestTimeout;
  for (const t of participant.timeline) {
    if (isOnClock(t.status)) {
      timeOnClock += timeout - t.time;
    } else {
      timeout = t.time;
    }
  }

  return <>{Math.round(timeOnClock / 1000 / 60 / 15) / 4}</>;
}

function ParticipantDialog({ open, participant, activity, onClose }: { open: boolean; onClose: () => void; participant?: Participant; activity: Activity }) {
  if (!participant) return <></>;

  const name = `${participant.firstname} ${participant.lastname}`;
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle style={{ borderBottom: 'solid 4px ' + getStatusCssColor(participant.timeline[0].status) }} alignItems="center" justifyContent="space-between" display="flex">
        <Box>{name}</Box>
        <Typography style={{ color: getStatusCssColor(participant.timeline[0].status) }}>{getStatusText(participant.timeline[0].status)}</Typography>
      </DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={2} sx={{ pt: 2 }} divider={<Divider orientation="vertical" flexItem />}>
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
                {[...participant.timeline].reverse().map((t) => (
                  <TableRow key={t.time}>
                    <TableCell>{activity.organizations[t.organizationId].rosterName ?? activity.organizations[t.organizationId].title}</TableCell>
                    <TableCell>{getStatusText(t.status)}</TableCell>
                    <TableCell>{formatDate(t.time, 'EEE yyyy-MM-dd HHmm')}</TableCell>
                  </TableRow>
                ))}
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

function RosterRow({ participant, orgs, onClick }: { participant: Participant; orgs: Record<string, ParticipatingOrg>; onClick?: () => void }) {
  return (
    <RosterRowCard status={participant.timeline[0].status} onClick={onClick}>
      <Stack direction="column" sx={{ m: '5px', ml: '8px' }} flexGrow={1}>
        <Stack>
          <Typography variant="body1" fontWeight={600}>
            {participant.firstname} {participant.lastname}
          </Typography>
          <Typography variant="body2">
            {orgs[participant.organizationId]?.rosterName ?? orgs[participant.organizationId]?.title} {participant.tags?.join(', ')}
          </Typography>
        </Stack>
      </Stack>
    </RosterRowCard>
  );
}

function RosterContainer({ children }: { children: ReactNode }) {
  return <Stack spacing={1}>{children}</Stack>;
}
