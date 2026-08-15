import EditIcon from '@mui/icons-material/Edit';
import { Button, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import Linkify from 'linkify-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useActivityCommands } from '@respond/lib/client/services/activity';
import { Activity } from '@respond/shared/types/activity';

import DialogWithHistory from '../DialogWithHistory';

import { DashboardBoxWithTitle } from './DashboardBoxWithTitle';

export function DashboardActivityDescription({ activity }: { activity: Activity }) {
  const [editing, setEditing] = useState(false);

  const editAction = {
    id: 'edit',
    icon: <EditIcon sx={{ fontSize: 16 }} />,
    onClick: () => setEditing(true),
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
      <DashboardActivityDescriptionEditDialog open={editing} onClose={() => setEditing(false)} activity={activity} />
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
    <DialogWithHistory fullWidth open={open} onClose={onClose}>
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
    </DialogWithHistory>
  );
}
