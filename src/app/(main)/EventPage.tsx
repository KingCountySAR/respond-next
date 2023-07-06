import { Alert, Box, Breadcrumbs, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Paper, Stack, Typography } from "@mui/material";
import formatDate from 'date-fns/format';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";

import DeleteIcon from "@mui/icons-material/Delete";
import { DataGrid, GridColDef, GridEventListener, GridRowsProp } from '@mui/x-data-grid';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector, isActive, getActivityStatus, isComplete, isOpen, isPending, isStarted } from '@respond/lib/client/store/activities';
import { ActivityActions } from '@respond/lib/state';
import { Participant, ParticipatingOrg, ResponderStatus, Activity } from '@respond/types/activity';

import { OutputForm, OutputLink, OutputText, OutputTextArea, OutputTime } from '@respond/components/OutputForm';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import styles from './EventPage.module.css';
import { STATUS_TEXT } from './StatusChip';
import { OrganizationChip } from './OrganizationChip';
import { reduceActive, reduceCheckedIn, reduceDemobilized, reduceSignedIn, reduceStandby } from '@respond/types/participant';
import ActivityTabs from '@respond/components/ActivityTabs';

export const Roster = ({participants, orgs, startTime}: {participants: Record<string, Participant>, orgs: Record<string, ParticipatingOrg>, startTime: number }) => {
  const handleRowClick: GridEventListener<'rowClick'> = (
    params, // GridRowParams
    event, // MuiEvent<React.MouseEvent<HTMLElement>>
    details, // GridCallbackDetails
  ) => {
    console.log('handle row click');
  };
  

  const rows: GridRowsProp = Object.values(participants).filter(f => f.timeline[0].status !== ResponderStatus.NotResponding).map(f => ({
    ...f,
    orgName: orgs[f.organizationId]?.rosterName ?? orgs[f.organizationId]?.title,
    fullName: f.lastname + ", " + f.firstname,
    statusColor: f.timeline[0].status,
    statusDescription: STATUS_TEXT[f.timeline[0].status],
    time: f.timeline[0].time,
  }));
  
  const columns: GridColDef[] = [
    { field: 'statusColor', headerName: '', width: 10, minWidth:15, valueFormatter: () => '', disableColumnMenu: true,
      cellClassName: ({value}: { value?: ResponderStatus}) => `roster-status roster-status-${ResponderStatus[value!]}`},
    { field: 'fullName', headerName: 'Name', minWidth:15, flex: 1, cellClassName: styles.rosterNameCell },
    { field: 'orgName', headerName: 'Org', flex: 1, renderCell: o => {
      return <div>
        <div>{o.value}</div>
        <div style={{fontSize: '80%'}}>{o.row.tags?.join(', ')}</div>
      </div>
    } },
    { field: 'statusDescription', headerName: 'Status', minWidth:15, flex: 1},
    { field: 'time', headerName: 'Time', valueFormatter: o => {
      const isToday = new Date().setHours(0,0,0,0) === new Date(o.value).setHours(0,0,0,0);
      return `${!isToday ? formatDate(o.value, 'yyyy-MM-dd ') : ''}${formatDate(o.value, 'HHmm')}`;
    }, flex: 1 },
  ];

  return (
    <DataGrid
      className={styles.roster}
      rows={rows}
      columns={columns}
      autoHeight
      disableRowSelectionOnClick
      hideFooter
      rowSelection={false}
      onRowClick={handleRowClick}
      getRowHeight={() => 'auto'}
    />
  )
}

const activityUpdateOptions = {
  complete: { label: 'Complete', callback: (activity: Activity) => ActivityActions.complete(activity.id, new Date().getTime()) },
  close: { label: 'Close', callback: (activity: Activity) => ActivityActions.closed(activity.id, new Date().getTime()) },
  reactivate: { label: 'Reactivate', callback: (activity: Activity) => ActivityActions.reactivate(activity.id) }
};

const getActivityUpdateOption = (activity: Activity) => {
  if (!isActive(activity)) { return activityUpdateOptions.reactivate; }
  if (isComplete(activity)) { return activityUpdateOptions.close; }
  return activityUpdateOptions.complete;
}

const ActivityStatusUpdater = ({activity}: {activity: Activity}) => {

  const dispatch = useAppDispatch();
  const action = getActivityUpdateOption(activity);
  const [promptingActivityState, setPromptingActivityState] = useState<boolean>(false);

  return (
    <>
      <Button variant="outlined" size="small" onClick={() => setPromptingActivityState(true)}>{action.label}</Button>

      <Dialog open={promptingActivityState} onClose={() => setPromptingActivityState(false)}>
        <DialogTitle>{action.label} event?</DialogTitle>
        <DialogContent>
          <DialogContentText>Only perform this action if you are authorized to do so.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromptingActivityState(false)}>Cancel</Button>
          <Button autoFocus onClick={() => {
            dispatch(action.callback(activity));
            setPromptingActivityState(false);
            }}>{action.label}</Button>
        </DialogActions>
      </Dialog>
    </>
  );

}

const ActivityStatusSummaryFields = ({activity}:{activity: Activity}) => {
  const participants = Object.values(activity.participants);

  if (isComplete(activity)) {
    return (
      <>
        <OutputText label="Demobilized" value={participants.reduce(reduceDemobilized, 0).toString()} />
        <OutputText label="Active" value={participants.reduce(reduceActive, 0).toString()} />
      </>
    )
  }

  if (isOpen(activity) || isStarted(activity)) {
    return (
      <>
        <OutputText label="Responding" value={participants.reduce(reduceSignedIn, 0).toString()} />
        <OutputText label="Checked-In" value={participants.reduce(reduceCheckedIn, 0).toString()} />
      </>
    )
  }

  if (isPending(activity)) {
    return (
      <>
        <OutputTime label="Start Time" time={activity.startTime} />
        <OutputText label="Standby" value={participants.reduce(reduceStandby, 0).toString()} />
      </>
    )
  }

  return <></>;
}

export const EventPage = ({ eventId }: { eventId: string }) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const activity = useAppSelector(buildActivitySelector(eventId));

  const [promptingRemove, setPromptingRemove ] = useState<boolean>(false);

  useEffect(() => {
    document.title = `${activity?.idNumber} ${activity?.title}`;
  }, [activity]);

  const org = useAppSelector(state => state.organization.mine);
  const user = useAppSelector(state => state.auth.userInfo);
  const myParticipation = activity?.participants[user?.userId ?? ''];

  let body;
  if (!org) {
    body = (<div>Loading org...</div>);
  }  if (!activity) {
    body = (<Alert severity="error">Activity not found</Alert>);
  } else {
    const isActivityActive = isActive(activity)
    body = (
      <Paper sx={{ p: 2, mb: 4 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="start" sx={{ mb:2}}>
          <Typography variant="h4" flexGrow={1}>{activity.title}</Typography>
          
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="outlined" size="small" component={Link} href={`/${activity.isMission ? 'mission' : 'event'}/${eventId}/edit`}>Edit</Button>
            <ActivityStatusUpdater activity={activity} />
            <IconButton color="danger" onClick={() => setPromptingRemove(true)}><DeleteIcon/></IconButton>
          </Stack>
        </Stack>

        <OutputForm>
          <Box>
            <OutputText label="Location" value={activity.location.title} />
            <OutputText label="State #" value={activity.idNumber} />
            <OutputLink label="Map" value={activity.mapId} href={`https://sartopo.com/m/${activity.mapId}`} />
          </Box>
          <Box>
            <OutputText label="Mission Status" value={getActivityStatus(activity)} />
            <ActivityStatusSummaryFields activity={activity} />
          </Box>
        </OutputForm>

        {activity.description && <OutputTextArea label="Description" value={activity.description} rows={1}></OutputTextArea>}

        <Stack flexDirection={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'start', sm: 'center' }} spacing={{ xs: 2, sm: 0 }} justifyContent={{ xs: 'start', sm: 'space-between' }} sx={{ py: 2 }}>
          <Box>
            {Object.entries(activity.organizations ?? {}).map(([id, org]) => <OrganizationChip key={id} org={org} activity={activity} />)}
          </Box>
          {isActivityActive && <StatusUpdater activity={activity} current={myParticipation?.timeline[0].status} />}
        </Stack>

        <ActivityTabs activity={activity} />

        <Dialog open={promptingRemove} onClose={() => setPromptingRemove(false)}>
          <DialogTitle>Remove Event?</DialogTitle>
          <DialogContent>
            <DialogContentText>Mark this event as deleted? Any data it contains will stop contributing to report totals.</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPromptingRemove(false)}>Cancel</Button>
            <Button autoFocus color="danger" onClick={() => {
              dispatch(ActivityActions.remove(activity.id));
              router.replace('/');
             }}>Remove</Button>
          </DialogActions>
        </Dialog>

      </Paper>
    )
  }

  const breadcrumbText = `${activity?.isMission ? 'Mission' : 'Event'} Details`;

  return (
    <Box>
      <Breadcrumbs aria-label="breadcrumb" sx={{mb: 2}}>
        <Link href="/">
          Home
        </Link>
        <Typography color="text.primary">{breadcrumbText}</Typography>
      </Breadcrumbs>
      {body}
    </Box>
   );
};
