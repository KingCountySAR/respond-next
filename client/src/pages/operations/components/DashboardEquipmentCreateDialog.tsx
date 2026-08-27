import { Button, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';

import { MuiDialogProps } from '@respond/components/DialogProvider';
import { AppDialog } from '@respond/components/DialogProvider/AppDialog';

type FormValues = {
  name: string;
};

export function DashboardEquipmentCreateDialog({ onClose }: MuiDialogProps<string>) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: '' },
    mode: 'onSubmit',
  });

  const onSubmit = ({ name }: FormValues) => {
    onClose(name.trim());
  };

  return (
    <AppDialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Custom Equipment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Name is required' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Equipment Name"
                fullWidth
                required
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSubmit(onSubmit)();
                  }
                }}
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(null)} color="primary">
          Cancel
        </Button>
        <Button onClick={handleSubmit(onSubmit)} color="primary" variant="contained">
          Add
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
