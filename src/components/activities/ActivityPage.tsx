import DeleteIcon from '@mui/icons-material/Delete';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FunctionComponent, useEffect, useState } from 'react';

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Stack } from '@respond/components/Material';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector, isActive } from '@respond/lib/client/store/activities';
import { ActivityActions } from '@respond/lib/state';
import { Activity } from '@respond/types/activity';

import { ParticipantProvider } from '../participant/ParticipantProvider';

import { ActivityProvider, useActivityContext } from './ActivityProvider';
import { DesktopActivityPage } from './DesktopActivityPage';
import { MobileActivityPage } from './MobileActivityPage';

export const ActivityPage = ({ activityId }: { activityId: string }) => {
  const activity = useAppSelector(buildActivitySelector(activityId));

  useEffect(() => {
    document.title = `${activity?.idNumber} ${activity?.title}`;
  }, [activity?.idNumber, activity?.title]);

  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  if (!activity) return <Alert severity="error">Activity not found</Alert>;

  return <ActivityProvider activity={activity}>{isMobile ? <MobileActivityPage /> : <DesktopActivityPage />}</ActivityProvider>;
};

export interface ActivityContentProps {
  startRemove: () => void;
  startChangeState: () => void;
}

export function ActivityGuardPanel({ component: ContentComponent }: { component: FunctionComponent<ActivityContentProps> }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const activity = useActivityContext();
  const org = useAppSelector((state) => state.organization.mine);
  const user = useAppSelector((state) => state.auth.userInfo);

  const [promptingRemove, setPromptingRemove] = useState<boolean>(false);
  const [promptingActivityState, setPromptingActivityState] = useState<boolean>(false);

  if (!org) return <div>Loading org...</div>;

  const myParticipation = activity.participants[user?.participantId ?? ''];

  const isActivityActive = isActive(activity);
  return (
    <ParticipantProvider participant={myParticipation}>
      <ContentComponent startRemove={() => setPromptingRemove(true)} startChangeState={() => setPromptingActivityState(true)} />
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
    </ParticipantProvider>
  );
}

export function ActivityActionsBar({ activity, startChangeState, startRemove }: { activity: Activity; startChangeState: () => void; startRemove: () => void }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="outlined" size="small" component={Link} href={`/${activity.isMission ? 'mission' : 'event'}/${activity.id}/edit`}>
        Edit
      </Button>
      <Button variant="outlined" size="small" onClick={startChangeState}>
        {isActive(activity) ? 'Complete' : 'Reactivate'}
      </Button>
      <IconButton color="danger" onClick={startRemove}>
        <DeleteIcon />
      </IconButton>
    </Stack>
  );
}
