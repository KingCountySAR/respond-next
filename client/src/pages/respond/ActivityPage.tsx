import DeleteIcon from '@mui/icons-material/Delete';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'wouter';

import { useUserDomainModel } from '@respond/components/AppDomainProvider';
import { useDialogs } from '@respond/components/DialogProvider';
import { Button, IconButton, Stack } from '@respond/components/Material';

import { ActivityViewModel } from '@/client/pages/respond/activityViewModel';
import { ActivityDomainModelProvider, useActivityDomainModel } from '@/client/pages/respond/components/ActivityDomainModelProvider';

import { DesktopActivityPage } from './DesktopActivityPage';
import { MobileActivityPage } from './MobileActivityPage';

export const ActivityPage = () => (
  <ActivityDomainModelProvider>
    <ActivityPageContent />
  </ActivityDomainModelProvider>
);

const ActivityPageContent = observer(function ActivityPageContent() {
  const domain = useActivityDomainModel();
  const user = useUserDomainModel();
  // Page-scoped view model over the shared domain model, drilled into the child
  // pages. Recreated (and its ephemeral UI state reset) only when the domain model
  // changes, i.e. on activity id change.
  const vm = useMemo(() => new ActivityViewModel(domain, user), [domain, user]);

  useEffect(() => {
    document.title = vm.numberAndTitle;
  }, [vm.numberAndTitle]);

  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  if (!vm.activityLoaded) return <div>Loading activity...</div>;

  return isMobile ? <MobileActivityPage activity={vm} /> : <DesktopActivityPage vm={vm} />;
});

export const ActivityActionsBar = observer(function ActivityActionsBar({ vm }: { vm: ActivityViewModel }) {
  const [, navigate] = useLocation();

  if (!vm.activityLoaded) return null;

  const handleRemove = async () => {
    // Wait for the ActivityRemoved event to land before leaving, so we don't
    // navigate to a list that hasn't yet dropped this activity.
    try {
      await vm.remove();
    } finally {
      navigate('/', { replace: true });
    }
  };

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <EditActivityButton disabled={vm.readOnly} href={`~${vm.url}/edit`} />
      <UpdateActivityStatusButton label={vm.isActive ? 'Complete' : 'Reactivate'} onClick={() => vm.toggleStatus()} />
      <RemoveActivityButton onClick={handleRemove} />
    </Stack>
  );
});

function EditActivityButton({ href, disabled }: { href: string; disabled?: boolean }) {
  return (
    <Button disabled={disabled} variant="outlined" size="small" component={Link} href={href}>
      Edit
    </Button>
  );
}

function UpdateActivityStatusButton({ label, onClick }: { label: string; onClick: () => void }) {
  const { confirm } = useDialogs();
  const handleClick = async () => {
    const confirmed = await confirm({
      title: `${label} event?`,
      prompt: 'Only perform this action if you are authorized to do so.',
      label,
    });
    if (confirmed) onClick();
  };
  return (
    <Button variant="outlined" size="small" onClick={handleClick}>
      {label}
    </Button>
  );
}

function RemoveActivityButton({ onClick }: { onClick: () => void }) {
  const { confirm } = useDialogs();
  const handleClick = async () => {
    const confirmed = await confirm({
      title: 'Remove Activity?',
      prompt: 'Mark this activity as deleted? Any data it contains will stop contributing to report totals.',
      destructive: true,
      label: 'Remove',
    });
    if (confirmed) onClick();
  };
  return (
    <IconButton color="danger" onClick={handleClick}>
      <DeleteIcon />
    </IconButton>
  );
}
