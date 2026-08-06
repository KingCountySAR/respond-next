import DeleteIcon from '@mui/icons-material/Delete';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Link, useLocation } from 'wouter';
import { useEffect, useState } from 'react';

import { Button, DialogActions, DialogContent, DialogContentText, DialogTitle, DialogWithHistory, IconButton, Stack } from '@respond/components/Material';
import { useActivityCommands } from '@respond/lib/client/services/activity';
import { useAppSelector } from '@respond/lib/client/store';
import { isActive } from '@respond/lib/client/store/activities';

import { useActivityContext } from './ActivityProvider';
import { DesktopActivityPage } from './DesktopActivityPage';
import { MobileActivityPage } from './MobileActivityPage';

export const ActivityPage = () => {
  const activity = useActivityContext();
  const org = useAppSelector((state) => state.organization.mine);

  useEffect(() => {
    document.title = `${activity.idNumber} ${activity.title}`;
  }, [activity.idNumber, activity.title]);

  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  if (!org) return <div>Loading org...</div>;

  return isMobile ? <MobileActivityPage /> : <DesktopActivityPage />;
};

export function ActivityActionsBar() {
  const activityCommands = useActivityCommands();
  const [, navigate] = useLocation();
  const activity = useActivityContext();
  const isActivityActive = isActive(activity);

  const handleRemove = () => {
    activityCommands.remove(activity.id);
    navigate('/', { replace: true });
  };

  const toggleStatus = () => {
    if (isActivityActive) {
      activityCommands.complete(activity.id, new Date().getTime());
    } else {
      activityCommands.reactivate(activity.id);
    }
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
