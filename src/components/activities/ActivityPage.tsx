import DeleteIcon from '@mui/icons-material/Delete';
import { Alert, Box, Breadcrumbs, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Paper, Stack, Typography } from '@mui/material';
import formatDate from 'date-fns/format';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { OrganizationChip } from '@respond/components/OrganizationChip';
import { OutputForm, OutputLink, OutputText, OutputTextArea, OutputTime } from '@respond/components/OutputForm';
import { STATUS_TEXT } from '@respond/components/StatusChip';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector, getActivityStatus, isActive } from '@respond/lib/client/store/activities';
import { ActivityActions } from '@respond/lib/state';
import { isActive as isParticpantActive, isCheckedIn as isParticpantCheckedIn, Participant, ParticipantStatus, ParticipatingOrg } from '@respond/types/activity';

function getStatusColor(status: ParticipantStatus) {
  switch (status) {
    case ParticipantStatus.SignedIn:
    case ParticipantStatus.Available:
    case ParticipantStatus.Assigned:
      return 'green';

    case ParticipantStatus.Standby:
      return 'orange';

    case ParticipantStatus.Demobilized:
      return 'darkred';

    case ParticipantStatus.Remote:
      return 'turquoise';

    default:
      return '';
  }
}

function formatStatusTime(time: number) {
  const isToday = new Date().setHours(0, 0, 0, 0) === new Date(time).setHours(0, 0, 0, 0);
  return `${!isToday ? formatDate(time, 'yyyy-MM-dd ') : ''}${formatDate(time, 'HHmm')}`;
}

function Tag({ tag }: { tag: string }) {
  return <Chip size="small" sx={{ mr: 1 }} label={tag} />;
}

function ResponderCard({ participant, org }: { participant: Participant; org: ParticipatingOrg }) {
  const name = `${participant.lastname}, ${participant.firstname}`;
  const orgName = org?.rosterName ?? org?.title;
  const status = participant.timeline[0].status;
  const statusTime = participant.timeline[0].time;
  const tags = participant.tags;

  return (
    <Stack direction="row" sx={{ borderColor: 'grey.200', padding: 1 }} borderBottom={1}>
      <Box minWidth="10px" sx={{ mr: 1, bgcolor: getStatusColor(status) }}></Box>
      <Stack direction="column" sx={{ flexGrow: 1 }}>
        <Stack direction="row" sx={{ mb: 1 }}>
          <Typography sx={{ flexGrow: 1, flexShrink: 1, mr: 1 }}>{name}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>{tags?.map((t, index) => <Tag key={index} tag={t} />)}</Box>
        </Stack>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Chip size="small" sx={{ mr: 1 }} label={orgName} />
          <Box fontSize={13}>
            <Typography fontSize="inherit" fontStyle="italic" display="inline">
              {STATUS_TEXT[status]}
            </Typography>{' '}
            at {formatStatusTime(statusTime)}
          </Box>
        </Stack>
      </Stack>
    </Stack>
  );
}

function Roster({ participants, orgs }: { participants: Record<string, Participant>; orgs: Record<string, ParticipatingOrg> }) {
  return (
    <Stack direction="column">
      {Object.values(participants)
        .filter((f) => f.timeline[0].status !== ParticipantStatus.NotResponding)
        .map((p) => (
          <ResponderCard key={p.id} participant={p} org={orgs[p.organizationId]} />
        ))}
    </Stack>
  );
}

export const ActivityPage = ({ activityId }: { activityId: string }) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const activity = useAppSelector(buildActivitySelector(activityId));

  const [promptingRemove, setPromptingRemove] = useState<boolean>(false);
  const [promptingActivityState, setPromptingActivityState] = useState<boolean>(false);

  useEffect(() => {
    document.title = `${activity?.idNumber} ${activity?.title}`;
  }, [activity]);

  const org = useAppSelector((state) => state.organization.mine);
  const user = useAppSelector((state) => state.auth.userInfo);
  const myParticipation = activity?.participants[user?.userId ?? ''];

  const reduceActive = (count: number, participant: Participant) => {
    return count + (isParticpantActive(participant?.timeline[0].status) ? 1 : 0);
  };

  const reduceStandby = (count: number, participant: Participant) => {
    return count + (participant?.timeline[0].status === ParticipantStatus.Standby ? 1 : 0);
  };

  const reduceSignedIn = (count: number, participant: Participant) => {
    return count + (participant?.timeline[0].status === ParticipantStatus.SignedIn ? 1 : 0);
  };

  const reduceCheckedIn = (count: number, participant: Participant) => {
    return count + (isParticpantCheckedIn(participant?.timeline[0].status) ? 1 : 0);
  };

  let body;
  if (!org) {
    body = <div>Loading org...</div>;
  }
  if (!activity) {
    body = <Alert severity="error">Activity not found</Alert>;
  } else {
    const isActivityActive = isActive(activity);
    body = (
      <Paper sx={{ p: 2, mb: 4 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="start" sx={{ mb: 2 }}>
          <Typography variant="h4" flexGrow={1}>
            {activity.title}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="outlined" size="small" component={Link} href={`/${activity.isMission ? 'mission' : 'event'}/${activityId}/edit`}>
              Edit
            </Button>
            <Button variant="outlined" size="small" onClick={() => setPromptingActivityState(true)}>
              {isActivityActive ? 'Complete' : 'Reactivate'}
            </Button>
            <IconButton color="danger" onClick={() => setPromptingRemove(true)}>
              <DeleteIcon />
            </IconButton>
          </Stack>
        </Stack>

        <OutputForm>
          <Box>
            <OutputText label="Location" value={activity.location.title} />
            <OutputText label="State #" value={activity.idNumber} />
            <OutputText label="Agency" value={activity.organizations[activity.ownerOrgId]?.title} />
            <OutputLink label="Map" value={activity.mapId} href={`https://sartopo.com/m/${activity.mapId}`} />
          </Box>
          <Box>
            <OutputText label="Mission Status" value={getActivityStatus(activity)} />
            <OutputText label="Active Responders" value={Object.values(activity.participants).reduce(reduceActive, 0).toString()}></OutputText>
            <OutputText label="Standby" value={Object.values(activity.participants).reduce(reduceStandby, 0).toString()}></OutputText>
            <OutputText label="Responding" value={Object.values(activity.participants).reduce(reduceSignedIn, 0).toString()}></OutputText>
            <OutputText label="Checked-In" value={Object.values(activity.participants).reduce(reduceCheckedIn, 0).toString()}></OutputText>
            <OutputTime label="Start Time" time={activity.startTime}></OutputTime>
            <OutputTime label="End Time" time={activity.endTime}></OutputTime>
          </Box>
        </OutputForm>
        <OutputTextArea label="Description" value={activity.description} rows={3}></OutputTextArea>

        <Box sx={{ my: 2 }}>{isActivityActive && <StatusUpdater activity={activity} current={myParticipation?.timeline[0].status} />}</Box>

        <Box>
          <Typography>Participating Organizations:</Typography>
          <Box sx={{ my: 2 }}>
            {Object.entries(activity.organizations ?? {}).map(([id, org]) => (
              <OrganizationChip key={id} org={org} activity={activity} />
            ))}
          </Box>
        </Box>

        <Box>
          <Typography>Roster:</Typography>
          <Roster participants={activity.participants} orgs={activity.organizations} />
        </Box>

        <Dialog open={promptingRemove} onClose={() => setPromptingRemove(false)}>
          <DialogTitle>Remove Activity?</DialogTitle>
          <DialogContent>
            <DialogContentText>Mark this activity as deleted? Any data it contains will stop contributing to report totals.</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPromptingRemove(false)}>Cancel</Button>
            <Button
              autoFocus
              color="danger"
              onClick={() => {
                dispatch(ActivityActions.remove(activity.id));
                router.replace('/');
              }}
            >
              Remove
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={promptingActivityState} onClose={() => setPromptingActivityState(false)}>
          <DialogTitle>{isActivityActive ? 'Complete' : 'Reactivate'} event?</DialogTitle>
          <DialogContent>
            <DialogContentText>Only perform this action if you are authorized to do so.</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPromptingActivityState(false)}>Cancel</Button>
            <Button
              autoFocus
              onClick={() => {
                dispatch(isActivityActive ? ActivityActions.complete(activity.id, new Date().getTime()) : ActivityActions.reactivate(activity.id));
                setPromptingActivityState(false);
              }}
            >
              {isActivityActive ? 'Complete' : 'Reactivate'}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    );
  }

  const breadcrumbText = `${activity?.isMission ? 'Mission' : 'Event'} Details`;

  return (
    <Box>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <Link href="/">Home</Link>
        <Typography color="text.primary">{breadcrumbText}</Typography>
      </Breadcrumbs>
      {body}
    </Box>
  );
};
