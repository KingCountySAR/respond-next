import { Button, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { SarGar, Team } from '../../types/operations';
import DialogWithHistory from '../DialogWithHistory';
import { Stack } from '../Material';

type DashboardTeamEditDialogProps = {
  team: Team | null;
  teams: Team[];
  onSave: (team: Team) => void;
  onClose: () => void;
};

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

export function DashboardTeamEditDialog({ team, teams, onSave, onClose }: DashboardTeamEditDialogProps) {
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

    onSave({
      ...team,
      name: data.name.trim(),
      gar: data.gar,
      assignment: data.assignment?.trim(),
      notes: data.notes?.trim(),
    });
  };

  // Prevent rendering dialog contents if team is null/undefined
  if (!team) return null;

  return (
    <DialogWithHistory fullWidth={true} open={Boolean(team)} onClose={onClose}>
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
