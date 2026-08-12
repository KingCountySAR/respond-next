import { Box, Button, Stack, TextField } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { useEffect, useRef } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { CommunicationsLogEntry, createNewCommsEntry } from '@respond/types/operations';

import { useActivityContext } from '../activities/ActivityProvider';

type FormValues = {
  from: string;
  to: string;
  message: string;
  timestamp: number;
};

type DashboardCommsComposerProps = {
  entry?: CommunicationsLogEntry | null;
  onSave?: () => void;
  onCancel?: () => void;
};

export function DashboardCommsComposer({ entry, onSave, onCancel }: DashboardCommsComposerProps) {
  const dispatch = useAppDispatch();
  const activity = useActivityContext();
  const fromRef = useRef<HTMLInputElement | null>(null);

  const { register, handleSubmit, reset, formState, control } = useForm<FormValues>({
    defaultValues: {
      from: entry?.from ?? '',
      to: entry?.to ?? '',
      message: entry?.message ?? '',
      timestamp: entry?.timestamp ?? Date.now(),
    },
  });

  useEffect(() => {
    if (!entry) {
      fromRef.current?.focus();
    }
  }, [entry]);

  const submit: SubmitHandler<FormValues> = (values) => {
    if (entry && entry.id) {
      const updates: Partial<CommunicationsLogEntry> = {
        from: values.from,
        to: values.to,
        message: values.message,
        timestamp: values.timestamp,
        isAutomated: false, // Automated messages are toggled to false when edited
      };
      dispatch(ActivityActions.updateComm(activity.id, entry.id, updates));
      onSave?.();
    } else {
      const comm: CommunicationsLogEntry = createNewCommsEntry({
        from: values.from,
        to: values.to,
        message: values.message,
      });
      dispatch(ActivityActions.addComm(activity.id, comm));
      onSave?.();
    }

    reset({ from: '', to: '', message: '', timestamp: Date.now() });

    if (!entry) {
      fromRef.current?.focus();
    }
  };

  return (
    <Box sx={{ borderColor: 'divider', p: entry ? 2 : 1, mt: entry ? 0 : 2, flexShrink: 0 }}>
      <form onSubmit={handleSubmit(submit)}>
        <Stack spacing={2}>
          <Stack direction={{ xl: 'row' }} alignItems={{ xs: 'stretch', xl: 'center' }} gap={2}>
            <TextField label="From" size="small" inputRef={fromRef} {...register('from')} />
            <TextField label="To" size="small" {...register('to')} />
            {entry && (
              <Controller
                name="timestamp"
                control={control}
                render={({ field }) => (
                  <DateTimePicker<Date>
                    label="Time"
                    value={new Date(field.value)}
                    format="MM/dd/yyyy HH:mm"
                    onChange={(newValue) => {
                      if (newValue) {
                        field.onChange(newValue.getTime());
                      }
                    }}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                )}
              />
            )}
          </Stack>
          <TextField
            label="Message"
            size="small"
            multiline
            minRows={2}
            {...register('message', { required: true })}
            error={!!formState.errors.message}
            helperText={formState.errors.message ? 'Message is required' : ''}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(submit)();
              }
            }}
          />
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
            {entry && (
              <Button
                onClick={() => {
                  reset();
                  onCancel?.();
                }}
                size="small"
              >
                Cancel
              </Button>
            )}
            <Button type="submit" size="small" variant="contained">
              Save
            </Button>
          </Stack>
        </Stack>
      </form>
    </Box>
  );
}
