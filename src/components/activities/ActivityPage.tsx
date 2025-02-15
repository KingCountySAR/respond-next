import DeleteIcon from '@mui/icons-material/Delete';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Stack } from '@respond/components/Material';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector, isActive } from '@respond/lib/client/store/activities';
import { ActivityActions } from '@respond/lib/state';

import { ActivityProvider, useActivityContext } from './ActivityProvider';
import { DesktopActivityPage } from './DesktopActivityPage';
import { MobileActivityPage } from './MobileActivityPage';

export const ActivityPage = ({ activityId }: { activityId: string }) => {
  const activity = useAppSelector(buildActivitySelector(activityId));
  const org = useAppSelector((state) => state.organization.mine);

  useEffect(() => {
    document.title = `${activity?.idNumber} ${activity?.title}`;
  }, [activity?.idNumber, activity?.title]);

  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  if (!activity) return <Alert severity="error">Activity not found</Alert>;

  if (!org) return <div>Loading org...</div>;

  return <ActivityProvider activity={activity}>{isMobile ? <MobileActivityPage /> : <DesktopActivityPage />}</ActivityProvider>;
};

export function ActivityActionsBar() {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <EditActivityButton />
      <UpdateActivityStatusButton />
      <RemoveActivityButton />
    </Stack>
  );
}

function EditActivityButton() {
  const activity = useActivityContext();
  return (
    <Button variant="outlined" size="small" component={Link} href={`/${activity.isMission ? 'mission' : 'event'}/${activity.id}/edit`}>
      Edit
    </Button>
  );
}

function UpdateActivityStatusButton() {
  const activity = useActivityContext();
  const dispatch = useAppDispatch();

  const [showDialog, setShowDialog] = useState(false);

  const isActivityActive = isActive(activity);

  return (
    <>
      <Button variant="outlined" size="small" onClick={() => setShowDialog(true)}>
        {isActive(activity) ? 'Complete' : 'Reactivate'}
      </Button>
      <Dialog open={showDialog} onClose={() => setShowDialog(false)}>
        <DialogTitle>{isActivityActive ? 'Complete' : 'Reactivate'} event?</DialogTitle>
        <DialogContent>
          <DialogContentText>Only perform this action if you are authorized to do so.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>Cancel</Button>
          <Button
            autoFocus
            onClick={() => {
              dispatch(isActivityActive ? ActivityActions.complete(activity.id, new Date().getTime()) : ActivityActions.reactivate(activity.id));
              setShowDialog(false);
            }}
          >
            {isActivityActive ? 'Complete' : 'Reactivate'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function RemoveActivityButton() {
  const activity = useActivityContext();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <IconButton color="danger" onClick={() => setShowDialog(true)}>
        <DeleteIcon />
      </IconButton>
      <Dialog open={showDialog} onClose={() => setShowDialog(false)}>
        <DialogTitle>Remove Activity?</DialogTitle>
        <DialogContent>
          <DialogContentText>Mark this activity as deleted? Any data it contains will stop contributing to report totals.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>Cancel</Button>
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
    </>
  );
}
