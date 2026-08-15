import { Box, Button, FormControlLabel, Stack, Switch, TextField } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { useEffect, useRef } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';

import { useCommsCommands } from '@respond/lib/client/services/comms';
import { CommunicationsLogEntry } from '@respond/shared/types/operations';

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
  autoScroll?: boolean;
  onAutoScrollChange?: (enabled: boolean) => void;
};

export function DashboardCommsComposer({ entry, onSave, onCancel, autoScroll, onAutoScrollChange }: DashboardCommsComposerProps) {
  const comms = useCommsCommands();
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
      comms.updateComm(activity.id, entry.id, updates);
      onSave?.();
    } else {
      // No id/timestamp — the server stamps those when it mints CommLogged.
      comms.logComm(activity.id, { from: values.from, to: values.to, message: values.message });
      onSave?.();
    }

    reset({ from: '', to: '', message: '', timestamp: Date.now() });

    if (!entry) {
      fromRef.current?.focus();
    }
  };

  return (
    <Box sx={{ borderColor: 'divider', p: 0.5, mt: entry ? 0 : 0.5, flexShrink: 0 }}>
      <form onSubmit={handleSubmit(submit)}>
        <Stack spacing={1}>
          <Stack direction={{ xl: 'row' }} sx={{ alignItems: { xs: 'stretch', xl: 'center' }, gap: 2 }}>
            <TextField label="From" size="small" inputRef={fromRef} {...register('from')} />
            <TextField label="To" size="small" {...register('to')} />
            {entry && (
              <Controller
                name="timestamp"
                control={control}
                render={({ field }) => (
                  <DateTimePicker
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
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            {!entry && onAutoScrollChange && (
              <FormControlLabel control={<Switch size="small" checked={autoScroll ?? true} onChange={(event) => onAutoScrollChange(event.target.checked)} sx={{ ml: 0.5 }} />} label="Auto-scroll" />
            )}
            <Stack direction="row" spacing={1} sx={{ ml: 'auto', alignItems: 'center' }}>
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
        </Stack>
      </form>
    </Box>
  );
}
