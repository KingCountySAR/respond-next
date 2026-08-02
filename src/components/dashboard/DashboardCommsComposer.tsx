import { Box, Button, Stack, TextField } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useRef } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { v4 as uuid } from 'uuid';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { CommunicationsLogEntry } from '@respond/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';

type FormValues = {
  from: string;
  to: string;
  message: string;
};

export function DashboardCommsComposer({ entry, onSave, onCancel }: { entry?: CommunicationsLogEntry | null; onSave?: () => void; onCancel?: () => void }) {
  const dispatch = useAppDispatch();
  const activity = useActivityContext();
  const fromRef = useRef<HTMLInputElement | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: {
      from: entry?.from ?? '',
      to: entry?.to ?? '',
      message: entry?.message ?? '',
    },
  });

  useEffect(() => {
    if (!entry) {
      fromRef.current?.focus();
    }
  }, [entry]);

  const submit: SubmitHandler<FormValues> = (values) => {
    if (entry && entry.id) {
      // update existing comm: only send changed fields as updates
      const updates: Partial<CommunicationsLogEntry> = {
        from: values.from,
        to: values.to,
        message: values.message,
      };
      dispatch(ActivityActions.updateComm(activity.id, entry.id, updates));
      onSave?.();
    } else {
      const comm: CommunicationsLogEntry = {
        id: uuid(),
        from: values.from,
        to: values.to,
        message: values.message,
        timestamp: Date.now(),
        isAutomated: false,
        isDeleted: false,
      };
      dispatch(ActivityActions.addComm(activity.id, comm));
      onSave?.();
    }

    reset({ from: '', to: '', message: '' });

    if (!entry) {
      fromRef.current?.focus();
    }
  };

  return (
    <Box sx={{ borderColor: 'divider', p: entry ? 2 : 1, mt: entry ? 0 : 2, flexShrink: 0, bgcolor: entry ? (theme) => alpha(theme.palette.info.main, 0.08) : undefined }}>
      <form onSubmit={handleSubmit(submit)}>
        <Stack spacing={2}>
          <Stack direction={{ xl: 'row' }} alignItems={{ xs: 'stretch', xl: 'center' }} gap={2}>
            <TextField label="From" size="small" inputRef={fromRef} {...register('from')} />
            <TextField label="To" size="small" {...register('to')} />
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
