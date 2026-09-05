import EditIcon from '@mui/icons-material/Edit';
import { Button, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import Linkify from 'linkify-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useDialogs } from '@respond/components/DialogProvider';
import { AppDialog } from '@respond/components/DialogProvider/AppDialog';
import { useActivityCommands } from '@respond/lib/client/services/activity';
import { Activity } from '@respond/shared/types/activity';

import { DashboardBoxWithTitle } from './DashboardBoxWithTitle';

export function DashboardActivityDescription({ activity }: { activity: Activity }) {
  const { open } = useDialogs();

  const editAction = {
    id: 'edit',
    icon: <EditIcon sx={{ fontSize: 16 }} />,
    onClick: () => open(DashboardActivityDescriptionEditDialog, { activity }),
  };

  return (
    <>
      <DashboardBoxWithTitle title={'Description'} actions={[editAction]} collapsible={activity.description?.trim() !== ''}>
        {activity.description && (
          <Typography variant="body2" color="text.secondary">
            <Linkify>{activity.description || 'No description provided.'}</Linkify>
          </Typography>
        )}
      </DashboardBoxWithTitle>
    </>
  );
}

function DashboardActivityDescriptionEditDialog({ open, onClose, activity }: { open: boolean; onClose: () => void; activity: Activity }) {
  const activityCommands = useActivityCommands();
  const { register, handleSubmit, reset } = useForm<{ description: string }>({
    values: { description: activity.description ?? '' },
  });

  useEffect(() => {
    reset({ description: activity.description ?? '' });
  }, [activity.description, reset]);

  const handleSave = ({ description }: { description: string }) => {
    activityCommands.update({ id: activity.id, description: description.trim() });
    onClose();
  };

  return (
    <AppDialog fullWidth open={open} onClose={onClose}>
      <DialogTitle>Edit Description</DialogTitle>
      <form onSubmit={handleSubmit(handleSave)}>
        <DialogContent>
          <TextField autoFocus label="Description" fullWidth multiline minRows={5} {...register('description')} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </form>
    </AppDialog>
  );
}
