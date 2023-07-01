import { useEffect, useState } from "react";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Box, Breadcrumbs, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Paper, Stack, Typography } from "@mui/material"; 
import differenceInDays from 'date-fns/differenceInDays';
import formatDate from 'date-fns/format';

import DeleteIcon from "@mui/icons-material/Delete";
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector, isActive } from '@respond/lib/client/store/activities';
import { OrganizationStatus, Participant, ParticipatingOrg, ResponderStatus } from '@respond/types/activity';
import { ActivityActions } from '@respond/lib/state';
import { DataGrid, GridColDef, GridEventListener, GridRowsProp } from '@mui/x-data-grid';

import styles from './EventPage.module.css';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { OutputForm } from '@respond/components/OutputForm';
import { OutputField } from '@respond/components/OutputField';
import { OutputTime } from '@respond/components/OutputTime';

const Roster = ({participants, orgs, startTime}: {participants: Record<string, Participant>, orgs: Record<string, ParticipatingOrg>, startTime: number }) => {
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
    status: f.timeline[0].status,
    time: f.timeline[0].time,
  }));
  
  const columns: GridColDef[] = [
    { field: 'status', headerName: '', width: 10, minWidth:15, valueFormatter: () => '', disableColumnMenu: true,
      cellClassName: ({value}: { value?: ResponderStatus}) => `roster-status roster-status-${ResponderStatus[value!]}`},
    { field: 'lastname', headerName: 'Last Name', minWidth:15, flex: 1, cellClassName: styles.rosterNameCell },
    { field: 'firstname', headerName: 'First Name', minWidth: 15, flex: 1, cellClassName: styles.rosterNameCell },
    { field: 'orgName', headerName: 'Organization', flex: 1, renderCell: o => {
      return <div>
        <div>{o.value}</div>
        <div style={{fontSize: '80%'}}>{o.row.tags?.join(', ')}</div>
      </div>
    } },
    { field: 'time', headerName: 'Time', valueFormatter: o => {
      const dayDiff = differenceInDays(startTime, o.value);
      return `${dayDiff > 0 ? dayDiff + '+' : ''}${formatDate(o.value, 'HHmm')}`;
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
    />
  )
}

export const EventPage = ({ eventId }: { eventId: string }) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const activity = useAppSelector(buildActivitySelector(eventId));

  const [promptingRemove, setPromptingRemove ] = useState<boolean>(false);
  const [promptingActivityState, setPromptingActivityState] = useState<boolean>(false);

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
            <Button variant="outlined" size="small" onClick={() => setPromptingActivityState(true)}>{isActivityActive ? 'Complete' : 'Reactivate'}</Button>
            <IconButton color="danger" onClick={() => setPromptingRemove(true)}><DeleteIcon/></IconButton>
          </Stack>
        </Stack>

        <OutputForm>
          <Box>
            <OutputField label="Location" value={activity.location.title} />
            <OutputField label="State #" value={activity.idNumber} />
            <OutputField label="Agency" value={activity.organizations[activity.ownerOrgId]?.title} />
            <OutputField label="Map" value={activity.mapId} href={`https://sartopo.com/m/${activity.mapId}`} />
          </Box>
          <Box>
            <OutputField label="Status" value={isActivityActive ? 'In Progress' : 'Complete'} />
            <OutputTime label="Start Time" time={activity.startTime}></OutputTime>
            <OutputTime label="End Time" time={activity.endTime}></OutputTime>
          </Box>
        </OutputForm>

        <Box sx={{ my:2 }}>
          {isActivityActive && <StatusUpdater activity={activity} current={myParticipation?.timeline[0].status} />}
        </Box>

        <Box>
          <Typography>Participating Organizations:</Typography>
          <Box sx={{ mb: 2}}>
            {Object.entries(activity.organizations ?? {}).map(([id, org]) => {
              const status = org.timeline[0]?.status;
              const color = (status === OrganizationStatus.Responding) ? 'success' :
                            (status === OrganizationStatus.Standby) ? 'warning' : 'default';

              return (
                <Chip key={id} sx={{m: 1}} label={org.rosterName ?? org.title} color={color} variant="outlined" />
              );
            })}
          </Box>
        </Box>

        <Box>
          <Typography>Roster:</Typography>
          <Roster participants={activity.participants} orgs={activity.organizations} startTime={activity.startTime} />
        </Box>

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

        <Dialog open={promptingActivityState} onClose={() => setPromptingActivityState(false)}>
          <DialogTitle>{isActivityActive ? 'Complete' : 'Reactivate'} event?</DialogTitle>
          <DialogContent>
            <DialogContentText>Only perform this action if you are authorized to do so.</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPromptingActivityState(false)}>Cancel</Button>
            <Button autoFocus onClick={() => {
              dispatch(isActivityActive
                ? ActivityActions.complete(activity.id, new Date().getTime())
                : ActivityActions.reactivate(activity.id));
              setPromptingActivityState(false);
             }}>{isActivityActive ? 'Complete' : 'Reactivate'}</Button>
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
