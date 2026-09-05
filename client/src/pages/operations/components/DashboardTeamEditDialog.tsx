import { Button, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { AppDialog } from '@respond/components/DialogProvider/AppDialog';
import { useTeamCommands } from '@respond/lib/client/services/teams';
import { Activity } from '@respond/shared/types/activity';
import { SarGar, Team } from '@respond/shared/types/operations';

import { MuiDialogProps, useDialogs } from '@/client/components/DialogProvider';
import { Stack } from '@/client/components/Material';

import { RemoveTeamDialog } from './RemoveTeamDialog';

interface DashboardTeamEditDialogProps extends MuiDialogProps<Team | null> {
  team: Team | null;
  activity: Activity;
}

type FormValues = {
  name: string;
  gar: SarGar;
  assignment: string;
  notes: string;
};

export function validateTeamName(teams: Team[], currentTeamId: string, name: string): { isValid: boolean; error?: string } {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { isValid: false, error: 'Team name is required.' };
  }

  const hasDuplicate = teams.some((team) => team.id !== currentTeamId && team.name.trim().toLowerCase() === trimmedName.toLowerCase());

  if (hasDuplicate) {
    return { isValid: false, error: 'Team name already exists.' };
  }

  return { isValid: true };
}

export function DashboardTeamEditDialog({ team, activity, onClose }: DashboardTeamEditDialogProps) {
  const teamCommands = useTeamCommands();
  const { open, confirm } = useDialogs();

  const teams = activity.teams ?? [];

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    // Use `values` instead of `defaultValues` to keep the form synced when `team` changes or finishes loading
    values: {
      name: team?.name ?? '',
      gar: team?.gar ?? 'green',
      assignment: team?.assignment ?? '',
      notes: team?.notes ?? '',
    },
  });

  useEffect(() => {
    reset({
      name: team?.name ?? '',
      gar: team?.gar ?? 'green',
      assignment: team?.assignment ?? '',
      notes: team?.notes ?? '',
    });
  }, [team, reset]);

  const handleSave = (data: FormValues) => {
    // Safety check in case the form is somehow submitted while team is undefined
    if (!team) return;

    const validation = validateTeamName(teams, team.id, data.name);

    if (!validation.isValid) {
      setError('name', {
        type: 'manual',
        message: validation.error ?? 'Please enter a team name.',
      });
      return;
    }

    onClose({
      ...team,
      name: data.name.trim(),
      gar: data.gar,
      assignment: data.assignment?.trim(),
      notes: data.notes?.trim(),
    });
  };

  // Prevent rendering dialog contents if team is null/undefined
  if (!team) return null;

  // Close this dialog first so it isn't stacked behind the disband/delete
  // dialog, then run the same reassignment flow DashboardTeamStatusSelect
  // uses for disbanding. onClose() pops browser history to dismiss this
  // dialog, but that pop only reaches DialogProvider's popstate handler
  // asynchronously; opening the next dialog synchronously right after would
  // push a new history entry first, so the pending pop then closes *that*
  // one instead. Yielding a tick first lets the pop land before we push.
  const deleteTeam = async () => {
    onClose(null);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const isInBase = team.status === 'In Base';
    const hasResources = team.assignedParticipants.length + team.assignedEquipment.length > 0;
    if (isInBase || !hasResources) {
      // Nothing to reassign, so a lightweight confirm is enough — no need for
      // the disband/delete dialog's reassignment options.
      const confirmed = await confirm({ prompt: `Delete ${team.name}?`, destructive: true, label: 'Delete' });
      if (!confirmed) return;
      teamCommands.deleteTeam(activity.id, team.id, undefined);
      return;
    }

    const result = await open(RemoveTeamDialog, { activity, team, action: 'Delete' });
    if (!result) return;
    teamCommands.deleteTeam(activity.id, team.id, result.target);
  };

  return (
    <>
      <AppDialog fullWidth={true} open={Boolean(team)} onClose={onClose}>
        <DialogTitle>Edit Team</DialogTitle>

        <form onSubmit={handleSubmit(handleSave)}>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField autoFocus label="Team name" fullWidth {...register('name')} error={Boolean(errors.name)} helperText={errors.name?.message ?? 'Choose a unique name for this team.'} />
              <Controller
                name="gar"
                control={control}
                defaultValue={team?.gar ?? 'green'}
                render={({ field }) => (
                  <TextField label="GAR" select fullWidth {...field}>
                    <MenuItem value="green">Green</MenuItem>
                    <MenuItem value="amber">Amber</MenuItem>
                    <MenuItem value="red">Red</MenuItem>
                  </TextField>
                )}
              />
              <TextField label="Assignment" fullWidth {...register('assignment')} />
              <TextField label="Notes" fullWidth multiline minRows={3} {...register('notes')} />
            </Stack>
          </DialogContent>

          <DialogActions sx={{ justifyContent: 'space-between' }}>
            <Button color="error" onClick={deleteTeam}>
              Delete
            </Button>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => onClose(null)}>Cancel</Button>
              <Button type="submit" variant="contained">
                Save
              </Button>
            </Stack>
          </DialogActions>
        </form>
      </AppDialog>
    </>
  );
}
