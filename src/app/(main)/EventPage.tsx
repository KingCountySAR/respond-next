import { useEffect, useState } from "react";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Box, Breadcrumbs, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, List, ListItem, ListItemText, Stack, Typography } from "@mui/material"; 

import DeleteIcon from "@mui/icons-material/Delete";
import { RelativeTimeText } from "@respond/components/RelativeTimeText";
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { ActivityActions, buildActivitySelector } from '@respond/lib/client/store/activities';
import { OrganizationStatus } from '@respond/types/activity';

export const EventPage = ({ eventId }: { eventId: string }) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const activity = useAppSelector(buildActivitySelector(eventId));

  const [promptingRemove, setPromptingRemove ] = useState<boolean>(false);
  const [ nowTime, setNowTime ] = useState<number>(new Date().getTime());

  useEffect(() => {
    document.title = `${activity?.idNumber} ${activity?.title}`;
    const interval = setInterval(() => setNowTime(new Date().getTime()), 5000);
    return () => {
      clearInterval(interval);
    }
  }, [activity]);

  const org = useAppSelector(state => state.organization.mine);

  let body;
  if (!org) {
    body = (<div>Loading org...</div>);
  }  if (!activity) {
    body = (<Alert severity="error">Activity not found</Alert>);
  } else {
    body = (
      <Box>
        <Typography variant="h4">{activity.title}</Typography>
        <Box>Location: {activity.location.title}</Box>
        <Box>State #: {activity.idNumber}</Box>
        {activity.ownerOrgId !== org?.id && <Box>Agency: {activity.organizations[activity.ownerOrgId]?.title}</Box>}
        <Box>Start Time: <RelativeTimeText time={activity.startTime} baseTime={nowTime}/></Box>

        <Stack direction="row" spacing={1} sx={{mt:2, mb:2}}>
          <Button variant="outlined" size="small" component={Link} href={`/${activity.isMission ? 'mission' : 'event'}/${eventId}/edit`}>Edit</Button>
          <IconButton color="danger" onClick={() => setPromptingRemove(true)}><DeleteIcon/></IconButton>
        </Stack>

        <Box>
          <Typography>Participating Organizations:</Typography>
          <List>
          {Object.entries(activity.organizations ?? {}).map(([id, org]) => (
            <ListItem key={id}>
              <ListItemText
                primary={org.rosterName ?? org.title}
                secondary={<>{`${OrganizationStatus[org.timeline[0]?.status]} as of`} <RelativeTimeText time={org.timeline[0]?.time ?? 0} baseTime={nowTime} lowercase={true} /></>}
              />
            </ListItem>
          ))}
          </List>
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
      </Box>
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
