import DeleteIcon from '@mui/icons-material/Delete';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert, Button, DialogActions, DialogContent, DialogContentText, DialogTitle, DialogWithHistory, IconButton, Stack } from '@respond/components/Material';
import { apiFetch } from '@respond/lib/api';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector, isActive } from '@respond/lib/client/store/activities';
import { ActivityActions } from '@respond/lib/state';
import type { Activity } from '@respond/types/activity';

import { ActivityProvider, useActivityContext } from './ActivityProvider';
import { DesktopActivityPage } from './DesktopActivityPage';
import { MobileActivityPage } from './MobileActivityPage';

export const ActivityPage = ({ activityId }: { activityId: string }) => {
  const activity = useAppSelector(buildActivitySelector(activityId));
  const org = useAppSelector((state) => state.organization.mine);
  const [fetchedActivity, setFetchedActivity] = useState<Activity | null>();
  const displayActivity = activity ?? fetchedActivity;

  useEffect(() => {
    document.title = `${displayActivity?.idNumber} ${displayActivity?.title}`;
  }, [displayActivity?.idNumber, displayActivity?.title]);

  useEffect(() => {
    if (activity) return;

    let cancelled = false;
    setFetchedActivity(undefined);

    apiFetch<{ data?: Activity }>(`/api/v1/activities/${activityId}`)
      .then((response) => {
        if (!cancelled) setFetchedActivity(response.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setFetchedActivity(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activity, activityId]);

  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  if (displayActivity === undefined) return <Alert severity="info">Loading activity...</Alert>;
  if (displayActivity === null) return <Alert severity="error">Activity not found</Alert>;

  if (!org) return <div>Loading org...</div>;

  return <ActivityProvider activity={displayActivity}>{isMobile ? <MobileActivityPage /> : <DesktopActivityPage />}</ActivityProvider>;
};

export function ActivityActionsBar() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const activity = useActivityContext();
  const isActivityActive = isActive(activity);

  const handleRemove = () => {
    dispatch(ActivityActions.remove(activity.id));
    router.replace('/');
  };

  const toggleStatus = () => {
    dispatch(isActivityActive ? ActivityActions.complete(activity.id, new Date().getTime()) : ActivityActions.reactivate(activity.id));
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <EditActivityButton href={`/${activity.isMission ? 'mission' : 'event'}/${activity.id}/edit`} />
      <UpdateActivityStatusButton label={isActivityActive ? 'Complete' : 'Reactivate'} onClick={toggleStatus} />
      <RemoveActivityButton onClick={handleRemove} />
    </Stack>
  );
}

function EditActivityButton({ href }: { href: string }) {
  return (
    <Button variant="outlined" size="small" component={Link} href={href}>
      Edit
    </Button>
  );
}

function UpdateActivityStatusButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [showDialog, setShowDialog] = useState(false);
  return (
    <>
      <Button variant="outlined" size="small" onClick={() => setShowDialog(true)}>
        {label}
      </Button>
      <DialogWithHistory open={showDialog} onClose={() => setShowDialog(false)}>
        <DialogTitle>{label} event?</DialogTitle>
        <DialogContent>
          <DialogContentText>Only perform this action if you are authorized to do so.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>Cancel</Button>
          <Button
            autoFocus
            onClick={() => {
              onClick();
              setShowDialog(false);
            }}
          >
            {label}
          </Button>
        </DialogActions>
      </DialogWithHistory>
    </>
  );
}

function RemoveActivityButton({ onClick }: { onClick: () => void }) {
  const [showDialog, setShowDialog] = useState(false);
  return (
    <>
      <IconButton color="danger" onClick={() => setShowDialog(true)}>
        <DeleteIcon />
      </IconButton>
      <DialogWithHistory open={showDialog} onClose={() => setShowDialog(false)}>
        <DialogTitle>Remove Activity?</DialogTitle>
        <DialogContent>
          <DialogContentText>Mark this activity as deleted? Any data it contains will stop contributing to report totals.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>Cancel</Button>
          <Button autoFocus color="danger" onClick={onClick}>
            Remove
          </Button>
        </DialogActions>
      </DialogWithHistory>
    </>
  );
}
