import { Button, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { AppDialog } from '@respond/components/DialogProvider/AppDialog';
import { usePlaceCommands } from '@respond/lib/client/services/places';
import { useTeamCommands } from '@respond/lib/client/services/teams';
import { Activity } from '@respond/shared/types/activity';
import { createNewPlace, DEFAULT_PLACES, SarGar, Team } from '@respond/shared/types/operations';

import { MuiDialogProps, useDialogs } from '@/client/components/DialogProvider';
import { Stack } from '@/client/components/Material';

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
  const places = usePlaceCommands();
  const { confirm } = useDialogs();

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

  const hasAssignedResources = team.assignedParticipants.length > 0 || team.assignedEquipment.length > 0;

  const deleteTeam = async () => {
    const confirmed = await confirm({
      prompt: hasAssignedResources ? `Deleting ${team.name} will move remaining members and equipment to ${DEFAULT_PLACES.field}. Continue?` : `Delete ${team.name}?`,
      destructive: true,
      label: 'Delete',
    });
    if (!confirmed) return;
    if (hasAssignedResources) reassignResources();
    teamCommands.deleteTeam(activity.id, team.id);
    onClose(null);
  };

  const reassignResources = () => {
    const fieldPlace = activity.places?.find((place) => place.name === DEFAULT_PLACES.field);
    const mergedParticipants = Array.from(new Set([...(fieldPlace?.assignedParticipants ?? []), ...team.assignedParticipants]));
    const existingEquipmentIds = new Set((fieldPlace?.assignedEquipment ?? []).map((item) => item.uuid));
    const mergedEquipment = [...(fieldPlace?.assignedEquipment ?? []), ...team.assignedEquipment.filter((item) => !existingEquipmentIds.has(item.uuid))];

    const updatedFieldPlace = fieldPlace
      ? { ...fieldPlace, assignedParticipants: mergedParticipants, assignedEquipment: mergedEquipment }
      : { ...createNewPlace(DEFAULT_PLACES.field), assignedParticipants: mergedParticipants, assignedEquipment: mergedEquipment };

    if (fieldPlace) {
      places.updatePlace(activity.id, updatedFieldPlace);
    } else {
      places.createPlace(activity.id, updatedFieldPlace);
    }
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
