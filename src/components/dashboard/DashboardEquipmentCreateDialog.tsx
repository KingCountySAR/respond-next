import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';

type FormValues = {
  name: string;
};

export function DashboardEquipmentCreateDialog({ onSave, onCancel }: { onSave: (name: string) => void; onCancel: () => void }) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: '' },
    mode: 'onSubmit',
  });

  const onSubmit = ({ name }: FormValues) => {
    onSave(name.trim());
  };

  return (
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
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
        <Button onClick={onCancel} color="primary">
          Cancel
        </Button>
        <Button onClick={handleSubmit(onSubmit)} color="primary" variant="contained">
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
