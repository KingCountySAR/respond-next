import DeleteIcon from '@mui/icons-material/Delete';
import { Button, IconButton, Stack } from '@mui/material';
import { Link, useLocation } from 'wouter';
import type { FieldActivity } from '@sync/model';
import { observer } from '@sync/model/react';
import { useDialogs } from '../../shell/dialogs';
import { activityPath } from '../../ui/paths';
import { useChange } from '../../ui/useChange';

export const ActivityActionsBar = observer(function ActivityActionsBar({ activity }: { activity: FieldActivity }) {
  const [, navigate] = useLocation();
  const change = useChange();
  const rec = activity.record;
  if (!rec) return null;

  const handleRemove = () => {
    if (change(() => activity.mutate('removeActivity', {}))) navigate('/', { replace: true });
  };

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <EditActivityButton href={`~${activityPath(activity)}/edit`} />
      <UpdateActivityStatusButton label={rec.closed ? 'Reactivate' : 'Complete'} onClick={() => change(() => activity.mutate(rec.closed ? 'reopenActivity' : 'closeActivity', {}))} />
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
