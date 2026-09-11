import { Autocomplete, Button, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { Stack } from '@mui/system';
import { useEffect, useMemo } from 'react';
import { Controller, FieldErrors, Resolver, useForm } from 'react-hook-form';

import { MuiDialogProps } from '@respond/components/DialogProvider';
import { AppDialog } from '@respond/components/DialogProvider/AppDialog';
import { Activity } from '@respond/shared/types/activity';
import { Group } from '@respond/shared/types/operations';

interface DashboardGroupEditDialogProps extends MuiDialogProps<Group | null> {
  activity: Activity;
  group: Group | null;
}

type FormValues = Pick<Group, 'name'>;

const GROUP_NAME_OPTIONS = ['Rescue Group', 'Medical Group', 'Rigging Group', '4X4 Group'];

/**
 * Builds a resolver scoped to the current activity and group.
 */
const createResolver = (activity: Activity, groupId: string): Resolver<FormValues> => {
  return async (values) => {
    const normalizedValues: FormValues = {
      name: values.name?.trim() ?? '',
    };

    const errors: FieldErrors<FormValues> = {};

    if (!normalizedValues.name) {
      errors.name = { type: 'required', message: 'Name is required' };
    }

    const hasDuplicate = (activity.groups ?? []).some((group) => group.id !== groupId && group.name.trim().toLowerCase() === normalizedValues.name.toLowerCase());
    if (hasDuplicate) {
      errors.name = { type: 'duplicate', message: 'Group name already exists' };
    }

    if (Object.keys(errors).length > 0) {
      return { values: {}, errors } as unknown as ReturnType<Resolver<FormValues>>;
    }

    return { values: normalizedValues, errors: {} } as unknown as ReturnType<Resolver<FormValues>>;
  };
};

export function DashboardGroupEditDialog(props: DashboardGroupEditDialogProps) {
  const { activity, group, onClose, ...dialogProps } = props;
  const resolver = useMemo(() => createResolver(activity, group?.id ?? ''), [activity, group?.id]);
  const groupNameOptions = useMemo(() => {
    const existingNames = new Set((activity.groups ?? []).map((existingGroup) => existingGroup.name.trim().toLowerCase()));
    return GROUP_NAME_OPTIONS.filter((option) => !existingNames.has(option.toLowerCase()));
  }, [activity.groups]);
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver,
    // Use `values` instead of `defaultValues` to keep the form synced when `group` changes or finishes loading
    values: {
      name: group?.name ?? '',
    },
  });

  useEffect(() => {
    reset({
      name: group?.name ?? '',
    });
  }, [group, reset]);

  const handleSave = (data: FormValues) => {
    // Safety check in case the form is somehow submitted while group is undefined
    if (!group) return;
    onClose({
      ...group,
      name: data.name,
    });
  };

  // Prevent rendering dialog contents if group is null/undefined
  if (!group) return null;

  return (
    <AppDialog {...dialogProps} onClose={onClose} fullWidth>
      <DialogTitle>Edit Group</DialogTitle>
      <form onSubmit={handleSubmit(handleSave)}>
        <DialogContent>
          <Stack spacing={1}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  fullWidth
                  options={groupNameOptions}
                  inputValue={field.value}
                  onInputChange={(_, newInputValue) => field.onChange(newInputValue)}
                  renderInput={(params) => <TextField {...params} autoFocus label="Group Name" error={Boolean(errors.name)} helperText={errors.name?.message ?? 'Choose a unique name for this group.'} />}
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose(null)}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </form>
    </AppDialog>
  );
}
